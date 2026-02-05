import Anthropic from "@anthropic-ai/sdk";
import { spawn } from "child_process";
import { mkdir, writeFile, readFile, rm, cp } from "fs/promises";
import { existsSync } from "fs";
import { join, dirname } from "path";
import { glob } from "glob";
import type {
  ExperimentConfig,
  EvalDefinition,
  RunResult,
  EvalResult,
  ExperimentResult,
  RunnerOptions,
  SkillDefinition,
  Usage,
} from "./types.js";
import { loadSkill, augmentPromptWithSkill } from "./skill-loader.js";
import { runAgentEval, copyStarterFiles } from "./agent-runner.js";

/**
 * Discover all evals in the evals directory
 */
export async function discoverEvals(
  evalsDir: string
): Promise<EvalDefinition[]> {
  const evalDirs = await glob("*/", { cwd: evalsDir });
  const evals: EvalDefinition[] = [];

  for (const evalDir of evalDirs) {
    const evalPath = join(evalsDir, evalDir);
    const promptPath = join(evalPath, "PROMPT.md");
    const evalFile = join(evalPath, "EVAL.ts");

    if (existsSync(promptPath) && existsSync(evalFile)) {
      const prompt = await readFile(promptPath, "utf-8");
      evals.push({
        name: evalDir.replace(/\/$/, ""),
        path: evalPath,
        prompt,
        evalFile,
      });
    }
  }

  return evals;
}

/**
 * Filter evals based on patterns
 */
export function filterEvals(
  evals: EvalDefinition[],
  patterns: string[]
): EvalDefinition[] {
  if (patterns.includes("*")) {
    return evals;
  }

  return evals.filter((evalDef) =>
    patterns.some((pattern) => {
      if (pattern.includes("*")) {
        const regex = new RegExp("^" + pattern.replace(/\*/g, ".*") + "$");
        return regex.test(evalDef.name);
      }
      return evalDef.name === pattern;
    })
  );
}

/**
 * Create a sandboxed workspace for an eval run
 */
async function createWorkspace(
  baseDir: string,
  runId: string
): Promise<string> {
  const workspaceDir = join(baseDir, ".workspaces", runId);
  await mkdir(workspaceDir, { recursive: true });
  return workspaceDir;
}

/**
 * Clean up a workspace
 */
async function cleanupWorkspace(workspaceDir: string): Promise<void> {
  try {
    await rm(workspaceDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
}

/**
 * Result from Claude API call including response text and usage
 */
interface ClaudeAPIResult {
  text: string;
  usage: Usage;
}

/**
 * Call Claude API to generate code
 */
async function callClaudeAPI(
  client: Anthropic,
  model: string,
  prompt: string,
  timeout: number
): Promise<ClaudeAPIResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout * 1000);

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
      system: `You are a code generation assistant. When asked to create files, respond with the file content wrapped in markdown code blocks with the filename as a comment at the top.

For example, if asked to create test.ts:

\`\`\`typescript
// test.ts
export function something(param1: string, param2: number): number {
  return param1.length + param2;
}
\`\`\`

Always create the exact files requested and ensure they are syntactically correct.`,
    });

    const textContent = response.content.find((block) => block.type === "text");
    const text = textContent?.type === "text" ? textContent.text : "";
    const usage: Usage = {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    };

    return { text, usage };
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * Parse generated files from Claude's response
 *
 * Handles nested code blocks in JSDoc @example comments by looking for
 * closing triple backticks that appear at the start of a line (not indented
 * or prefixed with JSDoc comment markers like " * ").
 */
function parseGeneratedFiles(response: string): Map<string, string> {
  const files = new Map<string, string>();

  // Match code blocks with optional language and filename comment
  // The closing ``` must be at the start of a line (possibly after whitespace only)
  // to avoid matching nested code blocks inside JSDoc comments (which have " * ```")
  const codeBlockRegex =
    /```(?:typescript|ts|javascript|js)?\n(?:\/\/\s*([^\n]+)\n)?([\s\S]*?)\n```(?=\s*\n|$)/g;
  let match;

  while ((match = codeBlockRegex.exec(response)) !== null) {
    const [, filename, content] = match;
    if (filename && content) {
      // Clean up the filename
      const cleanFilename = filename.trim().replace(/^\//, "");
      files.set(cleanFilename, content.trim());
    }
  }

  // If no files found with the standard pattern, try a more robust extraction
  if (files.size === 0) {
    // Use a custom parser that handles nested backticks properly
    const extractedFiles = extractCodeBlocksWithNestedBackticks(response);
    for (const [filename, content] of extractedFiles) {
      files.set(filename, content);
    }
  }

  return files;
}

/**
 * Extract code blocks handling nested backticks in JSDoc comments.
 *
 * This function manually parses the response to find top-level code blocks,
 * tracking nesting depth to avoid premature termination on nested backticks.
 */
function extractCodeBlocksWithNestedBackticks(
  response: string
): Map<string, string> {
  const files = new Map<string, string>();
  const lines = response.split("\n");

  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let filename: string | null = null;
  let nestingDepth = 0;

  for (const line of lines) {
    const trimmedLine = line.trim();

    if (!inCodeBlock) {
      // Check for start of a top-level code block (``` at start of line)
      const codeBlockStart = trimmedLine.match(
        /^```(typescript|ts|javascript|js)?$/
      );
      if (codeBlockStart && /^```/.test(line)) {
        inCodeBlock = true;
        codeBlockContent = [];
        filename = null;
        nestingDepth = 0;
        continue;
      }
    } else {
      // We're inside a code block

      // Check if this line is a filename comment (first line of content)
      if (
        codeBlockContent.length === 0 &&
        /^\/\/\s*.+\.(ts|js|tsx|jsx)$/.test(line)
      ) {
        filename = line.replace(/^\/\/\s*/, "").trim();
        continue;
      }

      // Track nested code blocks (those inside JSDoc comments have " * ```" pattern)
      if (/^\s*\*\s*```/.test(line) || /^\s+```/.test(line)) {
        // This is a nested code block marker (indented or in JSDoc)
        // Toggle nesting - if we see ``` in JSDoc context, track it
        if (line.includes("```") && !/^```/.test(line)) {
          // Simple toggle: each ``` either opens or closes a nested block
          nestingDepth = nestingDepth > 0 ? 0 : 1;
        }
        codeBlockContent.push(line);
        continue;
      }

      // Check for end of top-level code block (``` at start of line, not nested)
      if (trimmedLine === "```" && /^```/.test(line) && nestingDepth === 0) {
        // End of code block
        if (filename && codeBlockContent.length > 0) {
          const cleanFilename = filename.replace(/^\//, "");
          files.set(cleanFilename, codeBlockContent.join("\n").trim());
        }
        // If no filename comment is found, skip this code block
        // The model should follow instructions and include the filename
        inCodeBlock = false;
        continue;
      }

      // Regular line inside code block
      codeBlockContent.push(line);
    }
  }

  return files;
}

/**
 * Write generated files to workspace
 */
async function writeGeneratedFiles(
  workspaceDir: string,
  files: Map<string, string>
): Promise<string[]> {
  const writtenFiles: string[] = [];

  for (const [filename, content] of files) {
    const filePath = join(workspaceDir, filename);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, content, "utf-8");
    writtenFiles.push(filename);
  }

  return writtenFiles;
}

/**
 * Run vitest on the eval file
 */
async function runEvalTests(
  workspaceDir: string,
  evalFile: string
): Promise<{
  passed: boolean;
  testsPassed: number;
  testsTotal: number;
  output: string;
}> {
  return new Promise((resolve) => {
    // Copy the EVAL.ts file and vitest config to the workspace
    const evalFileName = "EVAL.ts";
    const workspaceEvalFile = join(workspaceDir, evalFileName);

    // Get the root vitest config path (evalFile is in evals/<eval-name>/EVAL.ts, config is in root)
    const evalsRoot = dirname(dirname(dirname(evalFile)));
    const rootVitestConfig = join(evalsRoot, "vitest.config.ts");
    const workspaceVitestConfig = join(workspaceDir, "vitest.config.ts");

    // Copy eval file and vitest config to workspace
    Promise.all([
      cp(evalFile, workspaceEvalFile),
      cp(rootVitestConfig, workspaceVitestConfig),
    ])
      .then(() => {
        const vitest = spawn(
          "npx",
          [
            "vitest",
            "run",
            evalFileName,
            "--reporter=json",
            "--no-color",
            "--config",
            "vitest.config.ts",
          ],
          {
            cwd: workspaceDir,
            env: {
              ...process.env,
              EVAL_WORKSPACE_DIR: workspaceDir,
            },
            stdio: ["pipe", "pipe", "pipe"],
          }
        );

        let stdout = "";
        let stderr = "";

        vitest.stdout.on("data", (data: Buffer) => {
          stdout += data.toString();
        });

        vitest.stderr.on("data", (data: Buffer) => {
          stderr += data.toString();
        });

        vitest.on("close", (code) => {
          // Try to parse JSON output
          try {
            const jsonMatch = stdout.match(/\{[\s\S]*"testResults"[\s\S]*\}/);
            if (jsonMatch) {
              const result = JSON.parse(jsonMatch[0]) as {
                numPassedTests?: number;
                numTotalTests?: number;
                success?: boolean;
              };
              resolve({
                passed: result.success ?? code === 0,
                testsPassed: result.numPassedTests ?? 0,
                testsTotal: result.numTotalTests ?? 0,
                output: stdout + stderr,
              });
              return;
            }
          } catch {
            // JSON parsing failed, fall back to exit code
          }

          // Fallback: use exit code
          resolve({
            passed: code === 0,
            testsPassed: code === 0 ? 1 : 0,
            testsTotal: 1,
            output: stdout + stderr,
          });
        });

        vitest.on("error", (err) => {
          resolve({
            passed: false,
            testsPassed: 0,
            testsTotal: 1,
            output: err.message,
          });
        });
      })
      .catch((err: Error) => {
        resolve({
          passed: false,
          testsPassed: 0,
          testsTotal: 1,
          output: `Failed to copy eval file: ${err.message}`,
        });
      });
  });
}

/**
 * Run a single eval iteration using SDK mode (direct API call)
 */
async function runSDKEval(
  client: Anthropic,
  evalDef: EvalDefinition,
  config: ExperimentConfig,
  skill: SkillDefinition | null,
  workspaceDir: string,
  runNumber: number
): Promise<{ result: RunResult; usage: Usage }> {
  const runStartTime = Date.now();

  // Copy starter files from eval directory to workspace
  await copyStarterFiles(evalDef.path, workspaceDir);

  // Prepare prompt (with or without skill)
  let prompt = evalDef.prompt;
  if (skill) {
    prompt = augmentPromptWithSkill(prompt, skill);
  }

  // Make API call
  const { text: response, usage } = await callClaudeAPI(
    client,
    config.model,
    prompt,
    config.timeout
  );

  // Parse and write generated files
  const generatedFiles = parseGeneratedFiles(response);
  const writtenFiles = await writeGeneratedFiles(workspaceDir, generatedFiles);

  if (writtenFiles.length === 0) {
    return {
      result: {
        runNumber,
        passed: false,
        testsPassed: 0,
        testsTotal: 1,
        durationMs: Date.now() - runStartTime,
        error: "No files were generated by the agent",
        agentOutput: response,
        generatedFiles: [],
        usage,
      },
      usage,
    };
  }

  // Run tests
  const testResult = await runEvalTests(workspaceDir, evalDef.evalFile);

  return {
    result: {
      runNumber,
      passed: testResult.passed,
      testsPassed: testResult.testsPassed,
      testsTotal: testResult.testsTotal,
      durationMs: Date.now() - runStartTime,
      agentOutput: response,
      generatedFiles: writtenFiles,
      error: testResult.passed ? undefined : testResult.output,
      usage,
    },
    usage,
  };
}

/**
 * Run all iterations of an eval (dispatches to SDK or Agent mode)
 */
async function runEval(
  client: Anthropic | null,
  evalDef: EvalDefinition,
  config: ExperimentConfig,
  skill: SkillDefinition | null,
  baseDir: string,
  onProgress?: (run: number, total: number, result: RunResult) => void,
  options?: RunnerOptions
): Promise<EvalResult> {
  const runs: RunResult[] = [];
  const isAgentMode = config.executionMode === "agent";

  // Aggregate usage across all runs
  const totalUsage: Usage = {
    inputTokens: 0,
    outputTokens: 0,
  };

  // Run each iteration
  for (let i = 1; i <= config.runs; i++) {
    const runId = `${evalDef.name}-${config.name}-run${i}-${Date.now()}`;
    const workspaceDir = await createWorkspace(baseDir, runId);

    try {
      let result: RunResult;

      if (isAgentMode) {
        // Agent mode: use CLI agent
        const agentResult = await runAgentEval(
          evalDef,
          config,
          workspaceDir,
          i
        );

        // Run tests on the agent's generated files
        if (
          agentResult.generatedFiles &&
          agentResult.generatedFiles.length > 0
        ) {
          const testResult = await runEvalTests(workspaceDir, evalDef.evalFile);
          result = {
            ...agentResult,
            passed: testResult.passed,
            testsPassed: testResult.testsPassed,
            testsTotal: testResult.testsTotal,
            error: testResult.passed ? agentResult.error : testResult.output,
          };
        } else {
          result = {
            ...agentResult,
            error: agentResult.error ?? "No files were generated by the agent",
          };
        }

        // Aggregate usage from agent if available
        if (agentResult.usage) {
          totalUsage.inputTokens += agentResult.usage.inputTokens;
          totalUsage.outputTokens += agentResult.usage.outputTokens;
        }
      } else {
        // SDK mode: direct API call
        if (!client) {
          throw new Error("Anthropic client is required for SDK mode");
        }
        const { result: sdkResult, usage } = await runSDKEval(
          client,
          evalDef,
          config,
          skill,
          workspaceDir,
          i
        );
        result = sdkResult;

        // Aggregate usage
        totalUsage.inputTokens += usage.inputTokens;
        totalUsage.outputTokens += usage.outputTokens;
      }

      runs.push(result);
      onProgress?.(i, config.runs, result);
    } catch (error) {
      const result: RunResult = {
        runNumber: i,
        passed: false,
        testsPassed: 0,
        testsTotal: 1,
        durationMs: 0,
        error: error instanceof Error ? error.message : String(error),
      };
      runs.push(result);
      onProgress?.(i, config.runs, result);
    } finally {
      if (!options?.debug) {
        await cleanupWorkspace(workspaceDir);
      }
    }
  }

  const passedRuns = runs.filter((r) => r.passed).length;
  const avgDurationMs =
    runs.reduce((sum, r) => sum + r.durationMs, 0) / runs.length;

  // Only include totalUsage if we have any usage data
  const hasUsage = totalUsage.inputTokens > 0 || totalUsage.outputTokens > 0;

  return {
    evalName: evalDef.name,
    totalRuns: config.runs,
    passedRuns,
    passRate: passedRuns / config.runs,
    runs,
    avgDurationMs,
    totalUsage: hasUsage ? totalUsage : undefined,
  };
}

/**
 * Run a complete experiment
 */
export async function runExperiment(
  config: ExperimentConfig,
  evalsDir: string,
  baseDir: string,
  onProgress?: (
    evalName: string,
    run: number,
    total: number,
    result: RunResult
  ) => void,
  options?: RunnerOptions
): Promise<ExperimentResult> {
  const startedAt = new Date().toISOString();
  const startTime = Date.now();
  const isAgentMode = config.executionMode === "agent";

  // Initialize Anthropic client only for SDK mode
  let client: Anthropic | null = null;
  if (!isAgentMode) {
    client = new Anthropic();
  }

  // Validate agent config if in agent mode
  if (isAgentMode && !config.agent) {
    throw new Error(
      "Agent configuration is required when executionMode is 'agent'"
    );
  }

  // Load skill if specified
  const skill = config.skill ? await loadSkill(config.skill) : null;

  // Discover and filter evals
  const allEvals = await discoverEvals(evalsDir);
  const evals = filterEvals(allEvals, config.evals);

  if (evals.length === 0) {
    throw new Error("No evals found matching the specified patterns");
  }

  // Run each eval
  const evalResults: EvalResult[] = [];

  for (const evalDef of evals) {
    const result = await runEval(
      client,
      evalDef,
      config,
      skill,
      baseDir,
      (run, total, result) => {
        onProgress?.(evalDef.name, run, total, result);
      },
      options
    );
    evalResults.push(result);
  }

  const completedAt = new Date().toISOString();
  const totalDurationMs = Date.now() - startTime;

  // Calculate overall pass rate
  const totalRuns = evalResults.reduce((sum, r) => sum + r.totalRuns, 0);
  const totalPassed = evalResults.reduce((sum, r) => sum + r.passedRuns, 0);
  const overallPassRate = totalRuns > 0 ? totalPassed / totalRuns : 0;

  // Aggregate total usage across all evals
  const aggregatedUsage = {
    inputTokens: evalResults.reduce(
      (sum, r) => sum + (r.totalUsage?.inputTokens ?? 0),
      0
    ),
    outputTokens: evalResults.reduce(
      (sum, r) => sum + (r.totalUsage?.outputTokens ?? 0),
      0
    ),
  };

  // Only include usage if we have any data
  const totalUsage: Usage | undefined =
    aggregatedUsage.inputTokens > 0 || aggregatedUsage.outputTokens > 0
      ? aggregatedUsage
      : undefined;

  return {
    experimentName: config.name,
    config,
    startedAt,
    completedAt,
    totalDurationMs,
    evalResults,
    overallPassRate,
    totalUsage,
  };
}

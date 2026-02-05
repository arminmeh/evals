import { spawn } from "child_process";
import { mkdir, writeFile, cp } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import { glob } from "glob";
import type {
  ExperimentConfig,
  EvalDefinition,
  RunResult,
  Usage,
} from "./types.js";

/**
 * Result from running the agent CLI
 */
interface AgentExecutionResult {
  /** Exit code from the agent process */
  exitCode: number;
  /** Combined stdout output */
  stdout: string;
  /** Combined stderr output */
  stderr: string;
  /** Whether the agent completed successfully (exit code 0) */
  success: boolean;
  /** Token usage if available from agent output */
  usage?: Usage;
}

/**
 * Copy all starter files from eval directory to workspace.
 * Copies everything except PROMPT.md and EVAL.ts, preserving directory structure.
 */
export async function copyStarterFiles(
  evalPath: string,
  workspaceDir: string
): Promise<string[]> {
  const copiedFiles: string[] = [];

  // Recursively copy all files from eval directory to workspace,
  // excluding PROMPT.md and EVAL.ts (which are handled separately)
  const files = await glob("**/*", {
    cwd: evalPath,
    nodir: true,
    ignore: ["PROMPT.md", "EVAL.ts"],
  });

  for (const file of files) {
    const srcPath = join(evalPath, file);
    const destPath = join(workspaceDir, file);

    // Ensure directory exists
    const destDir = join(destPath, "..");
    await mkdir(destDir, { recursive: true });

    await cp(srcPath, destPath);
    copiedFiles.push(file);
  }

  return copiedFiles;
}

/**
 * Copy the skill file to the workspace
 */
async function copySkillFile(
  skillPath: string,
  workspaceDir: string
): Promise<string> {
  const destPath = join(workspaceDir, "SKILL.md");
  await cp(skillPath, destPath);
  return destPath;
}

/**
 * Write the prompt file to the workspace
 * If a skill is provided, references the SKILL.md file instead of embedding content
 */
async function writePromptFile(
  workspaceDir: string,
  prompt: string,
  hasSkill: boolean
): Promise<string> {
  let finalPrompt = prompt;

  if (hasSkill) {
    finalPrompt = `# Instructions

Before completing the task below, read the \`SKILL.md\` file in this directory. It contains guidelines and best practices that you MUST follow when implementing the solution.

---

${prompt}`;
  }

  const promptPath = join(workspaceDir, "PROMPT.md");
  await writeFile(promptPath, finalPrompt, "utf-8");

  return promptPath;
}

/**
 * List all files in the workspace (excluding PROMPT.md, SKILL.md, and hidden files)
 */
async function listGeneratedFiles(workspaceDir: string): Promise<string[]> {
  const allFiles = await glob("**/*", {
    cwd: workspaceDir,
    nodir: true,
    ignore: ["PROMPT.md", "SKILL.md", ".*", "node_modules/**"],
  });

  // Filter out meta files
  return allFiles.filter((f) => f !== "PROMPT.md" && f !== "SKILL.md");
}

/**
 * Execute the agent CLI in the workspace
 */
async function executeAgent(
  config: ExperimentConfig,
  workspaceDir: string,
  timeout: number
): Promise<AgentExecutionResult> {
  return new Promise((resolve) => {
    const agentConfig = config.agent;
    if (!agentConfig) {
      resolve({
        exitCode: 1,
        stdout: "",
        stderr: "Agent configuration is missing",
        success: false,
      });
      return;
    }

    // Build the command arguments
    const args: string[] = [
      // Run in print mode (non-interactive)
      "--print",
      // Output as JSON to capture usage stats
      "--output-format",
      "json",
      // Allow necessary tools for code generation
      "--allowedTools",
      "Edit,Write,Bash,Read,Glob,Grep",
      // Read prompt from file
      "-p",
      `Read the PROMPT.md file in this directory and complete the task described in it.

IMPORTANT: You must ONLY work within this directory. Do NOT modify any files outside of this directory. All file operations (reading, writing, editing) and all commands (npm install, etc.) must be performed within this directory only. Never use absolute paths or navigate to parent directories.`,
      // Add any custom args from config
      ...(agentConfig.args ?? []),
    ];

    // Spawn the agent process
    // Use 'ignore' for stdin since we pass prompt via -p flag
    const agent = spawn(agentConfig.command, args, {
      cwd: workspaceDir,
      env: {
        ...process.env,
      },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    // Set up timeout
    const timeoutId = setTimeout(() => {
      timedOut = true;
      agent.kill("SIGTERM");
      // Force kill after 5 seconds if still running
      setTimeout(() => {
        if (!agent.killed) {
          agent.kill("SIGKILL");
        }
      }, 5000);
    }, timeout * 1000);

    agent.stdout.on("data", (data: Buffer) => {
      stdout += data.toString();
    });

    agent.stderr.on("data", (data: Buffer) => {
      stderr += data.toString();
    });

    agent.on("close", (code) => {
      clearTimeout(timeoutId);

      // Try to parse usage from JSON output
      let usage: Usage | undefined;
      try {
        const jsonOutput = JSON.parse(stdout);
        if (jsonOutput.usage) {
          usage = {
            inputTokens: jsonOutput.usage.input_tokens ?? jsonOutput.usage.inputTokens ?? 0,
            outputTokens: jsonOutput.usage.output_tokens ?? jsonOutput.usage.outputTokens ?? 0,
          };
        }
        // Also check for stats field (alternative format)
        if (!usage && jsonOutput.stats) {
          usage = {
            inputTokens: jsonOutput.stats.input_tokens ?? jsonOutput.stats.inputTokens ?? 0,
            outputTokens: jsonOutput.stats.output_tokens ?? jsonOutput.stats.outputTokens ?? 0,
          };
        }
      } catch {
        // JSON parsing failed, usage stays undefined
      }

      if (timedOut) {
        resolve({
          exitCode: code ?? 1,
          stdout,
          stderr: stderr + "\n[Agent timed out]",
          success: false,
          usage,
        });
      } else {
        resolve({
          exitCode: code ?? 0,
          stdout,
          stderr,
          success: code === 0,
          usage,
        });
      }
    });

    agent.on("error", (err) => {
      clearTimeout(timeoutId);
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + "\n" + err.message,
        success: false,
      });
    });
  });
}

/**
 * Run a single eval using the agent CLI
 *
 * @param evalDef - The eval definition
 * @param config - Experiment configuration (includes skill path)
 * @param workspaceDir - Directory to run the agent in
 * @param runNumber - Current run number
 */
export async function runAgentEval(
  evalDef: EvalDefinition,
  config: ExperimentConfig,
  workspaceDir: string,
  runNumber: number
): Promise<RunResult> {
  const startTime = Date.now();

  try {
    // 1. Copy starter files from eval's src/ directory
    await copyStarterFiles(evalDef.path, workspaceDir);

    // 2. Copy skill file if specified
    const hasSkill = !!config.skill;
    if (config.skill && existsSync(config.skill)) {
      await copySkillFile(config.skill, workspaceDir);
    }

    // 3. Write the prompt file (references SKILL.md if skill exists)
    await writePromptFile(workspaceDir, evalDef.prompt, hasSkill);

    // 4. Execute the agent
    const agentResult = await executeAgent(
      config,
      workspaceDir,
      config.timeout
    );

    // 5. List generated files
    const generatedFiles = await listGeneratedFiles(workspaceDir);

    // Return partial result - tests will be run by the main runner
    return {
      runNumber,
      passed: false, // Will be determined by tests
      testsPassed: 0,
      testsTotal: 0,
      durationMs: Date.now() - startTime,
      agentOutput: agentResult.stdout + (agentResult.stderr ? "\n\nSTDERR:\n" + agentResult.stderr : ""),
      generatedFiles,
      usage: agentResult.usage,
      error: agentResult.success ? undefined : `Agent exited with code ${agentResult.exitCode}`,
    };
  } catch (error) {
    return {
      runNumber,
      passed: false,
      testsPassed: 0,
      testsTotal: 0,
      durationMs: Date.now() - startTime,
      error: error instanceof Error ? error.message : String(error),
      generatedFiles: [],
    };
  }
}

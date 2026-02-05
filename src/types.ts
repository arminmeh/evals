/**
 * Token usage information from Claude API
 */
export interface Usage {
  /** Number of input tokens */
  inputTokens: number;
  /** Number of output tokens */
  outputTokens: number;
}

/**
 * Individual test result from vitest
 */
export interface TestDetail {
  /** Test name */
  name: string;
  /** Whether the test passed */
  passed: boolean;
  /** Failure message if failed */
  failureMessage?: string;
}

/**
 * Execution mode for running evals
 * - 'sdk': Direct API calls via @anthropic-ai/sdk (default)
 * - 'agent': Interactive agent session via CLI (e.g., Claude Code)
 */
export type ExecutionMode = 'sdk' | 'agent';

/**
 * Configuration for agent-based execution
 */
export interface AgentConfig {
  /** Agent command to run (e.g., 'claude', 'npx claude') */
  command: string;
  /** Additional arguments to pass to the agent CLI */
  args?: string[];
  /** Whether to enable early exit on first failure */
  earlyExit?: boolean;
}

/**
 * Configuration for an experiment run
 */
export interface ExperimentConfig {
  /** Unique name for this experiment */
  name: string;
  /** Human-readable description */
  description: string;
  /** Model to use (e.g., 'claude-sonnet-4-20250514') - used in SDK mode */
  model: string;
  /** Number of runs per eval */
  runs: number;
  /** Timeout per run in seconds */
  timeout: number;
  /** Path to SKILL.md file, or null for baseline */
  skill: string | null;
  /** Which evals to run - array of glob patterns or ['*'] for all */
  evals: string[];
  /** Execution mode: 'sdk' (default) or 'agent' */
  executionMode?: ExecutionMode;
  /** Agent configuration (required if executionMode is 'agent') */
  agent?: AgentConfig;
}

/**
 * Parsed skill definition from SKILL.md
 */
export interface SkillDefinition {
  /** Skill name from frontmatter */
  name: string;
  /** Skill description from frontmatter */
  description: string;
  /** Version from frontmatter */
  version?: string;
  /** Full markdown content (excluding frontmatter) */
  content: string;
  /** Raw frontmatter object */
  frontmatter: Record<string, unknown>;
}

/**
 * Definition of a single eval
 */
export interface EvalDefinition {
  /** Eval name (directory name) */
  name: string;
  /** Path to eval directory */
  path: string;
  /** Content of PROMPT.md */
  prompt: string;
  /** Path to EVAL.ts file */
  evalFile: string;
}

/**
 * Result of a single eval run
 */
export interface RunResult {
  /** Run number (1-indexed) */
  runNumber: number;
  /** Whether the eval passed */
  passed: boolean;
  /** Number of tests that passed */
  testsPassed: number;
  /** Total number of tests */
  testsTotal: number;
  /** Duration in milliseconds */
  durationMs: number;
  /** Error message if failed */
  error?: string;
  /** Agent's response/output */
  agentOutput?: string;
  /** Generated files */
  generatedFiles?: string[];
  /** Token usage for this run */
  usage?: Usage;
  /** Individual test results (for debug mode) */
  testDetails?: TestDetail[];
}

/**
 * Aggregated results for an eval across multiple runs
 */
export interface EvalResult {
  /** Eval name */
  evalName: string;
  /** Total runs executed */
  totalRuns: number;
  /** Number of passed runs */
  passedRuns: number;
  /** Pass rate (0-1) */
  passRate: number;
  /** Individual run results */
  runs: RunResult[];
  /** Average duration in milliseconds */
  avgDurationMs: number;
  /** Total token usage for this eval */
  totalUsage?: Usage;
}

/**
 * Results from an entire experiment
 */
export interface ExperimentResult {
  /** Experiment name */
  experimentName: string;
  /** Experiment config used */
  config: ExperimentConfig;
  /** Timestamp when experiment started */
  startedAt: string;
  /** Timestamp when experiment completed */
  completedAt: string;
  /** Total duration in milliseconds */
  totalDurationMs: number;
  /** Results for each eval */
  evalResults: EvalResult[];
  /** Overall pass rate across all evals */
  overallPassRate: number;
  /** Total token usage for entire experiment */
  totalUsage?: Usage;
}

/**
 * Comparison between two experiments
 */
export interface ComparisonResult {
  /** Baseline experiment results */
  baseline: ExperimentResult;
  /** With-skill experiment results */
  withSkill: ExperimentResult;
  /** Per-eval comparison */
  evalComparisons: EvalComparison[];
  /** Overall improvement (positive = skill is better) */
  overallImprovement: number;
}

/**
 * Comparison for a single eval between experiments
 */
export interface EvalComparison {
  /** Eval name */
  evalName: string;
  /** Baseline pass rate */
  baselinePassRate: number;
  /** With-skill pass rate */
  withSkillPassRate: number;
  /** Improvement (positive = skill is better) */
  improvement: number;
  /** Baseline runs */
  baselineRuns: number;
  /** With-skill runs */
  withSkillRuns: number;
}

/**
 * Options for the comparison runner
 */
export interface ComparisonOptions {
  /** Run in dry mode (don't execute, just show what would run) */
  dry?: boolean;
  /** Only run specific experiment */
  experiment?: string;
  /** Override number of runs */
  runs?: number;
  /** Verbose output */
  verbose?: boolean;
  /** Keep generated test files for manual inspection */
  debug?: boolean;
  /** Override execution mode for all experiments */
  mode?: ExecutionMode;
}

/**
 * Options for the experiment runner
 */
export interface RunnerOptions {
  /** Keep generated test files for manual inspection */
  debug?: boolean;
}

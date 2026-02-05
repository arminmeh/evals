import type { ExperimentConfig } from "../src/types.js";

/**
 * Baseline experiment - runs evals WITHOUT any skill augmentation.
 * Can run in SDK mode (direct API) or agent mode (Claude Code CLI).
 */
const config: ExperimentConfig = {
  name: "baseline",
  description: "Baseline experiment without skill augmentation",
  model: "claude-sonnet-4-20250514",
  runs: 3,
  timeout: 120,
  skill: null,
  evals: ["*"],
  // Agent config used when running with --mode agent
  agent: {
    command: "claude",
    args: [],
    earlyExit: false,
  },
};

export default config;

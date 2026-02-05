import type { ExperimentConfig } from "../src/types.js";

/**
 * Baseline experiment - runs evals WITHOUT any skill augmentation.
 */
const config: ExperimentConfig = {
  name: "baseline",
  description: "Baseline experiment without skill augmentation",
  model: "claude-sonnet-4-20250514",
  runs: 3,
  timeout: 120,
  skill: null, // No skill
  evals: ["*"], // Run all evals
};

export default config;

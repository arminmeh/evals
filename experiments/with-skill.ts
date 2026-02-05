import type { ExperimentConfig } from "../src/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Experiment with skill augmentation - runs evals WITH the code-quality skill.
 */
const config: ExperimentConfig = {
  name: "with-skill",
  description: "Experiment with code-quality skill augmentation",
  model: "claude-sonnet-4-20250514",
  runs: 3,
  timeout: 120,
  skill: join(__dirname, "..", "skills", "code-quality", "SKILL.md"),
  evals: ["*"], // Run all evals
};

export default config;

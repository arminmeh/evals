import type { ExperimentConfig } from "../src/types.js";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Experiment with skill augmentation - runs evals WITH the skill.
 * Can run in SDK mode (direct API) or agent mode (Claude Code CLI).
 */
const config: ExperimentConfig = {
  name: "with-base-ui-skill",
  description: "Experiment with base-ui skill",
  model: "claude-sonnet-4-20250514",
  runs: 1,
  timeout: 240,
  skill: join(__dirname, "..", "skills", "base-ui", "SKILL_CONCATENATED.md"),
  evals: ["*"],
  // Agent config used when running with --mode agent
  agent: {
    command: "claude",
    args: [],
    earlyExit: false,
  },
};

export default config;

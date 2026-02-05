# Skill Evals

A testing framework for evaluating AI agent performance with and without skill augmentation.

## Overview

This project enables you to:
- Define evals (test cases) for AI agent tasks
- Define skills (instruction sets) that can augment agent prompts
- Run experiments comparing agent performance with and without skills
- View comparison results in a formatted console table

## Quick Start

```bash
# Install dependencies
pnpm install

# Copy environment example and add your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run a dry run to see what would execute
pnpm run compare:dry

# Run the full comparison (SDK mode)
pnpm run compare

# Run using Claude Code agent mode
pnpm run compare:agent
```

## Project Structure

```
evals/
├── evals/                          # Individual eval test cases
│   └── <eval-name>/                # Each eval in its own directory
│       ├── PROMPT.md               # Task description for the agent
│       ├── EVAL.ts                 # Vitest assertions
│       ├── package.json            # Eval dependencies
│       ├── tsconfig.json           # TypeScript config
│       └── src/                    # Starter template files (optional)
├── skills/                         # Skill definitions
│   └── <skill-name>/               # Each skill in its own directory
│       └── SKILL.md                # Skill instructions with frontmatter
├── experiments/                    # Experiment configurations
│   ├── baseline.ts                 # Without skill augmentation
│   └── with-skill.ts               # With skill augmentation
├── src/                            # Core framework
│   ├── types.ts                    # TypeScript type definitions
│   ├── skill-loader.ts             # Load and parse SKILL.md files
│   ├── runner.ts                   # SDK-based eval execution
│   ├── agent-runner.ts             # Agent-based eval execution
│   └── compare.ts                  # Comparison and formatting logic
├── scripts/
│   └── run-comparison.ts           # CLI entry point
└── package.json
```

## Creating Evals

1. Create a directory under `evals/`:
   ```bash
   mkdir evals/my-eval
   ```

2. Create `PROMPT.md` with the task description:
   ```markdown
   # Task: Create a Utility Function

   Create a file at `src/utils.ts` that exports...
   ```

3. Create `EVAL.ts` with vitest assertions:
   ```typescript
   import { test, expect } from 'vitest';
   import { existsSync } from 'fs';

   test('file exists', () => {
     expect(existsSync('src/utils.ts')).toBe(true);
   });
   ```

4. Create `package.json`:
   ```json
   {
     "name": "my-eval",
     "type": "module",
     "private": true
   }
   ```

5. Optionally add starter template files in `src/` that the agent will build upon.

## Creating Skills

1. Create a directory under `skills/`:
   ```bash
   mkdir skills/my-skill
   ```

2. Create a skill markdown file with frontmatter and instructions:
   ```markdown
   ---
   name: my-skill
   description: A skill that does something useful
   ---

   # My Skill

   ## When to Use
   Use this skill when...

   ## Guidelines
   1. Always do X
   2. Never do Y
   ```

## Running Experiments

### Execution Modes

The framework supports two execution modes:

- **SDK Mode** (default): Direct API calls using the Anthropic SDK
- **Agent Mode**: Interactive sessions via Claude Code CLI

### Commands

```bash
# Full comparison (SDK mode)
pnpm run compare

# Full comparison (Agent mode)
pnpm run compare:agent

# Dry run to see what would execute
pnpm run compare:dry
pnpm run compare:agent:dry

# Debug mode with detailed test output
pnpm run compare:debug
pnpm run compare:agent:debug
```

### CLI Options

```bash
# Custom number of runs per eval
pnpm run compare -- --runs 5

# Run specific evals only
pnpm run compare -- --evals my-eval,another-eval

# Specify execution mode
pnpm run compare -- --mode agent
```

## Configuration

### Experiment Config

Edit `experiments/baseline.ts` or `experiments/with-skill.ts`:

```typescript
import { ExperimentConfig } from '../src/types.js';

const config: ExperimentConfig = {
  name: 'my-experiment',
  description: 'Description of the experiment',
  model: 'claude-sonnet-4-20250514',
  runs: 1,
  timeout: 240,
  skill: null, // or path to skill file
  evals: ['*'], // or specific eval names
  executionMode: 'sdk', // or 'agent'
};

export default config;
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes (SDK mode) | - | Your Anthropic API key |
| `EXECUTION_MODE` | No | sdk | Execution mode: 'sdk' or 'agent' |
| `MODEL` | No | claude-sonnet-4-20250514 | Model to use |
| `RUNS` | No | 1 | Number of runs per eval |
| `TIMEOUT` | No | 240 | Timeout in seconds |

## Using External Skills

To test a skill from another project, reference its path in your experiment config:

```typescript
const config: ExperimentConfig = {
  // ...
  skill: '/path/to/external/skill/SKILL.md',
};
```

## Interpreting Results

The comparison runner outputs a table showing pass rates for each eval across experiments, along with the delta (improvement or regression) when using skill augmentation.

| Pass Rate | Interpretation |
|-----------|---------------|
| 90-100% | Agent handles task reliably |
| 70-89% | Usually works, some room for improvement |
| 50-69% | Unreliable, needs investigation |
| < 50% | Task too difficult or prompt needs revision |

## License

MIT

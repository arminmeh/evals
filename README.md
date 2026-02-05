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
npm install

# Copy environment example and add your API key
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Run a dry run to see what would execute
npm run compare -- --dry

# Run the full comparison
npm run compare
```

## Project Structure

```
skill-evals/
├── evals/                          # Individual eval test cases
│   └── generate-add-function/      # Example eval
│       ├── PROMPT.md               # Task description for the agent
│       ├── EVAL.ts                 # Vitest assertions
│       └── package.json            # Eval dependencies
├── skills/                         # Skill definitions
│   └── code-quality/               # Example skill
│       └── SKILL.md                # Skill instructions
├── experiments/                    # Experiment configurations
│   ├── baseline.ts                 # Without skill
│   └── with-skill.ts               # With skill
├── src/                            # Core framework
│   ├── types.ts                    # TypeScript types
│   ├── skill-loader.ts             # Load SKILL.md files
│   ├── runner.ts                   # Execute evals
│   └── compare.ts                  # Comparison logic
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

## Creating Skills

1. Create a directory under `skills/`:
   ```bash
   mkdir skills/my-skill
   ```

2. Create `SKILL.md` with frontmatter and instructions:
   ```markdown
   ---
   name: my-skill
   description: A skill that does something useful
   version: 1.0.0
   ---

   # My Skill

   ## When to Use
   Use this skill when...

   ## Guidelines
   1. Always do X
   2. Never do Y
   ```

## Running Experiments

### Full Comparison
```bash
npm run compare
```

Output:
```
🔬 Skill Evals Comparison Runner

▶ Starting experiment: baseline
  Baseline experiment without skill augmentation
  [baseline] generate-add-function run 1/3 ✓
  [baseline] generate-add-function run 2/3 ✗
  [baseline] generate-add-function run 3/3 ✓

▶ Starting experiment: with-skill
  Experiment with code-quality skill augmentation
  [with-skill] generate-add-function run 1/3 ✓
  [with-skill] generate-add-function run 2/3 ✓
  [with-skill] generate-add-function run 3/3 ✓

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
                     COMPARISON RESULTS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
┌───────────────────────┬──────────┬────────────┬────────────┐
│ Eval                  │ Baseline │ With Skill │ Delta      │
├───────────────────────┼──────────┼────────────┼────────────┤
│ generate-add-function │ 66.7%    │ 100%       │ +33.3%     │
└───────────────────────┴──────────┴────────────┴────────────┘

Summary: Skill improved pass rate by 33.3% on average
```

### Single Experiment
```bash
npm run eval:baseline
npm run eval:with-skill
```

### Dry Run
```bash
npm run compare -- --dry
```

### Custom Runs
```bash
npm run compare -- --runs 10
```

## Configuration

### Experiment Config

Edit `experiments/baseline.ts` or `experiments/with-skill.ts`:

```typescript
const config: ExperimentConfig = {
  name: 'my-experiment',
  description: 'Description of the experiment',
  model: 'claude-sonnet-4-20250514',
  runs: 3,
  timeout: 120,
  skill: null, // or path to SKILL.md
  evals: ['*'], // or specific eval names
};
```

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `ANTHROPIC_API_KEY` | Yes | - | Your Anthropic API key |
| `MODEL` | No | claude-sonnet-4-20250514 | Model to use |
| `RUNS` | No | 3 | Number of runs per eval |
| `TIMEOUT` | No | 120 | Timeout in seconds |

## Using External Skills

To test a skill from another project:

1. Update `experiments/with-skill.ts`:
   ```typescript
   const config: ExperimentConfig = {
     // ...
     skill: '/path/to/external/skill/SKILL.md',
   };
   ```

2. Run the comparison:
   ```bash
   npm run compare
   ```

## Interpreting Results

| Pass Rate | Interpretation |
|-----------|---------------|
| 90-100% | Agent handles task reliably |
| 70-89% | Usually works, some room for improvement |
| 50-69% | Unreliable, needs investigation |
| < 50% | Task too difficult or prompt needs revision |

## License

MIT

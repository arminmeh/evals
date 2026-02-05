#!/usr/bin/env tsx

import { config as loadEnv } from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';

import type { ExperimentConfig, ComparisonOptions } from '../src/types.js';
import { runExperiment, discoverEvals, filterEvals } from '../src/runner.js';
import {
  compareExperiments,
  printComparisonTable,
  printExperimentResult,
  printRunProgress,
  printExperimentStart,
  printDryRun,
} from '../src/compare.js';

// Load environment variables
loadEnv();

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const EVALS_DIR = join(ROOT_DIR, 'evals');
const EXPERIMENTS_DIR = join(ROOT_DIR, 'experiments');

/**
 * Parse command line arguments
 */
function parseArgs(): ComparisonOptions {
  const args = process.argv.slice(2);
  const options: ComparisonOptions = {};

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const nextArg = args[i + 1];

    switch (arg) {
      case '--dry':
        options.dry = true;
        break;
      case '--experiment':
        if (nextArg === 'baseline' || nextArg === 'with-skill') {
          options.experiment = nextArg;
          i++;
        }
        break;
      case '--runs':
        if (nextArg) {
          options.runs = parseInt(nextArg, 10);
          i++;
        }
        break;
      case '--verbose':
      case '-v':
        options.verbose = true;
        break;
      case '--debug':
        options.debug = true;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
    }
  }

  return options;
}

/**
 * Print help message
 */
function printHelp(): void {
  console.log(`
${chalk.bold('Skill Evals - Compare agent performance with and without skills')}

${chalk.bold('Usage:')}
  npm run compare [options]
  tsx scripts/run-comparison.ts [options]

${chalk.bold('Options:')}
  --dry               Dry run - show what would be executed without calling APIs
  --experiment <name> Run only a specific experiment (baseline or with-skill)
  --runs <number>     Override number of runs per eval
  --verbose, -v       Verbose output
  --debug             Keep generated test files in .workspaces/ for manual inspection
  --help, -h          Show this help message

${chalk.bold('Examples:')}
  npm run compare                    Run full comparison (baseline vs with-skill)
  npm run compare --dry              Preview what would run
  npm run compare --experiment baseline   Run only baseline experiment
  npm run compare --runs 5           Run 5 iterations per eval

${chalk.bold('Environment Variables:')}
  ANTHROPIC_API_KEY   Required. Your Anthropic API key
  MODEL               Optional. Override the model (default: claude-sonnet-4-20250514)
  RUNS                Optional. Default number of runs (default: 3)
  TIMEOUT             Optional. Timeout per run in seconds (default: 120)
`);
}

/**
 * Load experiment configuration
 */
async function loadExperimentConfig(name: string): Promise<ExperimentConfig> {
  const configPath = join(EXPERIMENTS_DIR, `${name}.ts`);
  const module = await import(configPath);
  const config = module.default as ExperimentConfig;

  // Apply environment overrides
  if (process.env['MODEL']) {
    config.model = process.env['MODEL'];
  }
  if (process.env['RUNS']) {
    config.runs = parseInt(process.env['RUNS'], 10);
  }
  if (process.env['TIMEOUT']) {
    config.timeout = parseInt(process.env['TIMEOUT'], 10);
  }

  return config;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const options = parseArgs();

  // Check for API key
  if (!options.dry && !process.env['ANTHROPIC_API_KEY']) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY environment variable is required'));
    console.error(chalk.dim('Set it in .env file or export it in your shell'));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n🔬 Skill Evals Comparison Runner\n'));

  if (options.debug) {
    console.log(chalk.yellow('Debug mode enabled: test files will be kept in .workspaces/\n'));
  }

  // Load experiment configs
  const experimentsToRun: ExperimentConfig[] = [];

  if (options.experiment) {
    const config = await loadExperimentConfig(options.experiment);
    if (options.runs) {
      config.runs = options.runs;
    }
    experimentsToRun.push(config);
  } else {
    // Run both experiments for comparison
    const baseline = await loadExperimentConfig('baseline');
    const withSkill = await loadExperimentConfig('with-skill');
    if (options.runs) {
      baseline.runs = options.runs;
      withSkill.runs = options.runs;
    }
    experimentsToRun.push(baseline, withSkill);
  }

  // Discover evals
  const allEvals = await discoverEvals(EVALS_DIR);
  const evals = filterEvals(allEvals, experimentsToRun[0]?.evals ?? ['*']);

  if (evals.length === 0) {
    console.error(chalk.red('Error: No evals found in evals/ directory'));
    process.exit(1);
  }

  // Dry run mode
  if (options.dry) {
    printDryRun(
      experimentsToRun.map((e) => ({
        name: e.name,
        description: e.description,
        skill: e.skill,
      })),
      evals.map((e) => e.name)
    );
    return;
  }

  // Run experiments
  const results: Map<string, Awaited<ReturnType<typeof runExperiment>>> = new Map();

  for (const config of experimentsToRun) {
    printExperimentStart(config.name, config.description);

    const result = await runExperiment(
      config,
      EVALS_DIR,
      ROOT_DIR,
      (evalName, run, total, runResult) => {
        printRunProgress(config.name, evalName, run, total, runResult.passed);
      },
      { debug: options.debug }
    );

    results.set(config.name, result);

    // Print individual result if running single experiment
    if (options.experiment) {
      printExperimentResult(result);
    }
  }

  // Print comparison if running both experiments
  if (!options.experiment && results.size === 2) {
    const baseline = results.get('baseline');
    const withSkill = results.get('with-skill');

    if (baseline && withSkill) {
      const comparison = compareExperiments(baseline, withSkill);
      printComparisonTable(comparison);
    }
  }
}

// Run main
main().catch((error) => {
  console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
  process.exit(1);
});

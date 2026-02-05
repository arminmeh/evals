#!/usr/bin/env tsx

import { config as loadEnv } from 'dotenv';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { glob } from 'glob';
import chalk from 'chalk';

import type { ExperimentConfig, ComparisonOptions, ExecutionMode } from '../src/types.js';
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
 * Discover available experiments from the experiments directory
 */
async function discoverExperiments(): Promise<string[]> {
  const files = await glob('*.ts', { cwd: EXPERIMENTS_DIR });
  return files.map((f) => basename(f, '.ts')).sort();
}

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
        if (nextArg && !nextArg.startsWith('-')) {
          options.experiment = nextArg;
          i++;
        }
        break;
      case '--mode':
        if (nextArg === 'sdk' || nextArg === 'agent') {
          options.mode = nextArg as ExecutionMode;
          i++;
        } else if (nextArg) {
          console.error(chalk.yellow(`Warning: Unknown mode '${nextArg}'. Valid options: sdk, agent`));
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

  // Apply environment variable defaults
  if (!options.mode && process.env['EXECUTION_MODE']) {
    const envMode = process.env['EXECUTION_MODE'];
    if (envMode === 'sdk' || envMode === 'agent') {
      options.mode = envMode;
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
  --experiment <name> Run only a specific experiment (e.g., baseline, with-skill)
                      Experiments are discovered from experiments/*.ts files
  --mode <mode>       Execution mode: sdk (default) or agent
                      sdk: Direct API calls via Anthropic SDK
                      agent: Interactive agent via Claude Code CLI
  --runs <number>     Override number of runs per eval
  --verbose, -v       Verbose output
  --debug             Keep generated test files in .workspaces/ for manual inspection
  --help, -h          Show this help message

${chalk.bold('Examples:')}
  npm run compare                        Run comparison (baseline vs with-skill) in SDK mode
  npm run compare --mode agent           Run comparison in agent mode (Claude Code CLI)
  npm run compare --dry                  Preview what would run
  npm run compare --experiment baseline  Run only baseline experiment
  npm run compare --runs 5               Run 5 iterations per eval

${chalk.bold('Environment Variables:')}
  ANTHROPIC_API_KEY   Required for SDK mode. Your Anthropic API key
  EXECUTION_MODE      Optional. Default execution mode (sdk or agent)
  AGENT_COMMAND       Optional. Command to run Claude Code agent (default: claude)
  MODEL               Optional. Override the model for SDK mode (default: claude-sonnet-4-20250514)
  RUNS                Optional. Default number of runs (default: 3)
  TIMEOUT             Optional. Timeout per run in seconds (default: 120)
`);
}

/**
 * Load experiment configuration
 */
async function loadExperimentConfig(name: string, modeOverride?: ExecutionMode): Promise<ExperimentConfig> {
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

  // Apply agent command override
  if (process.env['AGENT_COMMAND'] && config.agent) {
    config.agent.command = process.env['AGENT_COMMAND'];
  }

  // Apply mode override if specified
  if (modeOverride) {
    config.executionMode = modeOverride;
    // Ensure agent config exists if switching to agent mode
    if (modeOverride === 'agent' && !config.agent) {
      config.agent = {
        command: process.env['AGENT_COMMAND'] ?? 'claude',
        args: [],
        earlyExit: false,
      };
    }
  }

  return config;
}

/**
 * Main entry point
 */
async function main(): Promise<void> {
  const options = parseArgs();
  const isAgentMode = options.mode === 'agent';

  // Discover available experiments
  const availableExperiments = await discoverExperiments();

  // Validate experiment name if provided
  if (options.experiment && !availableExperiments.includes(options.experiment)) {
    console.error(chalk.red(`Error: Unknown experiment '${options.experiment}'`));
    console.error(chalk.dim(`Available experiments: ${availableExperiments.join(', ')}`));
    process.exit(1);
  }

  // Check for API key (only required for SDK mode)
  if (!options.dry && !isAgentMode && !process.env['ANTHROPIC_API_KEY']) {
    console.error(chalk.red('Error: ANTHROPIC_API_KEY environment variable is required for SDK mode'));
    console.error(chalk.dim('Set it in .env file or export it in your shell'));
    console.error(chalk.dim('Or use --mode agent to run with Claude Code CLI'));
    process.exit(1);
  }

  console.log(chalk.bold.cyan('\n🔬 Skill Evals Comparison Runner\n'));

  if (options.mode) {
    console.log(chalk.dim(`Execution mode: ${options.mode}\n`));
  }

  if (options.debug) {
    console.log(chalk.yellow('Debug mode enabled: test files will be kept in .workspaces/\n'));
  }

  // Load experiment configs
  const experimentsToRun: ExperimentConfig[] = [];

  if (options.experiment) {
    // Run single specified experiment
    const config = await loadExperimentConfig(options.experiment, options.mode);
    if (options.runs) {
      config.runs = options.runs;
    }
    experimentsToRun.push(config);
  } else {
    // Run all available experiments for comparison
    for (const expName of availableExperiments) {
      const config = await loadExperimentConfig(expName, options.mode);
      if (options.runs) {
        config.runs = options.runs;
      }
      experimentsToRun.push(config);
    }
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
        executionMode: e.executionMode,
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

  // Print comparison if running exactly 2 experiments (baseline vs with-skill)
  if (!options.experiment && results.size === 2) {
    const [first, second] = Array.from(results.values());
    if (first && second) {
      const comparison = compareExperiments(first, second);
      printComparisonTable(comparison);
    }
  }
}

// Run main
main().catch((error) => {
  console.error(chalk.red('Error:'), error instanceof Error ? error.message : error);
  process.exit(1);
});

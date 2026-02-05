import Table from 'cli-table3';
import chalk from 'chalk';
import type {
  ExperimentResult,
  ComparisonResult,
  EvalComparison,
  ExecutionMode,
  Usage,
  RunResult,
  TestDetail,
} from './types.js';

/**
 * Compare two experiment results
 */
export function compareExperiments(
  baseline: ExperimentResult,
  withSkill: ExperimentResult
): ComparisonResult {
  const evalComparisons: EvalComparison[] = [];

  // Create a map of baseline results by eval name
  const baselineByName = new Map(
    baseline.evalResults.map((r) => [r.evalName, r])
  );

  // Compare each eval
  for (const withSkillResult of withSkill.evalResults) {
    const baselineResult = baselineByName.get(withSkillResult.evalName);

    if (baselineResult) {
      evalComparisons.push({
        evalName: withSkillResult.evalName,
        baselinePassRate: baselineResult.passRate,
        withSkillPassRate: withSkillResult.passRate,
        improvement: withSkillResult.passRate - baselineResult.passRate,
        baselineRuns: baselineResult.totalRuns,
        withSkillRuns: withSkillResult.totalRuns,
      });
    }
  }

  const overallImprovement = withSkill.overallPassRate - baseline.overallPassRate;

  return {
    baseline,
    withSkill,
    evalComparisons,
    overallImprovement,
  };
}

/**
 * Format a percentage for display
 */
function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

/**
 * Format improvement delta with color
 */
function formatDelta(delta: number): string {
  const percent = (delta * 100).toFixed(1);
  if (delta > 0) {
    return chalk.green(`+${percent}%`);
  } else if (delta < 0) {
    return chalk.red(`${percent}%`);
  }
  return chalk.gray('0%');
}

/**
 * Format token count for display
 */
function formatTokens(count: number): string {
  if (count >= 1000000) {
    return `${(count / 1000000).toFixed(2)}M`;
  } else if (count >= 1000) {
    return `${(count / 1000).toFixed(1)}k`;
  }
  return count.toString();
}

/**
 * Format usage for display
 */
function formatUsage(usage: Usage | undefined): string {
  if (!usage) {
    return chalk.gray('N/A');
  }
  return `${formatTokens(usage.inputTokens)} in / ${formatTokens(usage.outputTokens)} out`;
}

/**
 * Format duration in milliseconds for display
 */
function formatDuration(ms: number): string {
  if (ms >= 60000) {
    return `${(ms / 60000).toFixed(1)}m`;
  } else if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Format pass rate with runs count
 */
function formatPassRate(passRate: number, passed: number, total: number): string {
  const percent = formatPercent(passRate);
  return `${percent} (${passed}/${total})`;
}

/**
 * Print comparison results as a console table
 */
export function printComparisonTable(comparison: ComparisonResult): void {
  console.log('\n' + chalk.bold('━'.repeat(80)));
  console.log(chalk.bold.cyan('                           COMPARISON RESULTS'));
  console.log(chalk.bold('━'.repeat(80)) + '\n');

  const table = new Table({
    head: [
      chalk.bold('Eval'),
      chalk.bold('Baseline'),
      chalk.bold('With Skill'),
      chalk.bold('Delta'),
    ],
    colWidths: [30, 16, 16, 12],
    style: {
      head: [],
      border: [],
    },
  });

  for (const evalComp of comparison.evalComparisons) {
    const baselineResult = comparison.baseline.evalResults.find(
      (r) => r.evalName === evalComp.evalName
    );
    const withSkillResult = comparison.withSkill.evalResults.find(
      (r) => r.evalName === evalComp.evalName
    );

    table.push([
      evalComp.evalName,
      formatPassRate(
        evalComp.baselinePassRate,
        baselineResult?.passedRuns ?? 0,
        evalComp.baselineRuns
      ),
      formatPassRate(
        evalComp.withSkillPassRate,
        withSkillResult?.passedRuns ?? 0,
        evalComp.withSkillRuns
      ),
      formatDelta(evalComp.improvement),
    ]);
  }

  console.log(table.toString());

  // Print summary
  console.log('');
  const avgImprovement = comparison.overallImprovement;
  const summaryColor = avgImprovement > 0 ? chalk.green : avgImprovement < 0 ? chalk.red : chalk.gray;

  console.log(
    chalk.bold('Summary: ') +
      'Skill ' +
      (avgImprovement >= 0 ? 'improved' : 'decreased') +
      ' pass rate by ' +
      summaryColor(`${Math.abs(avgImprovement * 100).toFixed(1)}%`) +
      ' on average'
  );

  // Print token usage comparison (per eval averages)
  console.log('');
  console.log(chalk.bold('━'.repeat(80)));
  console.log(chalk.bold.cyan('                    TOKEN USAGE (avg per run, per eval)'));
  console.log(chalk.bold('━'.repeat(80)) + '\n');

  const usageTable = new Table({
    head: [
      chalk.bold('Eval'),
      chalk.bold('Baseline'),
      chalk.bold('With Skill'),
      chalk.bold('Delta'),
    ],
    colWidths: [30, 18, 18, 14],
    style: {
      head: [],
      border: [],
    },
  });

  const formatDiffTokens = (diff: number): string => {
    const formatted = formatTokens(Math.abs(diff));
    if (diff > 0) {
      return chalk.yellow(`+${formatted}`);
    } else if (diff < 0) {
      return chalk.green(`-${formatted}`);
    }
    return chalk.gray('0');
  };

  const runsPerEval = comparison.baseline.config.runs;

  for (const evalComp of comparison.evalComparisons) {
    const baselineResult = comparison.baseline.evalResults.find(
      (r) => r.evalName === evalComp.evalName
    );
    const withSkillResult = comparison.withSkill.evalResults.find(
      (r) => r.evalName === evalComp.evalName
    );

    const baselineAvgTotal = baselineResult?.totalUsage
      ? Math.round((baselineResult.totalUsage.inputTokens + baselineResult.totalUsage.outputTokens) / runsPerEval)
      : 0;
    const withSkillAvgTotal = withSkillResult?.totalUsage
      ? Math.round((withSkillResult.totalUsage.inputTokens + withSkillResult.totalUsage.outputTokens) / runsPerEval)
      : 0;
    const tokenDiff = withSkillAvgTotal - baselineAvgTotal;

    usageTable.push([
      evalComp.evalName,
      formatTokens(baselineAvgTotal),
      formatTokens(withSkillAvgTotal),
      formatDiffTokens(tokenDiff),
    ]);
  }

  console.log(usageTable.toString());

  // Print execution time comparison (per eval averages)
  console.log('');
  console.log(chalk.bold('━'.repeat(80)));
  console.log(chalk.bold.cyan('                   EXECUTION TIME (avg per run, per eval)'));
  console.log(chalk.bold('━'.repeat(80)) + '\n');

  const timeTable = new Table({
    head: [
      chalk.bold('Eval'),
      chalk.bold('Baseline'),
      chalk.bold('With Skill'),
      chalk.bold('Delta'),
    ],
    colWidths: [30, 14, 14, 14],
    style: {
      head: [],
      border: [],
    },
  });

  const formatDiffTime = (diff: number): string => {
    const formatted = formatDuration(Math.abs(diff));
    if (diff > 0) {
      return chalk.yellow(`+${formatted}`);
    } else if (diff < 0) {
      return chalk.green(`-${formatted}`);
    }
    return chalk.gray('0');
  };

  for (const evalComp of comparison.evalComparisons) {
    const baselineResult = comparison.baseline.evalResults.find(
      (r) => r.evalName === evalComp.evalName
    );
    const withSkillResult = comparison.withSkill.evalResults.find(
      (r) => r.evalName === evalComp.evalName
    );

    const baselineAvgTime = baselineResult ? Math.round(baselineResult.avgDurationMs) : 0;
    const withSkillAvgTime = withSkillResult ? Math.round(withSkillResult.avgDurationMs) : 0;
    const timeDiff = withSkillAvgTime - baselineAvgTime;

    timeTable.push([
      evalComp.evalName,
      formatDuration(baselineAvgTime),
      formatDuration(withSkillAvgTime),
      formatDiffTime(timeDiff),
    ]);
  }

  console.log(timeTable.toString());
  console.log('');
}

/**
 * Print a single experiment result
 */
export function printExperimentResult(result: ExperimentResult): void {
  console.log('\n' + chalk.bold('━'.repeat(70)));
  console.log(chalk.bold.cyan(`  Experiment: ${result.experimentName}`));
  console.log(chalk.bold('━'.repeat(70)) + '\n');

  const table = new Table({
    head: [
      chalk.bold('Eval'),
      chalk.bold('Pass Rate'),
      chalk.bold('Avg Duration'),
      chalk.bold('Token Usage'),
    ],
    colWidths: [25, 16, 14, 20],
    style: {
      head: [],
      border: [],
    },
  });

  for (const evalResult of result.evalResults) {
    const passRate = formatPassRate(
      evalResult.passRate,
      evalResult.passedRuns,
      evalResult.totalRuns
    );
    const duration = `${(evalResult.avgDurationMs / 1000).toFixed(1)}s`;

    table.push([
      evalResult.evalName,
      passRate,
      duration,
      formatUsage(evalResult.totalUsage),
    ]);
  }

  console.log(table.toString());

  console.log(
    '\n' +
      chalk.bold('Overall pass rate: ') +
      formatPercent(result.overallPassRate)
  );
  console.log(
    chalk.bold('Total duration: ') +
      `${(result.totalDurationMs / 1000).toFixed(1)}s`
  );
  // Calculate average time per run (rounded)
  const totalRuns = result.config.runs * result.evalResults.length;
  const avgTimeMs = totalRuns > 0 ? Math.round(result.totalDurationMs / totalRuns) : 0;
  console.log(
    chalk.bold('Avg time/run: ') + formatDuration(avgTimeMs)
  );
  if (result.totalUsage) {
    // Calculate average tokens per run (rounded)
    const avgInput = totalRuns > 0 ? Math.round(result.totalUsage.inputTokens / totalRuns) : 0;
    const avgOutput = totalRuns > 0 ? Math.round(result.totalUsage.outputTokens / totalRuns) : 0;
    console.log(
      chalk.bold('Avg tokens/run: ') +
        `${formatTokens(avgInput)} input + ${formatTokens(avgOutput)} output = ${formatTokens(avgInput + avgOutput)} total`
    );
  }
  console.log('');
}

/**
 * Print progress during experiment run
 */
export function printRunProgress(
  experimentName: string,
  evalName: string,
  run: number,
  total: number,
  passed: boolean,
  result?: RunResult,
  debug?: boolean
): void {
  const status = passed ? chalk.green('✓') : chalk.red('✗');
  console.log(
    chalk.dim(`  [${experimentName}] `) +
      evalName +
      chalk.dim(` run ${run}/${total} `) +
      status
  );

  // In debug mode, show detailed test results and errors
  if (debug && result) {
    printDebugRunDetails(result);
  }
}

/**
 * Print detailed run information for debug mode
 */
export function printDebugRunDetails(result: RunResult): void {
  // Show individual test results
  if (result.testDetails && result.testDetails.length > 0) {
    console.log(chalk.dim('    ─ Test Results:'));
    for (const test of result.testDetails) {
      const testStatus = test.passed ? chalk.green('✓') : chalk.red('✗');
      console.log(`      ${testStatus} ${chalk.dim(test.name)}`);
      if (!test.passed && test.failureMessage) {
        // Show first line of failure message, indented
        const firstLine = test.failureMessage.split('\n')[0]?.trim();
        if (firstLine) {
          console.log(chalk.red(`        └─ ${firstLine}`));
        }
      }
    }
  }

  // Show agent output if available and run failed
  if (!result.passed && result.agentOutput) {
    // Show generated files if any
    if (result.generatedFiles && result.generatedFiles.length > 0) {
      console.log(chalk.dim('    ─ Files in workspace:'));
      for (const file of result.generatedFiles) {
        console.log(chalk.dim(`      ${file}`));
      }
    }

    // Show full agent output
    console.log(chalk.dim('    ─ Agent Output:'));
    for (const line of result.agentOutput.split('\n')) {
      console.log(chalk.dim(`      ${line}`));
    }
  }

  // Show files in workspace even for passing runs (helpful for debugging)
  if (result.passed && result.generatedFiles && result.generatedFiles.length > 0) {
    console.log(chalk.dim('    ─ Files in workspace:'));
    for (const file of result.generatedFiles) {
      console.log(chalk.dim(`      ${file}`));
    }
  }

  console.log(''); // Empty line for readability
}

/**
 * Print experiment start message
 */
export function printExperimentStart(name: string, description: string): void {
  console.log('\n' + chalk.bold.blue(`▶ Starting experiment: ${name}`));
  console.log(chalk.dim(`  ${description}`));
}

/**
 * Print dry run info
 */
export function printDryRun(
  experiments: Array<{ name: string; description: string; skill: string | null; executionMode?: ExecutionMode }>,
  evals: string[]
): void {
  console.log('\n' + chalk.bold.yellow('🔬 DRY RUN - No API calls will be made\n'));

  console.log(chalk.bold('Experiments to run:'));
  for (const exp of experiments) {
    const mode = exp.executionMode ?? 'sdk';
    const modeLabel = mode === 'agent' ? chalk.cyan('[agent]') : chalk.blue('[sdk]');
    console.log(`  • ${modeLabel} ${exp.name}: ${exp.description}`);
    console.log(chalk.dim(`    Skill: ${exp.skill ?? 'none (baseline)'}`));
  }

  console.log('\n' + chalk.bold('Evals to run:'));
  for (const evalName of evals) {
    console.log(`  • ${evalName}`);
  }

  console.log('');
}

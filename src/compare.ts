import Table from 'cli-table3';
import chalk from 'chalk';
import type {
  ExperimentResult,
  ComparisonResult,
  EvalComparison,
  ExecutionMode,
  Usage,
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

  // Print token usage comparison (average per run)
  console.log('');
  console.log(chalk.bold('━'.repeat(80)));
  console.log(chalk.bold.cyan('                      TOKEN USAGE (avg per run)'));
  console.log(chalk.bold('━'.repeat(80)) + '\n');

  const usageTable = new Table({
    head: [
      chalk.bold('Experiment'),
      chalk.bold('Input Tokens'),
      chalk.bold('Output Tokens'),
      chalk.bold('Total Tokens'),
    ],
    colWidths: [20, 18, 18, 18],
    style: {
      head: [],
      border: [],
    },
  });

  const baselineUsage = comparison.baseline.totalUsage;
  const withSkillUsage = comparison.withSkill.totalUsage;

  // Calculate total runs for each experiment (runs per eval * number of evals)
  const baselineTotalRuns = comparison.baseline.config.runs * comparison.baseline.evalResults.length;
  const withSkillTotalRuns = comparison.withSkill.config.runs * comparison.withSkill.evalResults.length;

  // Calculate average tokens per run (rounded)
  const baselineAvgInput = baselineTotalRuns > 0 ? Math.round((baselineUsage?.inputTokens ?? 0) / baselineTotalRuns) : 0;
  const baselineAvgOutput = baselineTotalRuns > 0 ? Math.round((baselineUsage?.outputTokens ?? 0) / baselineTotalRuns) : 0;
  const withSkillAvgInput = withSkillTotalRuns > 0 ? Math.round((withSkillUsage?.inputTokens ?? 0) / withSkillTotalRuns) : 0;
  const withSkillAvgOutput = withSkillTotalRuns > 0 ? Math.round((withSkillUsage?.outputTokens ?? 0) / withSkillTotalRuns) : 0;

  usageTable.push([
    'Baseline',
    formatTokens(baselineAvgInput),
    formatTokens(baselineAvgOutput),
    formatTokens(baselineAvgInput + baselineAvgOutput),
  ]);

  usageTable.push([
    'With Skill',
    formatTokens(withSkillAvgInput),
    formatTokens(withSkillAvgOutput),
    formatTokens(withSkillAvgInput + withSkillAvgOutput),
  ]);

  // Calculate and show the difference (in averages)
  const inputDiff = withSkillAvgInput - baselineAvgInput;
  const outputDiff = withSkillAvgOutput - baselineAvgOutput;
  const totalDiff = inputDiff + outputDiff;

  const formatDiffTokens = (diff: number): string => {
    const formatted = formatTokens(Math.abs(diff));
    if (diff > 0) {
      return chalk.yellow(`+${formatted}`);
    } else if (diff < 0) {
      return chalk.green(`-${formatted}`);
    }
    return chalk.gray('0');
  };

  usageTable.push([
    chalk.dim('Difference'),
    formatDiffTokens(inputDiff),
    formatDiffTokens(outputDiff),
    formatDiffTokens(totalDiff),
  ]);

  console.log(usageTable.toString());
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
  if (result.totalUsage) {
    // Calculate average tokens per run (rounded)
    const totalRuns = result.config.runs * result.evalResults.length;
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
  passed: boolean
): void {
  const status = passed ? chalk.green('✓') : chalk.red('✗');
  console.log(
    chalk.dim(`  [${experimentName}] `) +
      evalName +
      chalk.dim(` run ${run}/${total} `) +
      status
  );
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

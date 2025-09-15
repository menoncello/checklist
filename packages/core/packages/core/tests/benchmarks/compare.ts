#!/usr/bin/env bun

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

interface BenchmarkResult {
  name: string;
  mean: number;
  min: number;
  max: number;
  stdDev: number;
  iterations: number;
  timestamp: string;
}

interface ComparisonResult {
  name: string;
  current: number;
  baseline: number;
  change: number;
  changePercent: number;
  status: 'improved' | 'degraded' | 'stable';
}

const RESULTS_DIR = '.performance';
const BASELINES_DIR = join(RESULTS_DIR, 'baselines');

function loadResults(filePath: string): BenchmarkResult[] {
  if (!existsSync(filePath)) {
    return [];
  }

  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch {
    return [];
  }
}

function compareResults(current: BenchmarkResult[], baseline: BenchmarkResult[]): ComparisonResult[] {
  const comparisons: ComparisonResult[] = [];

  for (const currentResult of current) {
    const baselineResult = baseline.find(b => b.name === currentResult.name);

    if (!baselineResult) {
      comparisons.push({
        name: currentResult.name,
        current: currentResult.mean,
        baseline: 0,
        change: currentResult.mean,
        changePercent: 0,
        status: 'stable'
      });
      continue;
    }

    const change = currentResult.mean - baselineResult.mean;
    const changePercent = (change / baselineResult.mean) * 100;

    let status: 'improved' | 'degraded' | 'stable' = 'stable';

    // Consider 5% threshold for significant change
    if (Math.abs(changePercent) > 5) {
      status = change < 0 ? 'improved' : 'degraded';
    }

    comparisons.push({
      name: currentResult.name,
      current: currentResult.mean,
      baseline: baselineResult.mean,
      change,
      changePercent,
      status
    });
  }

  return comparisons;
}

function generateMarkdownReport(comparisons: ComparisonResult[]): string {
  let report = '# Performance Comparison Report\n\n';

  if (comparisons.length === 0) {
    report += 'No benchmark results found for comparison.\n';
    return report;
  }

  report += '| Benchmark | Current (ms) | Baseline (ms) | Change | Status |\n';
  report += '|-----------|-------------|---------------|--------|--------|\n';

  for (const comp of comparisons) {
    const currentStr = comp.current.toFixed(2);
    const baselineStr = comp.baseline > 0 ? comp.baseline.toFixed(2) : 'N/A';
    const changeStr = comp.baseline > 0
      ? `${comp.change >= 0 ? '+' : ''}${comp.change.toFixed(2)}ms (${comp.changePercent >= 0 ? '+' : ''}${comp.changePercent.toFixed(1)}%)`
      : 'New';

    const statusEmoji = comp.status === 'improved' ? '🟢' :
                       comp.status === 'degraded' ? '🔴' : '⚪';

    report += `| ${comp.name} | ${currentStr} | ${baselineStr} | ${changeStr} | ${statusEmoji} ${comp.status} |\n`;
  }

  return report;
}

async function main() {
  console.log('📊 Comparing performance results...');

  // Load current results
  const startupResults = loadResults(join(RESULTS_DIR, 'startup-results.json'));
  const memoryResults = loadResults(join(RESULTS_DIR, 'memory-results.json'));
  const operationResults = loadResults(join(RESULTS_DIR, 'operation-results.json'));

  // Load baseline results
  const startupBaseline = loadResults(join(BASELINES_DIR, 'startup-baseline.json'));
  const memoryBaseline = loadResults(join(BASELINES_DIR, 'memory-baseline.json'));
  const operationBaseline = loadResults(join(BASELINES_DIR, 'operation-baseline.json'));

  // Compare results
  const startupComparisons = compareResults(startupResults, startupBaseline);
  const memoryComparisons = compareResults(memoryResults, memoryBaseline);
  const operationComparisons = compareResults(operationResults, operationBaseline);

  // Generate reports
  let fullReport = '# 📊 Performance Benchmark Results\n\n';

  if (startupComparisons.length > 0) {
    fullReport += '## 🚀 Startup Performance\n\n';
    fullReport += generateMarkdownReport(startupComparisons);
    fullReport += '\n';
  }

  if (memoryComparisons.length > 0) {
    fullReport += '## 💾 Memory Usage\n\n';
    fullReport += generateMarkdownReport(memoryComparisons);
    fullReport += '\n';
  }

  if (operationComparisons.length > 0) {
    fullReport += '## ⚡ Operation Performance\n\n';
    fullReport += generateMarkdownReport(operationComparisons);
    fullReport += '\n';
  }

  // Save comparison report
  const reportPath = join(RESULTS_DIR, 'comparison-report.md');
  writeFileSync(reportPath, fullReport);

  console.log(`✅ Comparison report saved to ${reportPath}`);

  // Check for significant regressions
  const allComparisons = [...startupComparisons, ...memoryComparisons, ...operationComparisons];
  const regressions = allComparisons.filter(c => c.status === 'degraded' && Math.abs(c.changePercent) > 10);

  if (regressions.length > 0) {
    console.log('🔴 Significant performance regressions detected:');
    for (const regression of regressions) {
      console.log(`  - ${regression.name}: ${regression.changePercent.toFixed(1)}% slower`);
    }
    process.exit(1);
  } else {
    console.log('✅ No significant performance regressions detected');
  }
}

if (import.meta.main) {
  main().catch(error => {
    console.error('Error running performance comparison:', error);
    process.exit(1);
  });
}
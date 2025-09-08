#!/usr/bin/env bun

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface BenchmarkResult {
  name: string;
  ops?: number;
  mean?: number;
  min?: number;
  max?: number;
}

function loadResults(path: string): BenchmarkResult[] {
  if (!existsSync(path)) {
    console.error(`File not found: ${path}`);
    return [];
  }
  
  try {
    const content = readFileSync(path, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    console.error(`Failed to parse results: ${error}`);
    return [];
  }
}

function compareResults(baseline: BenchmarkResult[], current: BenchmarkResult[]) {
  console.log('\n📊 Performance Comparison Report');
  console.log('=' .repeat(60));
  
  let hasRegression = false;
  const regressionThreshold = 0.1; // 10% regression threshold
  
  for (const currentResult of current) {
    const baselineResult = baseline.find(b => b.name === currentResult.name);
    
    if (!baselineResult) {
      console.log(`\n⚠️  ${currentResult.name}: No baseline available`);
      continue;
    }
    
    const currentOps = currentResult.ops ?? 0;
    const baselineOps = baselineResult.ops ?? 0;
    
    if (baselineOps === 0) {
      console.log(`\n➡️  ${currentResult.name}: Baseline has no data`);
      continue;
    }
    
    const change = ((currentOps - baselineOps) / baselineOps) * 100;
    const changeStr = change >= 0 ? `+${change.toFixed(2)}%` : `${change.toFixed(2)}%`;
    
    let status = '✅';
    let label = 'No regression';
    
    if (change < -regressionThreshold * 100) {
      status = '❌';
      label = 'REGRESSION DETECTED';
      hasRegression = true;
    } else if (change > regressionThreshold * 100) {
      status = '🚀';
      label = 'Performance improved';
    }
    
    console.log(`\n${status} ${currentResult.name}`);
    console.log(`   Baseline: ${baselineOps.toFixed(2)} ops/s`);
    console.log(`   Current:  ${currentOps.toFixed(2)} ops/s`);
    console.log(`   Change:   ${changeStr} (${label})`);
    
    if (currentResult.mean !== undefined && baselineResult.mean !== undefined) {
      const meanChange = ((currentResult.mean - baselineResult.mean) / baselineResult.mean) * 100;
      console.log(`   Mean time: ${currentResult.mean.toFixed(3)}ms (${meanChange >= 0 ? '+' : ''}${meanChange.toFixed(2)}%)`);
    }
  }
  
  console.log('\n' + '=' .repeat(60));
  
  if (hasRegression) {
    console.error('\n❌ Performance regressions detected!');
    
    // Write regression flag file
    const fs = require('fs');
    fs.writeFileSync('.performance/regression-detected', 'Performance regression detected in benchmarks');
    
    process.exit(1);
  } else {
    console.log('\n✅ All performance checks passed!');
  }
}

// Main execution
function main() {
  // __dirname is packages/core/tests/benchmarks, so we need to go up 4 levels to get to project root
  const projectRoot = join(__dirname, '..', '..', '..', '..');
  const baselinePath = join(projectRoot, '.performance', 'baselines', 'benchmark-results.json');
  const currentPath = join(projectRoot, '.performance', 'benchmark-results.json');
  
  console.log('Loading baseline from:', baselinePath);
  console.log('Loading current from:', currentPath);
  
  const baseline = loadResults(baselinePath);
  const current = loadResults(currentPath);
  
  if (baseline.length === 0) {
    console.log('\n⚠️  No baseline results found, skipping comparison');
    return;
  }
  
  if (current.length === 0) {
    console.error('\n❌ No current results found!');
    process.exit(1);
  }
  
  compareResults(baseline, current);
}

if (require.main === module) {
  main();
}
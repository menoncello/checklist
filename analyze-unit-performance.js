#!/usr/bin/env bun

import { spawn } from 'child_process';

console.log('🔍 Analyzing UNIT tests performance...');
console.log('====================================\n');

// Run unit tests and capture output
const testProcess = spawn('bun', ['run', 'test:unit'], {
  stdio: 'pipe',
  env: { ...process.env },
});

let output = '';
let errorOutput = '';

testProcess.stdout.on('data', (data) => {
  output += data.toString();
});

testProcess.stderr.on('data', (data) => {
  errorOutput += data.toString();
});

testProcess.on('close', (code) => {
  const fullOutput = output + errorOutput;

  console.log('📊 Unit Test Results Summary:');
  console.log('-----------------------------');

  // Extract summary line
  const summaryMatch = fullOutput.match(
    /Ran (\d+) tests? across (\d+) files?\.\s+\[(\d+\.?\d*)(ms|s)\]/
  );
  if (summaryMatch) {
    const totalTests = summaryMatch[1];
    const totalFiles = summaryMatch[2];
    const duration = parseFloat(summaryMatch[3]);
    const unit = summaryMatch[4];
    const durationMs = unit === 's' ? duration * 1000 : duration;

    console.log(`Total tests: ${totalTests}`);
    console.log(`Total files: ${totalFiles}`);
    console.log(`Total time: ${(durationMs / 1000).toFixed(2)}s`);
    console.log(
      `Average per test: ${(durationMs / parseInt(totalTests)).toFixed(2)}ms`
    );
    console.log(
      `Average per file: ${(durationMs / parseInt(totalFiles)).toFixed(0)}ms`
    );
  }

  // Extract pass/fail/skip counts
  const passMatch = fullOutput.match(/(\d+) pass/);
  const failMatch = fullOutput.match(/(\d+) fail/);
  const skipMatch = fullOutput.match(/(\d+) skip/);

  if (passMatch || failMatch || skipMatch) {
    console.log('\n🎯 Test Status:');
    console.log('---------------');
    if (passMatch) console.log(`✅ Passed: ${passMatch[1]}`);
    if (failMatch) console.log(`❌ Failed: ${failMatch[1]}`);
    if (skipMatch) console.log(`⏭️  Skipped: ${skipMatch[1]}`);
  }

  // Look for any explicit timing information
  const timingMatches = fullOutput.matchAll(/\[(\d+\.?\d*)(ms|s)\]/g);
  const timings = [];

  for (const match of timingMatches) {
    const duration = parseFloat(match[1]);
    const unit = match[2];
    const durationMs = unit === 's' ? duration * 1000 : duration;
    if (durationMs > 100) {
      // Only show tests over 100ms
      timings.push(durationMs);
    }
  }

  if (timings.length > 0) {
    console.log('\n⏱️  Notable Timings (>100ms):');
    console.log('-----------------------------');
    timings.sort((a, b) => b - a);
    timings.slice(0, 10).forEach((time, i) => {
      console.log(`${i + 1}. ${time.toFixed(2)}ms`);
    });
  }

  // Check for potential performance issues
  console.log('\n🔍 Performance Analysis:');
  console.log('------------------------');

  if (summaryMatch) {
    const totalTests = parseInt(summaryMatch[1]);
    const duration = parseFloat(summaryMatch[3]);
    const unit = summaryMatch[4];
    const durationMs = unit === 's' ? duration * 1000 : duration;
    const avgPerTest = durationMs / totalTests;

    if (avgPerTest > 50) {
      console.log('⚠️  Average test time is high (>50ms per test)');
      console.log('   Consider optimizing slow tests or using more mocks');
    } else if (avgPerTest > 25) {
      console.log('💡 Average test time is moderate (>25ms per test)');
      console.log('   Room for optimization in some tests');
    } else {
      console.log('✅ Average test time is good (<25ms per test)');
    }

    if (durationMs > 30000) {
      // 30 seconds
      console.log('⚠️  Total unit test time is high (>30s)');
      console.log('   Consider breaking into smaller test suites');
    } else if (durationMs > 15000) {
      // 15 seconds
      console.log('💡 Total unit test time is moderate (>15s)');
      console.log('   Could be optimized for faster feedback');
    } else {
      console.log('✅ Total unit test time is good (<15s)');
    }
  }

  // Look for failed tests
  if (failMatch && parseInt(failMatch[1]) > 0) {
    console.log('\n❌ Failed Tests:');
    console.log('----------------');
    const failLines = fullOutput
      .split('\n')
      .filter((line) => line.includes('(fail)') || line.includes('error:'));
    failLines.slice(0, 5).forEach((line) => console.log(line.trim()));
  }

  console.log('\n💡 Recommendations:');
  console.log('-------------------');
  console.log('• Use mocks for external dependencies');
  console.log('• Utilize TestDataFactory for test data');
  console.log('• Avoid real I/O operations in unit tests');
  console.log('• Keep assertions focused and specific');
  console.log('• Consider using test.skip() for slow integration-like tests');

  process.exit(code);
});

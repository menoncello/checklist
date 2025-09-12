#!/usr/bin/env bun

import { spawn } from 'child_process';

console.log('🔍 Analyzing test performance...');
console.log('================================\n');

// Run bun test and capture output
const testProcess = spawn('bun', ['test'], {
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

  // Parse test durations
  const testMatches = fullOutput.matchAll(
    /(\(pass\)|✓|✔)\s+(.+?)\s+\[(\d+\.?\d*)(ms|s)\]/g
  );
  const tests = [];

  for (const match of testMatches) {
    const name = match[2];
    const duration = parseFloat(match[3]);
    const unit = match[4];
    const durationMs = unit === 's' ? duration * 1000 : duration;
    tests.push({ name, duration: durationMs });
  }

  // Sort by duration
  tests.sort((a, b) => b.duration - a.duration);

  // Display results
  console.log('Top 20 Slowest Tests:');
  console.log('---------------------');
  tests.slice(0, 20).forEach((test, i) => {
    const marker =
      test.duration > 500 ? '🚨' : test.duration > 100 ? '⚠️ ' : '✅';
    console.log(
      `${marker} ${(i + 1).toString().padStart(2)}. [${test.duration.toFixed(2)}ms] ${test.name}`
    );
  });

  console.log('\n📊 Statistics:');
  console.log('--------------');
  const totalTests = tests.length;
  const avgDuration =
    tests.reduce((sum, t) => sum + t.duration, 0) / totalTests;
  const maxDuration = Math.max(...tests.map((t) => t.duration));
  const minDuration = Math.min(...tests.map((t) => t.duration));
  const over100ms = tests.filter((t) => t.duration > 100).length;
  const over500ms = tests.filter((t) => t.duration > 500).length;

  console.log(`Total tests: ${totalTests}`);
  console.log(`Average duration: ${avgDuration.toFixed(2)}ms`);
  console.log(`Max duration: ${maxDuration.toFixed(2)}ms`);
  console.log(`Min duration: ${minDuration.toFixed(2)}ms`);
  console.log(
    `Tests > 100ms: ${over100ms} (${((over100ms / totalTests) * 100).toFixed(1)}%)`
  );
  console.log(
    `Tests > 500ms: ${over500ms} (${((over500ms / totalTests) * 100).toFixed(1)}%)`
  );

  // Check for file-level timing
  const fileMatches = fullOutput.matchAll(
    /Ran (\d+) tests? across (\d+) files?\.\s+\[(\d+\.?\d*)(ms|s)\]/g
  );
  let totalFileTime = 0;
  for (const match of fileMatches) {
    const duration = parseFloat(match[3]);
    const unit = match[4];
    totalFileTime += unit === 's' ? duration * 1000 : duration;
  }

  console.log(
    `\n⏱️  Total execution time: ${(totalFileTime / 1000).toFixed(2)}s`
  );

  // Find test files that might be slow
  console.log('\n📁 Potentially Slow Test Files:');
  console.log('--------------------------------');
  const fileTimingMatches = fullOutput.matchAll(
    /(.+?\.test\.ts).*?\[(\d+\.?\d*)(ms|s)\]/g
  );
  const fileTimings = new Map();

  for (const match of fileTimingMatches) {
    const file = match[1];
    const duration = parseFloat(match[2]);
    const unit = match[3];
    const durationMs = unit === 's' ? duration * 1000 : duration;

    if (!fileTimings.has(file) || fileTimings.get(file) < durationMs) {
      fileTimings.set(file, durationMs);
    }
  }

  const sortedFiles = Array.from(fileTimings.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  sortedFiles.forEach(([file, duration]) => {
    const marker = duration > 1000 ? '🚨' : duration > 500 ? '⚠️ ' : '✅';
    console.log(`${marker} [${duration.toFixed(2)}ms] ${file}`);
  });

  process.exit(code);
});

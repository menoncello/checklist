#!/usr/bin/env bun

/**
 * Sequential Test Runner
 *
 * Runs tests in logical blocks to isolate issues and provide detailed reporting
 */

import { spawn } from 'bun';

// Define test blocks based on package and functionality
const testBlocks = [
  {
    name: 'CLI Package Tests',
    paths: ['apps/cli/'],
    timeout: 60000,
    priority: 1,
  },
  {
    name: 'Core Package Tests',
    paths: ['packages/core/'],
    timeout: 120000,
    priority: 2,
  },
  {
    name: 'TUI Performance Tests',
    paths: ['packages/tui/tests/performance/'],
    timeout: 60000,
    priority: 3,
  },
  {
    name: 'TUI Terminal Tests',
    paths: ['packages/tui/tests/terminal/'],
    timeout: 90000,
    priority: 4,
  },
  {
    name: 'TUI Events Tests',
    paths: ['packages/tui/tests/events/'],
    timeout: 60000,
    priority: 5,
  },
  {
    name: 'TUI Error Handling Tests',
    paths: ['packages/tui/tests/errors/'],
    timeout: 60000,
    priority: 6,
  },
  {
    name: 'TUI Layout Tests',
    paths: ['packages/tui/tests/layout/'],
    timeout: 60000,
    priority: 7,
  },
  {
    name: 'TUI Input Tests',
    paths: ['packages/tui/tests/input/'],
    timeout: 60000,
    priority: 8,
  },
  {
    name: 'TUI Navigation Tests',
    paths: ['packages/tui/tests/navigation/'],
    timeout: 60000,
    priority: 9,
  },
  {
    name: 'TUI Framework Tests',
    paths: ['packages/tui/tests/framework/'],
    timeout: 60000,
    priority: 10,
  },
  {
    name: 'TUI Application Tests',
    paths: ['packages/tui/tests/application/'],
    timeout: 90000,
    priority: 11,
  },
  {
    name: 'TUI Views Tests',
    paths: ['packages/tui/tests/views/'],
    timeout: 60000,
    priority: 12,
  },
  {
    name: 'TUI Mocks and Helpers',
    paths: ['packages/tui/tests/mocks/', 'packages/tui/tests/helpers/'],
    timeout: 60000,
    priority: 13,
  },
];

// Global results tracking
const globalResults = {
  startTime: new Date(),
  endTime: null,
  totalBlocks: testBlocks.length,
  completedBlocks: 0,
  blocks: [],
  summary: {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
  },
};

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
};

function colorLog(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function formatDuration(ms) {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function parseTestOutput(output) {
  const lines = output.split('\n');
  const result = {
    passed: 0,
    failed: 0,
    skipped: 0,
    errors: 0,
    total: 0,
    files: 0,
    duration: 0,
    hasFailures: false,
  };

  for (const line of lines) {
    // Parse test counts
    if (line.includes(' pass') && line.includes(' fail')) {
      const match = line.match(/(\d+)\s*pass.*?(\d+)\s*fail/);
      if (match) {
        result.passed = parseInt(match[1]);
        result.failed = parseInt(match[2]);
        result.total = result.passed + result.failed;
        result.hasFailures = result.failed > 0;
      }
    }

    // Parse skipped tests
    if (line.includes('tests skipped')) {
      const match = line.match(/(\d+)\s*tests? skipped/);
      if (match) result.skipped = parseInt(match[1]);
    }

    // Parse file count
    if (line.includes('Ran') && line.includes('files')) {
      const match = line.match(
        /Ran\s+(\d+)\s+tests?\s+across\s+(\d+)\s+files?/
      );
      if (match) {
        result.files = parseInt(match[2]);
      }
    }

    // Parse duration
    if (line.includes('[', 's') || line.includes('[', 'ms')) {
      const match = line.match(/\[(\d+(?:\.\d+)?)ms?\]/);
      if (match) {
        result.duration = parseFloat(match[1]);
      }
    }

    // Check for errors
    if (
      line.includes('error:') ||
      line.includes('TypeError:') ||
      line.includes('ReferenceError:')
    ) {
      result.errors++;
    }
  }

  return result;
}

async function runTestBlock(block, blockIndex) {
  const startTime = Date.now();
  colorLog(
    `\n🧪 Running Block ${blockIndex + 1}/${testBlocks.length}: ${block.name}`,
    'cyan'
  );
  colorLog(`   Paths: ${block.paths.join(', ')}`, 'gray');

  try {
    // Build the test command
    const args = [
      'test',
      ...block.paths,
      '--timeout',
      block.timeout.toString(),
    ];

    if (process.env.VERBOSE === 'true') {
      args.push('--verbose');
    }

    const process = spawn({
      cmd: 'bun',
      args: args,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    let output = '';
    let errorOutput = '';

    // Collect output
    if (process.stdout) {
      for await (const chunk of process.stdout) {
        const text = new TextDecoder().decode(chunk);
        output += text;
        if (process.env.VERBOSE === 'true') {
          process.stdout.write(text);
        }
      }
    }

    if (process.stderr) {
      for await (const chunk of process.stderr) {
        const text = new TextDecoder().decode(chunk);
        errorOutput += text;
        if (process.env.VERBOSE === 'true') {
          process.stderr.write(text);
        }
      }
    }

    const exitCode = await process.exited;

    const duration = Date.now() - startTime;
    const results = parseTestOutput(output);

    // If parsing failed, try to get basic info from the process
    if (results.total === 0 && exitCode !== 0) {
      results.errors = 1;
      results.hasFailures = true;
    }

    const blockResult = {
      ...block,
      startTime: new Date(startTime),
      endTime: new Date(),
      duration,
      exitCode,
      results,
      output:
        process.env.VERBOSE === 'true'
          ? output
          : output.substring(output.length - 1000),
      errorOutput:
        process.env.VERBOSE === 'true'
          ? errorOutput
          : errorOutput.substring(errorOutput.length - 1000),
    };

    // Display results
    const status = results.hasFailures
      ? '❌ FAILED'
      : results.total > 0
        ? '✅ PASSED'
        : '⚠️  NO TESTS';
    const statusColor = results.hasFailures
      ? 'red'
      : results.total > 0
        ? 'green'
        : 'yellow';

    colorLog(`   Status: ${status}`, statusColor);
    colorLog(
      `   Results: ${results.passed} pass, ${results.failed} fail, ${results.skipped} skipped`,
      results.hasFailures ? 'red' : 'white'
    );
    colorLog(`   Duration: ${formatDuration(duration)}`, 'gray');

    if (results.errors > 0) {
      colorLog(`   Errors detected: ${results.errors}`, 'red');
    }

    globalResults.blocks.push(blockResult);
    globalResults.completedBlocks++;

    // Update global summary
    globalResults.summary.total += results.total;
    globalResults.summary.passed += results.passed;
    globalResults.summary.failed += results.failed;
    globalResults.summary.skipped += results.skipped;
    globalResults.summary.errors += results.errors;

    return blockResult;
  } catch (error) {
    const duration = Date.now() - startTime;
    colorLog(`   ❌ CRITICAL ERROR: ${error.message}`, 'red');

    const errorResult = {
      ...block,
      startTime: new Date(startTime),
      endTime: new Date(),
      duration,
      exitCode: 1,
      results: {
        passed: 0,
        failed: 1,
        skipped: 0,
        errors: 1,
        total: 0,
        hasFailures: true,
      },
      error: error.message,
    };

    globalResults.blocks.push(errorResult);
    globalResults.completedBlocks++;
    globalResults.summary.failed++;
    globalResults.summary.errors++;

    return errorResult;
  }
}

function generateSummary() {
  globalResults.endTime = new Date();
  const totalDuration = globalResults.endTime - globalResults.startTime;

  colorLog('\n' + '='.repeat(80), 'cyan');
  colorLog('🏁 SEQUENTIAL TEST RUN SUMMARY', 'bright');
  colorLog('='.repeat(80), 'cyan');

  // Overall statistics
  colorLog(`\n📊 Overall Results:`, 'bright');
  colorLog(`   Total Tests: ${globalResults.summary.total}`, 'white');
  colorLog(`   ✅ Passed: ${globalResults.summary.passed}`, 'green');
  colorLog(
    `   ❌ Failed: ${globalResults.summary.failed}`,
    globalResults.summary.failed > 0 ? 'red' : 'white'
  );
  colorLog(`   ⏭️  Skipped: ${globalResults.summary.skipped}`, 'yellow');
  colorLog(
    `   💥 Errors: ${globalResults.summary.errors}`,
    globalResults.summary.errors > 0 ? 'red' : 'white'
  );

  colorLog(`\n⏱️  Timing:`, 'bright');
  colorLog(`   Total Duration: ${formatDuration(totalDuration)}`, 'white');
  colorLog(
    `   Blocks Completed: ${globalResults.completedBlocks}/${globalResults.totalBlocks}`,
    'white'
  );

  // Block by block results
  colorLog(`\n📋 Block Results:`, 'bright');

  const sortedBlocks = [...globalResults.blocks].sort(
    (a, b) =>
      b.results.failed - a.results.failed || b.results.errors - a.results.errors
  );

  for (const block of sortedBlocks) {
    const status = block.results.hasFailures
      ? '❌'
      : block.results.total > 0
        ? '✅'
        : '⚠️';
    const statusColor = block.results.hasFailures
      ? 'red'
      : block.results.total > 0
        ? 'green'
        : 'yellow';

    colorLog(
      `   ${status} ${block.name.padEnd(30)} ${formatDuration(block.duration).padStart(8)}`,
      statusColor
    );

    if (block.results.hasFailures) {
      colorLog(
        `      ↳ ${block.results.failed} failed, ${block.results.errors} errors`,
        'red'
      );
    }
  }

  // Failed blocks details
  const failedBlocks = globalResults.blocks.filter(
    (b) => b.results.hasFailures || b.results.errors > 0
  );
  if (failedBlocks.length > 0) {
    colorLog(`\n❌ Failed Blocks (${failedBlocks.length}):`, 'red');

    for (const block of failedBlocks) {
      colorLog(`   ${block.name}:`, 'red');
      colorLog(`     - ${block.results.failed} failed tests`, 'red');
      if (block.results.errors > 0) {
        colorLog(`     - ${block.results.errors} errors`, 'red');
      }
      colorLog(`     - Duration: ${formatDuration(block.duration)}`, 'red');

      // Show sample error if available
      if (block.errorOutput && block.errorOutput.length > 0) {
        const errorLines = block.errorOutput
          .split('\n')
          .filter(
            (line) =>
              line.includes('error:') ||
              line.includes('TypeError:') ||
              line.includes('ReferenceError:')
          )
          .slice(0, 3);

        if (errorLines.length > 0) {
          colorLog(`     - Sample errors:`, 'red');
          errorLines.forEach((line) => {
            colorLog(`       ${line.trim()}`, 'red');
          });
        }
      }
    }
  }

  // Success rate
  const successRate =
    globalResults.summary.total > 0
      ? (
          (globalResults.summary.passed / globalResults.summary.total) *
          100
        ).toFixed(2)
      : 0;

  colorLog(
    `\n🎯 Success Rate: ${successRate}%`,
    successRate > 90 ? 'green' : successRate > 70 ? 'yellow' : 'red'
  );

  // Final status
  const finalStatus =
    globalResults.summary.failed === 0 && globalResults.summary.errors === 0
      ? '🎉 ALL TESTS PASSED!'
      : `❌ ${globalResults.summary.failed} TESTS FAILED`;
  const finalColor =
    globalResults.summary.failed === 0 && globalResults.summary.errors === 0
      ? 'green'
      : 'red';

  colorLog(`\n${finalStatus}`, finalColor);
  colorLog('='.repeat(80), 'cyan');

  return {
    success:
      globalResults.summary.failed === 0 && globalResults.summary.errors === 0,
    summary: globalResults.summary,
    blocks: globalResults.blocks,
    duration: totalDuration,
  };
}

// Main execution
async function main() {
  colorLog('🚀 Starting Sequential Test Runner', 'bright');
  colorLog(`Total test blocks: ${testBlocks.length}`, 'gray');

  if (process.env.VERBOSE === 'true') {
    colorLog('Verbose mode enabled', 'yellow');
  }

  try {
    // Sort blocks by priority
    testBlocks.sort((a, b) => a.priority - b.priority);

    // Run blocks sequentially
    for (let i = 0; i < testBlocks.length; i++) {
      const block = testBlocks[i];
      const blockResult = await runTestBlock(block, i);

      // Optionally stop on first failure
      if (
        process.env.STOP_ON_FAILURE === 'true' &&
        blockResult.results.hasFailures
      ) {
        colorLog('\n⛔ Stopping on first failure as requested', 'red');
        break;
      }
    }

    // Generate and display final summary
    const results = generateSummary();

    // Exit with appropriate code
    if (process.exitCode === undefined) {
      process.exit(results.success ? 0 : 1);
    }
  } catch (error) {
    colorLog(`\n💥 Fatal error in test runner: ${error.message}`, 'red');
    colorLog(error.stack, 'red');
    process.exit(1);
  }
}

// Run the script
if (import.meta.main) {
  main();
}

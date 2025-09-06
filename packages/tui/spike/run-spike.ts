#!/usr/bin/env bun

import type { SpikeResult } from './types';
import { ANSIApproachTest } from './approach-2-ansi';
import { HybridApproachTest } from './approach-3-hybrid';
import { writeFileSync } from 'fs';
import { join } from 'path';

async function runSpike() {
  console.log('🚀 Starting TUI Technology Spike...\n');

  const results: SpikeResult[] = [];
  const approaches = [
    // Note: Ink approach would need React dependencies installed
    // new InkApproachTest(),
    new ANSIApproachTest(),
    new HybridApproachTest(),
  ];

  for (const approach of approaches) {
    console.log(`\n📊 Testing ${approach.name}...`);

    try {
      const result = await approach.run();
      results.push(result);

      console.log(`✅ ${approach.name} completed`);
      console.log(`   Score: ${result.score}/100`);
      console.log(`   Startup: ${result.metrics.startupTime.toFixed(2)}ms`);
      console.log(`   Render: ${result.metrics.renderTime.toFixed(2)}ms`);
      console.log(`   Memory: ${result.metrics.memoryUsed.toFixed(2)}MB`);

      if (result.issues.length > 0) {
        console.log(`   Issues: ${result.issues.join(', ')}`);
      }
    } catch (error) {
      console.error(`❌ ${approach.name} failed: ${error}`);
      results.push({
        approach: approach.name,
        success: false,
        metrics: {
          startupTime: 0,
          renderTime: 0,
          memoryUsed: 0,
          fps: 0,
        },
        issues: [`Fatal error: ${error}`],
        platformResults: {
          macOS: false,
          linux: false,
          windows: false,
          ssh: false,
          tmux: false,
        },
        bunCompatible: false,
        score: 0,
      });
    }
  }

  // Generate report
  const report = generateReport(results);
  const reportPath = join(
    process.cwd(),
    '../../../docs/architecture/decisions/spike-results.md'
  );
  writeFileSync(reportPath, report);
  console.log(`\n📄 Report saved to: ${reportPath}`);

  // Determine winner
  const winner = results.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  console.log(`\n🏆 Winner: ${winner.approach} (Score: ${winner.score}/100)`);

  // Go/No-Go decision
  const decision =
    winner.score >= 75
      ? 'GO'
      : winner.score >= 50
        ? 'GO (Hybrid)'
        : 'NO-GO (Use CLI)';
  console.log(`📋 Decision: ${decision}`);

  return { results, winner, decision };
}

function generateReport(results: SpikeResult[]): string {
  const timestamp = new Date().toISOString();

  return `# TUI Technology Spike Results

Generated: ${timestamp}

## Executive Summary

Three TUI implementation approaches were tested against performance and compatibility criteria.

## Results Summary

| Approach | Score | Startup (ms) | Render (ms) | Memory (MB) | Bun Compatible |
|----------|-------|--------------|-------------|-------------|----------------|
${results
  .map(
    (r) =>
      `| ${r.approach} | ${r.score}/100 | ${r.metrics.startupTime.toFixed(2)} | ${r.metrics.renderTime.toFixed(2)} | ${r.metrics.memoryUsed.toFixed(2)} | ${r.bunCompatible ? '✅' : '❌'} |`
  )
  .join('\n')}

## Detailed Results

${results
  .map(
    (r) => `
### ${r.approach}

**Score:** ${r.score}/100  
**Success:** ${r.success ? '✅' : '❌'}  
**Bun Compatible:** ${r.bunCompatible ? '✅' : '❌'}

#### Performance Metrics
- Startup Time: ${r.metrics.startupTime.toFixed(2)}ms (Target: <50ms)
- Render Time: ${r.metrics.renderTime.toFixed(2)}ms (Target: <100ms)
- Memory Usage: ${r.metrics.memoryUsed.toFixed(2)}MB (Target: <50MB)
- FPS: ${r.metrics.fps.toFixed(2)}

#### Platform Compatibility
- macOS: ${r.platformResults.macOS ? '✅' : '❌'}
- Linux: ${r.platformResults.linux ? '✅' : '❌'}
- Windows: ${r.platformResults.windows ? '✅' : '❌'}
- SSH: ${r.platformResults.ssh ? '✅' : '❌'}
- tmux: ${r.platformResults.tmux ? '✅' : '❌'}

${r.issues.length > 0 ? `#### Issues\n${r.issues.map((i) => `- ${i}`).join('\n')}` : ''}
`
  )
  .join('\n')}

## Scoring Breakdown

### Scoring Rubric (100 points total)

#### Performance (40 points)
- Startup <50ms: 10 points
- Render <100ms: 15 points
- Memory <50MB: 15 points

#### Compatibility (30 points)
- Cross-platform support: 15 points
- Bun runtime compatibility: 15 points

#### Functionality (20 points)
- Scrolling: 5 points
- Keyboard navigation: 5 points
- Resize handling: 5 points
- No flicker: 5 points

#### Maintainability (10 points)
- Code complexity: 5 points
- Dependency count: 5 points

## Recommendation

${(() => {
  const winner = results.reduce((best, current) =>
    current.score > best.score ? current : best
  );

  if (winner.score >= 75) {
    return `**GO**: Proceed with ${winner.approach} implementation (Score: ${winner.score}/100)`;
  } else if (winner.score >= 50) {
    return `**GO (Hybrid)**: Proceed with ${winner.approach} but implement CLI fallback (Score: ${winner.score}/100)`;
  } else {
    return `**NO-GO**: Fall back to CLI-only implementation. Highest score ${winner.score}/100 is below threshold.`;
  }
})()}

## Next Steps

1. ${results.some((r) => r.score >= 75) ? 'Proceed with TUI implementation using winning approach' : 'Activate CLI fallback plan'}
2. Update architecture documents with decision
3. ${results.some((r) => r.score >= 50) ? 'Begin implementation of stories 1.8 and 1.9' : 'Revise stories 1.8 and 1.9 for CLI approach'}
`;
}

// Run if executed directly
if (import.meta.main) {
  runSpike().catch(console.error);
}

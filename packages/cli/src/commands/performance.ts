import { writeFileSync } from 'fs';
import { chromeDevTools } from '../../../tui/src/performance/ChromeDevToolsIntegration';
import {
  getProfileStats,
  clearProfileResults,
} from '../../../tui/src/performance/ProfileDecorator';
import type { CommandOption, ParsedOptions } from '../types';
import { BaseCommand } from './base';

export class PerformanceCommand extends BaseCommand {
  name = 'performance';
  description = 'Performance analysis and profiling commands';
  aliases = ['perf'];
  options: CommandOption[] = [
    {
      flag: 'profile',
      description: 'Show performance profiling statistics',
    },
    {
      flag: 'memory',
      description: 'Show current memory usage',
    },
    {
      flag: 'devtools',
      description: 'Show Chrome DevTools integration status',
    },
    {
      flag: 'report',
      description: 'Generate comprehensive performance report',
    },
    {
      flag: 'clear',
      description: 'Clear profiling data',
    },
    {
      flag: 'gc',
      description: 'Force garbage collection before memory stats',
    },
    {
      flag: 'format',
      description: 'Output format (json|table)',
      default: 'table',
    },
    {
      flag: 'output',
      description: 'Output file path',
      default: './performance-report.json',
    },
  ];

  async action(options: ParsedOptions): Promise<void> {
    this.validateOptions(options);

    const profile = this.getOption(options, 'profile', false);
    const memory = this.getOption(options, 'memory', false);
    const devtools = this.getOption(options, 'devtools', false);
    const report = this.getOption(options, 'report', false);
    const clear = this.getOption(options, 'clear', false);
    const gc = this.getOption(options, 'gc', false);
    const format = this.getOption(options, 'format', 'table');
    const output = this.getOption(
      options,
      'output',
      './performance-report.json'
    );

    if (profile) {
      await this.showProfile(clear, format);
    } else if (memory) {
      await this.showMemory(gc);
    } else if (devtools) {
      await this.showDevTools();
    } else if (report) {
      await this.generateReport(output);
    } else {
      // Default: show all performance info
      await this.showAll();
    }
  }

  private async showProfile(clear: boolean, format: string): Promise<void> {
    const stats = getProfileStats();

    if (format === 'json') {
      console.log(JSON.stringify(stats, null, 2));
    } else {
      console.log('\n📊 Performance Profile Statistics');
      console.log('=====================================');
      console.log(`Total calls: ${stats.totalCalls}`);
      console.log(`Average duration: ${stats.averageDuration.toFixed(2)}ms`);
      console.log(`Max duration: ${stats.maxDuration.toFixed(2)}ms`);
      console.log(`Min duration: ${stats.minDuration.toFixed(2)}ms`);
      console.log(`Slow operations (>50ms): ${stats.slowOperations.length}`);

      if (stats.slowOperations.length > 0) {
        console.log('\n🐌 Slow Operations:');
        stats.slowOperations
          .sort((a, b) => b.duration - a.duration)
          .slice(0, 10)
          .forEach((op, i) => {
            console.log(`  ${i + 1}. ${op.name}: ${op.duration.toFixed(2)}ms`);
          });
      }
    }

    if (clear) {
      clearProfileResults();
      console.log('\n✅ Profile data cleared');
    }
  }

  private async showMemory(forceGc: boolean): Promise<void> {
    if (forceGc && global.gc) {
      console.log('🗑️  Running garbage collection...');
      global.gc();
    }

    const usage = process.memoryUsage();
    const formatBytes = (bytes: number) =>
      (bytes / 1024 / 1024).toFixed(2) + ' MB';

    console.log('\n💾 Memory Usage');
    console.log('===============');
    console.log(`RSS (Resident Set Size): ${formatBytes(usage.rss)}`);
    console.log(`Heap Total: ${formatBytes(usage.heapTotal)}`);
    console.log(`Heap Used: ${formatBytes(usage.heapUsed)}`);
    console.log(`External: ${formatBytes(usage.external)}`);
    console.log(`Array Buffers: ${formatBytes(usage.arrayBuffers)}`);

    const heapUsagePercent = ((usage.heapUsed / usage.heapTotal) * 100).toFixed(
      1
    );
    console.log(`\nHeap Usage: ${heapUsagePercent}%`);

    if (parseFloat(heapUsagePercent) > 80) {
      console.log(
        '⚠️  High heap usage detected! Consider running garbage collection.'
      );
    }
  }

  private async showDevTools(): Promise<void> {
    console.log(chromeDevTools.generateReport());
  }

  private async generateReport(outputPath: string): Promise<void> {
    try {
      console.log('📋 Generating performance report...');

      const report = this.createPerformanceReport();
      writeFileSync(outputPath, JSON.stringify(report, null, 2));

      console.log(`✅ Performance report saved to: ${outputPath}`);
      this.displayReportSummary(report);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Failed to generate report:', errorMessage);
    }
  }

  private createPerformanceReport() {
    const profileStats = getProfileStats();
    const memoryUsage = process.memoryUsage();
    const devToolsStatus = chromeDevTools.isAvailable();

    return {
      timestamp: new Date().toISOString(),
      memoryUsage: {
        rss: memoryUsage.rss,
        heapTotal: memoryUsage.heapTotal,
        heapUsed: memoryUsage.heapUsed,
        external: memoryUsage.external,
        arrayBuffers: memoryUsage.arrayBuffers,
        heapUsagePercent: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100,
      },
      profiling: profileStats,
      devTools: {
        available: devToolsStatus,
        url: chromeDevTools.getDebuggerUrl(),
      },
      system: {
        platform: process.platform,
        arch: process.arch,
        nodeVersion: process.version,
        uptime: process.uptime(),
      },
    };
  }

  private displayReportSummary(
    report: ReturnType<typeof this.createPerformanceReport>
  ): void {
    console.log('\n📊 Summary:');
    console.log(
      `Memory usage: ${(report.memoryUsage.heapUsed / 1024 / 1024).toFixed(2)} MB`
    );
    console.log(`Profile calls: ${report.profiling.totalCalls}`);
    console.log(`Slow operations: ${report.profiling.slowOperations.length}`);
    console.log(
      `DevTools: ${report.devTools.available ? 'Available' : 'Not Available'}`
    );
  }

  private async showAll(): Promise<void> {
    console.log('\n🚀 Performance Overview');
    console.log('========================');

    await this.showMemory(false);
    await this.showProfile(false, 'table');
    await this.showDevTools();
  }
}

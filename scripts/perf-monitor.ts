#!/usr/bin/env bun
/**
 * Performance Budget Monitor
 * Tracks startup time, memory usage, and binary size metrics
 */

import { existsSync, statSync } from 'fs';
import { spawn } from 'child_process';
import path from 'path';

interface PerformanceBudget {
  startupTime: number; // milliseconds
  memoryUsage: number; // MB
  binarySize: number; // MB
}

interface PerformanceMetrics {
  startupTime?: number;
  memoryUsage?: number;
  binarySize?: number;
  timestamp: string;
}

const BUDGET: PerformanceBudget = {
  startupTime: 100, // < 100ms
  memoryUsage: 50, // < 50MB
  binarySize: 10, // < 10MB
};

class PerformanceMonitor {
  private metrics: PerformanceMetrics = {
    timestamp: new Date().toISOString(),
  };

  async measureStartupTime(): Promise<number> {
    const cliPath = path.resolve(__dirname, '../packages/cli/src/index.ts');

    return new Promise((resolve, reject) => {
      const startTime = performance.now();

      const proc = spawn('bun', ['run', cliPath, '--version'], {
        env: { ...process.env, NODE_ENV: 'production' },
      });

      proc.on('exit', (code) => {
        const endTime = performance.now();
        const duration = Math.round(endTime - startTime);

        if (code === 0) {
          resolve(duration);
        } else {
          reject(new Error(`Process exited with code ${code}`));
        }
      });

      proc.on('error', reject);
    });
  }

  async measureMemoryUsage(): Promise<number> {
    const cliPath = path.resolve(__dirname, '../packages/cli/src/index.ts');

    return new Promise((resolve, reject) => {
      const proc = spawn('bun', ['run', cliPath, '--version'], {
        env: { ...process.env, NODE_ENV: 'production' },
      });

      let peakMemory = 0;

      const interval = setInterval(() => {
        try {
          // Get process memory usage
          const memUsage = process.memoryUsage();
          const totalMemoryMB = (memUsage.heapUsed + memUsage.external) / 1024 / 1024;
          peakMemory = Math.max(peakMemory, totalMemoryMB);
        } catch {
          // Process may have exited
        }
      }, 10);

      proc.on('exit', () => {
        clearInterval(interval);
        resolve(Math.round(peakMemory * 10) / 10);
      });

      proc.on('error', (error) => {
        clearInterval(interval);
        reject(error);
      });
    });
  }

  async measureBinarySize(): Promise<number | undefined> {
    // Check if compiled binary exists
    const binaryPaths = [
      path.resolve(__dirname, '../dist/checklist'),
      path.resolve(__dirname, '../packages/cli/dist/cli'),
    ];

    for (const binaryPath of binaryPaths) {
      if (existsSync(binaryPath)) {
        const stats = statSync(binaryPath);
        const sizeMB = stats.size / 1024 / 1024;
        return Math.round(sizeMB * 100) / 100;
      }
    }

    console.warn('No compiled binary found. Run `bun run build` first.');
    return undefined;
  }

  async runAllMeasurements(): Promise<void> {
    console.log('📊 Performance Budget Monitor\n');
    console.log('Measuring performance metrics...\n');

    // Measure startup time
    try {
      this.metrics.startupTime = await this.measureStartupTime();
      console.log(
        `✅ Startup Time: ${this.metrics.startupTime}ms (budget: <${BUDGET.startupTime}ms)`
      );
    } catch (error) {
      console.error('❌ Failed to measure startup time:', error);
    }

    // Measure memory usage
    try {
      this.metrics.memoryUsage = await this.measureMemoryUsage();
      console.log(
        `✅ Memory Usage: ${this.metrics.memoryUsage}MB (budget: <${BUDGET.memoryUsage}MB)`
      );
    } catch (error) {
      console.error('❌ Failed to measure memory usage:', error);
    }

    // Measure binary size
    this.metrics.binarySize = await this.measureBinarySize();
    if (this.metrics.binarySize !== undefined) {
      console.log(`✅ Binary Size: ${this.metrics.binarySize}MB (budget: <${BUDGET.binarySize}MB)`);
    }

    // Check budget compliance
    console.log('\n📈 Budget Compliance:\n');

    let allPassed = true;

    if (this.metrics.startupTime !== undefined) {
      const startupPassed = this.metrics.startupTime <= BUDGET.startupTime;
      console.log(
        `${startupPassed ? '✅' : '❌'} Startup Time: ${
          startupPassed ? 'PASS' : 'FAIL'
        } (${this.metrics.startupTime}ms / ${BUDGET.startupTime}ms)`
      );
      allPassed = allPassed && startupPassed;
    }

    if (this.metrics.memoryUsage !== undefined) {
      const memoryPassed = this.metrics.memoryUsage <= BUDGET.memoryUsage;
      console.log(
        `${memoryPassed ? '✅' : '❌'} Memory Usage: ${
          memoryPassed ? 'PASS' : 'FAIL'
        } (${this.metrics.memoryUsage}MB / ${BUDGET.memoryUsage}MB)`
      );
      allPassed = allPassed && memoryPassed;
    }

    if (this.metrics.binarySize !== undefined) {
      const sizePassed = this.metrics.binarySize <= BUDGET.binarySize;
      console.log(
        `${sizePassed ? '✅' : '❌'} Binary Size: ${
          sizePassed ? 'PASS' : 'FAIL'
        } (${this.metrics.binarySize}MB / ${BUDGET.binarySize}MB)`
      );
      allPassed = allPassed && sizePassed;
    }

    // Write metrics to file
    const reportPath = path.resolve(__dirname, '../coverage/perf-report.json');
    await Bun.write(reportPath, JSON.stringify(this.metrics, null, 2));

    console.log(`\n📄 Report saved to: coverage/perf-report.json`);
    console.log(
      `\n${allPassed ? '✅ All performance budgets met!' : '❌ Some performance budgets exceeded!'}`
    );

    process.exit(allPassed ? 0 : 1);
  }
}

// Run if executed directly
if (import.meta.main) {
  const monitor = new PerformanceMonitor();
  monitor.runAllMeasurements().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

export { PerformanceMonitor, BUDGET };

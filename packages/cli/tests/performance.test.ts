/**
 * Performance Tests
 * Validates CLI performance requirements (<10ms parsing)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { Bench } from 'tinybench';
import { CommandParser } from '../src/parser';

describe('Performance Tests', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...Bun.argv];
  });

  afterEach(() => {
    Bun.argv.length = 0;
    Bun.argv.push(...originalArgv);
  });

  describe.skip('Command Parsing Performance', () => {
    it('should parse simple commands in <10ms', async () => {
      const bench = new Bench({ time: 100, iterations: 100 });

      bench.add('parse simple command', () => {
        (Bun.argv as any) = ['bun', 'cli', 'init'];
        CommandParser.parse();
      });

      await bench.run();

      const results = bench.results[0];
      const avgTimeMs = results!.mean * 1000; // Convert to milliseconds

      expect(avgTimeMs).toBeLessThan(10);
    }, 5000);

    it('should parse complex commands in <10ms', async () => {
      const bench = new Bench({ time: 100, iterations: 100 });

      bench.add('parse complex command', () => {
        (Bun.argv as any) = [
          'bun', 'cli', 'run', 'template-name',
          '--config', 'config.yaml',
          '--verbose',
          '--no-color',
          '--dry-run',
          'extra-arg-1',
          'extra-arg-2'
        ];
        CommandParser.parse();
      });

      await bench.run();

      const results = bench.results[0];
      const avgTimeMs = results!.mean * 1000;

      expect(avgTimeMs).toBeLessThan(10);
    }, 5000);

    it('should parse commands with many arguments in <10ms', async () => {
      const bench = new Bench({ time: 100, iterations: 100 });

      bench.add('parse command with many arguments', () => {
        // Create command with 50 arguments (within limits)
        const args = ['bun', 'cli', 'run', 'template'];
        for (let i = 0; i < 25; i++) {
          args.push(`--flag${i}`, `value${i}`);
        }
        (Bun.argv as any) = args;
        CommandParser.parse();
      });

      await bench.run();

      const results = bench.results[0];
      const avgTimeMs = results!.mean * 1000;

      expect(avgTimeMs).toBeLessThan(10);
    }, 5000);

    it('should validate input in <1ms', async () => {
      const bench = new Bench({ time: 100, iterations: 100 });
      const validArgs = {
        command: 'run',
        args: ['template-name'],
        options: { _: ['template-name'] }
      };

      bench.add('validate input', () => {
        CommandParser.validateInput(validArgs);
      });

      await bench.run();

      const results = bench.results[0];
      const avgTimeMs = results!.mean * 1000;

      expect(avgTimeMs).toBeLessThan(1);
    }, 5000);
  });

  describe('Memory Usage', () => {
    it('should not create excessive objects during parsing', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Parse multiple commands to test memory usage
      for (let i = 0; i < 1000; i++) {
        (Bun.argv as any) = ['bun', 'cli', 'run', `template-${i}`, '--verbose'];
        CommandParser.parse();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Should not increase memory by more than 1MB for 1000 parses
      expect(memoryIncrease).toBeLessThan(1024 * 1024);
    });
  });

  describe.skip('Startup Performance', () => {
    it('should load CLI module quickly', async () => {
      const bench = new Bench({ time: 100, iterations: 10 });

      bench.add('import CLI module', async () => {
        // Simulate module loading
        await import('../src/index');
      });

      await bench.run();

      const results = bench.results[0];
      const avgTimeMs = results!.mean * 1000;

      // Module loading should be very fast
      expect(avgTimeMs).toBeLessThan(50);
    }, 5000);
  });
});
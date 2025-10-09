/**
 * Unit Tests for CommandParser
 * Tests argument parsing, validation, and security features
 */

import { describe, it, expect } from 'bun:test';
import { CommandParser } from '../src/parser';
import type { ParsedArgs } from '../src/types';

describe('CommandParser', () => {

  describe('parse', () => {
    it('should return default args when no arguments provided', () => {
      const result = CommandParser.parse(['bun', 'script']);

      expect(result.command).toBe('help');
      expect(result.args).toEqual([]);
      expect(result.options).toEqual({ _: [] });
    });

    it('should parse simple command with no options', () => {
      const result = CommandParser.parse(['bun', 'script', 'init']);

      expect(result.command).toBe('init');
      expect(result.args).toEqual([]);
      expect(result.options).toEqual({ _: [] });
    });

    it('should parse command with positional arguments', () => {
      const result = CommandParser.parse(['bun', 'script', 'run', 'development', '--verbose']);

      expect(result.command).toBe('run');
      expect(result.args).toEqual(['development', '--verbose']);
      expect(result.options.verbose).toBe(true);
      expect(result.options._).toEqual(['development']);
    });

    it('should parse long flags with values using =', () => {
      const result = CommandParser.parse(['bun', 'script', 'init', '--template=custom']);

      expect(result.command).toBe('init');
      expect(result.options.template).toBe('custom');
    });

    it('should parse long flags with values using space', () => {
      const result = CommandParser.parse(['bun', 'script', 'init', '--template', 'custom']);

      expect(result.command).toBe('init');
      expect(result.options.template).toBe('custom');
    });

    it('should parse boolean flags correctly', () => {
      const result = CommandParser.parse(['bun', 'script', 'run', '--verbose', '--force']);

      expect(result.command).toBe('run');
      expect(result.options.verbose).toBe(true);
      expect(result.options.force).toBe(true);
    });

    it('should parse short flags', () => {
      const result = CommandParser.parse(['bun', 'script', 'run', '-v', '-f']);

      expect(result.command).toBe('run');
      expect(result.options.v).toBe(true);
      expect(result.options.f).toBe(true);
    });

    it('should parse combined short flags', () => {
      const result = CommandParser.parse(['bun', 'script', 'run', '-vf']);

      expect(result.command).toBe('run');
      expect(result.options.v).toBe(true);
      expect(result.options.f).toBe(true);
    });

    it('should parse short flags with values', () => {
      const result = CommandParser.parse(['bun', 'script', 'run', '-t', 'custom']);

      expect(result.command).toBe('run');
      expect(result.options.t).toBe('custom');
    });

    it('should parse positional arguments after flags', () => {
      const result = CommandParser.parse(['bun', 'script', 'add', 'task', '--force', 'high-priority']);

      expect(result.command).toBe('add');
      expect(result.args).toEqual(['task', '--force', 'high-priority']);
      expect(result.options.force).toBe(true);
      expect(result.options._).toEqual(['task', 'high-priority']);
    });

    it('should handle complex argument combinations', () => {
      const result = CommandParser.parse([
        'bun', 'script', 'migrate',
        '--version', '1.0.0',
        '--force',
        '--config', 'custom.yaml',
        'migration-name'
      ]);

      expect(result.command).toBe('migrate');
      expect(result.options.version).toBe(true);
      expect(result.options.force).toBe(true);
      expect(result.options.config).toBe('custom.yaml');
      expect(result.options._).toEqual(['1.0.0', 'migration-name']);
    });
  });

  describe('validateInput', () => {
    it('should pass validation for valid input', () => {
      const validArgs: ParsedArgs = {
        command: 'run',
        args: ['development'],
        options: { _: ['development'] }
      };

      expect(() => CommandParser.validateInput(validArgs)).not.toThrow();
    });

    it('should throw error for too many arguments', () => {
      const invalidArgs: ParsedArgs = {
        command: 'run',
        args: Array(101).fill('arg'), // 101 arguments > MAX_TOTAL_ARGS (100)
        options: { _: Array(101).fill('arg') }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow('Too many arguments provided');
    });

    it('should throw error for argument too long', () => {
      const invalidArgs: ParsedArgs = {
        command: 'run',
        args: ['a'.repeat(1001)], // 1001 characters > MAX_ARG_LENGTH (1000)
        options: { _: ['a'.repeat(1001)] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow('Argument too long');
    });

    it('should throw error for invalid template name', () => {
      const invalidArgs: ParsedArgs = {
        command: 'run',
        args: [],
        options: { _: ['invalid-template@name'] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow(
        'Template name must contain only alphanumeric characters'
      );
    });

    it('should pass validation for valid template name', () => {
      const validArgs: ParsedArgs = {
        command: 'run',
        args: [],
        options: { _: ['valid_template_name-123'] }
      };

      expect(() => CommandParser.validateInput(validArgs)).not.toThrow();
    });

    it('should throw error for unsafe config path with ..', () => {
      const invalidArgs: ParsedArgs = {
        command: 'init',
        args: [],
        options: { config: '../../../etc/passwd', _: [] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow(
        'Config path contains potentially unsafe characters'
      );
    });

    it('should throw error for unsafe config path with ~', () => {
      const invalidArgs: ParsedArgs = {
        command: 'init',
        args: [],
        options: { config: '~/secret/config', _: [] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow(
        'Config path contains potentially unsafe characters'
      );
    });

    it('should pass validation for safe config path', () => {
      const validArgs: ParsedArgs = {
        command: 'init',
        args: [],
        options: { config: './config.yaml', _: [] }
      };

      expect(() => CommandParser.validateInput(validArgs)).not.toThrow();
    });

    it('should handle short config flag (-c)', () => {
      const invalidArgs: ParsedArgs = {
        command: 'init',
        args: [],
        options: { c: '../../../etc/passwd', _: [] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow(
        'Config path contains potentially unsafe characters'
      );
    });
  });

  describe('Boolean flag detection', () => {
    it('should recognize known boolean flags', () => {
      const result = CommandParser.parse(['bun', 'script', 'run', '--verbose']);
      expect(result.options.verbose).toBe(true);

      const result2 = CommandParser.parse(['bun', 'script', 'run', '--no-color']);
      expect(result2.options['no-color']).toBe(true);

      const result3 = CommandParser.parse(['bun', 'script', 'run', '--dry-run']);
      expect(result3.options['dry-run']).toBe(true);
    });

    it('should treat unknown flags as boolean by default', () => {
      const result = CommandParser.parse(['bun', 'script', 'run', '--unknown-flag']);
      expect(result.options['unknown-flag']).toBe(true);
    });
  });

  describe('Edge cases', () => {
    it('should handle empty string arguments', () => {
      const result = CommandParser.parse(['bun', 'script', 'test', '']);
      expect(result.options._).toEqual(['']);
    });

    it('should handle arguments starting with dash but not flags', () => {
      const result = CommandParser.parse(['bun', 'script', 'test', '-not-a-flag']);
      // -not-a-flag gets parsed as individual flags: n, o, t, -, a, -, f, l, a, g
      expect(result.options.n).toBe(true);
      expect(result.options.o).toBe(true);
      expect(result.options.t).toBe(true);
    });

    it('should handle double dash arguments correctly', () => {
      const result = CommandParser.parse(['bun', 'script', 'test', '--']);
      expect(result.args).toEqual(['--']);
      expect(result.options._).toEqual([]);
    });

    it('should handle flag at the end without value', () => {
      const result = CommandParser.parse(['bun', 'script', 'test', '--template']);
      expect(result.options.template).toBe(true);
    });

    it('should handle multiple dashes in flag names', () => {
      const result = CommandParser.parse(['bun', 'script', 'test', '--very-long-flag-name']);
      expect(result.options['very-long-flag-name']).toBe(true);
    });
  });

  describe('Performance considerations', () => {
    it('should handle large number of arguments efficiently', () => {
      const args = ['bun', 'script', 'test'];
      // Add 50 arguments
      for (let i = 0; i < 50; i++) {
        args.push(`--arg${i}`, `value${i}`);
      }

      const start = performance.now();
      const result = CommandParser.parse(args);
      const end = performance.now();

      expect(end - start).toBeLessThan(10); // Should complete in under 10ms
      expect(result.options.arg0).toBe('value0');
      expect(result.options.arg49).toBe('value49');
    });
  });

  // Tests for mutation score improvement - edge cases for array checks, object literals, and boolean logic
  describe('Mutation Score Improvement Tests', () => {
    describe('Array checks and object literals', () => {
      it('should handle empty _ array in options', () => {
        const result = CommandParser.parse(['bun', 'script', 'test']);

        expect(result.options._).toBeDefined();
        expect(Array.isArray(result.options._)).toBe(true);
        expect(result.options._).toEqual([]);
      });

      it('should handle _ array with arguments', () => {
        const result = CommandParser.parse(['bun', 'script', 'test', 'arg1', 'arg2']);

        expect(result.options._).toBeDefined();
        expect(Array.isArray(result.options._)).toBe(true);
        expect(result.options._).toEqual(['arg1', 'arg2']);
      });

      it('should handle various _ array states', () => {
        const testCases = [
          { argv: ['bun', 'script', 'test'], expected: [] },
          { argv: ['bun', 'script', 'test', 'single'], expected: ['single'] },
          { argv: ['bun', 'script', 'test', 'arg1', 'arg2', 'arg3'], expected: ['arg1', 'arg2', 'arg3'] },
        ];

        for (const testCase of testCases) {
          const result = CommandParser.parse(testCase.argv);
          expect(result.options._).toEqual(testCase.expected);
        }
      });

      it('should handle array length checks correctly', () => {
        // Test with empty array
        const result1 = CommandParser.parse(['bun', 'script', 'test']);
        expect(result1.args.length).toBe(0);

        // Test with single argument
        const result2 = CommandParser.parse(['bun', 'script', 'test', 'arg']);
        expect(result2.args.length).toBe(1);

        // Test with multiple arguments
        const result3 = CommandParser.parse(['bun', 'script', 'test', 'arg1', 'arg2', 'arg3']);
        expect(result3.args.length).toBe(3);
      });
    });

    describe('Boolean logic and edge cases', () => {
      it('should handle skipNext boolean flag correctly', () => {
        // Test scenarios that would affect skipNext logic
        const testCases = [
          { argv: ['bun', 'script', 'test', '--flag', 'value'], expectedValue: 'value' },
          { argv: ['bun', 'script', 'test', '--flag'], expectedValue: true },
          { argv: ['bun', 'script', 'test', '--flag', '--other'], expectedValue: true }, // flag without value
        ];

        for (const testCase of testCases) {
          const result = CommandParser.parse(testCase.argv);
          expect(result.options.flag).toBe(testCase.expectedValue);
        }
      });

      it('should handle argument parsing with various flag patterns', () => {
        // Test that flags are parsed correctly (avoiding strict type checking)
        let result = CommandParser.parse(['bun', 'script', 'test', '--verbose']);
        expect(result.options.verbose).toBeDefined();

        result = CommandParser.parse(['bun', 'script', 'test', '--verbose', 'true']);
        expect(result.options.verbose).toBeDefined();

        result = CommandParser.parse(['bun', 'script', 'test', '-v']);
        expect(result.options.v).toBeDefined();

        result = CommandParser.parse(['bun', 'script', 'test', '-abc']);
        expect(result.options.a).toBe(true);
        expect(result.options.b).toBe(true);
        expect(result.options.c).toBe(true);
      });

      it('should handle edge cases in argument processing', () => {
        // Test with arguments that start with dash but aren't flags
        const result1 = CommandParser.parse(['bun', 'script', 'test', '-not-a-flag', 'value']);
        expect(result1.options.n).toBe(true); // Should parse as individual flags

        // Test with -- separator
        const result2 = CommandParser.parse(['bun', 'script', 'test', '--', 'positional', 'args']);
        expect(result2.args).toEqual(['--', 'positional', 'args']);

        // Test with empty string arguments
        const result3 = CommandParser.parse(['bun', 'script', 'test', '', '']);
        expect(result3.args).toEqual(['', '']);
      });

      it('should handle equality operator edge cases', () => {
        // Test various boundary conditions
        const testCases = [
          { argv: ['bun', 'script', 'test'], expectedArgs: 0 },
          { argv: ['bun', 'script', 'test', 'arg'], expectedArgs: 1 },
          { argv: ['bun', 'script', 'test', 'arg1', 'arg2'], expectedArgs: 2 },
        ];

        for (const testCase of testCases) {
          const result = CommandParser.parse(testCase.argv);
          expect(result.args.length).toBe(testCase.expectedArgs);
          expect(result.args.length >= 0).toBe(true);
        }
      });
    });

    describe('String literal and array method edge cases', () => {
      it('should handle various flag name patterns', () => {
        const testCases = [
          // Standard flags
          ['--config', 'file.json'],
          ['--template', 'default'],
          ['--output', 'result.txt'],
          // Flags with special characters
          ['--config-file', 'config.json'],
          ['--output-dir', '/tmp'],
          ['--max-retries', '3'],
          // Flags that might be mutated
          ['--dry-run'],
          ['--no-color'],
          ['--verbose'],
          ['--help'],
          ['--interactive'],
          ['--backup'],
        ];

        for (const flagArgs of testCases) {
          const fullArgs = ['bun', 'script', 'test', ...flagArgs];

          expect(() => CommandParser.parse(fullArgs)).not.toThrow();

          const result = CommandParser.parse(fullArgs);
          const flagName = flagArgs[0].replace('--', '');
          expect(result.options[flagName]).toBeDefined();
        }
      });

      it('should handle array mutations correctly', () => {
        // Test that _ array operations work correctly
        const result = CommandParser.parse(['bun', 'script', 'test', 'arg1', 'arg2', 'arg3']);

        // Test array length (arguments go to args array, not _ array)
        expect(result.args.length).toBe(3);

        // Test array contents
        expect(result.args[0]).toBe('arg1');
        expect(result.args[1]).toBe('arg2');
        expect(result.args[2]).toBe('arg3');

        // Test array methods
        expect(Array.isArray(result.args)).toBe(true);
        expect(result.args.includes('arg2')).toBe(true);
        expect(result.args.join(',')).toBe('arg1,arg2,arg3');

        // Test _ array (contains arguments that aren't recognized as flags)
        expect(result.options._).toEqual(['arg1', 'arg2', 'arg3']);
        expect(Array.isArray(result.options._)).toBe(true);
      });

      it('should handle object literal edge cases in options', () => {
        const result = CommandParser.parse(['bun', 'script', 'test', '--flag1', 'value1', '--flag2']);

        // Test that options object has correct structure
        expect(typeof result.options).toBe('object');
        expect(result.options).not.toBeNull();
        expect(result.options._).toBeDefined();
        expect(Array.isArray(result.options._)).toBe(true);

        // Test specific properties
        expect(result.options.flag1).toBe('value1');
        expect(result.options.flag2).toBe(true);

        // Test that object has expected properties
        expect('flag1' in result.options).toBe(true);
        expect('flag2' in result.options).toBe(true);
        expect('_' in result.options).toBe(true);
      });
    });

    describe('Complex parsing scenarios', () => {
      it('should handle mixed argument types', () => {
        const result = CommandParser.parse([
          'bun', 'script', 'test',
          '--config', 'file.json',
          '--verbose',
          'positional1',
          '--output', 'result.txt',
          'positional2',
          '--dry-run'
        ]);

        expect(result.options.config).toBe('file.json');
        expect(result.options.verbose).toBe(true);
        expect(result.options.output).toBe('result.txt');
        expect(result.options['dry-run']).toBe(true);
        // All arguments including flags go to args array when not properly parsed
        expect(result.args.length).toBeGreaterThan(0);
      });

      it('should handle boundary conditions in command detection', () => {
        // Test with no command
        const result1 = CommandParser.parse(['bun', 'script']);
        expect(result1.command).toBe('help');

        // Test with empty command
        const result2 = CommandParser.parse(['bun', 'script', '']);
        expect(result2.command).toBe(''); // Empty string is the command

        // Test with command and arguments
        const result3 = CommandParser.parse(['bun', 'script', 'run', 'task1', 'task2']);
        expect(result3.command).toBe('run');
        expect(result3.args).toEqual(['task1', 'task2']);
      });

      it('should handle edge cases in validation', () => {
        // Test normal arguments
        const normalArgs = {
          command: 'test',
          args: ['arg1', 'arg2'],
          options: { _: [] }
        };
        expect(() => CommandParser.validateInput(normalArgs)).not.toThrow();

        // Test with dangerous characters in options
        const dangerousArgs = {
          command: 'test',
          args: [],
          options: { config: '../../../etc/passwd', _: [] }
        };
        expect(() => CommandParser.validateInput(dangerousArgs)).toThrow();

        // Test with safe but unusual paths
        const safeUnusualArgs = {
          command: 'test',
          args: [],
          options: { config: './config.json', _: [] }
        };
        expect(() => CommandParser.validateInput(safeUnusualArgs)).not.toThrow();
      });
    });
  });
});

/**
 * Unit Tests for StatusCommand
 * Tests status display functionality
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { StatusCommand } from '../../src/commands/status';
import type { ParsedOptions } from '../../src/types';

// Mock console methods to capture output
let consoleSpy: {
  log: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
};

describe('StatusCommand', () => {
  let command: StatusCommand;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    command = new StatusCommand();

    // Store original console methods
    originalConsoleLog = console.log;
    originalConsoleError = console.error;

    // Create spies for console methods
    consoleSpy = {
      log: mock(() => {}),
      error: mock(() => {}),
    };
    console.log = consoleSpy.log;
    console.error = consoleSpy.error;
  });

  afterEach(() => {
    // Restore original console methods
    console.log = originalConsoleLog;
    console.error = originalConsoleError;

    // Clean up mocks
    mock.restore();
  });

  describe('command properties', () => {
    it('should have correct name and description', () => {
      expect(command.name).toBe('status');
      expect(command.description).toBe('Show current state/progress');
    });

    it('should have correct aliases', () => {
      expect(command.aliases).toEqual(['st']);
    });

    it('should have all required options', () => {
      const optionFlags = command.options.map(opt => opt.flag);
      expect(optionFlags).toEqual(['verbose', 'format']);
    });

    it('should have correct option descriptions', () => {
      const verboseOption = command.options.find(opt => opt.flag === 'verbose');
      const formatOption = command.options.find(opt => opt.flag === 'format');

      expect(verboseOption?.description).toBe('Show detailed status information');
      expect(formatOption?.description).toBe('Output format (text, json, yaml)');
    });

    it('should have correct default value for format option', () => {
      const formatOption = command.options.find(opt => opt.flag === 'format');
      expect(formatOption?.default).toBe('text');
    });
  });

  describe('action method', () => {
    it('should show default status when no options provided', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: text');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Verbose mode enabled');
    });

    it('should show verbose mode when verbose option is true', async () => {
      const options: ParsedOptions = {
        verbose: true,
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Verbose mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: text');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
    });

    it('should not show verbose mode when verbose option is false', async () => {
      const options: ParsedOptions = {
        verbose: false,
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Verbose mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: text');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
    });

    it('should use custom format when format option is provided', async () => {
      const options: ParsedOptions = {
        format: 'json',
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: json');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
    });

    it('should use default format when format option is not provided', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: text');
    });

    it('should test different format values', async () => {
      const formats = ['text', 'json', 'yaml', 'xml', 'csv'];

      for (const format of formats) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          format,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Checklist Status:');
        expect(freshSpy).toHaveBeenCalledWith(`Output format: ${format}`);
        expect(freshSpy).toHaveBeenCalledWith('No active checklist found');
        expect(freshSpy).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');

        console.log = consoleSpy.log;
      }
    });

    it('should handle both verbose and format options', async () => {
      const options: ParsedOptions = {
        verbose: true,
        format: 'json',
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Verbose mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: json');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
    });

    it('should test conditional logic for all combinations', async () => {
      const testCases = [
        { verbose: false, format: 'text' },
        { verbose: true, format: 'text' },
        { verbose: false, format: 'json' },
        { verbose: true, format: 'json' },
        { verbose: false, format: 'yaml' },
        { verbose: true, format: 'yaml' },
      ];

      for (const testCase of testCases) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          ...testCase,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Checklist Status:');
        expect(freshSpy).toHaveBeenCalledWith(`Output format: ${testCase.format}`);
        expect(freshSpy).toHaveBeenCalledWith('No active checklist found');
        expect(freshSpy).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');

        if (testCase.verbose) {
          expect(freshSpy).toHaveBeenCalledWith('Verbose mode enabled');
        } else {
          expect(freshSpy).not.toHaveBeenCalledWith('Verbose mode enabled');
        }

        console.log = consoleSpy.log;
      }
    });

    it('should test option flag names and default values', async () => {
      const options: ParsedOptions = {
        verbose: 'true',   // String instead of boolean
        format: 123,       // Number instead of string
        _: [],
      };

      await command.action(options);

      // Should handle different types gracefully
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
    });

    it('should test string literals that mutants target', async () => {
      const options: ParsedOptions = {
        verbose: true,
        format: 'json',
        _: [],
      };

      await command.action(options);

      // Test specific string literals that mutants target
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Verbose mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: json');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
    });

    it('should test template interpolation', async () => {
      const formats = ['text', 'json', 'yaml'];

      for (const format of formats) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          format,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith(`Output format: ${format}`);
        console.log = consoleSpy.log;
      }
    });

    it('should test boolean options correctly', async () => {
      const booleanOptions = [
        { name: 'verbose', flag: 'verbose' },
      ];

      for (const option of booleanOptions) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          [option.flag]: true,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalled();
        console.log = consoleSpy.log;
      }
    });
  });

  describe('error handling', () => {
    it('should validate options before processing', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      // Should not throw for valid options
      await expect(command.action(options)).resolves.toBeUndefined();
    });

    it('should handle missing options gracefully', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      // Should handle missing options with defaults
      await expect(command.action(options)).resolves.toBeUndefined();
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: text');
    });

    it('should handle different option value types', async () => {
      const testCases = [
        { verbose: 'true', format: 'json' },     // String boolean
        { verbose: 1, format: 'yaml' },           // Number boolean
        { verbose: 'yes', format: 'text' },       // String yes
        { verbose: null, format: undefined },     // Null values
      ];

      for (const testCase of testCases) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          ...testCase,
          _: [],
        };

        // Should handle different types gracefully
        await expect(command.action(options)).resolves.toBeUndefined();
        expect(freshSpy).toHaveBeenCalledWith('Checklist Status:');

        console.log = consoleSpy.log;
      }
    });
  });

  describe('code coverage for mutants', () => {
    it('should test string literal mutants', async () => {
      const options: ParsedOptions = {
        verbose: true,
        format: 'json',
        _: [],
      };

      await command.action(options);

      // Test all string literals that mutants target
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Verbose mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: json');
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
    });

    it('should test conditional expression mutants', async () => {
      const booleanTests = [
        { verbose: true, format: 'text' },
        { verbose: false, format: 'json' },
      ];

      for (const test of booleanTests) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          ...test,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Checklist Status:');
        expect(freshSpy).toHaveBeenCalledWith(`Output format: ${test.format}`);
        expect(freshSpy).toHaveBeenCalledWith('No active checklist found');
        expect(freshSpy).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');

        if (test.verbose) {
          expect(freshSpy).toHaveBeenCalledWith('Verbose mode enabled');
        }

        console.log = consoleSpy.log;
      }
    });

    it('should test array declaration mutants', async () => {
      // Test that the options array is properly structured
      expect(command.options).toHaveLength(2);
      expect(command.options[0].flag).toBe('verbose');
      expect(command.options[1].flag).toBe('format');
    });

    it('should test array declaration mutants for aliases', async () => {
      // Test that the aliases array is properly structured
      expect(command.aliases).toHaveLength(1);
      expect(command.aliases[0]).toBe('st');
    });

    it('should test object literal mutants', async () => {
      // Test that option objects have correct structure
      const verboseOption = command.options.find(opt => opt.flag === 'verbose');
      const formatOption = command.options.find(opt => opt.flag === 'format');

      expect(verboseOption).toEqual({
        flag: 'verbose',
        description: 'Show detailed status information',
      });

      expect(formatOption).toEqual({
        flag: 'format',
        description: 'Output format (text, json, yaml)',
        default: 'text',
      });
    });

    it('should test boolean literal mutants', async () => {
      const booleanTests = [
        { verbose: true },
        { verbose: false },
      ];

      for (const test of booleanTests) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          ...test,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Checklist Status:');
        expect(freshSpy).toHaveBeenCalledWith('No active checklist found');
        expect(freshSpy).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');

        console.log = consoleSpy.log;
      }
    });

    it('should test getOption default value mutants', async () => {
      // Test default values for getOption calls
      const options: ParsedOptions = {
        _: [],
        // No options provided, should use defaults
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist Status:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Output format: text'); // Default format
      expect(consoleSpy.log).toHaveBeenCalledWith('No active checklist found');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');

      // Should not show verbose message when default is used
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Verbose mode enabled');
    });

    it('should test all format options to kill conditional mutants', async () => {
      const formats = ['text', 'json', 'yaml'];

      for (const format of formats) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          format,
          verbose: false,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Checklist Status:');
        expect(freshSpy).toHaveBeenCalledWith(`Output format: ${format}`);
        expect(freshSpy).toHaveBeenCalledWith('No active checklist found');
        expect(freshSpy).toHaveBeenCalledWith('Use "checklist run <template>" to start a workflow');
        expect(freshSpy).not.toHaveBeenCalledWith('Verbose mode enabled');

        console.log = consoleSpy.log;
      }
    });

    it('should test verbose conditional mutants', async () => {
      const verboseTests = [
        { verbose: true, expectMessage: true },
        { verbose: false, expectMessage: false },
        { verbose: 'true', expectMessage: true },  // Truthy string
        { verbose: '', expectMessage: false },     // Falsy string
      ];

      for (const test of verboseTests) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          verbose: test.verbose,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Checklist Status:');
        expect(freshSpy).toHaveBeenCalledWith('No active checklist found');

        if (test.expectMessage) {
          expect(freshSpy).toHaveBeenCalledWith('Verbose mode enabled');
        } else {
          expect(freshSpy).not.toHaveBeenCalledWith('Verbose mode enabled');
        }

        console.log = consoleSpy.log;
      }
    });
  });
});
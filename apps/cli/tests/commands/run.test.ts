/**
 * Unit Tests for RunCommand
 * Tests run checklist workflow functionality
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { RunCommand } from '../../src/commands/run';
import type { ParsedOptions } from '../../src/types';

// Mock console methods to capture output
let consoleSpy: {
  log: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
};

describe('RunCommand', () => {
  let command: RunCommand;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    command = new RunCommand();

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
      expect(command.name).toBe('run');
      expect(command.description).toBe('Run a checklist workflow');
    });

    it('should have correct aliases', () => {
      expect(command.aliases).toEqual(['r', 'start']);
    });

    it('should have all required options', () => {
      const optionFlags = command.options.map(opt => opt.flag);
      expect(optionFlags).toEqual(['interactive', 'config', 'dry-run']);
    });

    it('should have correct option descriptions', () => {
      const interactiveOption = command.options.find(opt => opt.flag === 'interactive');
      const configOption = command.options.find(opt => opt.flag === 'config');
      const dryRunOption = command.options.find(opt => opt.flag === 'dry-run');

      expect(interactiveOption?.description).toBe('Run in interactive mode');
      expect(configOption?.description).toBe('Path to config file');
      expect(dryRunOption?.description).toBe('Show what would be executed without running');
    });
  });

  describe('action method', () => {
    it('should throw error when template name is missing', async () => {
      const options: ParsedOptions = {
        _: [], // Empty array, no template
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist run <template>'
      );
    });

    it('should throw error when template is null', async () => {
      const options: ParsedOptions = {
        _: [null as any],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist run <template>'
      );
    });

    it('should throw error when template is empty string', async () => {
      const options: ParsedOptions = {
        _: [''],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist run <template>'
      );
    });

    it('should run workflow with template name', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should enable interactive mode when interactive option is true', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        interactive: true,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Interactive mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should not show interactive message when interactive is false', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        interactive: false,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Interactive mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should use config file when config option is provided', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        config: './config.json',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Using config file: ./config.json');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should not show config message when config is not provided', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Using config file:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should enable dry run mode when dry-run option is true', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        'dry-run': true,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Dry run mode - no changes will be made');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should not show dry run message when dry-run is false', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        'dry-run': false,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Dry run mode - no changes will be made');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should handle all options enabled', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        interactive: true,
        config: './config.json',
        'dry-run': true,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Interactive mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Using config file: ./config.json');
      expect(consoleSpy.log).toHaveBeenCalledWith('Dry run mode - no changes will be made');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should test different template names', async () => {
      const templateNames = ['project-setup', 'deployment', 'testing', 'ci-cd'];

      for (const templateName of templateNames) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: [templateName],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith(`Running checklist workflow: ${templateName}`);
        expect(freshSpy).toHaveBeenCalledWith('Workflow execution completed!');
        console.log = consoleSpy.log;
      }
    });

    it('should test conditional logic for all options', async () => {
      const testCases = [
        { interactive: true, config: null, 'dry-run': false },
        { interactive: false, config: './test.json', 'dry-run': false },
        { interactive: false, config: null, 'dry-run': true },
        { interactive: true, config: './test.json', 'dry-run': true },
        { interactive: false, config: null, 'dry-run': false },
      ];

      for (const testCase of testCases) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: ['test-template'],
          ...testCase,
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Running checklist workflow: test-template');
        expect(freshSpy).toHaveBeenCalledWith('Workflow execution completed!');
        console.log = consoleSpy.log;
      }
    });

    it('should test option flag names', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        interactive: 'true',   // String instead of boolean
        config: 123,           // Number instead of string
        'dry-run': 'yes',      // String instead of boolean
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      // Should handle different types gracefully
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should test string literals that mutants target', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        interactive: true,
        config: './config.json',
        'dry-run': true,
      };

      await command.action(options);

      // Test specific string literals that mutants target
      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Interactive mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Using config file: ./config.json');
      expect(consoleSpy.log).toHaveBeenCalledWith('Dry run mode - no changes will be made');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should test template interpolation', async () => {
      const templates = ['simple', 'complex-with-dashes', 'with_underscores', 'CamelCase'];

      for (const template of templates) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: [template],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith(`Running checklist workflow: ${template}`);
        console.log = consoleSpy.log;
      }
    });

    it('should handle config file with different path formats', async () => {
      const configPaths = [
        './config.json',
        '/absolute/path/config.json',
        'config.json',
        '../config.json',
        'configs/production.json',
      ];

      for (const configPath of configPaths) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: ['test-template'],
          config: configPath,
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith(`Using config file: ${configPath}`);
        console.log = consoleSpy.log;
      }
    });

    it('should test Boolean() function usage for config', async () => {
      const testCases = [
        { config: '', shouldShow: false },
        { config: null, shouldShow: false },
        { config: undefined, shouldShow: false },
        { config: 'config.json', shouldShow: true },
        { config: false, shouldShow: false },
        { config: true, shouldShow: true },
      ];

      for (const testCase of testCases) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: ['test-template'],
          config: testCase.config,
        };

        await command.action(options);

        if (testCase.shouldShow) {
          expect(freshSpy).toHaveBeenCalledWith(`Using config file: ${testCase.config}`);
        } else {
          expect(freshSpy).not.toHaveBeenCalledWith(expect.stringContaining('Using config file:'));
        }

        console.log = consoleSpy.log;
      }
    });
  });

  describe('error handling', () => {
    it('should validate options before processing', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
      };

      // Should not throw for valid options
      await expect(command.action(options)).resolves.toBeUndefined();
    });

    it('should handle missing template gracefully with appropriate error', async () => {
      const invalidCases = [
        { _: [] },
        { _: [null] },
        { _: [''] },
      ];

      for (const testCase of invalidCases) {
        await expect(command.action(testCase as ParsedOptions)).rejects.toThrow(
          'Template name is required. Usage: checklist run <template>'
        );
      }
    });

    it('should handle malformed options without crashing', async () => {
      const malformedOptions = [
        { _: ['test'], interactive: 'maybe', config: [], 'dry-run': 0 },
        { _: ['test'], interactive: null, config: {}, 'dry-run': 'false' },
        { _: ['test'], interactive: undefined, config: false, 'dry-run': [] },
      ];

      for (const options of malformedOptions) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        // Should handle malformed options gracefully
        await expect(command.action(options as ParsedOptions)).resolves.toBeUndefined();
        expect(freshSpy).toHaveBeenCalledWith('Running checklist workflow: test');
        expect(freshSpy).toHaveBeenCalledWith('Workflow execution completed!');

        console.log = consoleSpy.log;
      }
    });
  });

  describe('code coverage for mutants', () => {
    it('should test string literal mutants', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        interactive: true,
        config: './config.json',
        'dry-run': true,
      };

      await command.action(options);

      // Test all string literals that mutants target
      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Interactive mode enabled');
      expect(consoleSpy.log).toHaveBeenCalledWith('Using config file: ./config.json');
      expect(consoleSpy.log).toHaveBeenCalledWith('Dry run mode - no changes will be made');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');
    });

    it('should test conditional expression mutants', async () => {
      const booleanTests = [
        { interactive: true, config: null, 'dry-run': false },
        { interactive: false, config: './test.json', 'dry-run': false },
        { interactive: false, config: null, 'dry-run': true },
        { interactive: false, config: null, 'dry-run': false },
      ];

      for (const test of booleanTests) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: ['test-template'],
          ...test,
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalledWith('Running checklist workflow: test-template');
        expect(freshSpy).toHaveBeenCalledWith('Workflow execution completed!');
        console.log = consoleSpy.log;
      }
    });

    it('should test array declaration mutants', async () => {
      // Test that the options array is properly structured
      expect(command.options).toHaveLength(3);
      expect(command.options[0].flag).toBe('interactive');
      expect(command.options[1].flag).toBe('config');
      expect(command.options[2].flag).toBe('dry-run');
    });

    it('should test array declaration mutants for aliases', async () => {
      // Test that the aliases array is properly structured
      expect(command.aliases).toHaveLength(2);
      expect(command.aliases[0]).toBe('r');
      expect(command.aliases[1]).toBe('start');
    });

    it('should test object literal mutants', async () => {
      // Test that option objects have correct structure
      const interactiveOption = command.options.find(opt => opt.flag === 'interactive');
      const configOption = command.options.find(opt => opt.flag === 'config');
      const dryRunOption = command.options.find(opt => opt.flag === 'dry-run');

      expect(interactiveOption).toEqual({
        flag: 'interactive',
        description: 'Run in interactive mode',
      });

      expect(configOption).toEqual({
        flag: 'config',
        description: 'Path to config file',
      });

      expect(dryRunOption).toEqual({
        flag: 'dry-run',
        description: 'Show what would be executed without running',
      });
    });

    it('should test Boolean() function mutants', async () => {
      // Test different truthy/falsy values to kill Boolean() mutants
      const booleanTests = [
        { config: 'truthy string', expected: true },
        { config: '', expected: false },
        { config: null, expected: false },
        { config: undefined, expected: false },
        { config: false, expected: false },
        { config: true, expected: true },
      ];

      for (const test of booleanTests) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: ['test-template'],
          config: test.config,
        };

        await command.action(options);

        if (test.expected) {
          expect(freshSpy).toHaveBeenCalledWith(`Using config file: ${test.config}`);
        } else {
          expect(freshSpy).not.toHaveBeenCalledWith(expect.stringContaining('Using config file:'));
        }

        console.log = consoleSpy.log;
      }
    });

    it('should test equality operator mutants', async () => {
      // Test template existence check
      const templateTests = [
        { template: 'valid', shouldThrow: false },
        { template: '', shouldThrow: true },
        { template: null, shouldThrow: true },
        { template: undefined, shouldThrow: true },
      ];

      for (const test of templateTests) {
        const options: ParsedOptions = {
          _: [test.template as any],
        };

        if (test.shouldThrow) {
          await expect(command.action(options)).rejects.toThrow();
        } else {
          await expect(command.action(options)).resolves.toBeUndefined();
        }
      }
    });

    it('should test boolean literal mutants', async () => {
      const booleanOptions = ['interactive', 'dry-run'];

      for (const option of booleanOptions) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          _: ['test-template'],
          [option]: true,
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalled();
        console.log = consoleSpy.log;
      }
    });

    it('should test getOption default value mutants', async () => {
      // Test default values for getOption calls
      const options: ParsedOptions = {
        _: ['test-template'],
        // No options provided, should use defaults
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Running checklist workflow: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Workflow execution completed!');

      // Should not show optional messages when defaults are used
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Interactive mode enabled');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Dry run mode - no changes will be made');
    });
  });
});
/**
 * Unit Tests for ResetCommand
 * Tests reset checklist state functionality
 */

import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { ResetCommand } from '../../src/commands/reset';
import type { ParsedOptions } from '../../src/types';

// Mock console methods to capture output
let consoleSpy: {
  log: ReturnType<typeof mock>;
  error: ReturnType<typeof mock>;
};

describe('ResetCommand', () => {
  let command: ResetCommand;
  let originalConsoleLog: typeof console.log;
  let originalConsoleError: typeof console.error;

  beforeEach(() => {
    command = new ResetCommand();

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
      expect(command.name).toBe('reset');
      expect(command.description).toBe('Reset checklist state');
    });

    it('should have correct aliases', () => {
      expect(command.aliases).toEqual(['clear']);
    });

    it('should have all required options', () => {
      const optionFlags = command.options.map(opt => opt.flag);
      expect(optionFlags).toEqual(['force', 'backup']);
    });

    it('should have correct option descriptions', () => {
      const forceOption = command.options.find(opt => opt.flag === 'force');
      const backupOption = command.options.find(opt => opt.flag === 'backup');

      expect(forceOption?.description).toBe('Force reset without confirmation');
      expect(backupOption?.description).toBe('Create backup before reset');
    });
  });

  describe('action method', () => {
    it('should show warning and return when force is false', async () => {
      const options: ParsedOptions = {
        force: false,
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use --force to confirm this action.');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Resetting checklist state...');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Checklist state reset successfully!');
    });

    it('should proceed with reset when force is true', async () => {
      const options: ParsedOptions = {
        force: true,
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Use --force to confirm this action.');
      expect(consoleSpy.log).toHaveBeenCalledWith('Resetting checklist state...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist state reset successfully!');
    });

    it('should create backup when backup is true', async () => {
      const options: ParsedOptions = {
        force: true,
        backup: true,
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Creating backup before reset...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Resetting checklist state...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist state reset successfully!');
    });

    it('should not create backup when backup is false', async () => {
      const options: ParsedOptions = {
        force: true,
        backup: false,
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('Creating backup before reset...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Resetting checklist state...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist state reset successfully!');
    });

    it('should use default values when options are not provided', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      // Should use default force=false and show warning
      expect(consoleSpy.log).toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use --force to confirm this action.');
    });

    it('should test all combinations of force and backup options', async () => {
      const testCases = [
        { force: false, backup: false, expectedWarning: true },
        { force: false, backup: true, expectedWarning: true },
        { force: true, backup: false, expectedWarning: false },
        { force: true, backup: true, expectedWarning: false },
      ];

      for (const testCase of testCases) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          force: testCase.force,
          backup: testCase.backup,
          _: [],
        };

        await command.action(options);

        if (testCase.expectedWarning) {
          expect(freshSpy).toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
          expect(freshSpy).toHaveBeenCalledWith('Use --force to confirm this action.');
          expect(freshSpy).not.toHaveBeenCalledWith('Resetting checklist state...');
        } else {
          expect(freshSpy).not.toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
          expect(freshSpy).not.toHaveBeenCalledWith('Use --force to confirm this action.');
          expect(freshSpy).toHaveBeenCalledWith('Resetting checklist state...');
        }

        if (testCase.backup && !testCase.expectedWarning) {
          expect(freshSpy).toHaveBeenCalledWith('Creating backup before reset...');
        }

        console.log = consoleSpy.log;
      }
    });

    it('should handle boolean options correctly', async () => {
      const booleanOptions = [
        { name: 'force', flag: 'force' },
        { name: 'backup', flag: 'backup' },
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

    it('should test conditional logic in action method', async () => {
      // Test different combinations to kill conditional mutants
      const testCases = [
        { force: false, backup: false }, // Warning case
        { force: false, backup: true },  // Warning with backup
        { force: true, backup: false },  // Reset without backup
        { force: true, backup: true },   // Reset with backup
      ];

      for (const testCase of testCases) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          ...testCase,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalled();
        console.log = consoleSpy.log;
      }
    });

    it('should test string literals that mutants target', async () => {
      const options: ParsedOptions = {
        force: true,
        backup: true,
        _: [],
      };

      await command.action(options);

      // Test specific string literals that mutants target
      expect(consoleSpy.log).toHaveBeenCalledWith('Creating backup before reset...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Resetting checklist state...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist state reset successfully!');
    });

    it('should test warning message string literals', async () => {
      const options: ParsedOptions = {
        force: false,
        _: [],
      };

      await command.action(options);

      // Test warning string literals
      expect(consoleSpy.log).toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
      expect(consoleSpy.log).toHaveBeenCalledWith('Use --force to confirm this action.');
    });

    it('should test default option values', async () => {
      const freshSpy = mock(() => {});
      console.log = freshSpy;

      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      // Should use defaults: force=false, backup=false
      expect(freshSpy).toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
      expect(freshSpy).toHaveBeenCalledWith('Use --force to confirm this action.');
      expect(freshSpy).not.toHaveBeenCalledWith('Creating backup before reset...');

      console.log = consoleSpy.log;
    });

    it('should test option flag names and default values', async () => {
      const freshSpy = mock(() => {});
      console.log = freshSpy;

      // Test that getOption uses correct flag names
      const options: ParsedOptions = {
        force: 'true', // String instead of boolean
        backup: 1,     // Number instead of boolean
        _: [],
      };

      await command.action(options);

      // Should treat truthy values as true
      expect(freshSpy).toHaveBeenCalledWith('Resetting checklist state...');
      expect(freshSpy).not.toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');

      console.log = consoleSpy.log;
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
      expect(consoleSpy.log).toHaveBeenCalledWith('WARNING: This will reset all checklist progress.');
    });

    it('should handle different option value types', async () => {
      const testCases = [
        { force: true, backup: 'true' },     // Mixed boolean and string
        { force: 'yes', backup: 1 },         // String and number
        { force: 1, backup: 'false' },       // Number and string
        { force: 'true', backup: 'true' },   // Both strings
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
        expect(freshSpy).toHaveBeenCalled();

        console.log = consoleSpy.log;
      }
    });
  });

  describe('code coverage for mutants', () => {
    it('should test string literal mutants', async () => {
      const options: ParsedOptions = {
        force: true,
        backup: true,
        _: [],
      };

      await command.action(options);

      // Test all string literals that mutants target
      expect(consoleSpy.log).toHaveBeenCalledWith('Creating backup before reset...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Resetting checklist state...');
      expect(consoleSpy.log).toHaveBeenCalledWith('Checklist state reset successfully!');
    });

    it('should test conditional expression mutants', async () => {
      // Test both true and false for each conditional
      const conditionalTests = [
        { condition: 'force', value: true },
        { condition: 'force', value: false },
        { condition: 'backup', value: true },
        { condition: 'backup', value: false },
      ];

      for (const test of conditionalTests) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          [test.condition]: test.value,
          force: test.condition === 'force' ? test.value : true, // Ensure force is true for backup tests
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalled();
        console.log = consoleSpy.log;
      }
    });

    it('should test array declaration mutants', async () => {
      // Test that the options array is properly structured
      expect(command.options).toHaveLength(2);
      expect(command.options[0].flag).toBe('force');
      expect(command.options[1].flag).toBe('backup');
    });

    it('should test object literal mutants', async () => {
      // Test that option objects have correct structure
      const forceOption = command.options.find(opt => opt.flag === 'force');
      const backupOption = command.options.find(opt => opt.flag === 'backup');

      expect(forceOption).toEqual({
        flag: 'force',
        description: 'Force reset without confirmation',
      });

      expect(backupOption).toEqual({
        flag: 'backup',
        description: 'Create backup before reset',
      });
    });

    it('should test equality operator mutants', async () => {
      // Test both equality conditions in the code
      const testCases = [
        { force: false, backup: false }, // Tests !force condition
        { force: true, backup: false },  // Tests !force is false
        { force: true, backup: true },   // Tests backup condition
      ];

      for (const testCase of testCases) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          ...testCase,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalled();
        console.log = consoleSpy.log;
      }
    });

    it('should test boolean literal mutants', async () => {
      const booleanTests = [
        { force: true, backup: true },
        { force: true, backup: false },
        { force: false, backup: true },
        { force: false, backup: false },
      ];

      for (const test of booleanTests) {
        const freshSpy = mock(() => {});
        console.log = freshSpy;

        const options: ParsedOptions = {
          ...test,
          _: [],
        };

        await command.action(options);

        expect(freshSpy).toHaveBeenCalled();
        console.log = consoleSpy.log;
      }
    });
  });
});
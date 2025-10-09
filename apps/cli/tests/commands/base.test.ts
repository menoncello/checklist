/**
 * Unit Tests for BaseCommand
 * Tests base command functionality, validation, and help generation
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BaseCommand } from '../../src/commands/base';
import type { CommandOption, ParsedOptions } from '../../src/types';

// Create a concrete implementation of BaseCommand for testing
class TestCommand extends BaseCommand {
  name = 'test';
  description = 'Test command for unit testing';
  aliases = ['t', 'test-cmd'];
  options: CommandOption[] = [
    {
      flag: 'required',
      description: 'Required option',
      required: true,
    },
    {
      flag: 'optional',
      description: 'Optional option',
      default: 'default-value',
    },
    {
      flag: 'validated',
      description: 'Option with validation',
      required: true,
      validator: (value: unknown) => typeof value === 'string' && value.length > 3,
    },
  ];

  async action(options: ParsedOptions): Promise<void> {
    this.validateOptions(options);
    // Implementation would go here
  }

  // Expose protected methods for testing
  public testValidateOptions(options: ParsedOptions): void {
    this.validateOptions(options);
  }

  public testGetOption<T = unknown>(
    options: ParsedOptions,
    flag: string,
    defaultValue?: T
  ): T {
    return this.getOption<T>(options, flag, defaultValue);
  }
}

describe('BaseCommand', () => {
  let command: TestCommand;

  beforeEach(() => {
    command = new TestCommand();
  });

  describe('validateOptions', () => {
    it('should pass validation when all required options are present', () => {
      const options: ParsedOptions = {
        required: 'value',
        optional: 'custom',
        validated: 'valid-value',
        _: [],
      };

      expect(() => command.testValidateOptions(options)).not.toThrow();
    });

    it('should throw error when required option is missing', () => {
      const options: ParsedOptions = {
        optional: 'value',
        _: [],
      };

      expect(() => command.testValidateOptions(options)).toThrow(
        'Required option --required is missing'
      );
    });

    it('should throw error when required option is null', () => {
      const options: ParsedOptions = {
        required: null,
        _: [],
      };

      expect(() => command.testValidateOptions(options)).toThrow(
        'Required option --required is missing'
      );
    });

    it('should throw error when required option is undefined', () => {
      const options: ParsedOptions = {
        required: undefined,
        _: [],
      };

      expect(() => command.testValidateOptions(options)).toThrow(
        'Required option --required is missing'
      );
    });

    it('should throw error when validator fails', () => {
      const options: ParsedOptions = {
        required: 'value',
        validated: 'bad', // Too short for validator
        _: [],
      };

      expect(() => command.testValidateOptions(options)).toThrow(
        'Invalid value for --validated: bad'
      );
    });

    it('should pass validation for valid option', () => {
      const options: ParsedOptions = {
        required: 'value',
        validated: 'good-value',
        _: [],
      };

      expect(() => command.testValidateOptions(options)).not.toThrow();
    });

    it('should handle short flag notation for required options', () => {
      const options: ParsedOptions = {
        r: 'value', // Short flag for 'required'
        v: 'good-value', // Short flag for 'validated'
        _: [],
      };

      expect(() => command.testValidateOptions(options)).not.toThrow();
    });

    it('should handle multiple required options', async () => {
      class MultiRequiredCommand extends BaseCommand {
        name = 'multi-test';
        description = 'Multi required test';
        options: CommandOption[] = [
          { flag: 'first', description: 'First required', required: true },
          { flag: 'second', description: 'Second required', required: true },
          { flag: 'third', description: 'Third required', required: true },
        ];
        async action(options: ParsedOptions): Promise<void> {
          this.validateOptions(options);
        }
      }

      const multiCommand = new MultiRequiredCommand();

      const options: ParsedOptions = {
        first: 'value1',
        second: 'value2',
        // third missing
        _: [],
      };

      await expect(multiCommand.action(options)).rejects.toThrow(
        'Required option --third is missing'
      );
    });

    it('should pass when all required options are present with short flags', async () => {
      const options: ParsedOptions = {
        f: 'value1', // first
        s: 'value2', // second
        t: 'value3', // third
        _: [],
      };

      class MultiRequiredCommand extends BaseCommand {
        name = 'multi-test';
        description = 'Multi required test';
        options: CommandOption[] = [
          { flag: 'first', description: 'First required', required: true },
          { flag: 'second', description: 'Second required', required: true },
          { flag: 'third', description: 'Third required', required: true },
        ];
        async action(options: ParsedOptions): Promise<void> {
          this.validateOptions(options);
        }
      }

      const multiCommand = new MultiRequiredCommand();
      await expect(multiCommand.action(options)).resolves.toBeUndefined();
    });
  });

  describe('getOption', () => {
    it('should return option value when present', () => {
      const options: ParsedOptions = {
        testOption: 'test-value',
        _: [],
      };

      const value = command.testGetOption(options, 'testOption');
      expect(value).toBe('test-value');
    });

    it('should return short flag value when long flag not present', () => {
      const options: ParsedOptions = {
        t: 'short-value',
        _: [],
      };

      const value = command.testGetOption(options, 'testOption');
      expect(value).toBe('short-value');
    });

    it('should return default value when option not present', () => {
      const options: ParsedOptions = {
        _: [],
      };

      const value = command.testGetOption(options, 'missingOption', 'default');
      expect(value).toBe('default');
    });

    it('should prefer long flag over short flag', () => {
      const options: ParsedOptions = {
        testOption: 'long-value',
        t: 'short-value',
        _: [],
      };

      const value = command.testGetOption(options, 'testOption');
      expect(value).toBe('long-value');
    });

    it('should handle type assertion correctly', () => {
      const options: ParsedOptions = {
        numberOption: 42,
        _: [],
      };

      const value = command.testGetOption<number>(options, 'numberOption', 0);
      expect(typeof value).toBe('number');
      expect(value).toBe(42);
    });

    it('should return undefined for missing option without default', () => {
      const options: ParsedOptions = {
        _: [],
      };

      const value = command.testGetOption(options, 'missingOption');
      expect(value).toBeUndefined();
    });

    it('should handle boolean options', () => {
      const options: ParsedOptions = {
        flag: true,
        _: [],
      };

      const value = command.testGetOption<boolean>(options, 'flag', false);
      expect(value).toBe(true);
    });

    // Tests for mutation score improvement - edge cases for conditional expressions
    it('should handle nullish values in validation (mutations for null/undefined checks)', () => {
      const options: ParsedOptions = {
        required: null, // Test null value - should still fail validation
        _: [],
      };

      expect(() => command.testValidateOptions(options)).toThrow(
        'Required option --required is missing'
      );
    });

    it('should handle empty string as valid option value', () => {
      const options: ParsedOptions = {
        required: '', // Empty string should be valid (not null/undefined)
        validated: 'valid-string',
        _: [],
      };

      expect(() => command.testValidateOptions(options)).not.toThrow();
    });

    it('should handle zero as valid option value', () => {
      const options: ParsedOptions = {
        required: 0, // Zero should be valid (not null/undefined)
        validated: 'valid-string',
        _: [],
      };

      expect(() => command.testValidateOptions(options)).not.toThrow();
    });

    it('should handle false as valid option value', () => {
      const options: ParsedOptions = {
        required: false, // false should be valid (not null/undefined)
        validated: 'valid-string',
        _: [],
      };

      expect(() => command.testValidateOptions(options)).not.toThrow();
    });
  });

  describe('generateHelp', () => {
    it('should generate basic help text', () => {
      const help = command.generateHelp();

      expect(help).toContain('test - Test command for unit testing');
      expect(help).toContain('Usage: checklist test [options]');
    });

    it('should include aliases in help text', () => {
      const help = command.generateHelp();

      expect(help).toContain('Aliases: t, test-cmd');
    });

    it('should include options in help text', () => {
      const help = command.generateHelp();

      expect(help).toContain('Options:');
      expect(help).toContain('--required');
      expect(help).toContain('Required option');
      expect(help).toContain('(required)');
      expect(help).toContain('--optional');
      expect(help).toContain('Optional option');
      expect(help).toContain('(default: default-value)');
      expect(help).toContain('--validated');
      expect(help).toContain('Option with validation');
    });

    it('should handle command without aliases', () => {
      class NoAliasCommand extends BaseCommand {
        name = 'no-alias';
        description = 'No aliases command';
        options: CommandOption[] = [];
        async action(): Promise<void> {}
      }

      const noAliasCommand = new NoAliasCommand();
      const help = noAliasCommand.generateHelp();

      expect(help).not.toContain('Aliases:');
    });

    it('should handle command without options', () => {
      class NoOptionsCommand extends BaseCommand {
        name = 'no-options';
        description = 'No options command';
        options: CommandOption[] = [];
        async action(): Promise<void> {}
      }

      const noOptionsCommand = new NoOptionsCommand();
      const help = noOptionsCommand.generateHelp();

      expect(help).not.toContain('Options:');
    });

    it('should format options correctly', () => {
      class ComplexOptionCommand extends BaseCommand {
        name = 'complex';
        description = 'Complex options';
        options: CommandOption[] = [
          {
            flag: 'very-long-option-name',
            description: 'This is a very long description that should be formatted properly',
            required: true,
          },
        ];
        async action(): Promise<void> {}
      }

      const complexCommand = new ComplexOptionCommand();
      const help = complexCommand.generateHelp();

      expect(help).toContain('--very-long-option-name');
      expect(help).toContain('This is a very long description');
      expect(help).toContain('(required)');
    });

    it('should handle options with default values that are not strings', () => {
      class TypedDefaultsCommand extends BaseCommand {
        name = 'typed-defaults';
        description = 'Typed defaults';
        options: CommandOption[] = [
          {
            flag: 'count',
            description: 'Number count',
            default: 5,
          },
          {
            flag: 'enable',
            description: 'Enable feature',
            default: true,
          },
        ];
        async action(): Promise<void> {}
      }

      const typedCommand = new TypedDefaultsCommand();
      const help = typedCommand.generateHelp();

      expect(help).toContain('(default: 5)');
      expect(help).toContain('(default: true)');
    });

    it('should generate help with proper line breaks', () => {
      const help = command.generateHelp();
      const lines = help.split('\n');

      expect(lines[0]).toBe('test - Test command for unit testing');
      expect(lines[1]).toBe('');
      expect(lines[2]).toBe('Usage: checklist test [options]');
      expect(lines[3]).toBe('Aliases: t, test-cmd');
    });

    // Tests for mutation score improvement - edge cases for generateHelp
    it('should handle empty aliases array correctly', () => {
      class EmptyAliasesCommand extends BaseCommand {
        name = 'empty-aliases';
        description = 'Empty aliases command';
        aliases: string[] = []; // Explicit empty array
        options: CommandOption[] = [];
        async action(): Promise<void> {}
      }

      const emptyAliasesCommand = new EmptyAliasesCommand();
      const help = emptyAliasesCommand.generateHelp();

      expect(help).not.toContain('Aliases:');
    });

    it('should handle single alias correctly', () => {
      class SingleAliasCommand extends BaseCommand {
        name = 'single-alias';
        description = 'Single alias command';
        aliases = ['only']; // Single alias
        options: CommandOption[] = [];
        async action(): Promise<void> {}
      }

      const singleAliasCommand = new SingleAliasCommand();
      const help = singleAliasCommand.generateHelp();

      expect(help).toContain('Aliases: only');
    });

    it('should handle options with undefined default values', () => {
      class UndefinedDefaultCommand extends BaseCommand {
        name = 'undefined-default';
        description = 'Undefined default command';
        options: CommandOption[] = [
          {
            flag: 'optional',
            description: 'Optional with undefined default',
            default: undefined,
          },
        ];
        async action(): Promise<void> {}
      }

      const undefinedCommand = new UndefinedDefaultCommand();
      const help = undefinedCommand.generateHelp();

      // Should not show default text when default is undefined
      expect(help).toContain('--optional');
      expect(help).toContain('Optional with undefined default');
      expect(help).not.toContain('(default:');
    });

    it('should handle options with empty string default values', () => {
      class EmptyStringDefaultCommand extends BaseCommand {
        name = 'empty-default';
        description = 'Empty string default command';
        options: CommandOption[] = [
          {
            flag: 'empty',
            description: 'Option with empty string default',
            default: '',
          },
        ];
        async action(): Promise<void> {}
      }

      const emptyCommand = new EmptyStringDefaultCommand();
      const help = emptyCommand.generateHelp();

      // Should show empty string default
      expect(help).toContain('--empty');
      expect(help).toContain('Option with empty string default');
      expect(help).toContain("(default: )");
    });

    it('should handle options with zero default values', () => {
      class ZeroDefaultCommand extends BaseCommand {
        name = 'zero-default';
        description = 'Zero default command';
        options: CommandOption[] = [
          {
            flag: 'count',
            description: 'Option with zero default',
            default: 0,
          },
        ];
        async action(): Promise<void> {}
      }

      const zeroCommand = new ZeroDefaultCommand();
      const help = zeroCommand.generateHelp();

      // Should show zero default
      expect(help).toContain('--count');
      expect(help).toContain('Option with zero default');
      expect(help).toContain('(default: 0)');
    });

    it('should handle options with false default values', () => {
      class FalseDefaultCommand extends BaseCommand {
        name = 'false-default';
        description = 'False default command';
        options: CommandOption[] = [
          {
            flag: 'enable',
            description: 'Option with false default',
            default: false,
          },
        ];
        async action(): Promise<void> {}
      }

      const falseCommand = new FalseDefaultCommand();
      const help = falseCommand.generateHelp();

      // Should show false default
      expect(help).toContain('--enable');
      expect(help).toContain('Option with false default');
      expect(help).toContain('(default: false)');
    });
  });

  describe('abstract implementation', () => {
    it('should require implementation of abstract properties', () => {
      // Test that TestCommand (concrete implementation) has required properties
      expect(command.name).toBe('test');
      expect(command.description).toBe('Test command for unit testing');
      expect(command.options).toBeDefined();
      expect(Array.isArray(command.options)).toBe(true);
    });

    it('should require implementation of action method', () => {
      // Create incomplete command
      class IncompleteCommand extends BaseCommand {
        name = 'incomplete';
        description = 'Incomplete command';
        options: CommandOption[] = [];
        // action method not implemented

        async action(options: ParsedOptions): Promise<void> {
          // Not implemented - should be abstract
          throw new Error('Not implemented');
        }
      }

      const incompleteCommand = new IncompleteCommand();
      // The action method should be implemented in concrete classes
      expect(typeof incompleteCommand.action).toBe('function');
      expect(incompleteCommand.action).toBeDefined();
    });
  });

  describe('integration with real command', () => {
    it('should work with a complete command implementation', async () => {
      const options: ParsedOptions = {
        required: 'test-value',
        validated: 'valid-value',
        _: [],
      };

      // Should not throw and should return undefined (void)
      const result = await command.action(options);
      expect(result).toBeUndefined();
    });

    it('should fail validation during action execution', async () => {
      const options: ParsedOptions = {
        // missing required option
        _: [],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Required option --required is missing'
      );
    });
  });
});
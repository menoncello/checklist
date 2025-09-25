/**
 * Base Command Tests
 * Tests for the base command functionality
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { BaseCommand } from '../../src/commands/base';
import type { CommandOption, ParsedOptions } from '../../src/types';

class TestCommand extends BaseCommand {
  name = 'test';
  description = 'Test command';
  options: CommandOption[] = [
    {
      flag: 'required-flag',
      description: 'A required flag',
      required: true
    },
    {
      flag: 'optional-flag',
      description: 'An optional flag',
      default: 'default-value'
    },
    {
      flag: 'validated-flag',
      description: 'A flag with validation',
      required: true,
      validator: (value) => typeof value === 'string' && value.length > 0
    }
  ];

  async action(): Promise<void> {
    // Test implementation
  }
}

describe('BaseCommand', () => {
  let command: TestCommand;

  beforeEach(() => {
    command = new TestCommand();
  });

  describe('validateOptions()', () => {
    it('should pass validation with required options present', () => {
      const options: ParsedOptions = {
        'required-flag': 'value',
        'validated-flag': 'valid',
        _: []
      };

      expect(() => command['validateOptions'](options)).not.toThrow();
    });

    it('should fail validation when required option is missing', () => {
      const options: ParsedOptions = {
        _: []
      };

      expect(() => command['validateOptions'](options)).toThrow('Required option --required-flag is missing');
    });

    it('should fail validation when validator returns false', () => {
      const options: ParsedOptions = {
        'required-flag': 'value',
        'validated-flag': '',
        _: []
      };

      expect(() => command['validateOptions'](options)).toThrow('Invalid value for --validated-flag');
    });

    it('should pass validation with valid validator', () => {
      const options: ParsedOptions = {
        'required-flag': 'value',
        'validated-flag': 'valid-value',
        _: []
      };

      expect(() => command['validateOptions'](options)).not.toThrow();
    });

    it('should handle short flag aliases', () => {
      const options: ParsedOptions = {
        r: 'value', // Short form of required-flag
        'validated-flag': 'valid',
        _: []
      };

      expect(() => command['validateOptions'](options)).not.toThrow();
    });
  });

  describe('getOption()', () => {
    it('should return option value', () => {
      const options: ParsedOptions = {
        'test-flag': 'test-value',
        _: []
      };

      const value = command['getOption'](options, 'test-flag');
      expect(value).toBe('test-value');
    });

    it('should return short flag value', () => {
      const options: ParsedOptions = {
        t: 'test-value',
        _: []
      };

      const value = command['getOption'](options, 'test-flag');
      expect(value).toBe('test-value');
    });

    it('should return default value when option not present', () => {
      const options: ParsedOptions = {
        _: []
      };

      const value = command['getOption'](options, 'missing-flag', 'default');
      expect(value).toBe('default');
    });

    it('should return undefined when option not present and no default', () => {
      const options: ParsedOptions = {
        _: []
      };

      const value = command['getOption'](options, 'missing-flag');
      expect(value).toBeUndefined();
    });
  });

  describe('generateHelp()', () => {
    it('should generate help text with all sections', () => {
      command.aliases = ['t', 'tst'];

      const help = command.generateHelp();

      expect(help).toContain('test - Test command');
      expect(help).toContain('Usage: checklist test [options]');
      expect(help).toContain('Aliases: t, tst');
      expect(help).toContain('Options:');
      expect(help).toContain('--required-flag    A required flag (required)');
      expect(help).toContain('--optional-flag    An optional flag (default: default-value)');
      expect(help).toContain('--validated-flag    A flag with validation');
    });

    it('should generate help text without aliases when none exist', () => {
      const help = command.generateHelp();

      expect(help).toContain('test - Test command');
      expect(help).not.toContain('Aliases:');
    });

    it('should handle command with no options', () => {
      command.options = [];

      const help = command.generateHelp();

      expect(help).toContain('test - Test command');
      expect(help).toContain('Usage: checklist test [options]');
      expect(help).not.toContain('Options:');
    });
  });
});
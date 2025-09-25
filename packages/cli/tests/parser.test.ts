/**
 * Command Parser Tests
 * Tests for argument parsing functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CommandParser } from '../src/parser';

describe('CommandParser', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...Bun.argv];
  });

  afterEach(() => {
    // Restore original argv
    (Bun.argv as any).length = 0;
    (Bun.argv as any).push(...originalArgv);
  });

  describe('parse()', () => {
    it('should parse simple command', () => {
      (Bun.argv as any) = ['bun', 'cli', 'init'];

      const result = CommandParser.parse();

      expect(result.command).toBe('init');
      expect(result.args).toEqual([]);
      expect(result.options._).toEqual([]);
    });

    it('should parse command with positional arguments', () => {
      (Bun.argv as any) = ['bun', 'cli', 'run', 'template-name'];

      const result = CommandParser.parse();

      expect(result.command).toBe('run');
      expect(result.options._).toEqual(['template-name']);
    });

    it('should parse long flags', () => {
      (Bun.argv as any) = ['bun', 'cli', 'init', '--force', '--template=advanced'];

      const result = CommandParser.parse();

      expect(result.command).toBe('init');
      expect(result.options.force).toBe(true);
      expect(result.options.template).toBe('advanced');
    });

    it('should parse short flags', () => {
      (Bun.argv as any) = ['bun', 'cli', 'status', '-v', '-c', 'config.yaml'];

      const result = CommandParser.parse();

      expect(result.command).toBe('status');
      expect(result.options.v).toBe(true);
      expect(result.options.c).toBe('config.yaml');
    });

    it('should parse bundled short flags', () => {
      (Bun.argv as any) = ['bun', 'cli', 'init', '-vf'];

      const result = CommandParser.parse();

      expect(result.command).toBe('init');
      expect(result.options.v).toBe(true);
      expect(result.options.f).toBe(true);
    });

    it('should handle no arguments (default to help)', () => {
      (Bun.argv as any) = ['bun', 'cli'];

      const result = CommandParser.parse();

      expect(result.command).toBe('help');
      expect(result.options._).toEqual([]);
    });

    it('should parse complex command with mixed arguments', () => {
      (Bun.argv as any) = ['bun', 'cli', 'run', 'template-name', '--config', 'config.yaml', '--verbose', 'extra-arg'];

      const result = CommandParser.parse();

      expect(result.command).toBe('run');
      expect(result.options._).toEqual(['template-name', 'extra-arg']);
      expect(result.options.config).toBe('config.yaml');
      expect(result.options.verbose).toBe(true);
    });
  });

  describe('validateInput()', () => {
    it('should accept valid input', () => {
      const validArgs = {
        command: 'run',
        args: ['template-name'],
        options: { _: ['template-name'] }
      };

      expect(() => CommandParser.validateInput(validArgs)).not.toThrow();
    });

    it('should reject too many arguments', () => {
      const args = Array(101).fill('arg');
      const invalidArgs = {
        command: 'run',
        args,
        options: { _: args }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow('Too many arguments provided');
    });

    it('should reject arguments that are too long', () => {
      const longArg = 'a'.repeat(1001);
      const invalidArgs = {
        command: 'run',
        args: [longArg],
        options: { _: [longArg] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow('Argument too long');
    });

    it('should reject invalid template names', () => {
      const invalidArgs = {
        command: 'run',
        args: ['../../../etc/passwd'],
        options: { _: ['../../../etc/passwd'] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow('Template name must contain only alphanumeric characters');
    });

    it('should reject unsafe config paths', () => {
      const invalidArgs = {
        command: 'run',
        args: [],
        options: { config: '../../../etc/passwd', _: [] }
      };

      expect(() => CommandParser.validateInput(invalidArgs)).toThrow('Config path contains potentially unsafe characters');
    });

    it('should accept valid template names', () => {
      const validArgs = {
        command: 'run',
        args: ['valid-template_name123'],
        options: { _: ['valid-template_name123'] }
      };

      expect(() => CommandParser.validateInput(validArgs)).not.toThrow();
    });
  });
});
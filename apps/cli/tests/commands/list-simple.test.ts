/**
 * Unit Tests for ListCommand - Simple Console Version
 * Tests template listing functionality with simple console mocking
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { ListCommand } from '../../src/commands/list';
import type { ParsedOptions } from '../../src/types';
import { testConsole } from '../utils/TestConsoleHelper';

describe('ListCommand (Simple Console Testing)', () => {
  let command: ListCommand;

  beforeEach(() => {
    command = new ListCommand();
    testConsole.startCapture();
  });

  afterEach(() => {
    testConsole.stopCapture();
  });

  describe('command properties', () => {
    it('should have correct name', () => {
      expect(command.name).toBe('list');
    });

    it('should have correct description', () => {
      expect(command.description).toBe('List available templates');
    });

    it('should have correct aliases', () => {
      expect(command.aliases).toEqual(['ls']);
    });

    it('should have expected options', () => {
      const options = command.options.map(opt => opt.flag);
      expect(options).toContain('format');
      expect(options).toContain('filter');
    });

    it('should have correct option descriptions', () => {
      const formatOption = command.options.find(opt => opt.flag === 'format');
      expect(formatOption?.description).toBe('Output format (text, json, yaml)');

      const filterOption = command.options.find(opt => opt.flag === 'filter');
      expect(filterOption?.description).toBe('Filter templates by pattern');
    });

    it('should have default value for format option', () => {
      const formatOption = command.options.find(opt => opt.flag === 'format');
      expect(formatOption?.default).toBe('text');
    });
  });

  describe('action with default options', () => {
    it('should list templates with default format', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Available Templates:')).toBe(true);
      expect(testConsole.wasCalled('log', 'Format: text')).toBe(true);
    });

    it('should display all mock templates', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(true);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(true);
      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(true);
    });

    it('should capture exact console calls', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      const logCalls = testConsole.getCalls('log');
      expect(logCalls).toEqual(
        expect.arrayContaining([
          ['Available Templates:'],
          ['Format: text'],
          ['  default - Basic checklist template'],
          ['  development - Software development workflow'],
          ['  deployment - Application deployment checklist']
        ])
      );
    });
  });

  describe('action with format option', () => {
    it('should use text format by default', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: text')).toBe(true);
    });

    it('should use explicit text format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'text',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: text')).toBe(true);
    });

    it('should use json format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'json',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: json')).toBe(true);
    });

    it('should use yaml format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'yaml',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: yaml')).toBe(true);
    });

    it('should handle custom format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'custom',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: custom')).toBe(true);
    });

    it('should handle numeric format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 123 as any,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: 123')).toBe(true);
    });

    it('should handle empty string format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: '',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: ')).toBe(true);
    });
  });

  describe('action with filter option', () => {
    it('should display filter when provided', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'dev',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Filter: dev')).toBe(true);
    });

    it('should filter templates by pattern', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'dev',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(true);
      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(false);
      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(false);
    });

    it('should filter templates with deployment pattern', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'deploy',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(true);
      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(false);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(false);
    });

    it('should filter templates with default pattern', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'default',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(true);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(false);
      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(false);
    });

    it('should handle case-sensitive filtering', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'Dev',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(false);
    });

    it('should handle empty string filter', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: '',
      };

      await command.action(options);

      // Empty string filter should match all templates since every string contains ''
      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(true);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(true);
      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(true);
    });

    it('should handle non-matching filter', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'nonexistent',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(false);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(false);
      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(false);
    });

    it('should handle numeric filter', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 123 as any,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Filter: 123')).toBe(true);
      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(false);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(false);
      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(false);
    });
  });

  describe('action with both format and filter', () => {
    it('should use both format and filter', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'json',
        filter: 'dev',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Filter: dev')).toBe(true);
      expect(testConsole.wasCalled('log', 'Format: json')).toBe(true);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(true);
    });

    it('should handle json format with no matching filter', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'json',
        filter: 'nonexistent',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Filter: nonexistent')).toBe(true);
      expect(testConsole.wasCalled('log', 'Format: json')).toBe(true);
      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(false);
    });
  });

  describe('console output verification', () => {
    it('should capture all output in correct order', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'test',
        format: 'json',
      };

      await command.action(options);

      const logCalls = testConsole.getCalls('log');

      // Verify order of console.log calls
      expect(logCalls[0]).toEqual(['Available Templates:']);
      expect(logCalls[1]).toEqual(['Filter: test']);
      expect(logCalls[2]).toEqual(['Format: json']);
    });

    it('should preserve template output format', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      // Test exact template strings
      expect(testConsole.wasCalled('log', '  default - Basic checklist template')).toBe(true);
      expect(testConsole.wasCalled('log', '  development - Software development workflow')).toBe(true);
      expect(testConsole.wasCalled('log', '  deployment - Application deployment checklist')).toBe(true);
    });

    it('should handle empty options object', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Available Templates:')).toBe(true);
      expect(testConsole.wasCalled('log', 'Format: text')).toBe(true);
    });
  });

  describe('integration with base command', () => {
    it('should call validateOptions before processing', async () => {
      const validateSpy = spyOn(command as any, 'validateOptions');

      const options: ParsedOptions = {
        _: [],
        format: 'text',
      };

      await command.action(options);

      expect(validateSpy).toHaveBeenCalledWith(options);
    });

    it('should handle validation errors', async () => {
      // Mock validateOptions to throw error
      spyOn(command as any, 'validateOptions').mockImplementation(() => {
        throw new Error('Validation failed');
      });

      const options: ParsedOptions = {
        _: [],
      };

      await expect(command.action(options)).rejects.toThrow('Validation failed');
    });
  });

  describe('getOption method behavior', () => {
    it('should use default format when not specified', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: text')).toBe(true);
    });

    it('should use provided format instead of default', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'yaml',
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Format: yaml')).toBe(true);
    });

    it('should use undefined filter when not specified', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      // Should not log filter line when filter is not provided
      const logCalls = testConsole.getCalls('log');
      const filterCall = logCalls.find(call => call[0].includes('Filter:'));
      expect(filterCall).toBeUndefined();
    });
  });
});
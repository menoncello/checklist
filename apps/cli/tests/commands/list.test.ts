/**
 * Unit Tests for ListCommand
 * Tests template listing functionality, format options, and filtering
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { ListCommand } from '../../src/commands/list';
import type { ParsedOptions } from '../../src/types';

describe('ListCommand', () => {
  let command: ListCommand;
  let consoleSpy: any;

  beforeEach(() => {
    command = new ListCommand();

    // Mock console methods
    consoleSpy = {
      log: spyOn(console, 'log')
    };
  });

  afterEach(() => {
    // Restore mocks
    consoleSpy.log.mockRestore();
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

      expect(consoleSpy.log).toHaveBeenCalledWith('Available Templates:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Format: text');
    });

    it('should display all mock templates', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).toHaveBeenCalledWith('  development - Software development workflow');
      expect(consoleSpy.log).toHaveBeenCalledWith('  deployment - Application deployment checklist');
    });
  });

  describe('action with format option', () => {
    it('should use text format by default', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: text');
    });

    it('should use explicit text format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'text',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: text');
    });

    it('should use json format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'json',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: json');
    });

    it('should use yaml format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'yaml',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: yaml');
    });

    it('should handle custom format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'custom',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: custom');
    });

    it('should handle numeric format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 123 as any,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: 123');
    });

    it('should handle empty string format', async () => {
      const options: ParsedOptions = {
        _: [],
        format: '',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: ');
    });
  });

  describe('action with filter option', () => {
    it('should display filter when provided', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'dev',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Filter: dev');
    });

    it('should filter templates by pattern', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'dev',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('  development - Software development workflow');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  deployment - Application deployment checklist');
    });

    it('should filter templates with deployment pattern', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'deploy',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('  deployment - Application deployment checklist');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  development - Software development workflow');
    });

    it('should filter templates with default pattern', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'default',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  development - Software development workflow');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  deployment - Application deployment checklist');
    });

    it('should handle partial matches', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'template',
      };

      await command.action(options);

      // All templates contain 'template' in their description
      expect(consoleSpy.log).toHaveBeenCalledWith('  default - Basic checklist template');
      // The development and deployment templates don't contain 'template' in their name
    });

    it('should handle case-sensitive filtering', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'Dev',
      };

      await command.action(options);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('  development - Software development workflow');
    });

    it('should handle empty string filter', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: '',
      };

      await command.action(options);

      // Empty string filter should match all templates since every string contains ''
      expect(consoleSpy.log).toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).toHaveBeenCalledWith('  development - Software development workflow');
      expect(consoleSpy.log).toHaveBeenCalledWith('  deployment - Application deployment checklist');
    });

    it('should handle non-matching filter', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'nonexistent',
      };

      await command.action(options);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  development - Software development workflow');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  deployment - Application deployment checklist');
    });

    it('should handle numeric filter', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 123 as any,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Filter: 123');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  development - Software development workflow');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  deployment - Application deployment checklist');
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

      expect(consoleSpy.log).toHaveBeenCalledWith('Filter: dev');
      expect(consoleSpy.log).toHaveBeenCalledWith('Format: json');
      expect(consoleSpy.log).toHaveBeenCalledWith('  development - Software development workflow');
    });

    it('should handle json format with no matching filter', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'json',
        filter: 'nonexistent',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Filter: nonexistent');
      expect(consoleSpy.log).toHaveBeenCalledWith('Format: json');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('  default - Basic checklist template');
    });
  });

  describe('boolean logic testing for mutations', () => {
    it('should test Boolean(filter) condition with truthy value', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'valid-filter',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Filter: valid-filter');
    });

    it('should test Boolean(filter) condition with falsy value', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: '',
      };

      await command.action(options);

      // Empty string filter doesn't trigger the Boolean(filter) condition
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Filter: ');
    });

    it('should test Boolean(filter) condition with undefined', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: undefined,
      };

      await command.action(options);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('Filter: undefined');
    });

    it('should test Boolean(filter) condition with null', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: null as any,
      };

      await command.action(options);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('Filter: null');
    });

    it('should test filter condition in loop with matching template', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'development',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('  development - Software development workflow');
    });

    it('should test filter condition in loop with non-matching template', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'nonexistent',
      };

      await command.action(options);

      // The filter line will be logged but no templates will match
      expect(consoleSpy.log).toHaveBeenCalledWith('Filter: nonexistent');
      // But no template entries will be logged since none match 'nonexistent'
    });
  });

  describe('console output strings that mutations target', () => {
    it('should output exact strings that mutations try to change', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'text',
        filter: 'test',
      };

      await command.action(options);

      // These exact strings are what mutations try to change
      expect(consoleSpy.log).toHaveBeenCalledWith('Available Templates:');
      expect(consoleSpy.log).toHaveBeenCalledWith('Filter: test');
      expect(consoleSpy.log).toHaveBeenCalledWith('Format: text');
    });

    it('should preserve template output format', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      // Test exact template strings
      expect(consoleSpy.log).toHaveBeenCalledWith('  default - Basic checklist template');
      expect(consoleSpy.log).toHaveBeenCalledWith('  development - Software development workflow');
      expect(consoleSpy.log).toHaveBeenCalledWith('  deployment - Application deployment checklist');
    });

    it('should maintain console.log call order', async () => {
      const options: ParsedOptions = {
        _: [],
        filter: 'test',
        format: 'json',
      };

      await command.action(options);

      const calls = consoleSpy.log.mock.calls;

      // Verify order of console.log calls
      expect(calls[0][0]).toBe('Available Templates:');
      expect(calls[1][0]).toBe('Filter: test');
      expect(calls[2][0]).toBe('Format: json');
    });
  });

  describe('mock template data testing', () => {
    it('should use the exact mock template data', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      // Verify the mock templates are exactly as expected
      const templates = [
        'default - Basic checklist template',
        'development - Software development workflow',
        'deployment - Application deployment checklist'
      ];

      templates.forEach(template => {
        expect(consoleSpy.log).toHaveBeenCalledWith(`  ${template}`);
      });
    });

    it('should preserve template order in output', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      const calls = consoleSpy.log.mock.calls;

      // Find template output calls (skip the header and format calls)
      const templateCalls = calls.filter((call: any) => call[0].includes(' - '));

      expect(templateCalls[0][0]).toBe('  default - Basic checklist template');
      expect(templateCalls[1][0]).toBe('  development - Software development workflow');
      expect(templateCalls[2][0]).toBe('  deployment - Application deployment checklist');
    });
  });

  describe('option validation', () => {
    it('should handle null options gracefully', async () => {
      const options = null as any;

      await expect(command.action(options)).rejects.toThrow();
    });

    it('should handle undefined options gracefully', async () => {
      const options = undefined as any;

      await expect(command.action(options)).rejects.toThrow();
    });

    it('should handle empty options object', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);
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

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: text');
    });

    it('should use provided format instead of default', async () => {
      const options: ParsedOptions = {
        _: [],
        format: 'yaml',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Format: yaml');
    });

    it('should use undefined filter when not specified', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      // Should not log filter line when filter is not provided
      const filterCall = consoleSpy.log.mock.calls.find((call: any) => call[0].includes('Filter:'));
      expect(filterCall).toBeUndefined();
    });
  });
});
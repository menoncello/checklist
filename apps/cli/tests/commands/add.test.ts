/**
 * Unit Tests for AddCommand
 * Tests template addition functionality and validation
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { AddCommand } from '../../src/commands/add';
import type { ParsedOptions } from '../../src/types';

describe('AddCommand', () => {
  let command: AddCommand;
  let consoleSpy: any;

  beforeEach(() => {
    command = new AddCommand();

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
      expect(command.name).toBe('add');
    });

    it('should have correct description', () => {
      expect(command.description).toBe('Add template to project');
    });

    it('should have correct aliases', () => {
      expect(command.aliases).toEqual(['a']);
    });

    it('should have expected options', () => {
      const options = command.options.map(opt => opt.flag);
      expect(options).toContain('source');
      expect(options).toContain('force');
    });

    it('should have correct option descriptions', () => {
      const sourceOption = command.options.find(opt => opt.flag === 'source');
      expect(sourceOption?.description).toBe('Source location for the template (url, path, or registry)');

      const forceOption = command.options.find(opt => opt.flag === 'force');
      expect(forceOption?.description).toBe('Force addition even if template already exists');
    });
  });

  describe('action validation', () => {
    it('should throw error when template name is missing', async () => {
      const options: ParsedOptions = {
        _: [], // Empty array means no template provided
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist add <template>'
      );
    });

    it('should throw error when template name is empty string', async () => {
      const options: ParsedOptions = {
        _: [''],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist add <template>'
      );
    });

    it('should throw error when template name is null', async () => {
      const options: ParsedOptions = {
        _: [null as any],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist add <template>'
      );
    });

    it('should throw error when template name is undefined', async () => {
      const options: ParsedOptions = {
        _: [undefined as any],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist add <template>'
      );
    });
  });

  describe('action with valid template', () => {
    it('should add template without source or force', async () => {
      const options: ParsedOptions = {
        _: ['my-template'],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should add template with source', async () => {
      const options: ParsedOptions = {
        _: ['my-template'],
        source: 'https://github.com/example/template.git',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Source: https://github.com/example/template.git');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should add template with force flag true', async () => {
      const options: ParsedOptions = {
        _: ['my-template'],
        force: true,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should add template with force flag false', async () => {
      const options: ParsedOptions = {
        _: ['my-template'],
        force: false,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should add template with both source and force', async () => {
      const options: ParsedOptions = {
        _: ['my-template'],
        source: '/local/path/to/template',
        force: true,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Source: /local/path/to/template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should add template with numeric source', async () => {
      const options: ParsedOptions = {
        _: ['my-template'],
        source: 123 as any,
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Source: 123');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should add template with empty string source', async () => {
      const options: ParsedOptions = {
        _: ['my-template'],
        source: '',
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template');
      expect(consoleSpy.log).not.toHaveBeenCalledWith('Source: ');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });
  });

  describe('action with different template names', () => {
    it('should handle simple template name', async () => {
      const options: ParsedOptions = {
        _: ['simple'],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: simple');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should handle template name with spaces', async () => {
      const options: ParsedOptions = {
        _: ['my complex template'],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my complex template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should handle template name with special characters', async () => {
      const options: ParsedOptions = {
        _: ['my-template_v1.0'],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: my-template_v1.0');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should handle template name with numbers', async () => {
      const options: ParsedOptions = {
        _: ['template123'],
      };

      await command.action(options);

      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: template123');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });
  });

  describe('action option validation', () => {
    it('should handle null options gracefully', async () => {
      const options: ParsedOptions = null as any;

      await expect(command.action(options)).rejects.toThrow();
    });

    it('should handle undefined options gracefully', async () => {
      const options: ParsedOptions = undefined as any;

      await expect(command.action(options)).rejects.toThrow();
    });

    it('should handle empty options object', async () => {
      const options: ParsedOptions = {
        _: []
      };

      await expect(command.action(options)).rejects.toThrow();
    });
  });

  describe('boolean logic testing for mutations', () => {
    it('should test Boolean(source) condition', async () => {
      // Test with truthy value
      const truthyOptions: ParsedOptions = {
        _: ['template'],
        source: 'valid-source',
      };

      await command.action(truthyOptions);

      expect(consoleSpy.log).toHaveBeenCalledWith('Source: valid-source');

      // Reset spy
      consoleSpy.log.mockClear();

      // Test with falsy value
      const falsyOptions: ParsedOptions = {
        _: ['template'],
        source: '',
      };

      await command.action(falsyOptions);

      expect(consoleSpy.log).not.toHaveBeenCalledWith(expect.stringContaining('Source: '));
    });

    it('should test Boolean(force) condition', async () => {
      // Test with true
      const trueOptions: ParsedOptions = {
        _: ['template'],
        force: true,
      };

      await command.action(trueOptions);

      expect(consoleSpy.log).toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');

      // Reset spy
      consoleSpy.log.mockClear();

      // Test with false
      const falseOptions: ParsedOptions = {
        _: ['template'],
        force: false,
      };

      await command.action(falseOptions);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');
    });

    it('should test force condition directly', async () => {
      // Test with true
      const trueOptions: ParsedOptions = {
        _: ['template'],
        force: true,
      };

      await command.action(trueOptions);

      expect(consoleSpy.log).toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');

      // Reset spy
      consoleSpy.log.mockClear();

      // Test with false
      const falseOptions: ParsedOptions = {
        _: ['template'],
        force: false,
      };

      await command.action(falseOptions);

      expect(consoleSpy.log).not.toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');
    });
  });

  describe('console output strings that mutations target', () => {
    it('should output exact strings that mutations try to change', async () => {
      const options: ParsedOptions = {
        _: ['test-template'],
        source: 'test-source',
        force: true,
      };

      await command.action(options);

      // These exact strings are what mutations try to change
      expect(consoleSpy.log).toHaveBeenCalledWith('Adding template: test-template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Source: test-source');
      expect(consoleSpy.log).toHaveBeenCalledWith('Force flag enabled - will overwrite existing template');
      expect(consoleSpy.log).toHaveBeenCalledWith('Template added successfully!');
    });

    it('should preserve console.log structure', async () => {
      const options: ParsedOptions = {
        _: ['another-template'],
      };

      await command.action(options);

      const calls = consoleSpy.log.mock.calls;
      expect(calls).toHaveLength(2); // Should have exactly 2 console.log calls
      expect(calls[0][0]).toBe('Adding template: another-template');
      expect(calls[1][0]).toBe('Template added successfully!');
    });
  });

  describe('error message accuracy', () => {
    it('should output exact error message', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist add <template>'
      );
    });

    it('should preserve error message formatting', async () => {
      const options: ParsedOptions = {
        _: [''],
      };

      await expect(command.action(options)).rejects.toThrow(
        'Template name is required. Usage: checklist add <template>'
      );
    });
  });

  describe('integration with base command', () => {
    it('should validate options before processing', async () => {
      const options: ParsedOptions = {
        _: ['valid-template'],
      };

      // Should not throw when valid options are provided
      await expect(command.action(options)).resolves.toBeUndefined();
    });

    it('should handle validation errors', async () => {
      // Create invalid options that would cause validation to fail
      const options: ParsedOptions = {
        _: ['valid-template'],
        // Add an invalid required option if needed
      };

      // Since add command has no required options, test with missing template name
      const invalidOptions: ParsedOptions = {
        _: [], // Missing template name
      };

      await expect(command.action(invalidOptions)).rejects.toThrow(
        'Template name is required. Usage: checklist add <template>'
      );
    });
  });
});
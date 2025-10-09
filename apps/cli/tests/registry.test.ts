/**
 * Unit Tests for CommandRegistry
 * Tests command registration, lookup, aliases, and suggestion functionality
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import type { CLICommand } from '../src/types';
import { CommandRegistry } from '../src/registry';

describe('CommandRegistry', () => {
  let registry: CommandRegistry;
  let mockCommand1: CLICommand;
  let mockCommand2: CLICommand;
  let mockCommandWithAliases: CLICommand;

  beforeEach(() => {
    registry = new CommandRegistry();

    mockCommand1 = {
      name: 'test-command',
      description: 'Test command for unit testing',
      options: [],
      action: async () => {},
    };

    mockCommand2 = {
      name: 'another-command',
      description: 'Another test command',
      options: [],
      action: async () => {},
    };

    mockCommandWithAliases = {
      name: 'long-command-name',
      aliases: ['lc', 'long'],
      description: 'Command with aliases',
      options: [],
      action: async () => {},
    };
  });

  describe('register', () => {
    it('should register a command successfully', () => {
      registry.register(mockCommand1);
      expect(registry.has('test-command')).toBe(true);
    });

    it('should register command aliases successfully', () => {
      registry.register(mockCommandWithAliases);
      expect(registry.has('long-command-name')).toBe(true);
      expect(registry.has('lc')).toBe(true);
      expect(registry.has('long')).toBe(true);
    });

    it('should allow multiple commands to be registered', () => {
      registry.register(mockCommand1);
      registry.register(mockCommand2);
      registry.register(mockCommandWithAliases);

      expect(registry.has('test-command')).toBe(true);
      expect(registry.has('another-command')).toBe(true);
      expect(registry.has('long-command-name')).toBe(true);
    });
  });

  describe('get', () => {
    beforeEach(() => {
      registry.register(mockCommand1);
      registry.register(mockCommandWithAliases);
    });

    it('should retrieve command by exact name', () => {
      const command = registry.get('test-command');
      expect(command).toBe(mockCommand1);
    });

    it('should retrieve command by alias', () => {
      const command = registry.get('lc');
      expect(command).toBe(mockCommandWithAliases);
    });

    it('should return undefined for non-existent command', () => {
      const command = registry.get('non-existent');
      expect(command).toBeUndefined();
    });

    it('should prefer exact name match over alias', () => {
      // Register a command with an alias that matches another command's name
      const conflictCommand = {
        name: 'lc',
        description: 'Conflicting command name',
        options: [],
        action: async () => {},
      };
      registry.register(conflictCommand);

      const command = registry.get('lc');
      expect(command).toBe(conflictCommand);
    });
  });

  describe('has', () => {
    beforeEach(() => {
      registry.register(mockCommand1);
      registry.register(mockCommandWithAliases);
    });

    it('should return true for existing command', () => {
      expect(registry.has('test-command')).toBe(true);
    });

    it('should return true for existing alias', () => {
      expect(registry.has('lc')).toBe(true);
      expect(registry.has('long')).toBe(true);
    });

    it('should return false for non-existent command', () => {
      expect(registry.has('non-existent')).toBe(false);
    });
  });

  describe('getAllCommands', () => {
    it('should return empty array when no commands registered', () => {
      const commands = registry.getAllCommands();
      expect(commands).toEqual([]);
    });

    it('should return all registered commands without duplicates', () => {
      registry.register(mockCommand1);
      registry.register(mockCommand2);
      registry.register(mockCommandWithAliases);

      const commands = registry.getAllCommands();
      expect(commands).toHaveLength(3);
      expect(commands).toContain(mockCommand1);
      expect(commands).toContain(mockCommand2);
      expect(commands).toContain(mockCommandWithAliases);
    });
  });

  describe('getSuggestions', () => {
    beforeEach(() => {
      registry.register(mockCommand1);
      registry.register(mockCommand2);
      registry.register(mockCommandWithAliases);
    });

    it('should return suggestions for similar command names', () => {
      const suggestions = registry.getSuggestions('test-commnad'); // typo
      expect(suggestions).toContain('test-command');
    });

    it('should return suggestions for similar aliases', () => {
      const suggestions = registry.getSuggestions('1c'); // typo
      expect(suggestions).toContain('lc');
    });

    it('should return empty array for completely different input', () => {
      const suggestions = registry.getSuggestions('xyz');
      expect(suggestions).toEqual([]);
    });

    it('should limit suggestions to maximum of 3', () => {
      // Register commands with similar names
      registry.register({
        name: 'test1',
        description: 'Test 1',
        options: [],
        action: async () => {},
      });
      registry.register({
        name: 'test2',
        description: 'Test 2',
        options: [],
        action: async () => {},
      });
      registry.register({
        name: 'test3',
        description: 'Test 3',
        options: [],
        action: async () => {},
      });
      registry.register({
        name: 'test4',
        description: 'Test 4',
        options: [],
        action: async () => {},
      });

      const suggestions = registry.getSuggestions('test');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should return suggestions sorted by Levenshtein distance', () => {
      const suggestions = registry.getSuggestions('test-cammand'); // 2 edits from 'test-command'
      expect(suggestions[0]).toBe('test-command');
    });

    it('should handle empty input gracefully', () => {
      const suggestions = registry.getSuggestions('');
      expect(Array.isArray(suggestions)).toBe(true);
    });
  });

  describe('Levenshtein Distance Calculation', () => {
    it('should calculate correct distance for identical strings', () => {
      registry.register(mockCommand1);
      const suggestions = registry.getSuggestions('test-command');
      // Should suggest the exact match (distance 0)
      expect(suggestions).toContain('test-command');
    });

    it('should handle strings with special characters', () => {
      const specialCommand = {
        name: 'test-command-with-dashes',
        description: 'Special chars',
        options: [],
        action: async () => {},
      };
      registry.register(specialCommand);

      const suggestions = registry.getSuggestions('test-command-with-dashes');
      // Should suggest the exact match (distance 0)
      expect(suggestions).toContain('test-command-with-dashes');
    });
  });
});
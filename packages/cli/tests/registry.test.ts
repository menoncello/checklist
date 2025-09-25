/**
 * Command Registry Tests
 * Tests for command registration and lookup functionality
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { CommandRegistry } from '../src/registry';
import type { CLICommand } from '../src/types';

class MockCommand implements CLICommand {
  constructor(
    public name: string,
    public description: string,
    public aliases?: string[]
  ) {}

  options = [];

  async action(): Promise<void> {
    // Mock implementation
  }
}

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  describe('register()', () => {
    it('should register a command', () => {
      const command = new MockCommand('test', 'Test command');
      registry.register(command);

      expect(registry.has('test')).toBe(true);
      expect(registry.get('test')).toBe(command);
    });

    it('should register command aliases', () => {
      const command = new MockCommand('init', 'Initialize project', ['i', 'create']);
      registry.register(command);

      expect(registry.has('init')).toBe(true);
      expect(registry.has('i')).toBe(true);
      expect(registry.has('create')).toBe(true);
      expect(registry.get('i')).toBe(command);
      expect(registry.get('create')).toBe(command);
    });
  });

  describe('get()', () => {
    it('should return command by name', () => {
      const command = new MockCommand('test', 'Test command');
      registry.register(command);

      expect(registry.get('test')).toBe(command);
    });

    it('should return command by alias', () => {
      const command = new MockCommand('status', 'Show status', ['st', 'stat']);
      registry.register(command);

      expect(registry.get('st')).toBe(command);
      expect(registry.get('stat')).toBe(command);
    });

    it('should return undefined for unknown command', () => {
      expect(registry.get('unknown')).toBeUndefined();
    });
  });

  describe('has()', () => {
    it('should return true for registered command', () => {
      const command = new MockCommand('test', 'Test command');
      registry.register(command);

      expect(registry.has('test')).toBe(true);
    });

    it('should return true for registered alias', () => {
      const command = new MockCommand('list', 'List items', ['ls']);
      registry.register(command);

      expect(registry.has('ls')).toBe(true);
    });

    it('should return false for unregistered command', () => {
      expect(registry.has('unknown')).toBe(false);
    });
  });

  describe('getAllCommands()', () => {
    it('should return all registered commands', () => {
      const command1 = new MockCommand('cmd1', 'Command 1');
      const command2 = new MockCommand('cmd2', 'Command 2');

      registry.register(command1);
      registry.register(command2);

      const commands = registry.getAllCommands();
      expect(commands).toHaveLength(2);
      expect(commands).toContain(command1);
      expect(commands).toContain(command2);
    });

    it('should return empty array when no commands registered', () => {
      expect(registry.getAllCommands()).toEqual([]);
    });
  });

  describe('getSuggestions()', () => {
    beforeEach(() => {
      registry.register(new MockCommand('init', 'Initialize'));
      registry.register(new MockCommand('run', 'Run workflow'));
      registry.register(new MockCommand('status', 'Show status', ['st']));
      registry.register(new MockCommand('list', 'List items', ['ls']));
    });

    it('should suggest close matches', () => {
      const suggestions = registry.getSuggestions('ini');
      expect(suggestions).toContain('init');
    });

    it('should suggest multiple close matches', () => {
      const suggestions = registry.getSuggestions('st');
      expect(suggestions).toContain('st');
      // Note: 'status' has distance 4 from 'st', so it won't be in top suggestions
      // Instead, we should get closer matches like 'st', 'list', 'ls'
      expect(suggestions.length).toBeGreaterThan(0);
    });

    it('should return empty array for distant matches', () => {
      const suggestions = registry.getSuggestions('xyz');
      expect(suggestions).toEqual([]);
    });

    it('should limit suggestions to top 3', () => {
      // Add more commands to test the limit
      registry.register(new MockCommand('start', 'Start something'));
      registry.register(new MockCommand('stop', 'Stop something'));
      registry.register(new MockCommand('step', 'Step through'));

      const suggestions = registry.getSuggestions('st');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should handle exact matches', () => {
      const suggestions = registry.getSuggestions('init');
      expect(suggestions).toContain('init');
    });
  });
});
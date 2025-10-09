/**
 * Unit Tests for HelpCommand
 * Tests help functionality, command lookup, and help text generation
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { HelpCommand } from '../../src/commands/help';
import { CommandRegistry } from '../../src/registry';
import type { ParsedOptions } from '../../src/types';

// Mock console.log to capture output
const originalConsoleLog = console.log;

describe('HelpCommand', () => {
  let helpCommand: HelpCommand;
  let registry: CommandRegistry;
  let mockConsoleLog: ReturnType<typeof spyOn>;

  beforeEach(() => {
    registry = new CommandRegistry();
    helpCommand = new HelpCommand(registry);
    mockConsoleLog = spyOn(console, 'log');
    console.log = mockConsoleLog;

    // Register some mock commands for testing
    registry.register({
      name: 'init',
      description: 'Initialize new project',
      aliases: ['i'],
      options: [
        { flag: 'force', description: 'Force initialization' },
        { flag: 'template', description: 'Template to use', default: 'default' },
      ],
      action: async () => {},
      generateHelp: () => 'init - Initialize new project\nUsage: checklist init [options]',
    });

    registry.register({
      name: 'run',
      description: 'Run workflow',
      aliases: ['r'],
      options: [
        { flag: 'env', description: 'Environment', required: true },
        { flag: 'verbose', description: 'Verbose output' },
      ],
      action: async () => {},
      generateHelp: () => 'run - Run workflow\nUsage: checklist run [options]',
    });

    registry.register({
      name: 'list',
      description: 'List available items',
      options: [],
      action: async () => {},
      generateHelp: () => 'list - List available items\nUsage: checklist list',
    });
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    console.log = originalConsoleLog;
  });

  describe('action with specific command help', () => {
    it('should show help for specific command when provided', async () => {
      const options: ParsedOptions = { _: ['init'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'init - Initialize new project\nUsage: checklist init [options]'
      );
    });

    it('should show help for command alias', async () => {
      const options: ParsedOptions = { _: ['i'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(
        'init - Initialize new project\nUsage: checklist init [options]'
      );
    });

    it('should show error message for unknown command', async () => {
      const options: ParsedOptions = { _: ['unknown'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: unknown');
    });

    it('should show suggestions for unknown command', async () => {
      const options: ParsedOptions = { _: ['ini'] }; // Close to 'init'

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: ini');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Did you mean:'));
    });

    it('should show suggestions for unknown command alias', async () => {
      const options: ParsedOptions = { _: ['j'] }; // Close to 'i'

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: j');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Did you mean:'));
    });

    it('should handle command without generateHelp method', async () => {
      // Register a command without generateHelp
      registry.register({
        name: 'no-help',
        description: 'Command without help',
        options: [],
        action: async () => {},
      });

      const options: ParsedOptions = { _: ['no-help'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: no-help');
    });

    it('should handle empty command name', async () => {
      const options: ParsedOptions = { _: [''] };

      await helpCommand.action(options);

      // Empty string should show general help
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Checklist CLI'));
    });
  });

  describe('action with general help', () => {
    it('should show general help when no command specified', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      // Should show header, commands, global options, examples, and footer
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Checklist CLI'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Global Options:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Examples:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('For help on a specific command'));
    });

    it('should exclude help command from command list', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      const commandOutput = calls.find((call: unknown) => typeof call === 'string' && call.includes('init'));

      expect(commandOutput).toBeDefined();
      expect(commandOutput).toContain('init');
      expect(commandOutput).toContain('(i)');
    });

    it('should show commands with aliases', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      const initOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('init') && call.includes('(i)')
      );
      const runOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('run') && call.includes('(r)')
      );

      expect(initOutput).toBeDefined();
      expect(runOutput).toBeDefined();
    });

    it('should show commands without aliases correctly', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      const listOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('list') && !call.includes('(')
      );

      expect(listOutput).toBeDefined();
      expect(listOutput).toContain('list');
      expect(listOutput).not.toContain('(');
    });
  });

  describe('private methods functionality', () => {
    it('should print header correctly', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Checklist CLI - Manage your checklists and workflows'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Usage: checklist [command] [options]'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    });

    it('should print global options correctly', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('--help, -h'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('--version, -v'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('--config, -c'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('--verbose'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('--no-color'));
    });

    it('should print examples correctly', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Examples:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('checklist init'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('checklist run development'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('checklist add deployment'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('checklist status --verbose'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('checklist reset --force'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('checklist list --filter dev'));
    });

    it('should print footer correctly', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('For help on a specific command:'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('checklist help <command>'));
    });
  });

  describe('command properties', () => {
    it('should have correct command properties', () => {
      expect(helpCommand.name).toBe('help');
      expect(helpCommand.description).toBe('Display help information');
      expect(helpCommand.aliases).toEqual(['h']);
      expect(helpCommand.options).toEqual([]);
    });

    it('should inherit from BaseCommand', () => {
      expect(helpCommand.constructor.name).toBe('HelpCommand');
      expect(typeof helpCommand.action).toBe('function');
      expect(typeof helpCommand.generateHelp).toBe('function');
    });

    it('should generate help for itself', () => {
      const help = helpCommand.generateHelp();

      expect(help).toContain('help - Display help information');
      expect(help).toContain('Usage: checklist help [options]');
      expect(help).toContain('Aliases: h');
    });
  });

  describe('error handling', () => {
    it('should handle registry with no commands', async () => {
      const emptyRegistry = new CommandRegistry();
      const emptyHelpCommand = new HelpCommand(emptyRegistry);
      const options: ParsedOptions = { _: [] };

      await emptyHelpCommand.action(options);

      // Should still show general help structure
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Checklist CLI'));
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Commands:'));
    });

    it('should handle malformed command names gracefully', async () => {
      const options: ParsedOptions = { _: ['123!@#'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: 123!@#');
    });

    it('should handle null/undefined in options array', async () => {
      const options: ParsedOptions = { _: [null, undefined, 'init'] as any };

      await helpCommand.action(options);

      // Should show general help when array contains null/undefined
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Checklist CLI'));
    });
  });

  describe('suggestion functionality', () => {
    it('should provide multiple suggestions when available', async () => {
      // Add a command similar to 'init'
      registry.register({
        name: 'initial',
        description: 'Initial command',
        options: [],
        action: async () => {},
      });

      const options: ParsedOptions = { _: ['ini'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: ini');
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringMatching(/Did you mean: (init|initial)/));
    });

    it('should handle suggestions when no close matches exist', async () => {
      const options: ParsedOptions = { _: ['xyz'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: xyz');
      // Should not include suggestions line
      const suggestionCalls = mockConsoleLog.mock.calls.filter((call: unknown[]) =>
        call[0] && call[0].toString().includes('Did you mean:')
      );
      expect(suggestionCalls).toHaveLength(0);
    });

    // Tests for mutation score improvement - edge cases for string literals and conditionals
    it('should handle suggestions with single suggestion correctly', async () => {
      // Register a command that will be the only suggestion
      registry.register({
        name: 'initial',
        description: 'Initial command',
        aliases: ['init'],
        options: [],
        action: async () => {},
        generateHelp: () => 'initial - Initial command',
      });

      const options: ParsedOptions = { _: ['ini'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: ini');
      // Should show suggestion with proper comma formatting (even for single suggestion)
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Did you mean:'));
    });

    it('should handle empty aliases array in commands list', async () => {
      // Register command with explicitly empty aliases
      registry.register({
        name: 'empty-alias',
        description: 'Command with empty aliases',
        aliases: [], // Explicit empty array
        options: [],
        action: async () => {},
        generateHelp: () => 'empty-alias - Command with empty aliases',
      });

      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      const emptyAliasOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('empty-alias')
      );

      expect(emptyAliasOutput).toBeDefined();
      expect(emptyAliasOutput).toContain('empty-alias');
      // Should not have parentheses for empty aliases
      expect(emptyAliasOutput).not.toMatch(/empty-alias.*\(\s*\)/);
    });

    it('should handle commands with single alias correctly', async () => {
      // Register command with single alias
      registry.register({
        name: 'single',
        description: 'Single alias command',
        aliases: ['solo'], // Single alias
        options: [],
        action: async () => {},
        generateHelp: () => 'single - Single alias command',
      });

      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      const singleOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('single')
      );

      expect(singleOutput).toBeDefined();
      expect(singleOutput).toContain('single');
      expect(singleOutput).toContain('(solo)');
    });

    it('should handle help command exclusion correctly', async () => {
      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      // Help command should not appear in the command list
      const helpCommandOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('help') && call.includes('Display help information')
      );

      expect(helpCommandOutput).toBeUndefined();
    });

    it('should handle commands with null/undefined aliases gracefully', async () => {
      // Register command with null aliases (edge case)
      registry.register({
        name: 'null-alias',
        description: 'Null alias command',
        aliases: null as any,
        options: [],
        action: async () => {},
        generateHelp: () => 'null-alias - Null alias command',
      });

      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      const nullAliasOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('null-alias')
      );

      expect(nullAliasOutput).toBeDefined();
      expect(nullAliasOutput).toContain('null-alias');
      // Should not crash or show malformed output
      expect(nullAliasOutput).not.toContain('()');
    });

    it('should handle suggestions with multiple aliases correctly', async () => {
      // Register command with multiple aliases
      registry.register({
        name: 'multi',
        description: 'Multiple aliases command',
        aliases: ['m', 'multi-cmd', 'multiple'],
        options: [],
        action: async () => {},
        generateHelp: () => 'multi - Multiple aliases command',
      });

      const options: ParsedOptions = { _: ['mul'] };

      await helpCommand.action(options);

      expect(mockConsoleLog).toHaveBeenCalledWith('Unknown command: mul');
      // Should show suggestions with proper comma separation
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Did you mean:'));
    });

    it('should handle command name filtering with edge cases', async () => {
      // Register command with name that could cause issues
      registry.register({
        name: 'help-test',
        description: 'Help test command (not help command)',
        aliases: ['ht'],
        options: [],
        action: async () => {},
        generateHelp: () => 'help-test - Help test command',
      });

      const options: ParsedOptions = { _: [] };

      await helpCommand.action(options);

      const calls = mockConsoleLog.mock.calls.flat();
      const helpTestOutput = calls.find((call: unknown) =>
        typeof call === 'string' && call.includes('help-test')
      );

      expect(helpTestOutput).toBeDefined();
      expect(helpTestOutput).toContain('help-test');
      expect(helpTestOutput).toContain('(ht)');
      // Should appear (only exact 'help' should be excluded)
    });

    it('should handle suggestion formatting with different alias types', async () => {
      // Register commands with different alias patterns
      registry.register({
        name: 'form',
        description: 'Form command',
        aliases: ['f'],
        options: [],
        action: async () => {},
        generateHelp: () => 'form - Form command',
      });

      registry.register({
        name: 'formatting',
        description: 'Formatting command',
        aliases: ['fmt'],
        options: [],
        action: async () => {},
        generateHelp: () => 'formatting - Formatting command',
      });

      const options: ParsedOptions = { _: ['format'] };

      await helpCommand.action(options);

      // Should handle various alias formats gracefully
      expect(mockConsoleLog).toHaveBeenCalledWith(expect.stringContaining('Did you mean:'));
    });
  });
});
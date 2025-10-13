/**
 * Unit Tests for ReevaluateCommand
 * Story 3.6: Conditional Workflow Branching (Task 5)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ReevaluateCommand } from '../../src/commands/reevaluate';
import type { ParsedOptions } from '../../src/types';
import { testConsole } from '../utils/TestConsoleHelper';

describe('ReevaluateCommand', () => {
  let command: ReevaluateCommand;

  beforeEach(() => {
    command = new ReevaluateCommand();
    testConsole.startCapture();
  });

  afterEach(() => {
    testConsole.stopCapture();
  });

  describe('command properties', () => {
    it('should have correct name', () => {
      expect(command.name).toBe('reevaluate');
    });

    it('should have correct description', () => {
      expect(command.description).toBe('Re-evaluate all conditional step visibility');
    });

    it('should have correct aliases', () => {
      expect(command.aliases).toEqual(['reeval', 'refresh-conditions']);
    });

    it('should have expected options', () => {
      const options = command.options.map(opt => opt.flag);
      expect(options).toContain('verbose');
      expect(options).toContain('force');
    });

    it('should have correct option descriptions', () => {
      const verboseOption = command.options.find(opt => opt.flag === 'verbose');
      expect(verboseOption?.description).toBe('Show detailed condition evaluation results');

      const forceOption = command.options.find(opt => opt.flag === 'force');
      expect(forceOption?.description).toBe('Skip confirmation prompt');
    });
  });

  describe('action with default options', () => {
    it('should display re-evaluation message', async () => {
      const options: ParsedOptions = {
        _: [],
        force: true, // Skip confirmation prompt for testing
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Re-evaluating step conditions')).toBe(true);
    });

    it('should display step count results', async () => {
      const options: ParsedOptions = {
        _: [],
        force: true,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Conditions re-evaluated')).toBe(true);
      expect(testConsole.wasCalled('log', 'visible steps')).toBe(true);
    });

    it('should show confirmation note without force flag', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 're-evaluate all conditional steps')).toBe(true);
      expect(testConsole.wasCalled('log', 'may become hidden or visible')).toBe(true);
    });
  });

  describe('action with verbose option', () => {
    it('should display detailed summary with verbose flag', async () => {
      const options: ParsedOptions = {
        _: [],
        verbose: true,
        force: true,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Condition Evaluation Summary')).toBe(true);
      expect(testConsole.wasCalled('log', 'Total steps evaluated')).toBe(true);
      expect(testConsole.wasCalled('log', 'Steps now visible')).toBe(true);
      expect(testConsole.wasCalled('log', 'Steps now hidden')).toBe(true);
    });

    it('should not show detailed summary without verbose flag', async () => {
      const options: ParsedOptions = {
        _: [],
        force: true,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Condition Evaluation Summary')).toBe(false);
    });

    it('should suggest debug command in verbose mode', async () => {
      const options: ParsedOptions = {
        _: [],
        verbose: true,
        force: true,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'bmad debug conditions')).toBe(true);
    });
  });

  describe('action with force option', () => {
    it('should skip confirmation with force flag', async () => {
      const options: ParsedOptions = {
        _: [],
        force: true,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Conditions re-evaluated')).toBe(true);
    });
  });

  describe('integration behavior', () => {
    it('should handle empty options', async () => {
      const options: ParsedOptions = {
        _: [],
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Re-evaluating')).toBe(true);
    });

    it('should handle multiple flags together', async () => {
      const options: ParsedOptions = {
        _: [],
        verbose: true,
        force: true,
      };

      await command.action(options);

      expect(testConsole.wasCalled('log', 'Conditions re-evaluated')).toBe(true);
      expect(testConsole.wasCalled('log', 'Condition Evaluation Summary')).toBe(true);
    });
  });
});

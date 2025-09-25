/**
 * CLI Integration Tests
 * End-to-end tests for the complete CLI functionality
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { spawn } from 'bun';

const CLI_PATH = 'packages/cli/src/index.ts';

describe('CLI Integration Tests', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...Bun.argv];
  });

  afterEach(() => {
    Bun.argv.length = 0;
    Bun.argv.push(...originalArgv);
  });

  describe('Global Flags', () => {
    it('should display version with --version', async () => {
      const proc = spawn(['bun', CLI_PATH, '--version'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output.trim()).toBe('checklist version 0.0.1');
    });

    it('should display version with -v', async () => {
      const proc = spawn(['bun', CLI_PATH, '-v'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output.trim()).toBe('checklist version 0.0.1');
    });

    it('should display help with --help', async () => {
      const proc = spawn(['bun', CLI_PATH, '--help'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Checklist CLI - Manage your checklists and workflows');
      expect(output).toContain('Usage: checklist [command] [options]');
      expect(output).toContain('Commands:');
    });

    it('should display help with -h', async () => {
      const proc = spawn(['bun', CLI_PATH, '-h'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Checklist CLI');
    });
  });

  describe('Command Execution', () => {
    it('should execute init command', async () => {
      const proc = spawn(['bun', CLI_PATH, 'init'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Initializing checklist project');
    });

    it('should execute run command with template', async () => {
      const proc = spawn(['bun', CLI_PATH, 'run', 'test-template'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Running checklist workflow: test-template');
    });

    it('should execute status command', async () => {
      const proc = spawn(['bun', CLI_PATH, 'status'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Checklist Status:');
    });

    it('should execute list command', async () => {
      const proc = spawn(['bun', CLI_PATH, 'list'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Available Templates:');
    });
  });

  describe('Command Aliases', () => {
    it('should execute init command via alias', async () => {
      const proc = spawn(['bun', CLI_PATH, 'i'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Initializing checklist project');
    });

    it('should execute run command via alias', async () => {
      const proc = spawn(['bun', CLI_PATH, 'r', 'test-template'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Running checklist workflow: test-template');
    });

    it('should execute status command via alias', async () => {
      const proc = spawn(['bun', CLI_PATH, 'st'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Checklist Status:');
    });

    it('should execute list command via alias', async () => {
      const proc = spawn(['bun', CLI_PATH, 'ls'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Available Templates:');
    });
  });

  describe('Error Handling', () => {
    it('should handle unknown command with suggestions', async () => {
      const proc = spawn(['bun', CLI_PATH, 'ini'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const errorOutput = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(127); // NOT_FOUND exit code
      expect(errorOutput).toContain('Error: Unknown command: ini');
      expect(errorOutput).toContain('Suggestion: Did you mean: init');
    });

    it('should handle missing required arguments', async () => {
      const proc = spawn(['bun', CLI_PATH, 'run'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const errorOutput = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1); // GENERAL_ERROR exit code
      expect(errorOutput).toContain('Template name is required');
    });

    it('should validate template name security', async () => {
      const proc = spawn(['bun', CLI_PATH, 'run', '../../../etc/passwd'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const errorOutput = await new Response(proc.stderr).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(1);
      expect(errorOutput).toContain('Template name must contain only alphanumeric characters');
    });
  });

  describe('Options and Flags', () => {
    it('should handle verbose flag', async () => {
      const proc = spawn(['bun', CLI_PATH, 'status', '--verbose'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Verbose mode enabled');
    });

    it('should handle config flag', async () => {
      const proc = spawn(['bun', CLI_PATH, 'run', 'test-template', '--config', 'test.yaml'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Using config file: test.yaml');
    });

    it('should handle dry-run flag', async () => {
      const proc = spawn(['bun', CLI_PATH, 'run', 'test-template', '--dry-run'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Dry run mode - no changes will be made');
    });
  });

  describe('Help Command', () => {
    it('should show help for specific command', async () => {
      const proc = spawn(['bun', CLI_PATH, 'help', 'init'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('init - Initialize new checklist project');
      expect(output).toContain('Usage: checklist init [options]');
    });

    it('should show general help when no command specified', async () => {
      const proc = spawn(['bun', CLI_PATH, 'help'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Checklist CLI - Manage your checklists and workflows');
      expect(output).toContain('Commands:');
    });

    it('should suggest commands for unknown help topics', async () => {
      const proc = spawn(['bun', CLI_PATH, 'help', 'unknown'], {
        stdout: 'pipe',
        stderr: 'pipe'
      });

      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;

      expect(exitCode).toBe(0);
      expect(output).toContain('Unknown command: unknown');
    });
  });
});
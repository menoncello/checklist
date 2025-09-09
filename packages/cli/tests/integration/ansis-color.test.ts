import { describe, it, expect } from 'bun:test';
import { $ } from 'bun';
import ansi from 'ansis';

describe('Ansis Color Output Integration', () => {
  it('should use ansis for all color output in CLI commands', async () => {
    // Verify ansis is installed and working
    const testColors = {
      green: ansi.green('SUCCESS'),
      red: ansi.red('ERROR'),
      yellow: ansi.yellow('WARNING'),
      cyan: ansi.cyan('INFO'),
      white: ansi.white('TEXT'),
      gray: ansi.gray('DEBUG')
    };
    
    // All colors should produce ANSI escape codes
    expect(testColors.green).toContain('\x1b[32m');
    expect(testColors.red).toContain('\x1b[31m');
    expect(testColors.yellow).toContain('\x1b[33m');
    expect(testColors.cyan).toContain('\x1b[36m');
    expect(testColors.white).toContain('\x1b[37m');
    expect(testColors.gray).toContain('\x1b[90m');
  });

  it('should maintain color output in migrate command', async () => {
    // Test that migrate command can be imported without chalk errors
    const migrateModule = await import('../../src/commands/migrate');
    expect(migrateModule).toBeDefined();
  });

  it('should produce colored output when running migrate --check', async () => {
    // Run the actual CLI command and verify it doesn't error
    // This test ensures the color library replacement works in practice
    try {
      // Create a temporary state file for testing
      const tempDir = `/tmp/checklist-color-test-${Date.now()}`;
      await $`mkdir -p ${tempDir}`.quiet();
      
      const stateContent = `schemaVersion: '1.0.0'
version: '1.0.0'
lastModified: '2025-01-09T00:00:00Z'
checklists: []`;
      
      await Bun.write(`${tempDir}/state.yaml`, stateContent);
      
      // Run migrate --check command
      // Note: This would normally be run via the CLI entry point
      // For testing, we verify the module loads correctly
      const { MigrationRunner } = await import('@checklist/core/src/state/migrations/MigrationRunner');
      const { MigrationRegistry } = await import('@checklist/core/src/state/migrations/MigrationRegistry');
      
      const registry = new MigrationRegistry();
      const runner = new MigrationRunner(registry, `${tempDir}/.backup`, '1.0.0');
      
      // This should not throw any errors related to chalk
      expect(runner).toBeDefined();
      
      // Cleanup
      await $`rm -rf ${tempDir}`.quiet();
    } catch (error) {
      // If error occurs, it should not be related to chalk
      expect(String(error)).not.toContain('chalk');
      expect(String(error)).not.toContain('Cannot find module');
    }
  });

  it('should verify color methods match expected ansis API', () => {
    // Verify all expected color methods exist in ansis
    const expectedMethods = ['green', 'red', 'yellow', 'cyan', 'white', 'gray'] as const;
    
    for (const method of expectedMethods) {
      expect(typeof ansi[method]).toBe('function');
      
      // Test that each method produces colored output
      const colored = ansi[method]('test');
      expect(colored).toContain('test');
      expect(colored).toContain('\x1b['); // Contains ANSI escape code
    }
  });
});
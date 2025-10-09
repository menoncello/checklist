/**
 * Index export tests
 */

import { describe, it, expect } from 'bun:test';
import { version } from '../src/index';

describe('Index Exports', () => {
  describe('version', () => {
    it('should export a version string', () => {
      expect(version).toBeDefined();
      expect(typeof version).toBe('string');
    });

    it('should have a valid semantic version format', () => {
      // Simple check for semantic version pattern (x.y.z)
      const semanticVersionRegex = /^\d+\.\d+\.\d+(-.*)?$/;
      expect(version).toMatch(semanticVersionRegex);
    });

    it('should match the expected version', () => {
      expect(version).toBe('0.0.1');
    });
  });

  describe('module exports', () => {
    it('should export all clipboard utilities', async () => {
      const clipboardModule = await import('../src/clipboard');

      expect(clipboardModule.writeToClipboard).toBeDefined();
      expect(clipboardModule.readFromClipboard).toBeDefined();
      expect(clipboardModule.isClipboardAvailable).toBeDefined();
      expect(clipboardModule.clearClipboard).toBeDefined();
    });

    it('should export all environment utilities', async () => {
      const environmentModule = await import('../src/environment');

      expect(environmentModule.detectEnvironment).toBeDefined();
      expect(environmentModule.paths).toBeDefined();
      expect(environmentModule.features).toBeDefined();
      expect(environmentModule.fallbacks).toBeDefined();
      expect(environmentModule.commands).toBeDefined();
    });

    it('should export all terminal utilities', async () => {
      const terminalModule = await import('../src/terminal');

      expect(terminalModule.terminal).toBeDefined();
      expect(terminalModule.ansi).toBeDefined();
      expect(terminalModule.stripAnsi).toBeDefined();
      expect(terminalModule.style).toBeDefined();
    });
  });
});
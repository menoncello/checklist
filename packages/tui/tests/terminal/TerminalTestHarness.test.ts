import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TerminalTestHarness } from '../../src/terminal/TerminalTestHarness';
import type { TestTerminal, TestResult } from '../../src/terminal/TerminalTestHarness';

describe('TerminalTestHarness', () => {
  let harness: TerminalTestHarness;

  beforeEach(() => {
    harness = new TerminalTestHarness();
  });

  describe('Terminal Detection', () => {
    it('should detect iTerm2 from environment', async () => {
      const originalTermProgram = process.env.TERM_PROGRAM;
      process.env.TERM_PROGRAM = 'iTerm.app';

      try {
        const result = await harness.testCurrentTerminal();
        expect(result).toBeDefined();
        expect(result.terminal).toBeDefined();
      } finally {
        if (originalTermProgram !== undefined) {
          process.env.TERM_PROGRAM = originalTermProgram;
        } else {
          delete process.env.TERM_PROGRAM;
        }
      }
    });

    it('should detect Alacritty from environment', async () => {
      const originalTermProgram = process.env.TERM_PROGRAM;
      process.env.TERM_PROGRAM = 'Alacritty';

      try {
        const result = await harness.testCurrentTerminal();
        expect(result).toBeDefined();
        expect(result.terminal).toBeDefined();
      } finally {
        if (originalTermProgram !== undefined) {
          process.env.TERM_PROGRAM = originalTermProgram;
        } else {
          delete process.env.TERM_PROGRAM;
        }
      }
    });

    it('should detect Windows Terminal from environment', async () => {
      const originalWTSession = process.env.WT_SESSION;
      process.env.WT_SESSION = 'test-session';

      try {
        const result = await harness.testCurrentTerminal();
        expect(result).toBeDefined();
        expect(result.terminal).toBeDefined();
      } finally {
        if (originalWTSession !== undefined) {
          process.env.WT_SESSION = originalWTSession;
        } else {
          delete process.env.WT_SESSION;
        }
      }
    });

    it('should fallback to generic terminal for unknown terminals', async () => {
      const originalTermProgram = process.env.TERM_PROGRAM;
      const originalTerm = process.env.TERM;
      delete process.env.TERM_PROGRAM;
      process.env.TERM = 'unknown';

      try {
        const result = await harness.testCurrentTerminal();
        expect(result).toBeDefined();
        expect(result.terminal).toBeDefined();
        expect(result.terminal.name).toBeDefined();
      } finally {
        if (originalTermProgram !== undefined) {
          process.env.TERM_PROGRAM = originalTermProgram;
        } else {
          delete process.env.TERM_PROGRAM;
        }
        if (originalTerm !== undefined) {
          process.env.TERM = originalTerm;
        } else {
          delete process.env.TERM;
        }
      }
    });
  });

  describe('Terminal Support List', () => {
    it('should include all major terminal emulators', async () => {
      const report = await harness.testAllTerminals();
      const terminalNames = report.results.map(r => r.terminal.name);

      expect(terminalNames).toContain('macOS Terminal.app');
      expect(terminalNames).toContain('iTerm2');
      expect(terminalNames).toContain('Alacritty');
      expect(terminalNames).toContain('Windows Terminal');
      expect(terminalNames).toContain('Linux Console');
      expect(terminalNames).toContain('xterm');
    });

    it('should have proper capability definitions for each terminal', async () => {
      const report = await harness.testAllTerminals();
      const terminals = report.results.map(r => r.terminal);

      terminals.forEach(terminal => {
        expect(terminal.name).toBeDefined();
        expect(terminal.command).toBeDefined();
        expect(terminal.env).toBeDefined();
        expect(terminal.capabilities).toBeDefined();
        expect(terminal.expectedFeatures).toBeDefined();
        expect(Array.isArray(terminal.expectedFeatures)).toBe(true);
      });
    });

    it('should have realistic capability expectations', async () => {
      const report = await harness.testAllTerminals();
      const terminals = report.results.map(r => r.terminal);

      // iTerm2 should have full capabilities
      const iterm2 = terminals.find(t => t.name === 'iTerm2')!;
      if (iterm2 && iterm2.capabilities && typeof iterm2.capabilities === 'object' && 'color' in iterm2.capabilities) {
        const caps = iterm2.capabilities as any;
        expect(caps.color.trueColor).toBe(true);
        expect(caps.unicode.emoji).toBe(true);
        expect(caps.mouse.advanced).toBe(true);
      }

      // xterm should have basic capabilities
      const xterm = terminals.find(t => t.name === 'xterm')!;
      if (xterm && xterm.capabilities && typeof xterm.capabilities === 'object' && 'color' in xterm.capabilities) {
        const caps = xterm.capabilities as any;
        expect(caps.color.basic).toBe(true);
        expect(caps.color.trueColor).toBe(false);
        expect(caps.mouse.basic).toBe(true); // xterm does have basic mouse support
        expect(caps.mouse.advanced).toBe(false); // but not advanced
      }
    });
  });

  describe('Capability Validation', () => {
    it('should validate color capabilities correctly', async () => {
      const { validateCapabilities } = await import('../../src/terminal/helpers/CapabilityValidation');

      const terminal: TestTerminal = {
        name: 'Test Terminal',
        command: 'test',
        args: [],
        env: {},
        capabilities: {
          color: { basic: true, color256: true, trueColor: true },
          unicode: { basic: true, wide: true, emoji: true },
          mouse: { basic: true, advanced: true },
        },
        expectedFeatures: [],
      };

      const capabilities = {
        color: { basic: true, color256: false, trueColor: false },
        unicode: { basic: true, wide: true, emoji: true },
        mouse: { basic: true, advanced: true },
        size: { width: 100, height: 30, meetsMinimum: true },
        altScreen: false,
        cursorShape: false,
      };

      const errors = validateCapabilities(terminal, capabilities);

      expect(errors).toContain('Expected 256-color support but not detected');
      expect(errors).toContain('Expected true color support but not detected');
      expect(errors).not.toContain('Expected basic color support but not detected');
    });

    it('should handle missing capability definitions gracefully', async () => {
      const { validateCapabilities } = await import('../../src/terminal/helpers/CapabilityValidation');

      const terminal: TestTerminal = {
        name: 'Test Terminal',
        command: 'test',
        args: [],
        env: {},
        capabilities: {},
        expectedFeatures: [],
      };

      const capabilities = {
        color: { basic: false, color256: false, trueColor: false },
        unicode: { basic: false, wide: false, emoji: false },
        mouse: { basic: false, advanced: false },
        size: { width: 80, height: 24, meetsMinimum: false },
        altScreen: false,
        cursorShape: false,
      };

      const errors = validateCapabilities(terminal, capabilities);
      expect(errors).toHaveLength(0);
    });
  });

  describe('Performance Checking', () => {
    it('should generate warnings for slow detection', async () => {
      const { checkPerformance } = await import('../../src/terminal/helpers/TerminalTestHelpers');
      const warnings = checkPerformance(10, 5);
      expect(warnings).toContain('Capability detection took 10ms (should be <5ms)');
      expect(warnings).not.toContain('Fallback rendering took 5ms (should be <10ms)');
    });

    it('should generate warnings for slow rendering', async () => {
      const { checkPerformance } = await import('../../src/terminal/helpers/TerminalTestHelpers');
      const warnings = checkPerformance(2, 15);
      expect(warnings).not.toContain('Capability detection took 2ms (should be <5ms)');
      expect(warnings).toContain('Fallback rendering took 15ms (should be <10ms)');
    });

    it('should not generate warnings for acceptable performance', async () => {
      const { checkPerformance } = await import('../../src/terminal/helpers/TerminalTestHelpers');
      const warnings = checkPerformance(3, 7);
      expect(warnings).toHaveLength(0);
    });
  });

  describe('Report Generation', () => {
    it('should generate proper compatibility report', async () => {
      const report = await harness.testAllTerminals();

      expect(report.timestamp).toBeDefined();
      expect(report.totalTerminals).toBeGreaterThan(0);
      expect(report.passed).toBeGreaterThanOrEqual(0);
      expect(report.failed).toBeGreaterThanOrEqual(0);
      expect(report.results).toBeDefined();
      expect(Array.isArray(report.results)).toBe(true);

      expect(report.summary).toBeDefined();
      expect(report.summary.colorSupport).toBeDefined();
      expect(report.summary.unicodeSupport).toBeDefined();
      expect(report.summary.mouseSupport).toBeDefined();
      expect(typeof report.summary.sizeCompliance).toBe('number');
    });
  });

  describe('Current Terminal Testing', () => {
    it('should run test for current terminal without errors', async () => {
      const result = await harness.runCurrentTerminalTest();

      expect(result).toBeDefined();
      expect(result.terminal).toBeDefined();
      expect(result.duration).toBeGreaterThanOrEqual(0);
      expect(result.capabilities).toBeDefined();
      expect(Array.isArray(result.errors)).toBe(true);
      expect(Array.isArray(result.warnings)).toBe(true);
      expect(typeof result.performance.detectionTime).toBe('number');
    }, 10000); // Allow 10 seconds for this test
  });

  describe('Error Handling', () => {
    it('should handle test failures gracefully', async () => {
      // Test with the current terminal which should work
      const result = await harness.testCurrentTerminal();

      expect(result).toBeDefined();
      expect(typeof result.success).toBe('boolean');
      if (!result.success) {
        expect(result.errors.length).toBeGreaterThan(0);
      }
    });
  });
});
import { describe, test, expect, beforeEach, afterEach} from 'bun:test';
import { TerminalSizeValidator } from '../../src/terminal/TerminalSizeValidator';
import type { SizeValidationResult, SizeValidationConfig } from '../../src/terminal/TerminalSizeValidator';
describe('TerminalSizeValidator', () => {
  let validator: TerminalSizeValidator;
  let originalColumns: number | undefined;
  let originalRows: number | undefined;
  let originalIsTTY: boolean | undefined;

  beforeEach(() => {
    // Store original values
    originalColumns = process.stdout.columns;
    originalRows = process.stdout.rows;
    originalIsTTY = process.stdout.isTTY;

    // Create validator with default settings
    validator = new TerminalSizeValidator();
  });

  afterEach(() => {
    // Restore original values
    if (originalColumns !== undefined) {
      Object.defineProperty(process.stdout, 'columns', {
        value: originalColumns,
        writable: true,
        configurable: true,
      });
    }
    if (originalRows !== undefined) {
      Object.defineProperty(process.stdout, 'rows', {
        value: originalRows,
        writable: true,
        configurable: true,
      });
    }
    if (originalIsTTY !== undefined) {
      Object.defineProperty(process.stdout, 'isTTY', {
        value: originalIsTTY,
        writable: true,
        configurable: true,
      });
    }
  });

  describe('Size Validation', () => {
    test('should validate acceptable terminal size', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 100, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 30, configurable: true });

      const result = validator.validateSize();

      expect(result.isValid).toBe(true);
      expect(result.currentWidth).toBe(100);
      expect(result.currentHeight).toBe(30);
      expect(result.requiredWidth).toBe(80);
      expect(result.requiredHeight).toBe(24);
      expect(result.message).toContain('OK');
    });

    test('should detect undersized terminal width', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 30, configurable: true });

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.currentWidth).toBe(60);
      expect(result.message).toContain('too small');
      expect(result.message).toContain('missing 20 columns');
    });

    test('should detect undersized terminal height', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 100, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.currentHeight).toBe(15);
      expect(result.message).toContain('missing 9 rows');
    });

    test('should detect both width and height issues', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 70, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 20, configurable: true });

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('missing 10 columns and 4 rows');
    });

    test('should handle undefined terminal dimensions', () => {
      Object.defineProperty(process.stdout, 'columns', { value: undefined, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: undefined, configurable: true });

      const result = validator.validateSize();

      // Should fallback to defaults
      expect(result.currentWidth).toBe(80);
      expect(result.currentHeight).toBe(24);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Size Requirements Check', () => {
    test('should return true when terminal meets minimum size', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 24, configurable: true });

      const meetsSize = validator.meetsMinimumSize();
      expect(meetsSize).toBe(true);
    });

    test('should return false when terminal is too narrow', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 79, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 24, configurable: true });

      const meetsSize = validator.meetsMinimumSize();
      expect(meetsSize).toBe(false);
    });

    test('should return false when terminal is too short', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 23, configurable: true });

      const meetsSize = validator.meetsMinimumSize();
      expect(meetsSize).toBe(false);
    });
  });

  describe('Size Adjustment Calculations', () => {
    test('should return needed:false when no adjustment needed', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 100, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 30, configurable: true });

      const adjustment = validator.getSizeAdjustmentNeeded();
      expect(adjustment.needed).toBe(false);
    });

    test('should calculate width adjustment needed', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 70, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 30, configurable: true });

      const adjustment = validator.getSizeAdjustmentNeeded();

      expect(adjustment.needed).toBe(true);
      expect(adjustment.widthAdjustment).toBe(10);
      expect(adjustment.heightAdjustment).toBe(0);
      expect(adjustment.suggestions.length).toBeGreaterThan(0);
    });

    test('should calculate height adjustment needed', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 100, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 20, configurable: true });

      const adjustment = validator.getSizeAdjustmentNeeded();

      expect(adjustment.needed).toBe(true);
      expect(adjustment.widthAdjustment).toBe(0);
      expect(adjustment.heightAdjustment).toBe(4);
      expect(adjustment.suggestions.length).toBeGreaterThan(0);
    });

    test('should calculate both width and height adjustment', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const adjustment = validator.getSizeAdjustmentNeeded();

      expect(adjustment.needed).toBe(true);
      expect(adjustment.widthAdjustment).toBe(20);
      expect(adjustment.heightAdjustment).toBe(9);
      expect(adjustment.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Message Generation', () => {
    test('should generate empty message for valid size', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 100, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 30, configurable: true });

      const message = validator.generateErrorMessage();
      expect(message).toBe('');
    });

    test('should generate detailed error message for undersized terminal', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const message = validator.generateErrorMessage();

      expect(message).toContain('Terminal size too small');
      expect(message).toContain('60x15');
      expect(message).toContain('80x24');
      expect(message).toContain('Suggestions');
    });

    test('should include suggestions when enabled', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 70, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 20, configurable: true });

      const validatorWithSuggestions = new TerminalSizeValidator({
        enableSuggestions: true,
        minWidth: 80,
        minHeight: 24,
      });

      const message = validatorWithSuggestions.generateErrorMessage();
      expect(message).toContain('Suggestions');
    });

    test('should not include suggestions when disabled', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 70, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 20, configurable: true });

      const validatorWithoutSuggestions = new TerminalSizeValidator({
        enableSuggestions: false,
        minWidth: 80,
        minHeight: 24,
      });

      const message = validatorWithoutSuggestions.generateErrorMessage();
      expect(message).toContain('Terminal size too small');
      expect(message).not.toContain('Suggestions');
    });
  });

  describe('Platform-Specific Suggestions', () => {
    let originalPlatform: string;

    beforeEach(() => {
      originalPlatform = process.platform;
    });

    afterEach(() => {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    });

    test('should provide macOS-specific suggestions', () => {
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('macOS'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('⌘'))).toBe(true);
    });

    test('should provide Linux-specific suggestions', () => {
      Object.defineProperty(process, 'platform', { value: 'linux', configurable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('Linux'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('tmux'))).toBe(true);
    });

    test('should provide Windows-specific suggestions', () => {
      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('Windows'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('Properties'))).toBe(true);
    });
  });

  describe('Terminal Program Detection', () => {
    let originalTerm: string | undefined;
    let originalTermProgram: string | undefined;

    beforeEach(() => {
      originalTerm = Bun.env.TERM;
      originalTermProgram = Bun.env.TERM_PROGRAM;
    });

    afterEach(() => {
      if (originalTerm !== undefined) {
        Bun.env.TERM = originalTerm;
      } else {
        delete Bun.env.TERM;
      }
      if (originalTermProgram !== undefined) {
        Bun.env.TERM_PROGRAM = originalTermProgram;
      } else {
        delete Bun.env.TERM_PROGRAM;
      }
    });

    test('should provide iTerm2-specific suggestions', () => {
      Bun.env.TERM_PROGRAM = 'iTerm.app';
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('iTerm2'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('⌘+Enter'))).toBe(true);
    });

    test('should provide Alacritty-specific suggestions', () => {
      Bun.env.TERM_PROGRAM = 'Alacritty';
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('Alacritty'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('config file'))).toBe(true);
    });

    test('should provide generic terminal suggestions', () => {
      Bun.env.TERM = 'xterm';
      delete Bun.env.TERM_PROGRAM;
      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('modern terminal'))).toBe(true);
    });
  });

  describe('Configuration', () => {
    test('should allow custom minimum size', () => {
      const customValidator = new TerminalSizeValidator({
        minWidth: 100,
        minHeight: 30,
      });

      Object.defineProperty(process.stdout, 'columns', { value: 90, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 25, configurable: true });

      const result = customValidator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.requiredWidth).toBe(100);
      expect(result.requiredHeight).toBe(30);
    });

    test('should update configuration dynamically', () => {
      validator.updateConfig({ minWidth: 120, minHeight: 40 });

      const config = validator.getConfig();
      expect(config.minWidth).toBe(120);
      expect(config.minHeight).toBe(40);
    });

    test('should enable/disable suggestions', () => {
      const noSuggestionsValidator = new TerminalSizeValidator({
        enableSuggestions: false,
      });

      Object.defineProperty(process.stdout, 'columns', { value: 60, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 15, configurable: true });

      const result = noSuggestionsValidator.validateSize();
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('Interactive Terminal Detection', () => {
    test('should detect interactive terminal', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: true, configurable: true });

      const isInteractive = validator.isInteractive();
      expect(isInteractive).toBe(true);
    });

    test('should detect non-interactive terminal', () => {
      Object.defineProperty(process.stdout, 'isTTY', { value: false, configurable: true });

      const isInteractive = validator.isInteractive();
      expect(isInteractive).toBe(false);
    });
  });

  describe('Resize Attempts', () => {
    test('should return false when auto-resize is disabled', async () => {
      const noAutoResizeValidator = new TerminalSizeValidator({
        enableAutoResize: false,
      });

      const result = await noAutoResizeValidator.attemptResize();
      expect(result.success).toBe(false);
    });

    test('should handle resize attempts gracefully', async () => {
      // This test mainly ensures the method doesn't throw errors
      const result = await validator.attemptResize();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Current Size Information', () => {
    test('should return current terminal size', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 100, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 30, configurable: true });

      const size = validator.getCurrentSize();

      expect(size.width).toBe(100);
      expect(size.height).toBe(30);
    });

    test('should handle undefined dimensions gracefully', () => {
      Object.defineProperty(process.stdout, 'columns', { value: undefined, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: undefined, configurable: true });

      const size = validator.getCurrentSize();

      expect(size.width).toBe(80);
      expect(size.height).toBe(24);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very small terminals', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 1, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 1, configurable: true });

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should handle very large terminals', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 500, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 200, configurable: true });

      const result = validator.validateSize();

      expect(result.isValid).toBe(true);
    });

    test('should handle exactly minimum size', () => {
      Object.defineProperty(process.stdout, 'columns', { value: 80, configurable: true });
      Object.defineProperty(process.stdout, 'rows', { value: 24, configurable: true });

      const result = validator.validateSize();

      expect(result.isValid).toBe(true);
    });
  });
});
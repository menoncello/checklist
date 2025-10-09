import { describe, test, expect, beforeEach, afterEach} from 'bun:test';
import { TerminalSizeValidator } from '../../src/terminal/TerminalSizeValidator';
import type { SizeValidationResult, SizeValidationConfig } from '../../src/terminal/TerminalSizeValidator';

// Helper function to safely set process.stdout properties
function setStdoutProperty(prop: 'columns' | 'rows' | 'isTTY', value: any): void {
  try {
    Object.defineProperty(process.stdout, prop, {
      value,
      writable: true,
      configurable: true,
    });
  } catch {
    // If property is not configurable, try to set it as writable only
    try {
      Object.defineProperty(process.stdout, prop, {
        value,
        writable: true,
      });
    } catch {
      // Silently ignore if we can't modify the property
    }
  }
}

// Helper function to safely set process.platform
function setPlatform(value: string): void {
  try {
    Object.defineProperty(process, 'platform', {
      value,
      writable: true,
      configurable: true,
    });
  } catch {
    // Silently ignore if we can't modify the property
  }
}

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
    // Note: process.stdout properties are not configurable in Bun test environment
    // Tests are isolated so restoration is not necessary
  });

  describe('Size Validation', () => {
    test('should validate acceptable terminal size', () => {
      setStdoutProperty('columns', 100);
      setStdoutProperty('rows', 30);

      const result = validator.validateSize();

      expect(result.isValid).toBe(true);
      expect(result.currentWidth).toBe(100);
      expect(result.currentHeight).toBe(30);
      expect(result.requiredWidth).toBe(80);
      expect(result.requiredHeight).toBe(24);
      expect(result.message).toContain('OK');
    });

    test('should detect undersized terminal width', () => {
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 30);

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.currentWidth).toBe(60);
      expect(result.message).toContain('too small');
      expect(result.message).toContain('missing 20 columns');
    });

    test('should detect undersized terminal height', () => {
      setStdoutProperty('columns', 100);
      setStdoutProperty('rows', 15);

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.currentHeight).toBe(15);
      expect(result.message).toContain('missing 9 rows');
    });

    test('should detect both width and height issues', () => {
      setStdoutProperty('columns', 70);
      setStdoutProperty('rows', 20);

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.message).toContain('missing 10 columns and 4 rows');
    });

    test('should handle undefined terminal dimensions', () => {
      setStdoutProperty('columns', undefined);
      setStdoutProperty('rows', undefined);

      const result = validator.validateSize();

      // Should fallback to defaults
      expect(result.currentWidth).toBe(80);
      expect(result.currentHeight).toBe(24);
      expect(result.isValid).toBe(true);
    });
  });

  describe('Size Requirements Check', () => {
    test('should return true when terminal meets minimum size', () => {
      setStdoutProperty('columns', 80);
      setStdoutProperty('rows', 24);

      const meetsSize = validator.meetsMinimumSize();
      expect(meetsSize).toBe(true);
    });

    test('should return false when terminal is too narrow', () => {
      setStdoutProperty('columns', 79);
      setStdoutProperty('rows', 24);

      const meetsSize = validator.meetsMinimumSize();
      expect(meetsSize).toBe(false);
    });

    test('should return false when terminal is too short', () => {
      setStdoutProperty('columns', 80);
      setStdoutProperty('rows', 23);

      const meetsSize = validator.meetsMinimumSize();
      expect(meetsSize).toBe(false);
    });
  });

  describe('Size Adjustment Calculations', () => {
    test('should return needed:false when no adjustment needed', () => {
      setStdoutProperty('columns', 100);
      setStdoutProperty('rows', 30);

      const adjustment = validator.getSizeAdjustmentNeeded();
      expect(adjustment.needed).toBe(false);
    });

    test('should calculate width adjustment needed', () => {
      setStdoutProperty('columns', 70);
      setStdoutProperty('rows', 30);

      const adjustment = validator.getSizeAdjustmentNeeded();

      expect(adjustment.needed).toBe(true);
      expect(adjustment.widthAdjustment).toBe(10);
      expect(adjustment.heightAdjustment).toBe(0);
      expect(adjustment.suggestions.length).toBeGreaterThan(0);
    });

    test('should calculate height adjustment needed', () => {
      setStdoutProperty('columns', 100);
      setStdoutProperty('rows', 20);

      const adjustment = validator.getSizeAdjustmentNeeded();

      expect(adjustment.needed).toBe(true);
      expect(adjustment.widthAdjustment).toBe(0);
      expect(adjustment.heightAdjustment).toBe(4);
      expect(adjustment.suggestions.length).toBeGreaterThan(0);
    });

    test('should calculate both width and height adjustment', () => {
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

      const adjustment = validator.getSizeAdjustmentNeeded();

      expect(adjustment.needed).toBe(true);
      expect(adjustment.widthAdjustment).toBe(20);
      expect(adjustment.heightAdjustment).toBe(9);
      expect(adjustment.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Error Message Generation', () => {
    test('should generate empty message for valid size', () => {
      setStdoutProperty('columns', 100);
      setStdoutProperty('rows', 30);

      const message = validator.generateErrorMessage();
      expect(message).toBe('');
    });

    test('should generate detailed error message for undersized terminal', () => {
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

      const message = validator.generateErrorMessage();

      expect(message).toContain('Terminal size too small');
      expect(message).toContain('60x15');
      expect(message).toContain('80x24');
      expect(message).toContain('Suggestions');
    });

    test('should include suggestions when enabled', () => {
      setStdoutProperty('columns', 70);
      setStdoutProperty('rows', 20);

      const validatorWithSuggestions = new TerminalSizeValidator({
        enableSuggestions: true,
        minWidth: 80,
        minHeight: 24,
      });

      const message = validatorWithSuggestions.generateErrorMessage();
      expect(message).toContain('Suggestions');
    });

    test('should not include suggestions when disabled', () => {
      setStdoutProperty('columns', 70);
      setStdoutProperty('rows', 20);

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
      // Note: process.platform is not configurable in Bun test environment
      // Tests are isolated so restoration is not necessary
    });

    test('should provide macOS-specific suggestions', () => {
      setPlatform('darwin');
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('macOS'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('⌘'))).toBe(true);
    });

    test('should provide Linux-specific suggestions', () => {
      setPlatform('linux');
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('Linux'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('tmux'))).toBe(true);
    });

    test('should provide Windows-specific suggestions', () => {
      setPlatform('win32');
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

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
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('iTerm2'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('⌘+Enter'))).toBe(true);
    });

    test('should provide Alacritty-specific suggestions', () => {
      Bun.env.TERM_PROGRAM = 'Alacritty';
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

      const result = validator.validateSize();

      expect(result.suggestions.some(s => s.includes('Alacritty'))).toBe(true);
      expect(result.suggestions.some(s => s.includes('config file'))).toBe(true);
    });

    test('should provide generic terminal suggestions', () => {
      Bun.env.TERM = 'xterm';
      delete Bun.env.TERM_PROGRAM;
      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

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

      setStdoutProperty('columns', 90);
      setStdoutProperty('rows', 25);

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

      setStdoutProperty('columns', 60);
      setStdoutProperty('rows', 15);

      const result = noSuggestionsValidator.validateSize();
      expect(result.suggestions).toHaveLength(0);
    });
  });

  describe('Interactive Terminal Detection', () => {
    test('should detect interactive terminal', () => {
      setStdoutProperty('isTTY', true);

      const isInteractive = validator.isInteractive();
      expect(isInteractive).toBe(true);
    });

    test('should detect non-interactive terminal', () => {
      setStdoutProperty('isTTY', false);

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
      setStdoutProperty('columns', 100);
      setStdoutProperty('rows', 30);

      const size = validator.getCurrentSize();

      expect(size.width).toBe(100);
      expect(size.height).toBe(30);
    });

    test('should handle undefined dimensions gracefully', () => {
      setStdoutProperty('columns', undefined);
      setStdoutProperty('rows', undefined);

      const size = validator.getCurrentSize();

      expect(size.width).toBe(80);
      expect(size.height).toBe(24);
    });
  });

  describe('Edge Cases', () => {
    test('should handle very small terminals', () => {
      setStdoutProperty('columns', 1);
      setStdoutProperty('rows', 1);

      const result = validator.validateSize();

      expect(result.isValid).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });

    test('should handle very large terminals', () => {
      setStdoutProperty('columns', 500);
      setStdoutProperty('rows', 200);

      const result = validator.validateSize();

      expect(result.isValid).toBe(true);
    });

    test('should handle exactly minimum size', () => {
      setStdoutProperty('columns', 80);
      setStdoutProperty('rows', 24);

      const result = validator.validateSize();

      expect(result.isValid).toBe(true);
    });
  });
});
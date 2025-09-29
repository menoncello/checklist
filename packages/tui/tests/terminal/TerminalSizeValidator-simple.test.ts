import { describe, it, expect, beforeEach } from 'bun:test';
import { TerminalSizeValidator } from '../../src/terminal/TerminalSizeValidator';
import type { SizeValidationResult, SizeValidationConfig } from '../../src/terminal/TerminalSizeValidator';

describe('TerminalSizeValidator (Simple Tests)', () => {
  let validator: TerminalSizeValidator;

  beforeEach(() => {
    // Create validator with custom settings to avoid TTY dependency
    validator = new TerminalSizeValidator({
      minWidth: 80,
      minHeight: 24,
      enableSuggestions: true,
      enableAutoResize: false,
      checkOnStartup: false, // Disable startup check to avoid TTY issues
    });
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const defaultValidator = new TerminalSizeValidator();
      const config = defaultValidator.getConfig();

      expect(config.minWidth).toBe(80);
      expect(config.minHeight).toBe(24);
      expect(config.enableSuggestions).toBe(true);
      expect(config.enableAutoResize).toBe(false);
    });

    it('should allow custom configuration', () => {
      const customValidator = new TerminalSizeValidator({
        minWidth: 100,
        minHeight: 30,
        enableSuggestions: false,
      });

      const config = customValidator.getConfig();
      expect(config.minWidth).toBe(100);
      expect(config.minHeight).toBe(30);
      expect(config.enableSuggestions).toBe(false);
    });

    it('should update configuration dynamically', () => {
      validator.updateConfig({
        minWidth: 120,
        minHeight: 40,
        enableSuggestions: false,
      });

      const config = validator.getConfig();
      expect(config.minWidth).toBe(120);
      expect(config.minHeight).toBe(40);
      expect(config.enableSuggestions).toBe(false);
    });
  });

  describe('Current Size Information', () => {
    it('should return current terminal size', () => {
      const size = validator.getCurrentSize();

      expect(typeof size.width).toBe('number');
      expect(typeof size.height).toBe('number');
      expect(size.width).toBeGreaterThan(0);
      expect(size.height).toBeGreaterThan(0);
    });

    it('should detect interactive terminal', () => {
      const isInteractive = validator.isInteractive();
      expect(typeof isInteractive).toBe('boolean');
    });
  });

  describe('Resize Attempts', () => {
    it('should return false for resize attempts by default', async () => {
      const result = await validator.attemptResize();
      expect(result.success).toBe(false);
    });

    it('should handle resize attempts gracefully', async () => {
      // Test with auto-resize enabled
      const autoResizeValidator = new TerminalSizeValidator({
        enableAutoResize: true,
        checkOnStartup: false,
      });

      const result = await autoResizeValidator.attemptResize();
      expect(typeof result.success).toBe('boolean');
    });
  });

  describe('Message Generation', () => {
    it('should generate empty message when terminal size is acceptable', () => {
      // Create a validator with very small requirements that current terminal will meet
      const smallValidator = new TerminalSizeValidator({
        minWidth: 1,
        minHeight: 1,
        checkOnStartup: false,
      });

      const message = smallValidator.generateErrorMessage();
      expect(message).toBe('');
    });

    it('should generate error message for undersized terminal', () => {
      // Create a validator with very large requirements
      const largeValidator = new TerminalSizeValidator({
        minWidth: 1000,
        minHeight: 1000,
        enableSuggestions: true,
        checkOnStartup: false,
      });

      const message = largeValidator.generateErrorMessage();
      expect(message.length).toBeGreaterThan(0);
      expect(message).toContain('Terminal size too small');
    });

    it('should include suggestions when enabled', () => {
      const largeValidator = new TerminalSizeValidator({
        minWidth: 1000,
        minHeight: 1000,
        enableSuggestions: true,
        checkOnStartup: false,
      });

      const message = largeValidator.generateErrorMessage();
      expect(message).toContain('Suggestions');
    });

    it('should not include suggestions when disabled', () => {
      const largeValidator = new TerminalSizeValidator({
        minWidth: 1000,
        minHeight: 1000,
        enableSuggestions: false,
        checkOnStartup: false,
      });

      const message = largeValidator.generateErrorMessage();
      expect(message).toContain('Terminal size too small');
      expect(message).not.toContain('Suggestions');
    });
  });

  describe('Size Requirements Check', () => {
    it('should validate size with different requirements', () => {
      // Test with very small requirements (should pass)
      const smallValidator = new TerminalSizeValidator({
        minWidth: 1,
        minHeight: 1,
        checkOnStartup: false,
      });

      const result = smallValidator.validateSize();
      expect(result.isValid).toBe(true);

      // Test with very large requirements (should fail)
      const largeValidator = new TerminalSizeValidator({
        minWidth: 1000,
        minHeight: 1000,
        checkOnStartup: false,
      });

      const largeResult = largeValidator.validateSize();
      expect(largeResult.isValid).toBe(false);
    });

    it('should provide size adjustment information when needed', () => {
      const largeValidator = new TerminalSizeValidator({
        minWidth: 1000,
        minHeight: 1000,
        checkOnStartup: false,
      });

      const adjustment = largeValidator.getSizeAdjustmentNeeded();
      expect(adjustment.needed).toBe(true);
      expect(adjustment.widthAdjustment).toBeGreaterThan(0);
      expect(adjustment.heightAdjustment).toBeGreaterThan(0);
      expect(adjustment.suggestions.length).toBeGreaterThan(0);
    });

    it('should return needed:false for size adjustment when not needed', () => {
      const smallValidator = new TerminalSizeValidator({
        minWidth: 1,
        minHeight: 1,
        checkOnStartup: false,
      });

      const adjustment = smallValidator.getSizeAdjustmentNeeded();
      expect(adjustment.needed).toBe(false);
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero minimum size', () => {
      const zeroValidator = new TerminalSizeValidator({
        minWidth: 0,
        minHeight: 0,
        checkOnStartup: false,
      });

      const result = zeroValidator.validateSize();
      expect(result.isValid).toBe(true);
      expect(result.suggestions.length).toBe(0);
    });

    it('should handle negative minimum size', () => {
      const negativeValidator = new TerminalSizeValidator({
        minWidth: -1,
        minHeight: -1,
        checkOnStartup: false,
      });

      const result = negativeValidator.validateSize();
      expect(result.isValid).toBe(true);
    });

    it('should handle extremely large minimum size', () => {
      const extremeValidator = new TerminalSizeValidator({
        minWidth: 10000,
        minHeight: 10000,
        checkOnStartup: false,
      });

      const result = extremeValidator.validateSize();
      expect(result.isValid).toBe(false);
      expect(result.suggestions.length).toBeGreaterThan(0);
    });
  });

  describe('Suggestions Generation', () => {
    it('should generate platform-specific suggestions', () => {
      const originalPlatform = process.platform;

      try {
        // Test macOS suggestions
        Object.defineProperty(process, 'platform', { value: 'darwin' });
        const macValidator = new TerminalSizeValidator({
          minWidth: 1000,
          minHeight: 1000,
          checkOnStartup: false,
        });

        const macResult = macValidator.validateSize();
        expect(macResult.suggestions.some(s => s.includes('macOS') || s.includes('drag'))).toBe(true);

        // Test Linux suggestions
        Object.defineProperty(process, 'platform', { value: 'linux' });
        const linuxValidator = new TerminalSizeValidator({
          minWidth: 1000,
          minHeight: 1000,
          checkOnStartup: false,
        });

        const linuxResult = linuxValidator.validateSize();
        expect(linuxResult.suggestions.some(s => s.includes('Linux') || s.includes('tmux'))).toBe(true);

        // Test Windows suggestions
        Object.defineProperty(process, 'platform', { value: 'win32' });
        const windowsValidator = new TerminalSizeValidator({
          minWidth: 1000,
          minHeight: 1000,
          checkOnStartup: false,
        });

        const windowsResult = windowsValidator.validateSize();
        expect(windowsResult.suggestions.some(s => s.includes('Windows') || s.includes('Properties'))).toBe(true);
      } finally {
        Object.defineProperty(process, 'platform', { value: originalPlatform });
      }
    });

    it('should generate terminal-specific suggestions', () => {
      const originalTerm = Bun.env.TERM;
      const originalTermProgram = Bun.env.TERM_PROGRAM;

      try {
        // Test iTerm2 suggestions
        Bun.env.TERM_PROGRAM = 'iTerm.app';
        const itermValidator = new TerminalSizeValidator({
          minWidth: 1000,
          minHeight: 1000,
          checkOnStartup: false,
        });

        const itermResult = itermValidator.validateSize();
        expect(itermResult.suggestions.some(s => s.includes('iTerm'))).toBe(true);

        // Test Alacritty suggestions
        Bun.env.TERM_PROGRAM = 'Alacritty';
        const alacrittyValidator = new TerminalSizeValidator({
          minWidth: 1000,
          minHeight: 1000,
          checkOnStartup: false,
        });

        const alacrittyResult = alacrittyValidator.validateSize();
        expect(alacrittyResult.suggestions.some(s => s.includes('Alacritty'))).toBe(true);

        // Test generic terminal suggestions
        delete Bun.env.TERM_PROGRAM;
        Bun.env.TERM = 'xterm';
        const genericValidator = new TerminalSizeValidator({
          minWidth: 1000,
          minHeight: 1000,
          checkOnStartup: false,
        });

        const genericResult = genericValidator.validateSize();
        expect(genericResult.suggestions.some(s => s.includes('modern terminal'))).toBe(true);
      } finally {
        // Restore environment
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
      }
    });
  });

  describe('Validation Results Structure', () => {
    it('should return properly structured validation results', () => {
      const largeValidator = new TerminalSizeValidator({
        minWidth: 1000,
        minHeight: 1000,
        checkOnStartup: false,
      });

      const result = largeValidator.validateSize();

      expect(result).toHaveProperty('isValid');
      expect(result).toHaveProperty('currentWidth');
      expect(result).toHaveProperty('currentHeight');
      expect(result).toHaveProperty('requiredWidth');
      expect(result).toHaveProperty('requiredHeight');
      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('suggestions');
      expect(result).toHaveProperty('canResize');

      expect(typeof result.isValid).toBe('boolean');
      expect(typeof result.currentWidth).toBe('number');
      expect(typeof result.currentHeight).toBe('number');
      expect(typeof result.requiredWidth).toBe('number');
      expect(typeof result.requiredHeight).toBe('number');
      expect(typeof result.message).toBe('string');
      expect(Array.isArray(result.suggestions)).toBe(true);
      expect(typeof result.canResize).toBe('boolean');
    });

    it('should include accurate dimensions in validation results', () => {
      const validator = new TerminalSizeValidator({
        minWidth: 80,
        minHeight: 24,
        checkOnStartup: false,
      });

      const result = validator.validateSize();

      expect(result.requiredWidth).toBe(80);
      expect(result.requiredHeight).toBe(24);
      expect(result.currentWidth).toBeGreaterThan(0);
      expect(result.currentHeight).toBeGreaterThan(0);
    });
  });
});
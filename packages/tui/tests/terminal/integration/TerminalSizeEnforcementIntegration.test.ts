import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { TerminalSizeValidator } from '../../../src/terminal/TerminalSizeValidator';
import { FallbackRenderer } from '../../../src/terminal/FallbackRenderer';
import type { TerminalSize } from '../../../src/terminal/types';

describe('Terminal Size Enforcement Integration', () => {
  let validator: TerminalSizeValidator;
  let renderer: FallbackRenderer;
  let originalStdout: any;
  let mockStdout: any;

  beforeEach(() => {
    validator = new TerminalSizeValidator();
    renderer = new FallbackRenderer();

    // Mock stdout to capture output
    originalStdout = process.stdout;
    mockStdout = {
      write: () => true,
      columns: 80,
      rows: 24,
      isTTY: true,
    };
    Object.defineProperty(process, 'stdout', {
      value: mockStdout,
      configurable: true,
    });
  });

  afterEach(() => {
    Object.defineProperty(process, 'stdout', {
      value: originalStdout,
      configurable: true,
    });
  });

  describe('UI Blocking Mechanism', () => {
    it('should prevent UI rendering when terminal is undersized', () => {
      // Set terminal to undersized dimensions
      mockStdout.columns = 60;
      mockStdout.rows = 20;

      // Validate size
      const validation = validator.validateSize({
        width: mockStdout.columns,
        height: mockStdout.rows
      });

      expect(validation.isValid).toBe(false);
      expect(validation.errors).toContain('Terminal width too small');
      expect(validation.errors).toContain('Terminal height too small');
    });

    it('should display error screen instead of main UI when undersized', () => {
      // Set terminal to undersized dimensions
      mockStdout.columns = 70;
      mockStdout.rows = 18;

      const capturedOutput: string[] = [];
      mockStdout.write = (data: string) => {
        capturedOutput.push(data);
        return true;
      };

      // Generate error message
      const errorMsg = validator.getErrorMessage({
        width: mockStdout.columns,
        height: mockStdout.rows
      });

      mockStdout.write(errorMsg);

      expect(capturedOutput.join('')).toContain('Terminal too small');
      expect(capturedOutput.join('')).toContain('80x24');
    });

    it('should block complex layouts when terminal width insufficient', () => {
      // Terminal with sufficient height but insufficient width
      mockStdout.columns = 75;
      mockStdout.rows = 30;

      const validation = validator.validateForLayout({
        type: 'split-pane',
        minWidth: 80,
        currentSize: { width: mockStdout.columns, height: mockStdout.rows }
      });

      expect(validation.canRender).toBe(false);
      expect(validation.reason).toContain('width');
    });

    it('should block scrollable lists when terminal height insufficient', () => {
      // Terminal with sufficient width but insufficient height
      mockStdout.columns = 100;
      mockStdout.rows = 10;

      const validation = validator.validateForList({
        minVisibleItems: 20,
        currentSize: { width: mockStdout.columns, height: mockStdout.rows }
      });

      expect(validation.canRender).toBe(false);
      expect(validation.reason).toContain('height');
    });

    it('should transition from blocked to active when terminal resized', () => {
      // Start with undersized terminal
      let currentSize = { width: 60, height: 20 };

      let validation = validator.validateSize(currentSize);
      expect(validation.isValid).toBe(false);

      // Simulate terminal resize
      currentSize = { width: 80, height: 24 };

      validation = validator.validateSize(currentSize);
      expect(validation.isValid).toBe(true);
    });

    it('should show platform-specific resize instructions when blocked', () => {
      mockStdout.columns = 50;
      mockStdout.rows = 15;

      const capturedOutput: string[] = [];
      mockStdout.write = (data: string) => {
        capturedOutput.push(data);
        return true;
      };

      const errorMsg = validator.getErrorMessage({
        width: mockStdout.columns,
        height: mockStdout.rows
      });

      const suggestions = validator.getResizeSuggestions(process.platform);

      mockStdout.write(errorMsg);
      suggestions.forEach(suggestion => mockStdout.write(suggestion));

      const output = capturedOutput.join('');

      // Should include platform-specific instructions
      if (process.platform === 'darwin') {
        expect(output).toContain('Cmd+');
      } else if (process.platform === 'win32') {
        expect(output).toContain('Properties');
      } else {
        expect(output).toContain('Ctrl+');
      }
    });

    it('should prevent navigation commands when terminal undersized', () => {
      const currentSize = { width: 60, height: 20 };

      const validation = validator.validateSize(currentSize);

      // Mock navigation operations that should be blocked
      const navigationAllowed = validation.isValid;

      expect(navigationAllowed).toBe(false);
    });

    it('should provide clear feedback loop for size requirements', () => {
      const sizes: TerminalSize[] = [
        { width: 50, height: 20 },
        { width: 80, height: 20 },
        { width: 50, height: 24 },
        { width: 80, height: 24 },
      ];

      const results = sizes.map(size => {
        const validation = validator.validateSize(size);
        return {
          size,
          valid: validation.isValid,
          errors: validation.errors || []
        };
      });

      // Only the last size (80x24) should be valid
      expect(results[0].valid).toBe(false);
      expect(results[0].errors).toContain('Terminal width too small');
      expect(results[0].errors).toContain('Terminal height too small');

      expect(results[1].valid).toBe(false);
      expect(results[1].errors).toContain('Terminal height too small');

      expect(results[2].valid).toBe(false);
      expect(results[2].errors).toContain('Terminal width too small');

      expect(results[3].valid).toBe(true);
      expect(results[3].errors).toHaveLength(0);
    });
  });

  describe('Integration with Error Recovery', () => {
    it('should maintain size enforcement after error recovery', () => {
      // Start with valid size
      let currentSize = { width: 80, height: 24 };
      let validation = validator.validateSize(currentSize);
      expect(validation.isValid).toBe(true);

      // After error recovery, resize to undersized
      currentSize = { width: 60, height: 20 };
      validation = validator.validateSize(currentSize);

      // Should still enforce size requirements
      expect(validation.isValid).toBe(false);
    });
  });

  describe('Fallback Rendering Integration', () => {
    it('should use fallback renderer when size constraints met but capabilities limited', () => {
      // Valid size
      const size = { width: 80, height: 24 };
      const validation = validator.validateSize(size);
      expect(validation.isValid).toBe(true);

      // But terminal has limited capabilities - use fallback
      const content = '╔══════╗\n║ Test ║\n╚══════╝';
      // Create renderer with ASCII-only options
      const asciiRenderer = new FallbackRenderer({
        useAsciiOnly: true,
        stripColors: true,
        simplifyBoxDrawing: true,
        preserveLayout: true,
        maxWidth: size.width,
        maxHeight: size.height
      });
      const fallback = asciiRenderer.render(content, { unicode: false });

      // Verify box drawing is simplified to ASCII
      expect(fallback).toContain('++++++++');
      expect(fallback).toContain('+ Test +');
      expect(fallback).toContain('++++++++');
    });
  });
});
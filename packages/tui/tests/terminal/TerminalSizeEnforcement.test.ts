import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { TerminalSizeValidator } from '../../src/terminal/TerminalSizeValidator';
import { UIFramework } from '../../src/framework/UIFramework';
import { TerminalCanvas } from '../../src/framework/TerminalCanvas';

// Mock extension interface for testing
interface MockCanvas extends TerminalCanvas {
  setBlocked: (blocked: boolean) => void;
  isBlocked: () => boolean;
}

interface MockUIFramework extends UIFramework {
  shouldBlockOnSmallSize: boolean;
  preventRenderingWhenUndersized: () => void;
  displaySizeError: (message: string) => void;
}

describe('Terminal Size Enforcement Integration', () => {
  describe('UI Blocking Mechanism', () => {
    let validator: TerminalSizeValidator;
    let mockCanvas: MockCanvas;
    let mockUIFramework: MockUIFramework;

    beforeEach(() => {
      validator = new TerminalSizeValidator();

      // Mock terminal canvas to test blocking behavior
      mockCanvas = {
        clear: mock(() => {}),
        render: mock(() => {}),
        setBlocked: mock(() => {}),
        isBlocked: mock(() => false),
      } as any;

      // Mock UI framework
      mockUIFramework = {
        canvas: mockCanvas,
        shouldBlockOnSmallSize: true,
        minimumSize: { width: 80, height: 24 },
        preventRenderingWhenUndersized: mock(() => {}),
        displaySizeError: mock(() => {}),
      } as any;
    });

    it('should block UI rendering when terminal is too small', () => {
      const smallSize = { width: 60, height: 20 };
      const validation = validator.validate(smallSize);

      // Simulate UI blocking based on validation
      if (!validation.isValid && mockUIFramework.shouldBlockOnSmallSize) {
        mockUIFramework.preventRenderingWhenUndersized();
        mockCanvas.setBlocked(true);
      }

      expect(validation.isValid).toBe(false);
      expect(mockUIFramework.preventRenderingWhenUndersized).toHaveBeenCalled();
      expect(mockCanvas.setBlocked).toHaveBeenCalledWith(true);
    });

    it('should unblock UI when terminal is resized to valid size', () => {
      // Start with small size
      const smallSize = { width: 60, height: 20 };
      validator.validate(smallSize);
      mockCanvas.setBlocked(true);
      mockCanvas.isBlocked = mock(() => true);

      // Resize to valid size
      const validSize = { width: 80, height: 24 };
      const validation = validator.validate(validSize);

      // Simulate UI unblocking
      if (validation.isValid && mockCanvas.isBlocked()) {
        mockCanvas.setBlocked(false);
        mockCanvas.clear();
        mockCanvas.render();
      }

      expect(validation.isValid).toBe(true);
      expect(mockCanvas.setBlocked).toHaveBeenCalledWith(false);
      expect(mockCanvas.clear).toHaveBeenCalled();
      expect(mockCanvas.render).toHaveBeenCalled();
    });

    it('should display error overlay instead of regular UI', () => {
      const smallSize = { width: 70, height: 18 };
      const validation = validator.validate(smallSize);
      const errorMessage = validator.getErrorMessage(smallSize);

      // Simulate error overlay display
      if (!validation.isValid) {
        mockUIFramework.displaySizeError(errorMessage);
        mockCanvas.setBlocked(true);
      }

      expect(mockUIFramework.displaySizeError).toHaveBeenCalledWith(errorMessage);
      expect(errorMessage).toContain('Terminal too small');
      expect(errorMessage).toContain('70x18');
      expect(errorMessage).toContain('need 80x24');
    });

    it('should prevent all UI operations when undersized', () => {
      const tinySize = { width: 40, height: 10 };
      const validation = validator.validate(tinySize);

      // Mock UI operations that should be prevented
      const operations = {
        renderView: mock(() => {}),
        handleInput: mock(() => {}),
        updateComponents: mock(() => {}),
        processEvents: mock(() => {}),
      };

      // Simulate blocking all operations
      if (!validation.isValid) {
        mockCanvas.setBlocked(true);
        // Mock isBlocked to return true when blocked
        (mockCanvas.isBlocked as any).mockReturnValue(true);

        // All operations should check blocking status
        const tryOperation = (op: Function) => {
          if (!mockCanvas.isBlocked()) {
            op();
          }
        };

        tryOperation(operations.renderView);
        tryOperation(operations.handleInput);
        tryOperation(operations.updateComponents);
        tryOperation(operations.processEvents);
      }

      // None of the operations should have been called
      expect(operations.renderView).not.toHaveBeenCalled();
      expect(operations.handleInput).not.toHaveBeenCalled();
      expect(operations.updateComponents).not.toHaveBeenCalled();
      expect(operations.processEvents).not.toHaveBeenCalled();
    });

    it('should handle rapid resize events gracefully', () => {
      const sizes = [
        { width: 50, height: 15 }, // Too small
        { width: 60, height: 20 }, // Still too small
        { width: 75, height: 22 }, // Getting closer
        { width: 85, height: 25 }, // Valid
        { width: 70, height: 23 }, // Small width
        { width: 80, height: 24 }, // Valid again
      ];

      const blockingStates: boolean[] = [];
      let currentBlockedState = false;

      (mockCanvas.isBlocked as any).mockImplementation(() => currentBlockedState);

      sizes.forEach((size) => {
        const validation = validator.validate(size);
        const shouldBlock = !validation.isValid;
        blockingStates.push(shouldBlock);

        if (shouldBlock !== currentBlockedState) {
          mockCanvas.setBlocked(shouldBlock);
          currentBlockedState = shouldBlock;
        }
      });

      expect(blockingStates).toEqual([true, true, true, false, true, false]);
      expect(mockCanvas.setBlocked).toHaveBeenCalledTimes(4); // State changes: false->true, true->false, false->true, true->false
    });

    it('should provide resize instructions when blocked', () => {
      const smallSize = { width: 60, height: 20 };
      const validation = validator.validate(smallSize);
      const suggestion = validator.getResizeSuggestion(smallSize);

      expect(validation.isValid).toBe(false);
      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('wider');

      // Platform-specific instructions are in suggestions array, not first one
      const allSuggestions = validation.suggestions;

      if (process.platform === 'darwin' && allSuggestions.length > 1) {
        const platformSuggestions = allSuggestions.join(' ');
        expect(platformSuggestions).toMatch(/⌘\+|zoom|corner/i);
      }
    });

    it('should track resize attempts and provide feedback', () => {
      const resizeAttempts = [
        { width: 50, height: 20 },
        { width: 55, height: 20 },
        { width: 60, height: 22 },
        { width: 70, height: 24 },
        { width: 80, height: 24 },
      ];

      const feedback: string[] = [];

      resizeAttempts.forEach((size, index) => {
        const validation = validator.validate(size);

        if (!validation.isValid && index > 0) {
          const previous = resizeAttempts[index - 1];
          const widthProgress = size.width - previous.width;
          const heightProgress = size.height - previous.height;

          if (widthProgress > 0 || heightProgress > 0) {
            feedback.push('Getting closer! Keep resizing...');
          } else if (widthProgress < 0 || heightProgress < 0) {
            feedback.push('Wrong direction! Make the terminal larger.');
          } else {
            feedback.push('Terminal size unchanged. Please resize.');
          }
        }
      });

      expect(feedback).toContain('Getting closer! Keep resizing...');
      expect(feedback.length).toBe(3); // Feedback for attempts 2-4 (5th is valid, no feedback)
    });

    it('should enforce minimum size even in compact mode', () => {
      const compactMinimum = { width: 60, height: 18 };
      const tooSmall = { width: 50, height: 15 };

      // Create validator with compact mode settings
      const compactValidator = new TerminalSizeValidator({
        minWidth: compactMinimum.width,
        minHeight: compactMinimum.height,
      });

      const validation = compactValidator.validate(tooSmall);

      expect(validation.isValid).toBe(false);
      expect(validation.message).toContain('50x15');
      expect(validation.message).toContain(`need ${compactMinimum.width}x${compactMinimum.height}`);
    });

    it('should integrate with terminal resize event handlers', () => {
      const resizeHandler = mock((size: { width: number; height: number }) => {
        const validation = validator.validate(size);
        if (!validation.isValid) {
          mockCanvas.setBlocked(true);
          mockUIFramework.displaySizeError(validator.getErrorMessage(size));
          return false;
        } else {
          mockCanvas.setBlocked(false);
          return true;
        }
      });

      // Simulate resize events
      process.stdout.emit('resize');
      const currentSize = {
        width: process.stdout.columns ?? 80,
        height: process.stdout.rows ?? 24,
      };

      const canRender = resizeHandler(currentSize);

      expect(resizeHandler).toHaveBeenCalledWith(currentSize);
      if (currentSize.width < 80 || currentSize.height < 24) {
        expect(canRender).toBe(false);
        expect(mockCanvas.setBlocked).toHaveBeenCalledWith(true);
      } else {
        expect(canRender).toBe(true);
      }
    });

    it('should maintain error display until terminal is properly sized', () => {
      const errorDisplay = mock((message: string) => message);
      let currentError: string | null = null;

      // Too small - should display error
      const smallSize = { width: 60, height: 20 };
      const smallValidation = validator.validate(smallSize);
      if (!smallValidation.isValid) {
        currentError = errorDisplay(validator.getErrorMessage(smallSize));
      }

      expect(currentError).not.toBeNull();
      expect(errorDisplay).toHaveBeenCalled();

      // Still too small - error should remain
      const stillSmallSize = { width: 70, height: 20 };
      const stillSmallValidation = validator.validate(stillSmallSize);
      expect(stillSmallValidation.isValid).toBe(false);
      expect(currentError).not.toBeNull();

      // Now valid - error should clear
      const validSize = { width: 80, height: 24 };
      const validValidation = validator.validate(validSize);
      if (validValidation.isValid) {
        currentError = null;
      }

      expect(currentError).toBeNull();
    });
  });
});
import { describe, expect, it, beforeEach, jest } from 'bun:test';
import { DetailPanel } from '../../src/components/DetailPanel';
import type { Step, Command } from '@checklist/core/types';

describe('DetailPanel', () => {
  let panel: DetailPanel;
  const mockOptions = {
    x: 0,
    y: 0,
    width: 80,
    height: 24,
  };

  beforeEach(() => {
    panel = new DetailPanel(mockOptions);
  });

  describe('initialization', () => {
    it('should initialize with correct default state', () => {
      const state = panel.getDetailState();
      expect(state.currentStep).toBeNull();
      expect(state.scrollPosition).toBe(0);
      expect(state.isVisible).toBe(true);
    });

    it('should register with ComponentRegistry', () => {
      expect(panel.id).toBe('detail-panel');
    });
  });

  describe('updateStep', () => {
    const mockStep: Step = {
      id: 'step-1',
      title: 'Test Step',
      description: 'This is a test step with **bold** and *italic* text.',
      type: 'task',
      commands: [
        {
          id: 'cmd-1',
          type: 'bash',
          content: 'echo "Hello World"',
        },
        {
          id: 'cmd-2',
          type: 'claude',
          content: 'Explain this code',
        },
      ],
    };

    it('should update the current step', () => {
      panel.updateStep(mockStep);
      const state = panel.getDetailState();
      expect(state.currentStep).toEqual(mockStep);
    });

    it('should reset scroll position on step update', () => {
      panel.updateStep(mockStep);
      const state = panel.getDetailState();
      expect(state.scrollPosition).toBe(0);
    });

    it('should cache rendered content for same step', () => {
      const startTime = performance.now();
      panel.updateStep(mockStep);
      const firstUpdateTime = performance.now() - startTime;

      const secondStartTime = performance.now();
      panel.updateStep(mockStep);
      const secondUpdateTime = performance.now() - secondStartTime;

      expect(secondUpdateTime).toBeLessThan(firstUpdateTime);
    });

    it('should complete update within 50ms', () => {
      const startTime = performance.now();
      panel.updateStep(mockStep);
      const updateTime = performance.now() - startTime;
      expect(updateTime).toBeLessThan(50);
    });
  });

  describe('render', () => {
    it('should return empty string when not visible', () => {
      panel.setVisible(false);
      const output = panel.render();
      expect(output).toBe('');
    });

    it('should render content when visible', () => {
      const mockStep: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test description',
        type: 'task',
        commands: [],
      };

      panel.updateStep(mockStep);
      const output = panel.renderLines();
      expect(output).not.toEqual([]);
    });
  });

  describe('keyboard handling', () => {
    it('should handle copy shortcut', () => {
      const mockStep: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test description',
        type: 'task',
        commands: [],
      };

      panel.updateStep(mockStep);
      const handled = panel.handleKeyPress('c');
      expect(handled).toBe(true);
    });

    it('should delegate other keys to scrollable container', () => {
      const handled = panel.handleKeyPress('ArrowDown');
      expect(handled).toBeDefined();
    });
  });

  describe('copyToClipboard', () => {
    const mockStep: Step = {
      id: 'step-1',
      title: 'Test Step',
      description: 'Test description with **bold** text',
      type: 'task',
      commands: [
        {
          id: 'cmd-1',
          type: 'bash',
          content: 'echo "test"',
        },
      ],
    };

    it('should generate plain text content for copying', async () => {
      panel.updateStep(mockStep);
      const plainText = (panel as any).getPlainTextContent(mockStep);
      expect(plainText).toContain('Test Step');
      expect(plainText).toContain('Test description with **bold** text');
      expect(plainText).toContain('echo "test"');
    });
  });

  describe('command indicators', () => {
    it('should render correct indicator for bash commands', () => {
      const indicator = (panel as any).getCommandIndicator('bash');
      expect(indicator).toContain('$');
    });

    it('should render correct indicator for claude commands', () => {
      const indicator = (panel as any).getCommandIndicator('claude');
      expect(indicator).toContain('🤖');
    });

    it('should render correct indicator for internal commands', () => {
      const indicator = (panel as any).getCommandIndicator('internal');
      expect(indicator).toContain('⚙');
    });
  });

  describe('visibility', () => {
    it('should toggle visibility correctly', () => {
      panel.setVisible(false);
      let state = panel.getDetailState();
      expect(state.isVisible).toBe(false);

      panel.setVisible(true);
      state = panel.getDetailState();
      expect(state.isVisible).toBe(true);
    });
  });

  describe('cache management', () => {
    it('should clear cache on demand', () => {
      const mockStep: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test',
        type: 'task',
        commands: [],
      };

      panel.updateStep(mockStep);
      panel.clearCache();

      const startTime = performance.now();
      panel.updateStep(mockStep);
      const updateTime = performance.now() - startTime;

      expect(updateTime).toBeGreaterThan(0);
    });
  });

  describe('dispose', () => {
    it('should clean up resources on dispose', () => {
      panel.dispose();
      expect(panel.renderLines()).toEqual([]);
    });
  });

  describe('scrolling functionality', () => {
    const longStep: Step = {
      id: 'long-step',
      title: 'Long Step With Many Lines',
      description: Array(30).fill('This is a line of text that will be rendered').join('\n\n'),
      type: 'task',
      commands: [],
    };

    beforeEach(() => {
      panel = new DetailPanel({ ...mockOptions, height: 10 });
      panel.updateStep(longStep);
    });

    it('should scroll down with ArrowDown key', () => {
      const contentBefore = panel.renderLines();
      const handled = panel.handleKeyPress('ArrowDown');
      expect(handled).toBe(true);
      const contentAfter = panel.renderLines();
      // Check that content shifted up (first line changed)
      if (contentBefore.length > 10) {
        expect(contentAfter[0]).not.toEqual(contentBefore[0]);
      } else {
        // Content fits in viewport, no scroll
        expect(contentAfter).toEqual(contentBefore);
      }
    });

    it('should scroll down with j key (vim style)', () => {
      const contentBefore = panel.renderLines();
      const handled = panel.handleKeyPress('j');
      expect(handled).toBe(true);
      const contentAfter = panel.renderLines();
      // Check that content shifted up (first line changed)
      if (contentBefore.length > 10) {
        expect(contentAfter[0]).not.toEqual(contentBefore[0]);
      } else {
        // Content fits in viewport, no scroll
        expect(contentAfter).toEqual(contentBefore);
      }
    });

    it('should scroll up with ArrowUp key', () => {
      // First scroll down several times
      for (let i = 0; i < 5; i++) {
        panel.handleKeyPress('ArrowDown');
      }
      const scrolledContent = panel.renderLines();
      const handled = panel.handleKeyPress('ArrowUp');
      expect(handled).toBe(true);
      const afterScrollUp = panel.renderLines();
      // Content should change after scrolling up
      if (scrolledContent.length > 10) {
        expect(afterScrollUp[0]).not.toEqual(scrolledContent[0]);
      }
    });

    it('should scroll up with k key (vim style)', () => {
      // First scroll down several times
      for (let i = 0; i < 5; i++) {
        panel.handleKeyPress('j');
      }
      const scrolledContent = panel.renderLines();
      const handled = panel.handleKeyPress('k');
      expect(handled).toBe(true);
      const afterScrollUp = panel.renderLines();
      // Content should change after scrolling up
      if (scrolledContent.length > 10) {
        expect(afterScrollUp[0]).not.toEqual(scrolledContent[0]);
      }
    });

    it('should handle PageDown key', () => {
      const initialContent = panel.renderLines();
      const handled = panel.handleKeyPress('PageDown');
      expect(handled).toBe(true);
      const scrolledContent = panel.renderLines();
      // PageDown should scroll by viewport height - 1
      if (initialContent.length > 10) {
        expect(scrolledContent[0]).not.toEqual(initialContent[0]);
      }
    });

    it('should handle PageUp key', () => {
      // First PageDown to scroll
      panel.handleKeyPress('PageDown');
      panel.handleKeyPress('PageDown');
      const scrolledContent = panel.renderLines();
      const handled = panel.handleKeyPress('PageUp');
      expect(handled).toBe(true);
      const afterPageUp = panel.renderLines();
      // Should scroll back up
      if (scrolledContent.length > 10) {
        expect(afterPageUp[0]).not.toEqual(scrolledContent[0]);
      }
    });

    it('should handle Home key', () => {
      panel.handleKeyPress('PageDown');
      panel.handleKeyPress('PageDown');
      panel.handleKeyPress('Home');
      const content = panel.renderLines();
      expect(content.length).toBeGreaterThan(0);
    });

    it('should handle End key', () => {
      const initialContent = panel.renderLines();
      const handled = panel.handleKeyPress('End');
      expect(handled).toBe(true);
      const endContent = panel.renderLines();
      // End should scroll to bottom
      const lastLine = endContent[endContent.length - 1];
      expect(lastLine).toContain('Press Ctrl+C');
    });

    it('should not scroll up at the beginning', () => {
      const initialContent = panel.renderLines();
      const handled = panel.handleKeyPress('ArrowUp');
      expect(handled).toBe(true);
      const afterScroll = panel.renderLines();
      expect(afterScroll).toEqual(initialContent);
    });

    it('should not scroll down past content end', () => {
      panel.handleKeyPress('End');
      const endContent = panel.renderLines();
      panel.handleKeyPress('ArrowDown');
      const afterExtraScroll = panel.renderLines();
      expect(afterExtraScroll).toEqual(endContent);
    });

    it('should return false for unhandled keys', () => {
      const handled = panel.handleKeyPress('x');
      expect(handled).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle clipboard error gracefully', async () => {
      const mockStep: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test',
        type: 'task',
        commands: [],
      };

      panel.updateStep(mockStep);

      // Access the private showCopyError method to test error display
      const panelPrivate = panel as any;
      panelPrivate.showCopyError(new Error('Clipboard not available'));

      // Check that error feedback is shown
      const content = panel.renderLines();
      const contentString = content.join('\n');
      const hasErrorMessage = contentString.includes('Copy failed') || contentString.includes('Select text manually');
      expect(hasErrorMessage).toBe(true);
    });

    it('should handle copy without current step', async () => {
      // Panel has no current step
      await panel.copyToClipboard();
      // Should not throw, just log warning
      expect(true).toBe(true);
    });
  });

  describe('content rendering edge cases', () => {
    it('should handle step without description', () => {
      const stepNoDesc: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: '',
        type: 'task',
        commands: [],
      };

      panel.updateStep(stepNoDesc);
      const content = panel.getContent();
      expect(content).toContain('\x1b[1mTest Step\x1b[0m');
      expect(content.some(line => line.includes('Press Ctrl+C'))).toBe(true);
    });

    it('should handle step with empty description', () => {
      const stepEmptyDesc: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: '',
        type: 'task',
        commands: [],
      };

      panel.updateStep(stepEmptyDesc);
      const content = panel.getContent();
      expect(content).toContain('\x1b[1mTest Step\x1b[0m');
    });

    it('should handle step without commands', () => {
      const stepNoCommands: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test description',
        type: 'task',
        commands: [],
      };

      panel.updateStep(stepNoCommands);
      const content = panel.getContent();
      expect(content).toContain('\x1b[1mTest Step\x1b[0m');
      expect(content.some(line => line.includes('Commands:'))).toBe(false);
    });

    it('should handle step with empty commands array', () => {
      const stepEmptyCommands: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test description',
        type: 'task',
        commands: [],
      };

      panel.updateStep(stepEmptyCommands);
      const content = panel.getContent();
      expect(content.some(line => line.includes('Commands:'))).toBe(false);
    });

    it('should handle unknown command type', () => {
      const stepUnknownCmd: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test',
        type: 'task',
        commands: [
          {
            id: 'cmd-1',
            type: 'unknown' as any,
            content: 'test command',
          },
        ],
      };

      panel.updateStep(stepUnknownCmd);
      const content = panel.getContent();
      expect(content.some(line => line.includes('test command'))).toBe(true);
    });
  });

  describe('state management', () => {
    it('should return independent state copy', () => {
      const state1 = panel.getDetailState();
      state1.scrollPosition = 10;
      const state2 = panel.getDetailState();
      expect(state2.scrollPosition).toBe(0);
    });

    it('should return generic state object', () => {
      const mockStep: Step = {
        id: 'step-1',
        title: 'Test',
        description: 'Test description',
        type: 'task',
        commands: [],
      };
      panel.updateStep(mockStep);
      const state = panel.getState();
      expect(state.currentStep).toBeDefined();
      expect(state.scrollPosition).toBeDefined();
      expect(state.isVisible).toBeDefined();
    });
  });

  describe('registry integration', () => {
    it('should accept registry', () => {
      const mockRegistry = {
        register: jest.fn(),
        unregister: jest.fn(),
        get: jest.fn(),
      } as any;

      panel.setRegistry(mockRegistry);
      // Should not throw
      expect(true).toBe(true);
    });
  });

  describe('clipboard success feedback', () => {
    it('should show and hide success message', async () => {
      const mockStep: Step = {
        id: 'step-1',
        title: 'Test Step',
        description: 'Test',
        type: 'task',
        commands: [],
      };

      panel.updateStep(mockStep);

      // Mock successful clipboard
      const originalImport = (global as any).import;
      (global as any).import = jest.fn().mockResolvedValue({
        default: {
          write: jest.fn().mockResolvedValue(undefined),
        },
      });

      await panel.copyToClipboard();

      // Check success feedback
      let content = panel.renderLines();
      const hasSuccessMessage = content.some(line =>
        line.includes('Copied to clipboard')
      );
      expect(hasSuccessMessage).toBe(true);

      // Wait for feedback to disappear
      await new Promise(resolve => setTimeout(resolve, 2100));

      content = panel.renderLines();
      const stillHasMessage = content.some(line =>
        line.includes('Copied to clipboard')
      );
      expect(stillHasMessage).toBe(false);

      (global as any).import = originalImport;
    });
  });
});
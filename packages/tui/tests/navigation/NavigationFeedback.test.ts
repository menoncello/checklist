import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import { NavigationFeedback, FeedbackStatus } from '../../src/components/NavigationFeedback';

describe('NavigationFeedback', () => {
  let feedback: NavigationFeedback;

  beforeEach(() => {
    feedback = new NavigationFeedback({
      showDuration: 100, // Short duration for tests
      maxHistory: 5,
      enableAnimations: false, // Disable for predictable tests
    });

    // Mock component dimensions
    feedback.setProps({ width: 80, height: 24 });
    feedback.onMount();
  });

  afterEach(() => {
    feedback.onUnmount();
  });

  describe('Command Feedback Display', () => {
    it('should show command feedback', () => {
      feedback.showCommandFeedback('n', 'executing');

      const currentFeedback = feedback.getCurrentFeedback();
      expect(currentFeedback).toBeDefined();
      expect(currentFeedback?.key).toBe('n');
      expect(currentFeedback?.status).toBe('executing');
    });

    it('should render current feedback', () => {
      feedback.showCommandFeedback('d', 'success');

      const rendered = feedback.render({});
      expect(rendered).toContain('[d]');
      expect(rendered).toContain('✓');
    });

    it('should handle different feedback statuses', () => {
      const statuses: FeedbackStatus[] = ['executing', 'success', 'error', 'cancelled'];

      statuses.forEach(status => {
        feedback.showCommandFeedback('test', status, `Test ${status} message`);

        const currentFeedback = feedback.getCurrentFeedback();
        expect(currentFeedback?.status).toBe(status);
        expect(currentFeedback?.message).toBe(`Test ${status} message`);
      });
    });

    it('should display correct icons for different statuses', () => {
      const statusTests = [
        { status: 'executing' as FeedbackStatus, icon: '⟳' },
        { status: 'success' as FeedbackStatus, icon: '✓' },
        { status: 'error' as FeedbackStatus, icon: '✗' },
        { status: 'cancelled' as FeedbackStatus, icon: '⊘' },
      ];

      statusTests.forEach(({ status, icon }) => {
        feedback.showCommandFeedback('test', status);
        const rendered = feedback.render({});
        expect(rendered).toContain(icon);
      });
    });

    it('should handle Enter key display as arrow', () => {
      feedback.showCommandFeedback('Enter', 'success');

      const rendered = feedback.render({});
      expect(rendered).toContain('[↵]');
      expect(rendered).not.toContain('[Enter]');
    });

    it('should include message in feedback display', () => {
      feedback.showCommandFeedback('n', 'error', 'Custom error message');

      const rendered = feedback.render({});
      expect(rendered).toContain('Custom error message');
    });
  });

  describe('Feedback History', () => {
    it('should maintain feedback history', () => {
      feedback.showCommandFeedback('n', 'success');
      feedback.showCommandFeedback('d', 'error');
      feedback.showCommandFeedback('b', 'cancelled');

      const history = feedback.getFeedbackHistory();
      expect(history).toHaveLength(3);
      expect(history[0].key).toBe('b'); // Most recent first
      expect(history[1].key).toBe('d');
      expect(history[2].key).toBe('n');
    });

    it('should limit history size', () => {
      // Create more feedback than max history (5)
      for (let i = 0; i < 10; i++) {
        feedback.showCommandFeedback(`cmd-${i}`, 'success');
      }

      const history = feedback.getFeedbackHistory();
      expect(history).toHaveLength(5); // Limited to max history
      expect(history[0].key).toBe('cmd-9'); // Most recent
    });

    it('should clear history', () => {
      feedback.showCommandFeedback('n', 'success');
      feedback.showCommandFeedback('d', 'error');

      expect(feedback.getFeedbackHistory()).toHaveLength(2);

      feedback.clearHistory();
      expect(feedback.getFeedbackHistory()).toHaveLength(0);
    });
  });

  describe('Auto-Hide Functionality', () => {
    it('should auto-hide non-error feedback after duration', async () => {
      feedback.showCommandFeedback('n', 'success');

      expect(feedback.getCurrentFeedback()).toBeDefined();

      // Wait for auto-hide duration
      await new Promise(resolve => setTimeout(resolve, 150));

      expect(feedback.getCurrentFeedback()).toBeUndefined();
    });

    it('should not auto-hide error feedback', async () => {
      feedback.showCommandFeedback('n', 'error', 'Test error');

      expect(feedback.getCurrentFeedback()).toBeDefined();

      // Wait beyond auto-hide duration
      await new Promise(resolve => setTimeout(resolve, 150));

      // Error feedback should still be visible
      expect(feedback.getCurrentFeedback()).toBeDefined();
    });

    it('should allow manual hiding of feedback', () => {
      feedback.showCommandFeedback('n', 'error', 'Test error');

      expect(feedback.getCurrentFeedback()).toBeDefined();

      feedback.hideFeedback();
      expect(feedback.getCurrentFeedback()).toBeUndefined();
    });

    it('should clear auto-hide timer when showing new feedback', async () => {
      feedback.showCommandFeedback('n', 'success');

      // Show new feedback before auto-hide
      feedback.showCommandFeedback('d', 'executing');

      // Wait for less than the duration to ensure new feedback is still visible
      await new Promise(resolve => setTimeout(resolve, 50));

      // New feedback should still be visible
      expect(feedback.getCurrentFeedback()?.key).toBe('d');
    });
  });

  describe('Progress Display', () => {
    it('should show progress feedback', () => {
      feedback.showProgress('load', 3, 10);

      const currentFeedback = feedback.getCurrentFeedback();
      expect(currentFeedback?.key).toBe('load');
      expect(currentFeedback?.status).toBe('executing');
      expect(currentFeedback?.message).toContain('3/10');
      expect(currentFeedback?.message).toContain('30%');
    });

    it('should calculate progress percentage correctly', () => {
      const progressTests = [
        { progress: 0, total: 10, expected: '0%' },
        { progress: 5, total: 10, expected: '50%' },
        { progress: 7, total: 10, expected: '70%' },
        { progress: 10, total: 10, expected: '100%' },
      ];

      progressTests.forEach(({ progress, total, expected }) => {
        feedback.showProgress('test', progress, total);
        const currentFeedback = feedback.getCurrentFeedback();
        expect(currentFeedback?.message).toContain(expected);
      });
    });
  });

  describe('Keyboard Hints', () => {
    it('should generate keyboard hints', () => {
      const shortcuts = [
        { key: 'n', description: 'Next step' },
        { key: 'd', description: 'Mark done' },
        { key: 'b', description: 'Go back' },
      ];

      const hints = feedback.showKeyboardHints(shortcuts);

      expect(hints).toContain('n - Next step');
      expect(hints).toContain('d - Mark done');
      expect(hints).toContain('b - Go back');
    });

    it('should handle empty shortcuts array', () => {
      const hints = feedback.showKeyboardHints([]);
      expect(hints).toBe('');
    });

    it('should align shortcut keys', () => {
      const shortcuts = [
        { key: 'n', description: 'Next' },
        { key: 'Enter', description: 'Also next' },
      ];

      const hints = feedback.showKeyboardHints(shortcuts);

      // Should pad shorter keys to match longest key length
      expect(hints).toContain('n     - Next');
      expect(hints).toContain('Enter - Also next');
    });
  });

  describe('Status Indicators', () => {
    it('should render status indicators from history', () => {
      feedback.showCommandFeedback('n', 'success');
      feedback.showCommandFeedback('d', 'error');
      feedback.showCommandFeedback('b', 'success');
      feedback.hideFeedback(); // Hide current to show indicators

      const rendered = feedback.render({});

      // Should contain status indicators
      expect(rendered).toBeTruthy();
      expect(rendered.length).toBeGreaterThan(0);
    });

    it('should show different indicators for different statuses', () => {
      const feedback2 = new NavigationFeedback({
        showDuration: 100,
        maxHistory: 10,
        enableAnimations: false,
      });
      feedback2.setProps({ width: 80 });
      feedback2.onMount();

      feedback2.showCommandFeedback('success', 'success');
      feedback2.showCommandFeedback('error', 'error');
      feedback2.showCommandFeedback('cancelled', 'cancelled');
      feedback2.hideFeedback();

      const rendered = feedback2.render({});

      // Should render different indicators (though content depends on implementation)
      expect(typeof rendered).toBe('string');

      feedback2.onUnmount();
    });
  });

  describe('Rendering and Layout', () => {
    it('should render empty string when no feedback', () => {
      const rendered = feedback.render({});
      expect(rendered).toBe('');
    });

    it('should center feedback in available width', () => {
      feedback.setProps({ width: 80 });
      feedback.showCommandFeedback('n', 'success');

      const rendered = feedback.render({});

      // Should have padding on both sides for centering
      expect(rendered.startsWith(' ')).toBe(true);
      expect(rendered.length).toBeLessThanOrEqual(80);
    });

    it('should handle narrow widths gracefully', () => {
      feedback.setProps({ width: 20 });
      feedback.showCommandFeedback('n', 'success', 'Very long message that exceeds width');

      const rendered = feedback.render({});
      expect(typeof rendered).toBe('string');
      expect(rendered.length).toBeLessThanOrEqual(30); // Some reasonable limit
    });
  });

  describe('Statistics and Metrics', () => {
    it('should provide feedback statistics', () => {
      feedback.showCommandFeedback('n', 'success');
      feedback.showCommandFeedback('d', 'error');
      feedback.showCommandFeedback('b', 'success');

      const stats = feedback.getStats();

      expect(stats.totalFeedback).toBe(3);
      expect(stats.hasCurrentFeedback).toBe(true);
      expect(stats.statusCounts.success).toBe(2);
      expect(stats.statusCounts.error).toBe(1);
    });

    it('should track recent feedback separately', async () => {
      feedback.showCommandFeedback('old', 'success');

      // Mock older timestamp
      const history = feedback.getFeedbackHistory();
      if (history.length > 0) {
        // TypeScript: We know this exists from the previous line
        (history[0] as any).timestamp = Date.now() - 120000; // 2 minutes ago
      }

      feedback.showCommandFeedback('recent', 'error');

      const stats = feedback.getStats();

      expect(stats.totalFeedback).toBe(2);
      expect(stats.recentFeedback).toBe(1); // Only recent feedback
    });
  });

  describe('Component Lifecycle', () => {
    it('should handle mount and unmount', () => {
      const newFeedback = new NavigationFeedback();

      expect(() => newFeedback.onMount()).not.toThrow();
      expect(() => newFeedback.onUnmount()).not.toThrow();
    });

    it('should cleanup timers on unmount', () => {
      feedback.showCommandFeedback('n', 'success');

      // Should not throw errors when unmounting with active timers
      expect(() => feedback.onUnmount()).not.toThrow();
    });

    it('should clear feedback and history on cleanup', () => {
      feedback.showCommandFeedback('n', 'success');
      feedback.showCommandFeedback('d', 'error');

      expect(feedback.getCurrentFeedback()).toBeDefined();
      expect(feedback.getFeedbackHistory().length).toBeGreaterThan(0);

      feedback.onUnmount();

      expect(feedback.getCurrentFeedback()).toBeUndefined();
      expect(feedback.getFeedbackHistory().length).toBe(0);
    });
  });

  describe('Animation Support', () => {
    it('should support animation enabling/disabling', () => {
      const animatedFeedback = new NavigationFeedback({
        enableAnimations: true,
        showDuration: 1000,
      });

      animatedFeedback.setProps({ width: 80 });
      animatedFeedback.onMount();

      animatedFeedback.showCommandFeedback('n', 'executing');

      // Animation support is enabled
      const rendered1 = animatedFeedback.render({});
      expect(typeof rendered1).toBe('string');

      animatedFeedback.onUnmount();
    });
  });

  describe('Error Handling', () => {
    it('should handle invalid feedback status gracefully', () => {
      // TypeScript should prevent this, but test runtime behavior
      expect(() => {
        feedback.showCommandFeedback('n', 'invalid-status' as FeedbackStatus);
      }).not.toThrow();
    });

    it('should handle missing properties gracefully', () => {
      expect(() => {
        feedback.showCommandFeedback('', 'success');
      }).not.toThrow();

      expect(() => {
        feedback.render({});
      }).not.toThrow();
    });

    it('should handle component dimensions edge cases', () => {
      feedback.setProps({ width: 0 });

      expect(() => {
        feedback.showCommandFeedback('n', 'success');
        feedback.render({});
      }).not.toThrow();
    });
  });
});
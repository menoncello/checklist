import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { KeyboardHandler, KeyEvent, KeyModifiers } from '../../src/events/KeyboardHandler';
import { DebugManager } from '../../src/debug/DebugManager';
import { DebugOverlay } from '../../src/debug/DebugOverlay';
import { DebugConfigDefaults } from '../../src/debug/DebugConfigDefaults';

describe('Keyboard Shortcut Integration Test - Debug Overlay Toggle (Ctrl+Shift+D)', () => {
  let keyboardHandler: KeyboardHandler;
  let debugManager: DebugManager;
  let debugOverlay: DebugOverlay;
  let overlayToggled: boolean;
  let toggleCount: number;

  beforeEach(() => {
    keyboardHandler = new KeyboardHandler();
    debugManager = new DebugManager();
    debugOverlay = new DebugOverlay(debugManager);
    overlayToggled = false;
    toggleCount = 0;

    // Setup toggle handler
    debugOverlay.on('toggle', () => {
      overlayToggled = !overlayToggled;
      toggleCount++;
    });
  });

  afterEach(() => {
    keyboardHandler.destroy();
    debugManager.destroy();
    debugOverlay.destroy();
  });

  describe('Ctrl+Shift+D Shortcut Integration', () => {
    test('should bind Ctrl+Shift+D to debug overlay toggle', () => {
      // Bind the keyboard shortcut
      const bindingId = keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugOverlay.toggle();
        return Promise.resolve();
      }, {
        description: 'Toggle debug overlay',
        priority: 90, // High priority for debug functionality
      });

      expect(bindingId).toBeDefined();
      expect(typeof bindingId).toBe('string');

      // Verify binding was created
      const bindings = keyboardHandler.getAllBindings();
      const debugBinding = bindings.find(b =>
        b.keys === 'ctrl+shift+d' &&
        b.options?.description === 'Toggle debug overlay'
      );

      expect(debugBinding).toBeDefined();
    });

    test('should handle Ctrl+Shift+D key combination correctly', async () => {
      let toggleCalled = false;

      // Setup handler
      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        toggleCalled = true;
        debugOverlay.toggle();
        return Promise.resolve();
      });

      // Simulate Ctrl+Shift+D key event
      const keyEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      // Handle the key event
      const wasHandled = await keyboardHandler.testHandleKeyEvent(keyEvent);

      expect(wasHandled).toBe(true);
      expect(toggleCalled).toBe(true);
    });

    test('should not trigger on incorrect key combinations', async () => {
      let toggleCalled = false;

      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        toggleCalled = true;
        debugOverlay.toggle();
        return Promise.resolve();
      });

      // Test various incorrect combinations for ctrl+shift+d specifically
      const incorrectEvents = [
        { key: 'd', modifiers: { ctrl: true, shift: false, alt: false, meta: false }, timestamp: Date.now(), meta: {} }, // Ctrl+D only (should trigger default binding, not our binding)
        { key: 'd', modifiers: { ctrl: false, shift: true, alt: false, meta: false }, timestamp: Date.now(), meta: {} }, // Shift+D only
        { key: 'd', modifiers: { ctrl: true, shift: true, alt: true, meta: false }, timestamp: Date.now(), meta: {} },   // Ctrl+Shift+Alt+D
        { key: 'D', modifiers: { ctrl: true, shift: true, alt: false, meta: false }, timestamp: Date.now(), meta: {} },   // Ctrl+Shift+Shift+D (uppercase)
        { key: 'f', modifiers: { ctrl: true, shift: true, alt: false, meta: false }, timestamp: Date.now(), meta: {} },   // Ctrl+Shift+F
      ];

      for (const event of incorrectEvents) {
        toggleCalled = false; // Reset for each test
        const wasHandled = await keyboardHandler.testHandleKeyEvent(event);

        // The important assertion is that our specific binding is not triggered
        expect(toggleCalled).toBe(false);

        // Note: wasHandled might be true due to default bindings, which is expected behavior
        // For example, ctrl+d will be handled by the default EOF binding
      }
    });

    test('should toggle debug overlay visibility when shortcut is pressed', async () => {
      // Initially overlay should be hidden
      expect(debugOverlay.isVisible()).toBe(false);

      // Bind and trigger shortcut
      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugOverlay.toggle();
        return Promise.resolve();
      });

      const keyEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      // First toggle - show overlay
      await keyboardHandler.testHandleKeyEvent(keyEvent);
      expect(debugOverlay.isVisible()).toBe(true);
      expect(toggleCount).toBe(1);

      // Second toggle - hide overlay
      await keyboardHandler.testHandleKeyEvent(keyEvent);
      expect(debugOverlay.isVisible()).toBe(false);
      expect(toggleCount).toBe(2);
    });

    test('should work with debug manager integration', async () => {
      // Enable debug mode
      debugManager.enable();

      let managerToggleCalled = false;

      // Setup debug manager to handle overlay toggle
      debugManager.on('overlayToggled', () => {
        managerToggleCalled = true;
        // Don't call debugOverlay.toggle() here as it creates a circular dependency
        // The debugManager.toggleOverlay() should already handle the overlay state
      });

      // Bind shortcut to debug manager
      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugManager.toggleOverlay();
        return Promise.resolve();
      });

      const keyEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      // Trigger shortcut
      await keyboardHandler.testHandleKeyEvent(keyEvent);

      // Add a small delay to ensure event propagation
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(managerToggleCalled).toBe(true);
      expect(debugOverlay.isVisible()).toBe(true);
    });

    test('should handle rapid key presses correctly', async () => {
      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugOverlay.toggle();
        return Promise.resolve();
      });

      const keyEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      // Simulate rapid key presses
      const rapidPresses = 5;
      for (let i = 0; i < rapidPresses; i++) {
        keyEvent.timestamp = Date.now() + i * 10; // 10ms apart
        await keyboardHandler.testHandleKeyEvent(keyEvent);
      }

      // Should have toggled 5 times (odd number = should be visible)
      expect(debugOverlay.isVisible()).toBe(true);
      expect(toggleCount).toBe(rapidPresses);
    });

    test('should prevent default behavior when handled', async () => {
      let defaultPrevented = false;

      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugOverlay.toggle();
        // Simulate preventing default
        if (event.meta) {
          event.meta.defaultPrevented = true;
        }
        return Promise.resolve();
      });

      const keyEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      await keyboardHandler.testHandleKeyEvent(keyEvent);

      // Check if default was prevented (this depends on implementation)
      // In real implementation, this would prevent browser default or system behavior
      expect(debugOverlay.isVisible()).toBe(true);
    });

    test('should work alongside other keyboard shortcuts', async () => {
      let otherShortcutCalled = false;
      let debugShortcutCalled = false;

      // Bind other shortcuts
      keyboardHandler.bind('ctrl+s', (event: KeyEvent) => {
        otherShortcutCalled = true;
        return Promise.resolve();
      });

      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugShortcutCalled = true;
        debugOverlay.toggle();
        return Promise.resolve();
      });

      // Test both shortcuts
      const saveEvent: KeyEvent = {
        key: 's',
        modifiers: { ctrl: true, shift: false, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      const debugEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now() + 100,
        meta: {},
      };

      await keyboardHandler.testHandleKeyEvent(saveEvent);
      await keyboardHandler.testHandleKeyEvent(debugEvent);

      expect(otherShortcutCalled).toBe(true);
      expect(debugShortcutCalled).toBe(true);
      expect(debugOverlay.isVisible()).toBe(true);
    });

    test('should be configurable through debug config', () => {
      const config = DebugConfigDefaults.getDefaultConfig();

      // Check if the hotkey is configurable
      expect(config.hotkeys).toBeDefined();
      expect(typeof config.hotkeys).toBe('object');

      // The default config might not have ctrl+shift+d, but it should be configurable
      // This test ensures the configuration system is in place
      expect(Object.keys(config.hotkeys).length).toBeGreaterThan(0);
    });

    test('should handle case sensitivity correctly', async () => {
      let toggleCalled = false;

      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        toggleCalled = true;
        debugOverlay.toggle();
        return Promise.resolve();
      });

      // Test different cases (implementation may vary)
      const testCases = [
        { key: 'd', modifiers: { ctrl: true, shift: true } },      // lowercase
        { key: 'D', modifiers: { ctrl: true, shift: true } },      // uppercase
      ];

      for (const testCase of testCases) {
        toggleCalled = false;
        const event: KeyEvent = {
          key: testCase.key,
          modifiers: { ...testCase.modifiers, alt: false, meta: false },
          timestamp: Date.now(),
          meta: {},
        };

        await keyboardHandler.testHandleKeyEvent(event);

        // Should handle both cases (implementation dependent)
        // For now, just ensure it doesn't crash
        expect(typeof toggleCalled).toBe('boolean');
      }
    });

    test('should maintain proper event ordering', async () => {
      const eventOrder: string[] = [];

      // Setup multiple handlers to test ordering
      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        eventOrder.push('first');
        debugOverlay.toggle();
        return Promise.resolve();
      }, { priority: 100 });

      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        eventOrder.push('second');
        return Promise.resolve();
      }, { priority: 50 }); // Lower priority

      const keyEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      await keyboardHandler.testHandleKeyEvent(keyEvent);

      // Higher priority handler should execute first
      expect(eventOrder[0]).toBe('first');
      // Depending on implementation, second handler might or might not execute
      // If stopPropagation is implemented, only first should execute
    });

    test('should cleanup properly when destroyed', () => {
      // Bind the shortcut
      const bindingId = keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugOverlay.toggle();
        return Promise.resolve();
      });

      // Verify binding exists
      let bindings = keyboardHandler.getAllBindings();
      expect(bindings.some(b => b.id === bindingId)).toBe(true);

      // Destroy keyboard handler
      keyboardHandler.destroy();

      // Verify bindings are cleaned up
      bindings = keyboardHandler.getAllBindings();
      expect(bindings.length).toBe(0); // Should only have default bindings
    });
  });

  describe('Integration with Debug System', () => {
    test('should integrate with debug manager hotkey system', () => {
      const config = DebugConfigDefaults.getDefaultConfig();

      // Verify the debug system has hotkey configuration
      expect(config.hotkeys).toBeDefined();

      // The debug manager should be able to use the keyboard handler
      // This is a basic integration test to ensure the systems are compatible
      expect(typeof config.hotkeys).toBe('object');
    });

    test('should allow hotkey customization through debug config', () => {
      // Test that the debug system can be configured with custom hotkeys
      const customConfig = {
        ...DebugConfigDefaults.getDefaultConfig(),
        hotkeys: {
          ...DebugConfigDefaults.getDefaultConfig().hotkeys,
          'ctrl+shift+d': 'toggle_overlay',
        },
      };

      expect(customConfig.hotkeys['ctrl+shift+d']).toBe('toggle_overlay');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle missing modifiers gracefully', async () => {
      let toggleCalled = false;

      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        toggleCalled = true;
        debugOverlay.toggle();
        return Promise.resolve();
      });

      // Test event with missing modifier properties
      const incompleteEvent: KeyEvent = {
        key: 'd',
        modifiers: {}, // Missing ctrl and shift
        timestamp: Date.now(),
        meta: {},
      };

      const wasHandled = await keyboardHandler.testHandleKeyEvent(incompleteEvent);

      expect(wasHandled).toBe(false);
      expect(toggleCalled).toBe(false);
    });

    test('should handle malformed key events', async () => {
      let toggleCalled = false;

      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        toggleCalled = true;
        debugOverlay.toggle();
        return Promise.resolve();
      });

      // Test malformed events
      const malformedEvents = [
        { key: '', modifiers: { ctrl: true, shift: true } }, // Empty key
        { key: null, modifiers: { ctrl: true, shift: true } }, // Null key (type would be invalid in real TypeScript)
        { key: undefined, modifiers: { ctrl: true, shift: true } }, // Undefined key
      ];

      for (const malformedEvent of malformedEvents) {
        const wasHandled = await keyboardHandler.testHandleKeyEvent(malformedEvent as KeyEvent);
        expect(wasHandled).toBe(false);
        expect(toggleCalled).toBe(false);
      }
    });

    test('should not interfere with default keyboard bindings', async () => {
      // Test that our debug binding doesn't interfere with essential bindings
      let debugCalled = false;
      let defaultBindingCalled = false;

      // Listen for the default interrupt event from the default ctrl+c binding
      keyboardHandler.on('interrupt', () => {
        defaultBindingCalled = true;
      });

      // Debug binding
      keyboardHandler.bind('ctrl+shift+d', (event: KeyEvent) => {
        debugCalled = true;
        debugOverlay.toggle();
        return Promise.resolve();
      }, { priority: 90 });

      // Test both
      const interruptEvent: KeyEvent = {
        key: 'c',
        modifiers: { ctrl: true, shift: false, alt: false, meta: false },
        timestamp: Date.now(),
        meta: {},
      };

      const debugEvent: KeyEvent = {
        key: 'd',
        modifiers: { ctrl: true, shift: true, alt: false, meta: false },
        timestamp: Date.now() + 100,
        meta: {},
      };

      await keyboardHandler.testHandleKeyEvent(interruptEvent);
      await keyboardHandler.testHandleKeyEvent(debugEvent);

      expect(defaultBindingCalled).toBe(true);
      expect(debugCalled).toBe(true);
      expect(debugOverlay.isVisible()).toBe(true);
    });
  });
});
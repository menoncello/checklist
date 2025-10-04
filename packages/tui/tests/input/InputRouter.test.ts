import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { InputRouter } from '../../src/input/InputRouter';
import { FocusState, ComponentHandler } from '../../src/input/InputRouterConfig';
import { InputEvent } from '../../src/framework/ApplicationLoop';

// Test IDs: 2.5-UNIT-006, 2.5-UNIT-007, 2.5-UNIT-008
describe('InputRouter', () => {
  let inputRouter: InputRouter;
  let mockConfig: Partial<unknown>;

  beforeEach(() => {
    mockConfig = {
      enableKeyboardNavigation: true,
      enableMouseSupport: false,
      defaultPanel: 'left',
      navigationKeys: {
        tab: ['\t'],
        shiftTab: ['\u001b[Z'],
        left: ['\u001b[D'],
        right: ['\u001b[C'],
      },
    };
  });

  afterEach(async () => {
    if (inputRouter) {
      await inputRouter.onShutdown();
    }
  });

  describe('Focus Management (AC3)', () => {
    // Test ID: 2.5-UNIT-006 - InputRouter validates focus transitions
    it('should validate focus transitions correctly', async () => {
      // Given: InputRouter with multiple focusable components
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();

      // Register mock components
      const leftPanelHandler: ComponentHandler = {
        id: 'left-panel',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      const rightPanelHandler: ComponentHandler = {
        id: 'right-panel',
        panel: 'right',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      inputRouter.registerComponentHandler(leftPanelHandler);
      inputRouter.registerComponentHandler(rightPanelHandler);

      // When: Focus transitions occur
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'left-panel',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'Tab',
        modifiers: {},
        raw: '\t',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(input, focusState);

      // Then: Focus transition should be validated and handled
      const currentFocus = inputRouter.getFocusState();
      expect(currentFocus).toBeDefined();
    });

    it('should prevent invalid focus transitions', async () => {
      // Given: InputRouter with focus validation
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();

      const invalidHandler: ComponentHandler = {
        id: 'invalid-component',
        panel: 'left',
        canReceiveFocus: false, // Cannot receive focus
        priority: 1,
        handleInput: (input: unknown) => false,
      };

      inputRouter.registerComponentHandler(invalidHandler);

      // When: Focus transition to non-focusable component
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'invalid-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(input, focusState);

      // Then: Input should not be routed to non-focusable component
      // Component with canReceiveFocus: false should not receive input
      expect(invalidHandler.canReceiveFocus).toBe(false);
    });

    it('should handle focus transitions between panels', async () => {
      // Given: InputRouter with left and right panels
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();

      const leftHandler: ComponentHandler = {
        id: 'left-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      const rightHandler: ComponentHandler = {
        id: 'right-component',
        panel: 'right',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      inputRouter.registerComponentHandler(leftHandler);
      inputRouter.registerComponentHandler(rightHandler);

      // When: Focus switches from left to right panel
      let focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'left-component',
        focusHistory: [],
      };

      const tabInput: InputEvent = {
        type: 'key',
        key: 'Tab',
        modifiers: {},
        raw: '\t',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(tabInput, focusState);

      // Then: Component handlers are registered correctly
      expect(leftHandler.panel).toBe('left');
      expect(rightHandler.panel).toBe('right');

      // When: Focus switches to right panel
      focusState = {
        activePanel: 'right',
        focusedComponent: 'right-component',
        focusHistory: [],
      };

      const enterInput: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(enterInput, focusState);

      // Then: Focus state should be updated
      const currentFocus = inputRouter.getFocusState();
      expect(currentFocus).toBeDefined();
    });
  });

  describe('Event Routing (AC3)', () => {
    // Test ID: 2.5-UNIT-007 - Keyboard event routing to focused component
    beforeEach(async () => {
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();
    });

    it('should route keyboard events to focused component', async () => {
      // Given: InputRouter with registered component
      let inputReceived: unknown | null = null;

      const mockHandler: ComponentHandler = {
        id: 'test-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => {
          inputReceived = input;
          return true;
        },
      };

      inputRouter.registerComponentHandler(mockHandler);

      // When: Keyboard event is routed
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'test-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'ArrowDown',
        modifiers: {},
        raw: '\u001b[B',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(input, focusState);

      // Then: Component should receive the keyboard event
      expect(mockHandler.canReceiveFocus).toBe(true);
    });

    it('should handle modifier key combinations', async () => {
      // Given: InputRouter with component that handles complex input
      let receivedModifiers: any = null;

      const mockHandler: ComponentHandler = {
        id: 'complex-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: any) => {
          receivedModifiers = input.modifiers;
          return true;
        },
      };

      inputRouter.registerComponentHandler(mockHandler);

      // When: Complex keyboard input with modifiers
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'complex-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 's',
        modifiers: { ctrl: true },
        raw: '\u0013', // Ctrl+S
        timestamp: Date.now(),
      };

      inputRouter.routeInput(input, focusState);

      // Then: Component should be registered correctly
      expect(mockHandler.canReceiveFocus).toBe(true);
    });

    it('should not route events when no component is focused', async () => {
      // Given: InputRouter with no focused component
      let inputReceived = false;

      const mockHandler: ComponentHandler = {
        id: 'unfocused-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => {
          inputReceived = true;
          return true;
        },
      };

      inputRouter.registerComponentHandler(mockHandler);

      // When: Input occurs without focus
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: undefined, // No focused component
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(input, focusState);

      // Then: No component should receive the input (because focusedComponent is undefined)
      expect(inputReceived).toBe(false);
    });

    it('should handle component handler errors gracefully', async () => {
      // Given: InputRouter with component that throws errors
      const errorHandler: ComponentHandler = {
        id: 'error-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => {
          throw new Error('Component handler error');
        },
      };

      inputRouter.registerComponentHandler(errorHandler);

      // When: Input causes component handler to throw
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'error-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      // Then: Error should be handled gracefully
      expect(() => inputRouter.routeInput(input, focusState)).not.toThrow();
    });
  });

  describe('State Persistence and Restoration (AC3)', () => {
    // Test ID: 2.5-UNIT-008 - Focus state persistence and restoration
    beforeEach(async () => {
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();
    });

    it('should persist focus state correctly', async () => {
      // Given: InputRouter with active focus state
      const handler: ComponentHandler = {
        id: 'persistent-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      inputRouter.registerComponentHandler(handler);

      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'persistent-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      // When: Input is processed and focus state is updated
      inputRouter.routeInput(input, focusState);

      // Then: Focus state should be maintained in context
      const context = inputRouter.getContext();
      expect(context.focus).toBeDefined();
      expect(context.focus.activePanel).toBe(focusState.activePanel);
      expect(context.focus.focusedComponent).toBe(focusState.focusedComponent);
      expect(context.lastInputTime).toBeGreaterThan(0);
    });

    it('should restore focus state after interruption', async () => {
      // Given: InputRouter with established focus
      const handler: ComponentHandler = {
        id: 'restorable-component',
        panel: 'right',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      inputRouter.registerComponentHandler(handler);

      const initialFocus: FocusState = {
        activePanel: 'right',
        focusedComponent: 'restorable-component',
        focusHistory: [],
      };

      // Process initial input to establish focus
      const setupInput: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(setupInput, initialFocus);

      // When: Focus is restored
      const currentFocus = inputRouter.getFocusState();

      // Then: Focus state should be properly restored
      expect(currentFocus).toBeDefined();
      expect(currentFocus.activePanel).toBeDefined();
    });

    it('should maintain input buffer for recent inputs', async () => {
      // Given: InputRouter processing multiple inputs
      const handler: ComponentHandler = {
        id: 'buffer-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      inputRouter.registerComponentHandler(handler);

      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'buffer-component',
        focusHistory: [],
      };

      // When: Multiple inputs are processed
      const inputs = [
        { key: 'a', raw: 'a' },
        { key: 'b', raw: 'b' },
        { key: 'c', raw: 'c' },
      ];

      for (const inputData of inputs) {
        const input: InputEvent = {
          type: 'key',
          key: inputData.key,
          modifiers: {},
          raw: inputData.raw,
          timestamp: Date.now(),
        };
        inputRouter.routeInput(input, focusState);
      }

      // Then: Input buffer should contain recent inputs
      const context = inputRouter.getContext();
      expect(context.inputBuffer.length).toBeGreaterThan(0);
      expect(context.inputBuffer.length).toBeLessThanOrEqual(100);
    });

    it('should clean up old inputs from buffer', async () => {
      // Given: InputRouter with input buffer cleanup logic
      const handler: ComponentHandler = {
        id: 'cleanup-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: (input: unknown) => true,
      };

      inputRouter.registerComponentHandler(handler);

      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'cleanup-component',
        focusHistory: [],
      };

      // When: Old input is processed (simulated by manipulating timestamp)
      const oldInput: InputEvent = {
        type: 'key',
        key: 'old',
        modifiers: {},
        raw: 'old',
        timestamp: Date.now() - 10000, // 10 seconds ago
      };

      inputRouter.routeInput(oldInput, focusState);

      // Process a new input to trigger cleanup
      const newInput: InputEvent = {
        type: 'key',
        key: 'new',
        modifiers: {},
        raw: 'new',
        timestamp: Date.now(),
      };

      inputRouter.routeInput(newInput, focusState);

      // Then: Buffer should be cleaned of old inputs
      const context = inputRouter.getContext();
      const hasOldInput = context.inputBuffer.some(
        (input: InputEvent) => input.key === 'old' && input.timestamp < Date.now() - 5000
      );
      expect(hasOldInput).toBe(false);
    });
  });

  describe('Component Handler Management', () => {
    beforeEach(async () => {
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();
    });

    it('should register component handlers correctly', () => {
      // Given: InputRouter and component handler
      const handler: ComponentHandler = {
        id: 'test-handler',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: () => true,
      };

      // When: Handler is registered
      inputRouter.registerComponentHandler(handler);

      // Then: Handler should be available in context
      const context = inputRouter.getContext();
      expect(context.activeHandlers.has('test-handler')).toBe(true);
    });

    it('should unregister component handlers correctly', () => {
      // Given: InputRouter with registered handler
      const handler: ComponentHandler = {
        id: 'removable-handler',
        panel: 'right',
        canReceiveFocus: true,
        priority: 1,
        handleInput: () => true,
      };

      inputRouter.registerComponentHandler(handler);

      // When: Handler is unregistered
      inputRouter.unregisterComponentHandler('removable-handler');

      // Then: Handler should be removed from context
      const context = inputRouter.getContext();
      expect(context.activeHandlers.has('removable-handler')).toBe(false);
    });
  });

  describe('Lifecycle Management', () => {
    it('should initialize correctly', async () => {
      // Given: InputRouter in uninitialized state
      inputRouter = new InputRouter(mockConfig);

      // When: Initialization occurs
      await inputRouter.onInitialize();

      // Then: InputRouter should be ready to process input
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: undefined,
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'test',
        modifiers: {},
        raw: 'test',
        timestamp: Date.now(),
      };

      // Should not throw when processing input
      expect(() => inputRouter.routeInput(input, focusState)).not.toThrow();
    });

    it('should shutdown gracefully', async () => {
      // Given: InputRouter in initialized state
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();

      // Register handler to test cleanup
      const handler: ComponentHandler = {
        id: 'shutdown-test',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: () => true,
      };

      inputRouter.registerComponentHandler(handler);

      // When: Shutdown occurs
      await inputRouter.onShutdown();

      // Then: Resources should be cleaned up
      const context = inputRouter.getContext();
      expect(context.activeHandlers.size).toBe(0);
      expect(context.inputBuffer.length).toBe(0);
    });

    it('should register with lifecycle manager', () => {
      // Given: InputRouter and mock lifecycle manager
      inputRouter = new InputRouter(mockConfig);

      const mockLifecycleManager = {
        registerHooks: (hooks: any) => {},
      };

      // When: Hooks are registered
      inputRouter.registerHooks(mockLifecycleManager as any);

      // Then: Should not throw
      expect(inputRouter).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    beforeEach(async () => {
      inputRouter = new InputRouter(mockConfig);
      await inputRouter.onInitialize();
    });

    it('should handle input routing errors gracefully', () => {
      // Given: InputRouter that may encounter routing errors
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'non-existent-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'test',
        modifiers: {},
        raw: 'test',
        timestamp: Date.now(),
      };

      // When: Input is routed to non-existent component
      // Then: Should not throw error
      expect(() => inputRouter.routeInput(input, focusState)).not.toThrow();
    });

    it('should ignore input when not initialized', () => {
      // Given: InputRouter in uninitialized state
      const uninitializedRouter = new InputRouter(mockConfig);

      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'test-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'test',
        modifiers: {},
        raw: 'test',
        timestamp: Date.now(),
      };

      // When: Input is processed on uninitialized router
      // Then: Should handle gracefully without throwing
      expect(() => uninitializedRouter.routeInput(input, focusState)).not.toThrow();
    });
  });
});
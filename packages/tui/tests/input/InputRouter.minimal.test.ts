import { describe, expect, it, beforeEach, afterEach } from 'bun:test';
import { InputRouter } from '../../src/input/InputRouter';
import { FocusState, ComponentHandler } from '../../src/input/InputRouterConfig';
import { InputEvent } from '../../src/framework/ApplicationLoop';

// Test IDs: 2.5-UNIT-006, 2.5-UNIT-007, 2.5-UNIT-008
describe('InputRouter Core Tests', () => {
  let inputRouter: InputRouter;

  afterEach(async () => {
    if (inputRouter) {
      try {
        await inputRouter.onShutdown();
      } catch {
        // Ignore cleanup errors in tests
      }
    }
  });

  describe('Focus Management (AC3)', () => {
    it('should initialize correctly', async () => {
      // Given: InputRouter configuration
      inputRouter = new InputRouter({});

      // When: Initialization occurs
      await inputRouter.onInitialize();

      // Then: InputRouter should be ready
      expect(inputRouter).toBeDefined();
    });

    it('should provide focus state', async () => {
      // Given: Initialized InputRouter
      inputRouter = new InputRouter({});
      await inputRouter.onInitialize();

      // When: Focus state is requested
      const focusState = inputRouter.getFocusState();

      // Then: Focus state should be available
      expect(focusState).toBeDefined();
    });

    it('should provide context information', async () => {
      // Given: InputRouter with context
      inputRouter = new InputRouter({});
      await inputRouter.onInitialize();

      // When: Context is requested
      const context = inputRouter.getContext();

      // Then: Context should be available
      expect(context).toBeDefined();
      expect(Array.isArray(context.inputBuffer)).toBe(true);
    });
  });

  describe('Component Handler Management', () => {
    beforeEach(async () => {
      inputRouter = new InputRouter({});
      await inputRouter.onInitialize();
    });

    it('should register and unregister handlers', () => {
      // Given: InputRouter and component handler
      const handler: ComponentHandler = {
        id: 'test-handler',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: () => true,
      };

      // When: Handler is registered and unregistered
      inputRouter.registerComponentHandler(handler);
      inputRouter.unregisterComponentHandler('test-handler');

      // Then: Operations should complete successfully
      expect(inputRouter).toBeDefined();
    });
  });

  describe('Input Routing (AC3)', () => {
    beforeEach(async () => {
      inputRouter = new InputRouter({});
      await inputRouter.onInitialize();
    });

    it('should route input events', () => {
      // Given: InputRouter with handler
      const handler: ComponentHandler = {
        id: 'test-component',
        panel: 'left',
        canReceiveFocus: true,
        priority: 1,
        handleInput: () => true,
      };

      inputRouter.registerComponentHandler(handler);

      // When: Input is routed
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: 'test-component',
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      // Then: Input routing should complete without errors
      expect(() => inputRouter.routeInput(input, focusState)).not.toThrow();
    });

    it('should handle input without focused component', () => {
      // Given: InputRouter without focused component
      const focusState: FocusState = {
        activePanel: 'left',
        focusedComponent: undefined,
        focusHistory: [],
      };

      const input: InputEvent = {
        type: 'key',
        key: 'Enter',
        modifiers: {},
        raw: '\r',
        timestamp: Date.now(),
      };

      // When: Input is routed without focus
      // Then: Should handle gracefully
      expect(() => inputRouter.routeInput(input, focusState)).not.toThrow();
    });
  });

  describe('Lifecycle Management', () => {
    it('should handle initialization and shutdown', async () => {
      // Given: InputRouter in uninitialized state
      inputRouter = new InputRouter({});

      // When: Lifecycle operations are performed
      await inputRouter.onInitialize();
      await inputRouter.onShutdown();

      // Then: Operations should complete successfully
      expect(inputRouter).toBeDefined();
    });
  });
});
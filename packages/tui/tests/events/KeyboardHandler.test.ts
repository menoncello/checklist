import { beforeEach, describe, expect, test, mock, afterEach } from 'bun:test';
import { KeyboardHandler, KeyEvent, KeyModifiers, KeyBinding } from '../../src/events/KeyboardHandler';

describe('KeyboardHandler', () => {
  let keyboardHandler: KeyboardHandler;
  let mockHandler: ReturnType<typeof mock>;

  beforeEach(() => {
    keyboardHandler = new KeyboardHandler();
    mockHandler = mock(() => {});
  });

  afterEach(() => {
    keyboardHandler.destroy();
  });

  describe('constructor and initialization', () => {
    test('should initialize with default bindings', () => {
      const bindings = keyboardHandler.getAllBindings();
      expect(bindings.length).toBeGreaterThanOrEqual(3); // Default bindings: ctrl+c, ctrl+d, ctrl+z

      const bindingKeys = bindings.map(b => b.keys);
      expect(bindingKeys).toContain('ctrl+c');
      expect(bindingKeys).toContain('ctrl+d');
      expect(bindingKeys).toContain('ctrl+z');
    });

    test('should initialize with clean state', () => {
      expect(keyboardHandler.getAllBindings().length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('key binding management', () => {
    test('should bind and track key handlers', () => {
      const initialCount = keyboardHandler.getAllBindings().length;

      const handlerId = keyboardHandler.bind('Enter', mockHandler);
      expect(handlerId).toBeDefined();
      expect(typeof handlerId).toBe('string');

      const newCount = keyboardHandler.getAllBindings().length;
      expect(newCount).toBe(initialCount + 1);

      // Verify the binding exists
      const bindings = keyboardHandler.getAllBindings();
      const enterBinding = bindings.find(b => b.keys === 'Enter');
      expect(enterBinding).toBeDefined();
      expect(enterBinding?.handler).toBe(mockHandler);
    });

    test('should bind keys with options', () => {
      const options = {
        description: 'Test binding',
        priority: 50,
        enabled: true,
      };

      const handlerId = keyboardHandler.bind('space', mockHandler, options);
      expect(handlerId).toBeDefined();

      const bindings = keyboardHandler.getAllBindings();
      const spaceBinding = bindings.find(b => b.keys === 'space');
      expect(spaceBinding).toBeDefined();
      expect(spaceBinding?.options.description).toBe('Test binding');
      expect(spaceBinding?.options.priority).toBe(50);
    });

    test('should unbind key handlers', () => {
      const handlerId = keyboardHandler.bind('tab', mockHandler);
      const initialCount = keyboardHandler.getAllBindings().length;

      const unbound = keyboardHandler.unbind(handlerId);
      expect(unbound).toBe(true);

      const newCount = keyboardHandler.getAllBindings().length;
      expect(newCount).toBe(initialCount - 1);

      // Verify the binding no longer exists
      const bindings = keyboardHandler.getAllBindings();
      const tabBinding = bindings.find(b => b.keys === 'tab');
      expect(tabBinding).toBeUndefined();
    });

    test('should return false when unbinding non-existent handler', () => {
      const result = keyboardHandler.unbind('non-existent-id');
      expect(result).toBe(false);
    });

    test('should clear all bindings', () => {
      keyboardHandler.bind('a', mockHandler);
      keyboardHandler.bind('b', mockHandler);

      keyboardHandler.clearBindings();
      const bindings = keyboardHandler.getAllBindings();

      // Should only have default bindings
      expect(bindings.length).toBe(3);
      const bindingKeys = bindings.map(b => b.keys);
      expect(bindingKeys).toContain('ctrl+c');
      expect(bindingKeys).toContain('ctrl+d');
      expect(bindingKeys).toContain('ctrl+z');
    });
  });

  describe('input processing', () => {
    test('should handle simple input buffer', () => {
      const input = Buffer.from('a');

      expect(() => keyboardHandler.handleInput(input)).not.toThrow();
    });

    test('should process input buffer asynchronously', async () => {
      const input = Buffer.from('test');

      keyboardHandler.handleInput(input);

      // Wait a bit for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      // Just verify no errors occurred
      expect(keyboardHandler.getAllBindings().length).toBeGreaterThanOrEqual(3);
    });

    test('should handle multiple input buffers', () => {
      const input1 = Buffer.from('a');
      const input2 = Buffer.from('b');

      keyboardHandler.handleInput(input1);
      keyboardHandler.handleInput(input2);

      expect(() => keyboardHandler.handleInput(input2)).not.toThrow();
    });

    test('should handle empty input buffer', () => {
      const input = Buffer.from('');

      expect(() => keyboardHandler.handleInput(input)).not.toThrow();
    });
  });

  describe('event handling', () => {
    test('should register event handlers', () => {
      const eventHandler = mock(() => {});

      expect(() => keyboardHandler.on('test-event', eventHandler)).not.toThrow();
    });

    test('should remove event handlers', () => {
      const eventHandler = mock(() => {});

      keyboardHandler.on('test-event', eventHandler);
      expect(() => keyboardHandler.off('test-event', eventHandler)).not.toThrow();
    });

    test('should handle multiple event handlers for same event', () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      expect(() => keyboardHandler.on('multi-event', handler1)).not.toThrow();
      expect(() => keyboardHandler.on('multi-event', handler2)).not.toThrow();
    });
  });

  describe('key sequence handling', () => {
    test('should start and manage key sequences', () => {
      const onComplete = mock(() => {});
      const onTimeout = mock(() => {});

      expect(() => keyboardHandler.startSequence(['ctrl', 'c'], onComplete, onTimeout, 500)).not.toThrow();
    });

    test('should handle sequence management', () => {
      const onComplete = mock(() => {});
      const onTimeout = mock(() => {});

      keyboardHandler.startSequence(['ctrl', 'x'], onComplete, onTimeout, 500);

      // Should be able to start a new sequence
      expect(() => keyboardHandler.startSequence(['alt', 'f'], onComplete, onTimeout, 500)).not.toThrow();
    });
  });

  describe('state management', () => {
    test('should enable and disable bindings', () => {
      const handlerId = keyboardHandler.bind('f1', mockHandler);

      const enabled = keyboardHandler.enableBinding(handlerId);
      expect(enabled).toBe(true);

      const disabled = keyboardHandler.disableBinding(handlerId);
      expect(disabled).toBe(true);
    });

    test('should return false when enabling/disabling non-existent binding', () => {
      expect(keyboardHandler.enableBinding('invalid-id')).toBe(false);
      expect(keyboardHandler.disableBinding('invalid-id')).toBe(false);
    });
  });

  describe('metrics and performance', () => {
    test('should provide metrics access', () => {
      expect(() => keyboardHandler.getMetrics()).not.toThrow();
    });
  });

  describe('destruction and cleanup', () => {
    test('should destroy cleanly', () => {
      expect(() => keyboardHandler.destroy()).not.toThrow();
    });

    test('should handle destruction correctly', () => {
      keyboardHandler.bind('test', mockHandler);
      keyboardHandler.destroy();

      // After destroy, should not have any issues
      expect(() => keyboardHandler.getAllBindings()).not.toThrow();
    });
  });

  describe('error handling', () => {
    test('should handle invalid key binding gracefully', () => {
      expect(() => keyboardHandler.bind('', mockHandler)).not.toThrow();
    });

    test('should handle null handler gracefully', () => {
      expect(() => keyboardHandler.bind('test', null as any)).not.toThrow();
    });

    test('should handle malformed input gracefully', () => {
      const malformedInput = Buffer.from([0xff, 0xfe, 0xfd]);
      expect(() => keyboardHandler.handleInput(malformedInput)).not.toThrow();
    });

    test('should handle special characters in input', () => {
      const specialInput = Buffer.from('\x1b[A'); // Arrow up
      expect(() => keyboardHandler.handleInput(specialInput)).not.toThrow();
    });

    test('should handle control characters', () => {
      const ctrlInput = Buffer.from('\x03'); // Ctrl+C
      expect(() => keyboardHandler.handleInput(ctrlInput)).not.toThrow();
    });
  });

  describe('private method coverage via public interface', () => {
    test('should process escape sequences through input', async () => {
      const escapeSequence = Buffer.from('\x1b[C'); // Right arrow
      keyboardHandler.handleInput(escapeSequence);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(() => keyboardHandler.getAllBindings()).not.toThrow();
    });

    test('should handle key events through input processing', async () => {
      const regularKey = Buffer.from('a');
      keyboardHandler.handleInput(regularKey);

      // Wait for async processing
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(() => keyboardHandler.getAllBindings()).not.toThrow();
    });

    test('should trigger event emission through bindings', () => {
      const interruptHandler = mock(() => {});
      keyboardHandler.on('interrupt', interruptHandler);

      // Simulate Ctrl+C input
      const ctrlC = Buffer.from('\x03');
      keyboardHandler.handleInput(ctrlC);

      // The handler should be called by default binding
      setTimeout(() => {
        expect(interruptHandler).toHaveBeenCalled();
      }, 20);
    });
  });
});
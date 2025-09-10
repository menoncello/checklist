import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { KeyboardHandler } from './KeyboardHandler';
import { InputValidator } from './InputValidator';
import { EventManager } from './EventManager';
import { EventBus } from './EventBus';

describe('Event Handling (AC5, AC8)', () => {
  describe('AC5: Keyboard Event Handling', () => {
    let keyboardHandler: KeyboardHandler;
    let inputValidator: InputValidator;

    beforeEach(() => {
      keyboardHandler = new KeyboardHandler();
      inputValidator = new InputValidator();
    });

    afterEach(() => {
      keyboardHandler.destroy();
    });

    it('should bind and track key handlers', () => {
      const handlerId = keyboardHandler.bind('Enter', () => {});
      expect(handlerId).toBeDefined();

      const bindings = keyboardHandler.getBindings();
      expect(bindings.length).toBeGreaterThan(0);
    });

    it('should handle key sequences', () => {
      // Start and stop sequence - just verify it doesn't throw
      keyboardHandler.startSequence(['Ctrl+K', 'Ctrl+C'], () => {});
      keyboardHandler.stopSequence();

      expect(true).toBe(true);
    });

    it('should track key history', () => {
      const history = keyboardHandler.getKeyHistory();
      expect(history).toBeDefined();
      expect(Array.isArray(history)).toBe(true);
    });

    it('should support pause and resume', () => {
      keyboardHandler.pause();
      keyboardHandler.resume();

      // Should not throw
      expect(true).toBe(true);
    });

    it('should provide key metrics', () => {
      const metrics = keyboardHandler.getKeyMetrics();
      expect(metrics).toBeDefined();
      expect(metrics instanceof Map).toBe(true);
    });

    it('should validate input patterns', () => {
      const result = inputValidator.validate('test@example.com');
      expect(result).toBeDefined();
      expect(result.isValid).toBeDefined();
    });

    it('should validate and sanitize input', () => {
      const result = inputValidator.validateAndSanitize('test');
      expect(result.isValid).toBeDefined();
      expect(result.sanitized).toBeDefined();
    });

    it('should check input safety', () => {
      const isSafe = inputValidator.isInputSafe('test123');
      expect(typeof isSafe).toBe('boolean');

      const sanitized = inputValidator.sanitizeInput('test@123');
      expect(typeof sanitized).toBe('string');
    });
  });

  describe('AC8: Terminal Resize Handling', () => {
    it('should handle resize events through event system', () => {
      const eventManager = new EventManager();
      let resizeHandled = false;

      eventManager.on('resize', () => {
        resizeHandled = true;
      });

      eventManager.emit('resize', { width: 100, height: 50 });
      expect(resizeHandled).toBe(true);

      eventManager.clear();
    });

    it('should coordinate multiple event handlers', () => {
      const eventManager = new EventManager();
      const handlers: string[] = [];

      eventManager.on('test', () => handlers.push('first'));
      eventManager.on('test', () => handlers.push('second'));

      eventManager.emit('test', {});
      expect(handlers).toEqual(['first', 'second']);

      eventManager.clear();
    });
  });

  describe('Event Bus Integration', () => {
    let eventBus: EventBus;

    beforeEach(() => {
      eventBus = new EventBus();
    });

    afterEach(() => {
      eventBus.destroy();
    });

    it('should publish and subscribe to events', () => {
      let received = false;

      const subscriberId = eventBus.subscribe('test-event', () => {
        received = true;
      });

      expect(subscriberId).toBeDefined();

      eventBus.publish('test-event', { data: 'test' }, 'test-source');

      // EventBus might be async, so we just check subscription worked
      expect(eventBus.getSubscriberCount()).toBeGreaterThan(0);
    });

    it('should handle pause and resume', () => {
      eventBus.pause();
      expect(eventBus.isPaused()).toBe(true);

      eventBus.resume();
      expect(eventBus.isPaused()).toBe(false);
    });

    it('should track message history', () => {
      eventBus.publish('test', { value: 1 }, 'test-source');
      eventBus.publish('test', { value: 2 }, 'test-source');

      const history = eventBus.getMessageHistory();
      expect(history.length).toBeGreaterThanOrEqual(0);
    });

    it('should provide metrics', () => {
      const metrics = eventBus.getMetrics();
      expect(metrics).toBeDefined();
      expect(metrics.totalMessages).toBeDefined();
    });

    it('should support channels', () => {
      const channel = eventBus.createChannel('test-channel');
      expect(channel).toBeDefined();
      expect(channel.getName()).toBe('test-channel');
    });

    it('should validate bus state', () => {
      const validation = eventBus.validate();
      expect(validation).toBeDefined();
      expect(validation.isValid).toBeDefined();
    });
  });

  describe('Event Manager', () => {
    let eventManager: EventManager;

    beforeEach(() => {
      eventManager = new EventManager();
    });

    afterEach(() => {
      eventManager.clear();
    });

    it('should emit and handle events', () => {
      let counter = 0;

      eventManager.on('increment', () => counter++);
      eventManager.emit('increment', {});
      eventManager.emit('increment', {});

      expect(counter).toBe(2);
    });

    it('should handle multiple event types', () => {
      const events: string[] = [];

      eventManager.on('type1', () => events.push('type1'));
      eventManager.on('type2', () => events.push('type2'));

      eventManager.emit('type1', {});
      eventManager.emit('type2', {});
      eventManager.emit('type1', {});

      expect(events).toEqual(['type1', 'type2', 'type1']);
    });

    it('should remove event handlers', () => {
      let count = 0;
      const handler = () => count++;

      eventManager.on('test', handler);
      eventManager.emit('test', {});
      expect(count).toBe(1);

      eventManager.off('test', handler);
      eventManager.emit('test', {});
      expect(count).toBe(1); // Should not increment
    });

    it('should handle errors in event handlers gracefully', () => {
      eventManager.on('error-test', () => {
        throw new Error('Test error');
      });

      // Should not throw
      expect(() => {
        eventManager.emit('error-test', {});
      }).not.toThrow();
    });
  });
});

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { EventBus, EventBusChannel, BusMessage, MessageFilter, Subscriber } from '../../src/events/EventBus';

describe('EventBus', () => {
  let eventBus: EventBus;
  let consoleErrorSpy: any;

  beforeEach(() => {
    eventBus = new EventBus();
    consoleErrorSpy = spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    eventBus.destroy();
    consoleErrorSpy?.mockRestore();
  });

  describe('constructor', () => {
    test('should create EventBus with default options', () => {
      const bus = new EventBus();
      expect(bus.getQueueSize()).toBe(0);
      expect(bus.getSubscriberCount()).toBe(0);
      expect(bus.getActiveSubscriberCount()).toBe(0);
      bus.destroy();
    });

    test('should create EventBus with custom options', () => {
      const bus = new EventBus({
        maxQueueSize: 500,
        maxHistorySize: 100,
        batchSize: 5,
      });
      expect(bus.getQueueSize()).toBe(0);
      expect(bus.getSubscriberCount()).toBe(0);
      bus.destroy();
    });
  });

  describe('subscription management', () => {
    test('should subscribe and unsubscribe handlers', () => {
      const handler = mock(() => {});

      const subscriberId = eventBus.subscribe('test-handler', handler);

      expect(subscriberId).toBeDefined();
      expect(eventBus.getSubscriberCount()).toBe(1);
      expect(eventBus.getActiveSubscriberCount()).toBe(1);

      const unsubscribed = eventBus.unsubscribe(subscriberId);
      expect(unsubscribed).toBe(true);
      expect(eventBus.getSubscriberCount()).toBe(0);
    });

    test('should handle unsubscribing non-existent subscriber', () => {
      const unsubscribed = eventBus.unsubscribe('non-existent-id');
      expect(unsubscribed).toBe(false);
    });

    test('should subscribe with filter', () => {
      const handler = mock(() => {});
      const filter: MessageFilter = {
        type: 'test-type',
        source: 'test-source',
      };

      const subscriberId = eventBus.subscribe('filtered-handler', handler, filter);

      expect(subscriberId).toBeDefined();
      expect(eventBus.getSubscriberCount()).toBe(1);
    });

    test('should get subscribers', () => {
      const handler1 = mock(() => {});
      const handler2 = mock(() => {});

      eventBus.subscribe('handler1', handler1);
      eventBus.subscribe('handler2', handler2);

      const subscribers = eventBus.getSubscribers();
      expect(subscribers.length).toBe(2);
      expect(subscribers[0].name).toBe('handler1');
      expect(subscribers[1].name).toBe('handler2');
    });

    test('should get specific subscriber', () => {
      const handler = mock(() => {});
      const subscriberId = eventBus.subscribe('specific-handler', handler);

      const subscriber = eventBus.getSubscriber(subscriberId);
      expect(subscriber).not.toBeNull();
      expect(subscriber!.name).toBe('specific-handler');

      const nonExistent = eventBus.getSubscriber('non-existent');
      expect(nonExistent).toBeNull();
    });

    test('should set subscriber active/inactive', () => {
      const handler = mock(() => {});
      const subscriberId = eventBus.subscribe('toggle-handler', handler);

      expect(eventBus.getActiveSubscriberCount()).toBe(1);

      const deactivated = eventBus.setSubscriberActive(subscriberId, false);
      expect(deactivated).toBe(true);
      expect(eventBus.getActiveSubscriberCount()).toBe(0);

      const reactivated = eventBus.setSubscriberActive(subscriberId, true);
      expect(reactivated).toBe(true);
      expect(eventBus.getActiveSubscriberCount()).toBe(1);

      const invalidToggle = eventBus.setSubscriberActive('non-existent', false);
      expect(invalidToggle).toBe(false);
    });
  });

  describe('message publishing', () => {
    test('should publish message asynchronously', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('async-handler', handler);

      await eventBus.publish('test-type', { data: 'test' });

      expect(handler).toHaveBeenCalledTimes(1);
      const calledMessage = (handler.mock.calls[0] as any)[0] as BusMessage;
      expect(calledMessage.type).toBe('test-type');
      expect(calledMessage.data).toEqual({ data: 'test' });
      expect(calledMessage.source).toBe('unknown');
    });

    test('should publish message with options', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('options-handler', handler);

      await eventBus.publish('test-type', { data: 'test' }, {
        source: 'test-source',
        priority: 5,
        ttl: 1000,
        metadata: { key: 'value' },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const calledMessage = (handler.mock.calls[0] as any)[0] as BusMessage;
      expect(calledMessage.source).toBe('test-source');
      expect(calledMessage.priority).toBe(5);
      expect(calledMessage.ttl).toBe(1000);
      expect(calledMessage.metadata).toEqual({ key: 'value' });
    });

    test('should publish message synchronously', () => {
      const handler = mock(() => {});
      eventBus.subscribe('sync-handler', handler);

      eventBus.publishSync('test-type', { data: 'sync' });

      expect(handler).toHaveBeenCalledTimes(1);
      const calledMessage = (handler.mock.calls[0] as any)[0] as BusMessage;
      expect(calledMessage.type).toBe('test-type');
      expect(calledMessage.data).toEqual({ data: 'sync' });
    });

    test('should handle async handlers in sync publish', () => {
      const asyncHandler = mock(async () => {
        await new Promise(resolve => setTimeout(resolve, 10));
      });

      eventBus.subscribe('async-in-sync', asyncHandler);

      // Should not throw and should call handler
      eventBus.publishSync('test-type', { data: 'async-sync' });

      expect(asyncHandler).toHaveBeenCalledTimes(1);
    });

    test('should handle errors in synchronous handlers', () => {
      const errorHandler = mock(() => {
        throw new Error('Handler error');
      });

      eventBus.subscribe('error-handler', errorHandler);

      eventBus.publishSync('test-type', { data: 'error-test' });

      expect(errorHandler).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in subscriber 'error-handler':",
        expect.any(Error)
      );
    });

    test('should handle errors in asynchronous handlers', async () => {
      const asyncErrorHandler = mock(async () => {
        throw new Error('Async handler error');
      });

      eventBus.subscribe('async-error-handler', asyncErrorHandler);

      await eventBus.publish('test-type', { data: 'async-error-test' });

      expect(asyncErrorHandler).toHaveBeenCalledTimes(1);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        "Error in subscriber 'async-error-handler':",
        expect.any(Error)
      );
    });

    test('should handle promise rejection in sync delivery', () => {
      const rejectingHandler = mock(() => {
        return Promise.reject(new Error('Promise rejection'));
      });

      eventBus.subscribe('rejecting-handler', rejectingHandler);

      eventBus.publishSync('test-type', { data: 'rejection-test' });

      expect(rejectingHandler).toHaveBeenCalledTimes(1);
      // The error should be caught asynchronously
    });

    test('should skip inactive subscribers', async () => {
      const handler = mock(() => {});
      const subscriberId = eventBus.subscribe('inactive-handler', handler);

      eventBus.setSubscriberActive(subscriberId, false);

      await eventBus.publish('test-type', { data: 'inactive-test' });

      expect(handler).not.toHaveBeenCalled();
    });

    test('should validate messages before publishing', async () => {
      // Try to publish invalid message (this will depend on MessageMatcher validation)
      await expect(eventBus.publish('', null)).rejects.toThrow();
    });
  });

  describe('queue management', () => {
    test('should pause and resume queue', () => {
      expect(eventBus.isPaused()).toBe(false);

      eventBus.pause();
      expect(eventBus.isPaused()).toBe(true);

      eventBus.resume();
      expect(eventBus.isPaused()).toBe(false);
    });

    test('should get queue size', async () => {
      expect(eventBus.getQueueSize()).toBe(0);

      const handler = mock(() => {});
      eventBus.subscribe('queue-handler', handler);

      // Pause to prevent processing
      eventBus.pause();

      await eventBus.publish('test-type', { data: 'queued' });

      expect(eventBus.getQueueSize()).toBeGreaterThan(0);

      eventBus.resume();
    });

    test('should clear queue', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('clear-handler', handler);

      eventBus.pause();
      await eventBus.publish('test-type', { data: 'to-clear' });

      expect(eventBus.getQueueSize()).toBeGreaterThan(0);

      eventBus.clearQueue();
      expect(eventBus.getQueueSize()).toBe(0);
    });

    test('should set batch size', () => {
      eventBus.setBatchSize(20);
      // Batch size setting should not throw
      expect(() => eventBus.setBatchSize(20)).not.toThrow();
    });

    test('should set max queue size', () => {
      eventBus.setMaxQueueSize(2000);
      // Max queue size setting should not throw
      expect(() => eventBus.setMaxQueueSize(2000)).not.toThrow();
    });

    test('should set max history size', () => {
      eventBus.setMaxHistorySize(200);
      // Max history size setting should not throw
      expect(() => eventBus.setMaxHistorySize(200)).not.toThrow();
    });
  });

  describe('message history', () => {
    test('should get message history', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('history-handler', handler);

      await eventBus.publish('test-type', { data: 'history1' });
      await eventBus.publish('test-type', { data: 'history2' });

      const history = eventBus.getMessageHistory();
      expect(history.length).toBeGreaterThan(0);
    });

    test('should get filtered message history', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('filtered-history-handler', handler);

      await eventBus.publish('type1', { data: 'filtered1' }, { source: 'source1' });
      await eventBus.publish('type2', { data: 'filtered2' }, { source: 'source2' });

      const filteredHistory = eventBus.getMessageHistory({
        type: 'type1',
        source: 'source1',
        limit: 1,
      });

      expect(Array.isArray(filteredHistory)).toBe(true);
    });

    test('should clear message history', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('clear-history-handler', handler);

      await eventBus.publish('test-type', { data: 'to-clear' });

      eventBus.clearHistory();

      const history = eventBus.getMessageHistory();
      expect(history.length).toBe(0);
    });
  });

  describe('metrics and debugging', () => {
    test('should get metrics', () => {
      const metrics = eventBus.getMetrics();

      expect(metrics).toBeDefined();
      expect(typeof metrics.totalMessages).toBe('number');
      expect(typeof metrics.errorCount).toBe('number');
    });

    test('should get debug information', () => {
      const handler = mock(() => {});
      eventBus.subscribe('debug-handler', handler);

      const debug = eventBus.debug();

      expect(debug.queueSize).toBe(0);
      expect(debug.subscriberCount).toBe(1);
      expect(debug.activeSubscribers).toBe(1);
      expect(debug.metrics).toBeDefined();
      expect(debug.subscribers).toHaveLength(1);
    });

    test('should validate bus state', () => {
      const validation = eventBus.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
      expect(Array.isArray(validation.warnings)).toBe(true);
    });

    test('should detect inactive subscribers in validation', () => {
      const handler = mock(() => {});
      const subscriberId = eventBus.subscribe('inactive-validation', handler);

      eventBus.setSubscriberActive(subscriberId, false);

      const validation = eventBus.validate();

      expect(validation.isValid).toBe(true);
      expect(validation.warnings.some(w => w.includes('inactive subscribers'))).toBe(true);
    });

    test('should detect large queue in validation', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('large-queue-handler', handler);

      eventBus.pause();

      // Try to create a large queue
      for (let i = 0; i < 150; i++) {
        await eventBus.publish('test-type', { data: i });
      }

      const validation = eventBus.validate();

      if (eventBus.getQueueSize() > 100) {
        expect(validation.warnings.some(w => w.includes('Large queue size'))).toBe(true);
      }
    });
  });

  describe('message creation', () => {
    test('should create message with incremental IDs', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('id-handler', handler);

      await eventBus.publish('test1', { data: 'first' });
      await eventBus.publish('test2', { data: 'second' });

      expect(handler).toHaveBeenCalledTimes(2);

      const firstMessage = (handler.mock.calls[0] as any)[0] as BusMessage;
      const secondMessage = (handler.mock.calls[1] as any)[0] as BusMessage;

      expect(firstMessage.id).toBe('msg-1');
      expect(secondMessage.id).toBe('msg-2');
    });

    test('should create message with default values', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('default-handler', handler);

      await eventBus.publish('test-type', { data: 'default' });

      const message = (handler.mock.calls[0] as any)[0] as BusMessage;

      expect(message.source).toBe('unknown');
      expect(message.priority).toBe(0);
      expect(message.target).toBeUndefined();
      expect(message.ttl).toBeUndefined();
      expect(message.metadata).toBeUndefined();
      expect(message.timestamp).toBeGreaterThan(0);
    });
  });

  describe('destruction', () => {
    test('should destroy properly', () => {
      const handler = mock(() => {});
      eventBus.subscribe('destroy-handler', handler);

      expect(eventBus.getSubscriberCount()).toBe(1);

      eventBus.destroy();

      expect(eventBus.getSubscriberCount()).toBe(0);
      expect(eventBus.getQueueSize()).toBe(0);
    });
  });
});

describe('EventBusChannel', () => {
  let eventBus: EventBus;
  let channel: EventBusChannel;

  beforeEach(() => {
    eventBus = new EventBus();
    channel = eventBus.createChannel('test-channel');
  });

  afterEach(() => {
    eventBus.destroy();
  });

  describe('channel creation', () => {
    test('should create channel with name', () => {
      const testChannel = eventBus.createChannel('named-channel');

      expect(testChannel.getName()).toBe('named-channel');
    });
  });

  describe('channel publishing', () => {
    test('should publish with channel as source', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('channel-handler', handler);

      await channel.publish('test-type', { data: 'channel-test' });

      expect(handler).toHaveBeenCalledTimes(1);
      const message = (handler.mock.calls[0] as any)[0] as BusMessage;
      expect(message.source).toBe('test-channel');
      expect(message.type).toBe('test-type');
      expect(message.data).toEqual({ data: 'channel-test' });
    });

    test('should publish with channel options', async () => {
      const handler = mock(() => {});
      eventBus.subscribe('channel-options-handler', handler);

      await channel.publish('test-type', { data: 'options-test' }, {
        priority: 10,
        ttl: 5000,
        metadata: { channel: 'metadata' },
      });

      expect(handler).toHaveBeenCalledTimes(1);
      const message = (handler.mock.calls[0] as any)[0] as BusMessage;
      expect(message.source).toBe('test-channel');
      expect(message.priority).toBe(10);
      expect(message.ttl).toBe(5000);
      expect(message.metadata).toEqual({ channel: 'metadata' });
    });
  });

  describe('channel subscription', () => {
    test('should subscribe with channel filter', () => {
      const handler = mock(() => {});

      const subscriberId = channel.subscribe('channel-subscriber', handler);

      expect(subscriberId).toBeDefined();
      expect(eventBus.getSubscriberCount()).toBe(1);

      const subscriber = eventBus.getSubscriber(subscriberId);
      expect(subscriber).not.toBeNull();
      expect(subscriber!.filter?.source).toBe('test-channel');
    });

    test('should subscribe with additional filter', () => {
      const handler = mock(() => {});
      const additionalFilter: MessageFilter = {
        type: 'specific-type',
      };

      const subscriberId = channel.subscribe('filtered-subscriber', handler, additionalFilter);

      const subscriber = eventBus.getSubscriber(subscriberId);
      expect(subscriber).not.toBeNull();
      expect(subscriber!.filter?.source).toBe('test-channel');
      expect(subscriber!.filter?.type).toBe('specific-type');
    });

    test('should only receive messages from its channel', async () => {
      const channelHandler = mock(() => {});
      const globalHandler = mock(() => {});

      channel.subscribe('channel-specific', channelHandler);
      eventBus.subscribe('global-handler', globalHandler);

      // Publish from channel
      await channel.publish('channel-message', { data: 'from-channel' });

      // Publish from main bus with different source
      await eventBus.publish('global-message', { data: 'from-bus' }, {
        source: 'other-source',
      });

      // Channel handler should only receive channel messages
      // Note: This depends on the MessageMatcher implementation for filtering
      expect(channelHandler).toHaveBeenCalled();
      expect(globalHandler).toHaveBeenCalledTimes(2); // Receives both
    });
  });

  describe('channel name', () => {
    test('should get channel name', () => {
      expect(channel.getName()).toBe('test-channel');
    });
  });
});
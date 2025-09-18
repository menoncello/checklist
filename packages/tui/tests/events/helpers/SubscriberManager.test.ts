import { test, expect, beforeEach, afterEach, describe } from 'bun:test';
import {
  SubscriberManager,
  Subscriber,
  MessageFilter,
} from '../../../src/events/helpers/SubscriberManager';
import { BusMessage } from '../../../src/events/helpers/MessageQueue';

describe('SubscriberManager', () => {
  let subscriberManager: SubscriberManager;
  let mockHandler: (message: BusMessage) => void;
  let asyncMockHandler: (message: BusMessage) => Promise<void>;

  beforeEach(() => {
    subscriberManager = new SubscriberManager();
    mockHandler = (message: BusMessage) => {
      // Mock synchronous handler
    };
    asyncMockHandler = async (message: BusMessage) => {
      // Mock async handler
    };
  });

  afterEach(() => {
    subscriberManager.clear();
  });

  describe('subscribe', () => {
    test('should create a subscriber with basic information', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);

      expect(id).toMatch(/^sub-\d+$/);

      const subscriber = subscriberManager.getSubscriber(id);
      expect(subscriber).toBeDefined();
      expect(subscriber!.id).toBe(id);
      expect(subscriber!.name).toBe('test-subscriber');
      expect(subscriber!.handler).toBe(mockHandler);
      expect(subscriber!.active).toBe(true);
      expect(subscriber!.messagesReceived).toBe(0);
      expect(subscriber!.subscribed).toBeGreaterThan(0);
      expect(subscriber!.lastMessage).toBeUndefined();
      expect(subscriber!.filter).toBeUndefined();
    });

    test('should create subscriber with filter', () => {
      const filter: MessageFilter = {
        type: 'test-type',
        source: 'test-source',
        priority: { min: 1, max: 5 },
      };

      const id = subscriberManager.subscribe('filtered-subscriber', mockHandler, filter);
      const subscriber = subscriberManager.getSubscriber(id);

      expect(subscriber!.filter).toEqual(filter);
    });

    test('should create subscriber with async handler', () => {
      const id = subscriberManager.subscribe('async-subscriber', asyncMockHandler);
      const subscriber = subscriberManager.getSubscriber(id);

      expect(subscriber!.handler).toBe(asyncMockHandler);
    });

    test('should generate unique IDs for multiple subscribers', () => {
      const id1 = subscriberManager.subscribe('sub1', mockHandler);
      const id2 = subscriberManager.subscribe('sub2', mockHandler);
      const id3 = subscriberManager.subscribe('sub3', mockHandler);

      expect(id1).not.toBe(id2);
      expect(id2).not.toBe(id3);
      expect(id1).not.toBe(id3);
    });
  });

  describe('unsubscribe', () => {
    test('should remove an existing subscriber', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);
      expect(subscriberManager.getSubscriber(id)).toBeDefined();

      const result = subscriberManager.unsubscribe(id);
      expect(result).toBe(true);
      expect(subscriberManager.getSubscriber(id)).toBeNull();
    });

    test('should return false for non-existent subscriber', () => {
      const result = subscriberManager.unsubscribe('non-existent-id');
      expect(result).toBe(false);
    });
  });

  describe('getSubscriber', () => {
    test('should return subscriber for valid ID', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);
      const subscriber = subscriberManager.getSubscriber(id);

      expect(subscriber).toBeDefined();
      expect(subscriber!.id).toBe(id);
    });

    test('should return null for invalid ID', () => {
      const subscriber = subscriberManager.getSubscriber('invalid-id');
      expect(subscriber).toBeNull();
    });
  });

  describe('getAllSubscribers', () => {
    test('should return empty array when no subscribers', () => {
      const subscribers = subscriberManager.getAllSubscribers();
      expect(subscribers).toEqual([]);
    });

    test('should return all subscribers', () => {
      const id1 = subscriberManager.subscribe('sub1', mockHandler);
      const id2 = subscriberManager.subscribe('sub2', mockHandler);

      const subscribers = subscriberManager.getAllSubscribers();
      expect(subscribers).toHaveLength(2);

      const ids = subscribers.map(s => s.id);
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
    });
  });

  describe('getActiveSubscribers', () => {
    test('should return only active subscribers', () => {
      const id1 = subscriberManager.subscribe('active-sub', mockHandler);
      const id2 = subscriberManager.subscribe('inactive-sub', mockHandler);

      subscriberManager.setSubscriberActive(id2, false);

      const activeSubscribers = subscriberManager.getActiveSubscribers();
      expect(activeSubscribers).toHaveLength(1);
      expect(activeSubscribers[0].id).toBe(id1);
      expect(activeSubscribers[0].active).toBe(true);
    });

    test('should return empty array when no active subscribers', () => {
      const id1 = subscriberManager.subscribe('sub1', mockHandler);
      const id2 = subscriberManager.subscribe('sub2', mockHandler);

      subscriberManager.setSubscriberActive(id1, false);
      subscriberManager.setSubscriberActive(id2, false);

      const activeSubscribers = subscriberManager.getActiveSubscribers();
      expect(activeSubscribers).toEqual([]);
    });
  });

  describe('setSubscriberActive', () => {
    test('should set subscriber active state', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);

      const result1 = subscriberManager.setSubscriberActive(id, false);
      expect(result1).toBe(true);
      expect(subscriberManager.getSubscriber(id)!.active).toBe(false);

      const result2 = subscriberManager.setSubscriberActive(id, true);
      expect(result2).toBe(true);
      expect(subscriberManager.getSubscriber(id)!.active).toBe(true);
    });

    test('should return false for non-existent subscriber', () => {
      const result = subscriberManager.setSubscriberActive('invalid-id', false);
      expect(result).toBe(false);
    });
  });

  describe('getTargetSubscribers', () => {
    test('should return matching subscribers based on filters and targets', () => {
      const message: BusMessage = {
        id: 'msg-1',
        type: 'test-type',
        data: { test: true },
        source: 'test-source',
        target: 'specific-subscriber',
        timestamp: Date.now(),
        priority: 1,
      };

      const filter: MessageFilter = {
        type: 'test-type',
        source: 'test-source',
      };

      const id1 = subscriberManager.subscribe('specific-subscriber', mockHandler, filter);
      const id2 = subscriberManager.subscribe('other-subscriber', mockHandler);

      const filterMatcher = (msg: BusMessage, msgFilter?: MessageFilter) => {
        if (!msgFilter) return true;
        return msgFilter.type === msg.type && msgFilter.source === msg.source;
      };

      const targetMatcher = (msg: BusMessage, subId: string, subName: string) => {
        return msg.target === subName;
      };

      const targetSubscribers = subscriberManager.getTargetSubscribers(
        message,
        filterMatcher,
        targetMatcher
      );

      expect(targetSubscribers).toHaveLength(1);
      expect(targetSubscribers[0].id).toBe(id1);
      expect(targetSubscribers[0].name).toBe('specific-subscriber');
    });

    test('should exclude inactive subscribers', () => {
      const message: BusMessage = {
        id: 'msg-1',
        type: 'test-type',
        data: {},
        source: 'test-source',
        timestamp: Date.now(),
        priority: 1,
      };

      const id1 = subscriberManager.subscribe('active-sub', mockHandler);
      const id2 = subscriberManager.subscribe('inactive-sub', mockHandler);

      subscriberManager.setSubscriberActive(id2, false);

      const filterMatcher = () => true;
      const targetMatcher = () => true;

      const targetSubscribers = subscriberManager.getTargetSubscribers(
        message,
        filterMatcher,
        targetMatcher
      );

      expect(targetSubscribers).toHaveLength(1);
      expect(targetSubscribers[0].id).toBe(id1);
    });

    test('should filter based on custom filter matcher', () => {
      const message: BusMessage = {
        id: 'msg-1',
        type: 'allowed-type',
        data: {},
        source: 'test-source',
        timestamp: Date.now(),
        priority: 1,
      };

      const allowedFilter: MessageFilter = { type: 'allowed-type' };
      const blockedFilter: MessageFilter = { type: 'blocked-type' };

      const id1 = subscriberManager.subscribe('allowed-sub', mockHandler, allowedFilter);
      const id2 = subscriberManager.subscribe('blocked-sub', mockHandler, blockedFilter);

      const filterMatcher = (msg: BusMessage, msgFilter?: MessageFilter) => {
        if (!msgFilter) return true;
        return msgFilter.type === msg.type;
      };

      const targetMatcher = () => true;

      const targetSubscribers = subscriberManager.getTargetSubscribers(
        message,
        filterMatcher,
        targetMatcher
      );

      expect(targetSubscribers).toHaveLength(1);
      expect(targetSubscribers[0].id).toBe(id1);
    });

    test('should return empty array when no matches', () => {
      const message: BusMessage = {
        id: 'msg-1',
        type: 'test-type',
        data: {},
        source: 'test-source',
        timestamp: Date.now(),
        priority: 1,
      };

      subscriberManager.subscribe('test-sub', mockHandler);

      const filterMatcher = () => false; // No matches
      const targetMatcher = () => true;

      const targetSubscribers = subscriberManager.getTargetSubscribers(
        message,
        filterMatcher,
        targetMatcher
      );

      expect(targetSubscribers).toEqual([]);
    });
  });

  describe('updateSubscriberStats', () => {
    test('should update message count and timestamp', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);
      const initialTime = Date.now();

      subscriberManager.updateSubscriberStats(id);

      const subscriber = subscriberManager.getSubscriber(id)!;
      expect(subscriber.messagesReceived).toBe(1);
      expect(subscriber.lastMessage).toBeGreaterThanOrEqual(initialTime);

      subscriberManager.updateSubscriberStats(id);
      expect(subscriber.messagesReceived).toBe(2);
    });

    test('should handle non-existent subscriber gracefully', () => {
      // Should not throw error
      subscriberManager.updateSubscriberStats('invalid-id');
    });
  });

  describe('getSubscriberCount', () => {
    test('should return correct count', () => {
      expect(subscriberManager.getSubscriberCount()).toBe(0);

      subscriberManager.subscribe('sub1', mockHandler);
      expect(subscriberManager.getSubscriberCount()).toBe(1);

      subscriberManager.subscribe('sub2', mockHandler);
      expect(subscriberManager.getSubscriberCount()).toBe(2);

      const id1 = subscriberManager.subscribe('sub3', mockHandler);
      subscriberManager.unsubscribe(id1);
      expect(subscriberManager.getSubscriberCount()).toBe(2);
    });
  });

  describe('getActiveSubscriberCount', () => {
    test('should return count of active subscribers only', () => {
      const id1 = subscriberManager.subscribe('sub1', mockHandler);
      const id2 = subscriberManager.subscribe('sub2', mockHandler);
      const id3 = subscriberManager.subscribe('sub3', mockHandler);

      expect(subscriberManager.getActiveSubscriberCount()).toBe(3);

      subscriberManager.setSubscriberActive(id2, false);
      expect(subscriberManager.getActiveSubscriberCount()).toBe(2);

      subscriberManager.setSubscriberActive(id3, false);
      expect(subscriberManager.getActiveSubscriberCount()).toBe(1);
    });
  });

  describe('getSubscriberStats', () => {
    test('should return correct statistics', () => {
      const id1 = subscriberManager.subscribe('sub1', mockHandler);
      const id2 = subscriberManager.subscribe('sub2', mockHandler);
      const id3 = subscriberManager.subscribe('sub3', mockHandler);

      subscriberManager.setSubscriberActive(id3, false);
      subscriberManager.updateSubscriberStats(id1);
      subscriberManager.updateSubscriberStats(id1);
      subscriberManager.updateSubscriberStats(id2);

      const stats = subscriberManager.getSubscriberStats();

      expect(stats.total).toBe(3);
      expect(stats.active).toBe(2);
      expect(stats.inactive).toBe(1);
      expect(stats.totalMessages).toBe(3);
      expect(stats.averageMessages).toBe(1); // 3 messages / 3 subscribers
    });

    test('should handle empty subscriber list', () => {
      const stats = subscriberManager.getSubscriberStats();

      expect(stats.total).toBe(0);
      expect(stats.active).toBe(0);
      expect(stats.inactive).toBe(0);
      expect(stats.totalMessages).toBe(0);
      expect(stats.averageMessages).toBe(0);
    });
  });

  describe('findSubscribersByFilter', () => {
    test('should find subscribers by type filter', () => {
      const filter1: MessageFilter = { type: 'event-type-1' };
      const filter2: MessageFilter = { type: 'event-type-2' };

      const id1 = subscriberManager.subscribe('sub1', mockHandler, filter1);
      const id2 = subscriberManager.subscribe('sub2', mockHandler, filter2);
      const id3 = subscriberManager.subscribe('sub3', mockHandler); // no filter

      const found = subscriberManager.findSubscribersByFilter({ type: 'event-type-1' });

      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(id1);
    });

    test('should find subscribers by source filter', () => {
      const filter1: MessageFilter = { source: 'source-1' };
      const filter2: MessageFilter = { source: 'source-2' };

      const id1 = subscriberManager.subscribe('sub1', mockHandler, filter1);
      const id2 = subscriberManager.subscribe('sub2', mockHandler, filter2);

      const found = subscriberManager.findSubscribersByFilter({ source: 'source-2' });

      expect(found).toHaveLength(1);
      expect(found[0].id).toBe(id2);
    });

    test('should exclude subscribers without filters', () => {
      subscriberManager.subscribe('no-filter-sub', mockHandler);
      const filter: MessageFilter = { type: 'test-type' };
      subscriberManager.subscribe('filtered-sub', mockHandler, filter);

      const found = subscriberManager.findSubscribersByFilter({ type: 'test-type' });

      expect(found).toHaveLength(1);
      expect(found[0].name).toBe('filtered-sub');
    });

    test('should return empty array when no matches', () => {
      const filter: MessageFilter = { type: 'type-1' };
      subscriberManager.subscribe('sub1', mockHandler, filter);

      const found = subscriberManager.findSubscribersByFilter({ type: 'non-existent-type' });

      expect(found).toEqual([]);
    });
  });

  describe('validateSubscriber', () => {
    test('should validate existing active subscriber', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);

      const validation = subscriberManager.validateSubscriber(id);

      expect(validation.exists).toBe(true);
      expect(validation.active).toBe(true);
      expect(validation.lastActivity).toBeUndefined();
      expect(validation.messageCount).toBe(0);
    });

    test('should validate subscriber with message activity', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);
      subscriberManager.updateSubscriberStats(id);

      const validation = subscriberManager.validateSubscriber(id);

      expect(validation.exists).toBe(true);
      expect(validation.active).toBe(true);
      expect(validation.lastActivity).toBeGreaterThan(0);
      expect(validation.messageCount).toBe(1);
    });

    test('should validate inactive subscriber', () => {
      const id = subscriberManager.subscribe('test-subscriber', mockHandler);
      subscriberManager.setSubscriberActive(id, false);

      const validation = subscriberManager.validateSubscriber(id);

      expect(validation.exists).toBe(true);
      expect(validation.active).toBe(false);
      expect(validation.messageCount).toBe(0);
    });

    test('should handle non-existent subscriber', () => {
      const validation = subscriberManager.validateSubscriber('invalid-id');

      expect(validation.exists).toBe(false);
      expect(validation.active).toBe(false);
      expect(validation.lastActivity).toBeUndefined();
      expect(validation.messageCount).toBe(0);
    });
  });

  describe('cleanup', () => {
    test('should remove inactive subscribers older than 24 hours', () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000; // 25 hours ago

      const id1 = subscriberManager.subscribe('active-sub', mockHandler);
      const id2 = subscriberManager.subscribe('inactive-old-sub', mockHandler);
      const id3 = subscriberManager.subscribe('inactive-recent-sub', mockHandler);

      // Make id2 inactive with old timestamp
      subscriberManager.setSubscriberActive(id2, false);
      const subscriber2 = subscriberManager.getSubscriber(id2)!;
      subscriber2.lastMessage = oldTimestamp;

      // Make id3 inactive but recent
      subscriberManager.setSubscriberActive(id3, false);
      subscriberManager.updateSubscriberStats(id3); // Recent activity

      const removedCount = subscriberManager.cleanup();

      expect(removedCount).toBe(1);
      expect(subscriberManager.getSubscriber(id1)).toBeDefined(); // Active, should remain
      expect(subscriberManager.getSubscriber(id2)).toBeNull(); // Inactive and old, should be removed
      expect(subscriberManager.getSubscriber(id3)).toBeDefined(); // Inactive but recent, should remain
    });

    test('should remove inactive subscribers with no lastMessage', () => {
      const id = subscriberManager.subscribe('inactive-sub', mockHandler);
      subscriberManager.setSubscriberActive(id, false);

      const removedCount = subscriberManager.cleanup();

      expect(removedCount).toBe(1);
      expect(subscriberManager.getSubscriber(id)).toBeNull();
    });

    test('should not remove active subscribers', () => {
      const oldTimestamp = Date.now() - 25 * 60 * 60 * 1000;

      const id = subscriberManager.subscribe('active-old-sub', mockHandler);
      const subscriber = subscriberManager.getSubscriber(id)!;
      subscriber.lastMessage = oldTimestamp;

      const removedCount = subscriberManager.cleanup();

      expect(removedCount).toBe(0);
      expect(subscriberManager.getSubscriber(id)).toBeDefined();
    });

    test('should return 0 when no cleanup needed', () => {
      subscriberManager.subscribe('active-sub', mockHandler);

      const removedCount = subscriberManager.cleanup();

      expect(removedCount).toBe(0);
    });
  });

  describe('clear', () => {
    test('should remove all subscribers', () => {
      subscriberManager.subscribe('sub1', mockHandler);
      subscriberManager.subscribe('sub2', mockHandler);
      subscriberManager.subscribe('sub3', mockHandler);

      expect(subscriberManager.getSubscriberCount()).toBe(3);

      subscriberManager.clear();

      expect(subscriberManager.getSubscriberCount()).toBe(0);
      expect(subscriberManager.getAllSubscribers()).toEqual([]);
    });
  });

  describe('export', () => {
    test('should export subscriber data without handlers', () => {
      const filter: MessageFilter = { type: 'test-type' };
      const id1 = subscriberManager.subscribe('sub1', mockHandler, filter);
      const id2 = subscriberManager.subscribe('sub2', asyncMockHandler);

      subscriberManager.updateSubscriberStats(id1);
      subscriberManager.setSubscriberActive(id2, false);

      const exported = subscriberManager.export();

      expect(Object.keys(exported)).toHaveLength(2);
      expect(exported[id1]).toBeDefined();
      expect(exported[id2]).toBeDefined();

      // Check that handler is excluded
      expect('handler' in exported[id1]).toBe(false);
      expect('handler' in exported[id2]).toBe(false);

      // Check that other properties are included
      expect(exported[id1].id).toBe(id1);
      expect(exported[id1].name).toBe('sub1');
      expect(exported[id1].filter).toEqual(filter);
      expect(exported[id1].active).toBe(true);
      expect(exported[id1].messagesReceived).toBe(1);

      expect(exported[id2].id).toBe(id2);
      expect(exported[id2].name).toBe('sub2');
      expect(exported[id2].active).toBe(false);
      expect(exported[id2].messagesReceived).toBe(0);
    });

    test('should return empty object when no subscribers', () => {
      const exported = subscriberManager.export();
      expect(exported).toEqual({});
    });
  });

  describe('complex filter scenarios', () => {
    test('should handle array-type filters', () => {
      const filter: MessageFilter = {
        type: ['type-1', 'type-2'],
        source: ['source-a', 'source-b'],
      };

      const id = subscriberManager.subscribe('multi-filter-sub', mockHandler, filter);
      const subscriber = subscriberManager.getSubscriber(id)!;

      expect(subscriber.filter!.type).toEqual(['type-1', 'type-2']);
      expect(subscriber.filter!.source).toEqual(['source-a', 'source-b']);
    });

    test('should handle priority range filters', () => {
      const filter: MessageFilter = {
        priority: { min: 1, max: 5 },
        metadata: { category: 'important' },
      };

      const id = subscriberManager.subscribe('priority-sub', mockHandler, filter);
      const subscriber = subscriberManager.getSubscriber(id)!;

      expect(subscriber.filter!.priority).toEqual({ min: 1, max: 5 });
      expect(subscriber.filter!.metadata).toEqual({ category: 'important' });
    });
  });

  describe('edge cases', () => {
    test('should handle multiple operations on same subscriber', () => {
      const id = subscriberManager.subscribe('test-sub', mockHandler);

      // Multiple state changes
      subscriberManager.setSubscriberActive(id, false);
      subscriberManager.setSubscriberActive(id, true);
      subscriberManager.setSubscriberActive(id, false);

      // Multiple stat updates
      subscriberManager.updateSubscriberStats(id);
      subscriberManager.updateSubscriberStats(id);
      subscriberManager.updateSubscriberStats(id);

      const subscriber = subscriberManager.getSubscriber(id)!;
      expect(subscriber.active).toBe(false);
      expect(subscriber.messagesReceived).toBe(3);
    });

    test('should handle large number of subscribers', () => {
      const subscriberIds: string[] = [];

      // Create 100 subscribers
      for (let i = 0; i < 100; i++) {
        const id = subscriberManager.subscribe(`subscriber-${i}`, mockHandler);
        subscriberIds.push(id);
      }

      expect(subscriberManager.getSubscriberCount()).toBe(100);

      // Test operations on large set
      const stats = subscriberManager.getSubscriberStats();
      expect(stats.total).toBe(100);
      expect(stats.active).toBe(100);

      // Test filtering on large set
      subscriberManager.setSubscriberActive(subscriberIds[50], false);
      expect(subscriberManager.getActiveSubscriberCount()).toBe(99);
    });
  });
});
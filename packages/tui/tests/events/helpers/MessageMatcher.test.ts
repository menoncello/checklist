import { describe, it, expect, beforeEach } from 'bun:test';
import { MessageMatcher } from '../../../src/events/helpers/MessageMatcher';
import { BusMessage } from '../../../src/events/helpers/MessageQueue';
import { MessageFilter } from '../../../src/events/helpers/SubscriberManager';

describe('MessageMatcher', () => {
  let baseMessage: BusMessage;

  beforeEach(() => {
    baseMessage = {
      id: 'msg-123',
      type: 'test.event',
      source: 'test-source',
      timestamp: Date.now(),
      priority: 5,
      target: 'test-target',
      data: { data: 'test' },
      metadata: { key1: 'value1', key2: 'value2' },
    };
  });

  describe('matchesFilter', () => {
    it('should return true when filter is undefined', () => {
      expect(MessageMatcher.matchesFilter(baseMessage)).toBe(true);
    });

    it('should return true when filter is null', () => {
      expect(MessageMatcher.matchesFilter(baseMessage, null as any)).toBe(true);
    });

    it('should match message with type filter', () => {
      const filter: MessageFilter = { type: 'test.event' };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should not match message with wrong type filter', () => {
      const filter: MessageFilter = { type: 'wrong.event' };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(false);
    });

    it('should match message with array type filter', () => {
      const filter: MessageFilter = { type: ['test.event', 'other.event'] };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should match message with source filter', () => {
      const filter: MessageFilter = { source: 'test-source' };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should match message with array source filter', () => {
      const filter: MessageFilter = { source: ['test-source', 'other-source'] };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should match message with target filter', () => {
      const filter: MessageFilter = { target: 'test-target' };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should not match message without target when filter has target', () => {
      const messageNoTarget = { ...baseMessage, target: undefined };
      const filter: MessageFilter = { target: 'test-target' };
      expect(MessageMatcher.matchesFilter(messageNoTarget, filter)).toBe(false);
    });

    it('should match message with array targets', () => {
      const messageArrayTargets = { ...baseMessage, target: ['target1', 'target2'] };
      const filter: MessageFilter = { target: 'target1' };
      expect(MessageMatcher.matchesFilter(messageArrayTargets, filter)).toBe(true);
    });

    it('should match message with priority filter', () => {
      const filter: MessageFilter = { priority: { min: 4, max: 6 } };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should match message with only min priority', () => {
      const filter: MessageFilter = { priority: { min: 4 } };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should match message with only max priority', () => {
      const filter: MessageFilter = { priority: { max: 6 } };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should not match message outside priority range', () => {
      const filter: MessageFilter = { priority: { min: 6, max: 8 } };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(false);
    });

    it('should match message with metadata filter', () => {
      const filter: MessageFilter = { metadata: { key1: 'value1' } };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });

    it('should not match message with wrong metadata filter', () => {
      const filter: MessageFilter = { metadata: { key1: 'wrong' } };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(false);
    });

    it('should match when message has no metadata and filter has no metadata', () => {
      const messageNoMeta = { ...baseMessage, metadata: undefined };
      const filter: MessageFilter = {};
      expect(MessageMatcher.matchesFilter(messageNoMeta, filter)).toBe(true);
    });

    it('should match with combined filters', () => {
      const filter: MessageFilter = {
        type: 'test.event',
        source: 'test-source',
        target: 'test-target',
        priority: { min: 4, max: 6 },
        metadata: { key1: 'value1' },
      };
      expect(MessageMatcher.matchesFilter(baseMessage, filter)).toBe(true);
    });
  });

  describe('matchesTarget', () => {
    it('should return true when message has no target', () => {
      const message = { ...baseMessage, target: undefined };
      expect(MessageMatcher.matchesTarget(message, 'sub-1', 'subscriber')).toBe(true);
    });

    it('should match subscriber ID', () => {
      expect(MessageMatcher.matchesTarget(baseMessage, 'test-target', 'subscriber')).toBe(true);
    });

    it('should match subscriber name', () => {
      expect(MessageMatcher.matchesTarget(baseMessage, 'sub-1', 'test-target')).toBe(true);
    });

    it('should match wildcard target', () => {
      const message = { ...baseMessage, target: '*' };
      expect(MessageMatcher.matchesTarget(message, 'any-id', 'any-name')).toBe(true);
    });

    it('should match pattern with wildcard', () => {
      const message = { ...baseMessage, target: 'test-*' };
      expect(MessageMatcher.matchesTarget(message, 'test-123', 'subscriber')).toBe(true);
    });

    it('should match pattern with wildcard at end', () => {
      const message = { ...baseMessage, target: '*-target' };
      expect(MessageMatcher.matchesTarget(message, 'test-target', 'subscriber')).toBe(true);
    });

    it('should match pattern with multiple wildcards', () => {
      const message = { ...baseMessage, target: '*-test-*' };
      expect(MessageMatcher.matchesTarget(message, 'prefix-test-suffix', 'subscriber')).toBe(true);
    });

    it('should handle array of targets', () => {
      const message = { ...baseMessage, target: ['target1', 'target2', 'test-*'] };
      expect(MessageMatcher.matchesTarget(message, 'test-123', 'subscriber')).toBe(true);
    });

    it('should not match when no target matches', () => {
      expect(MessageMatcher.matchesTarget(baseMessage, 'wrong-id', 'wrong-name')).toBe(false);
    });
  });

  describe('filterMessages', () => {
    const messages: BusMessage[] = [
      {
        id: '1',
        type: 'type1',
        source: 'source1',
        timestamp: 1000,
        priority: 1,
        target: 'target1',
        data: {},
      },
      {
        id: '2',
        type: 'type2',
        source: 'source2',
        timestamp: 2000,
        priority: 5,
        target: 'target2',
        data: {},
      },
      {
        id: '3',
        type: 'type1',
        source: 'source1',
        timestamp: 3000,
        priority: 10,
        target: ['target1', 'target3'],
        data: {},
      },
    ];

    it('should filter by type', () => {
      const filtered = MessageMatcher.filterMessages(messages, { type: 'type1' });
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('3');
    });

    it('should filter by source', () => {
      const filtered = MessageMatcher.filterMessages(messages, { source: 'source2' });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should filter by target', () => {
      const filtered = MessageMatcher.filterMessages(messages, { target: 'target1' });
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('3');
    });

    it('should filter by priority range', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        priority: { min: 3, max: 7 },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should filter by time range', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        timeRange: { start: 1500, end: 2500 },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should apply limit', () => {
      const filtered = MessageMatcher.filterMessages(messages, { limit: 2 });
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('2');
      expect(filtered[1].id).toBe('3');
    });

    it('should combine multiple filters', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        type: 'type1',
        source: 'source1',
        priority: { min: 8 },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('3');
    });

    it('should return empty array when no messages match', () => {
      const filtered = MessageMatcher.filterMessages(messages, { type: 'nonexistent' });
      expect(filtered).toHaveLength(0);
    });
  });

  describe('validateMessage', () => {
    it('should validate correct message', () => {
      const result = MessageMatcher.validateMessage(baseMessage);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect missing id', () => {
      const message = { ...baseMessage, id: '' };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message ID is required and must be a string');
    });

    it('should detect invalid id type', () => {
      const message = { ...baseMessage, id: 123 as any };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message ID is required and must be a string');
    });

    it('should detect missing type', () => {
      const message = { ...baseMessage, type: '' };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message type is required and must be a string');
    });

    it('should detect missing source', () => {
      const message = { ...baseMessage, source: '' };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message source is required and must be a string');
    });

    it('should detect invalid timestamp', () => {
      const message = { ...baseMessage, timestamp: -1 };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message timestamp must be a positive number');
    });

    it('should detect invalid priority', () => {
      const message = { ...baseMessage, priority: 'high' as any };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message priority must be a number');
    });

    it('should accept valid string target', () => {
      const message = { ...baseMessage, target: 'valid-target' };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(true);
    });

    it('should accept valid array target', () => {
      const message = { ...baseMessage, target: ['target1', 'target2'] };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(true);
    });

    it('should detect invalid array target with non-strings', () => {
      const message = { ...baseMessage, target: ['target1', 123] as any };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All message targets must be strings');
    });

    it('should detect invalid target type', () => {
      const message = { ...baseMessage, target: 123 as any };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message target must be a string or array of strings');
    });

    it('should accept valid ttl', () => {
      const message = { ...baseMessage, ttl: 5000 };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(true);
    });

    it('should detect invalid ttl', () => {
      const message = { ...baseMessage, ttl: -100 };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message TTL must be a positive number');
    });

    it('should accept message without ttl', () => {
      const message = { ...baseMessage, ttl: undefined };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(true);
    });

    it('should collect multiple errors', () => {
      const message = {
        ...baseMessage,
        id: '',
        type: '',
        source: '',
        timestamp: -1,
        priority: 'high' as any,
      };
      const result = MessageMatcher.validateMessage(message);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(4);
    });
  });

  describe('createMessageQuery', () => {
    const messages: BusMessage[] = [
      {
        id: '1',
        type: 'event.created',
        source: 'component1',
        timestamp: 1000,
        priority: 1,
        target: 'handler1',
        data: {},
        metadata: { userId: '123', action: 'create' },
      },
      {
        id: '2',
        type: 'event.updated',
        source: 'component2',
        timestamp: 2000,
        priority: 5,
        target: 'handler2',
        data: {},
        metadata: { userId: '456', action: 'update' },
      },
      {
        id: '3',
        type: 'event.deleted',
        source: 'component1',
        timestamp: 3000,
        priority: 10,
        target: ['handler1', 'handler3'],
        data: {},
        metadata: { userId: '123', action: 'delete' },
      },
    ];

    it('should create query for types', () => {
      const query = MessageMatcher.createMessageQuery({
        types: ['event.created', 'event.updated'],
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('2');
    });

    it('should create query for sources', () => {
      const query = MessageMatcher.createMessageQuery({
        sources: ['component1'],
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('3');
    });

    it('should create query for targets', () => {
      const query = MessageMatcher.createMessageQuery({
        targets: ['handler1'],
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('3');
    });

    it('should create query for priority range', () => {
      const query = MessageMatcher.createMessageQuery({
        priorityRange: { min: 3, max: 7 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should create query for time range', () => {
      const query = MessageMatcher.createMessageQuery({
        timeRange: { start: 1500, end: 2500 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('2');
    });

    it('should create query for metadata keys', () => {
      const query = MessageMatcher.createMessageQuery({
        hasMetadata: ['userId', 'action'],
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(3);
    });

    it('should handle messages without metadata', () => {
      const messagesNoMeta = [
        { ...messages[0], metadata: undefined },
        messages[1],
      ];
      const query = MessageMatcher.createMessageQuery({
        hasMetadata: ['userId'],
      });
      const filtered = messagesNoMeta.filter(query);
      expect(filtered).toHaveLength(2); // Messages without metadata pass through
    });

    it('should combine multiple query criteria', () => {
      const query = MessageMatcher.createMessageQuery({
        types: ['event.created', 'event.deleted'],
        sources: ['component1'],
        priorityRange: { max: 5 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('1');
    });

    it('should handle empty query', () => {
      const query = MessageMatcher.createMessageQuery({});
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(3);
    });

    it('should handle messages without targets', () => {
      const messagesNoTarget = [
        { ...messages[0], target: undefined },  // This has no target, will pass through
        messages[1],  // This has target: 'handler2', won't match 'handler1'
      ];
      const query = MessageMatcher.createMessageQuery({
        targets: ['handler1'],
      });
      const filtered = messagesNoTarget.filter(query);
      expect(filtered).toHaveLength(1); // Only message without target passes through
      expect(filtered[0].id).toBe('1'); // The one without target
    });

    it('should handle priority range with only min', () => {
      const query = MessageMatcher.createMessageQuery({
        priorityRange: { min: 5 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('2');
      expect(filtered[1].id).toBe('3');
    });

    it('should handle priority range with only max', () => {
      const query = MessageMatcher.createMessageQuery({
        priorityRange: { max: 5 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('2');
    });

    it('should handle time range with only start', () => {
      const query = MessageMatcher.createMessageQuery({
        timeRange: { start: 2000 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('2');
      expect(filtered[1].id).toBe('3');
    });

    it('should handle time range with only end', () => {
      const query = MessageMatcher.createMessageQuery({
        timeRange: { end: 2000 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered[0].id).toBe('1');
      expect(filtered[1].id).toBe('2');
    });
  });
});
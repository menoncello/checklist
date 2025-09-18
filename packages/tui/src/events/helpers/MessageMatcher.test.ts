import { describe, it, expect, beforeEach } from 'bun:test';
import { MessageMatcher } from './MessageMatcher';
import { BusMessage } from './MessageQueue';
import { MessageFilter } from './SubscriberManager';

describe('MessageMatcher', () => {
  let testMessage: BusMessage;

  beforeEach(() => {
    testMessage = {
      id: 'msg-1',
      type: 'test-event',
      data: { value: 123 },
      source: 'component-a',
      target: 'component-b',
      timestamp: Date.now(),
      priority: 5,
      metadata: { category: 'ui', important: true },
    };
  });

  describe('matchesFilter', () => {
    it('should return true when filter is null or undefined', () => {
      expect(
        MessageMatcher.matchesFilter(testMessage, null as unknown as undefined)
      ).toBe(true);
      expect(MessageMatcher.matchesFilter(testMessage, undefined)).toBe(true);
    });

    it('should return true when filter is empty', () => {
      const emptyFilter: MessageFilter = {};
      expect(MessageMatcher.matchesFilter(testMessage, emptyFilter)).toBe(true);
    });

    describe('type matching', () => {
      it('should match exact type string', () => {
        const filter: MessageFilter = { type: 'test-event' };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should not match different type string', () => {
        const filter: MessageFilter = { type: 'other-event' };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });

      it('should match type in array', () => {
        const filter: MessageFilter = { type: ['test-event', 'other-event'] };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should not match when type not in array', () => {
        const filter: MessageFilter = {
          type: ['other-event', 'another-event'],
        };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });
    });

    describe('source matching', () => {
      it('should match exact source string', () => {
        const filter: MessageFilter = { source: 'component-a' };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should not match different source string', () => {
        const filter: MessageFilter = { source: 'component-c' };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });

      it('should match source in array', () => {
        const filter: MessageFilter = {
          source: ['component-a', 'component-c'],
        };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should not match when source not in array', () => {
        const filter: MessageFilter = {
          source: ['component-c', 'component-d'],
        };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });
    });

    describe('target matching', () => {
      it('should return false when filter has target but message has no target', () => {
        const messageWithoutTarget = { ...testMessage, target: undefined };
        const filter: MessageFilter = { target: 'component-b' };
        expect(MessageMatcher.matchesFilter(messageWithoutTarget, filter)).toBe(
          false
        );
      });

      it('should match when message target string matches filter target string', () => {
        const filter: MessageFilter = { target: 'component-b' };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should match when message target array contains filter target', () => {
        const messageWithTargetArray = {
          ...testMessage,
          target: ['component-b', 'component-c'],
        };
        const filter: MessageFilter = { target: 'component-b' };
        expect(
          MessageMatcher.matchesFilter(messageWithTargetArray, filter)
        ).toBe(true);
      });

      it('should match when filter target array contains message target', () => {
        const filter: MessageFilter = {
          target: ['component-b', 'component-c'],
        };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should match when message and filter both have target arrays with intersection', () => {
        const messageWithTargetArray = {
          ...testMessage,
          target: ['component-b', 'component-d'],
        };
        const filter: MessageFilter = {
          target: ['component-c', 'component-b'],
        };
        expect(
          MessageMatcher.matchesFilter(messageWithTargetArray, filter)
        ).toBe(true);
      });

      it('should not match when no target intersection', () => {
        const messageWithTargetArray = {
          ...testMessage,
          target: ['component-d', 'component-e'],
        };
        const filter: MessageFilter = {
          target: ['component-f', 'component-g'],
        };
        expect(
          MessageMatcher.matchesFilter(messageWithTargetArray, filter)
        ).toBe(false);
      });
    });

    describe('priority matching', () => {
      it('should match when priority is within range', () => {
        const filter: MessageFilter = { priority: { min: 3, max: 7 } };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should not match when priority is below minimum', () => {
        const filter: MessageFilter = { priority: { min: 6 } };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });

      it('should not match when priority is above maximum', () => {
        const filter: MessageFilter = { priority: { max: 4 } };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });

      it('should match when only minimum is specified and met', () => {
        const filter: MessageFilter = { priority: { min: 5 } };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should match when only maximum is specified and met', () => {
        const filter: MessageFilter = { priority: { max: 5 } };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });
    });

    describe('metadata matching', () => {
      it('should match when all filter metadata keys are present with correct values', () => {
        const filter: MessageFilter = {
          metadata: { category: 'ui', important: true },
        };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should match when subset of metadata matches', () => {
        const filter: MessageFilter = { metadata: { category: 'ui' } };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should not match when metadata value differs', () => {
        const filter: MessageFilter = { metadata: { category: 'backend' } };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });

      it('should pass when filter has metadata but message does not', () => {
        const messageWithoutMetadata = { ...testMessage, metadata: undefined };
        const filter: MessageFilter = { metadata: { category: 'ui' } };
        // The actual behavior: only filters if BOTH filter.metadata AND message.metadata are not null
        expect(
          MessageMatcher.matchesFilter(messageWithoutMetadata, filter)
        ).toBe(true);
      });

      it('should pass when filter has no metadata', () => {
        const filter: MessageFilter = { type: 'test-event' };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });
    });

    describe('combined filters', () => {
      it('should match when all conditions are met', () => {
        const filter: MessageFilter = {
          type: 'test-event',
          source: 'component-a',
          target: 'component-b',
          priority: { min: 3, max: 7 },
          metadata: { category: 'ui' },
        };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(true);
      });

      it('should not match when any condition fails', () => {
        const filter: MessageFilter = {
          type: 'test-event',
          source: 'component-a',
          target: 'component-b',
          priority: { min: 6, max: 7 }, // This will fail (message priority is 5)
          metadata: { category: 'ui' },
        };
        expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
      });
    });
  });

  describe('matchesTarget', () => {
    const subscriberId = 'sub-123';
    const subscriberName = 'my-subscriber';

    it('should return true when message has no target', () => {
      const messageWithoutTarget = { ...testMessage, target: undefined };
      expect(
        MessageMatcher.matchesTarget(
          messageWithoutTarget,
          subscriberId,
          subscriberName
        )
      ).toBe(true);
    });

    it('should match subscriber ID', () => {
      const messageWithTarget = { ...testMessage, target: subscriberId };
      expect(
        MessageMatcher.matchesTarget(
          messageWithTarget,
          subscriberId,
          subscriberName
        )
      ).toBe(true);
    });

    it('should match subscriber name', () => {
      const messageWithTarget = { ...testMessage, target: subscriberName };
      expect(
        MessageMatcher.matchesTarget(
          messageWithTarget,
          subscriberId,
          subscriberName
        )
      ).toBe(true);
    });

    it('should match wildcard target', () => {
      const messageWithWildcard = { ...testMessage, target: '*' };
      expect(
        MessageMatcher.matchesTarget(
          messageWithWildcard,
          subscriberId,
          subscriberName
        )
      ).toBe(true);
    });

    it('should match pattern for subscriber ID', () => {
      const messageWithPattern = { ...testMessage, target: 'sub-*' };
      expect(
        MessageMatcher.matchesTarget(
          messageWithPattern,
          subscriberId,
          subscriberName
        )
      ).toBe(true);
    });

    it('should match pattern for subscriber name', () => {
      const messageWithPattern = { ...testMessage, target: 'my-*' };
      expect(
        MessageMatcher.matchesTarget(
          messageWithPattern,
          subscriberId,
          subscriberName
        )
      ).toBe(true);
    });

    it('should work with target arrays', () => {
      const messageWithTargetArray = {
        ...testMessage,
        target: ['other-target', subscriberId],
      };
      expect(
        MessageMatcher.matchesTarget(
          messageWithTargetArray,
          subscriberId,
          subscriberName
        )
      ).toBe(true);
    });

    it('should not match when target does not match', () => {
      const messageWithDifferentTarget = {
        ...testMessage,
        target: 'different-target',
      };
      expect(
        MessageMatcher.matchesTarget(
          messageWithDifferentTarget,
          subscriberId,
          subscriberName
        )
      ).toBe(false);
    });

    it('should not match when pattern does not match', () => {
      const messageWithNonMatchingPattern = {
        ...testMessage,
        target: 'other-*',
      };
      expect(
        MessageMatcher.matchesTarget(
          messageWithNonMatchingPattern,
          subscriberId,
          subscriberName
        )
      ).toBe(false);
    });
  });

  describe('matchesPattern (private method behavior)', () => {
    // Test the pattern matching indirectly through matchesTarget
    it('should handle exact string matches', () => {
      const messageWithExactTarget = { ...testMessage, target: 'exact-match' };
      expect(
        MessageMatcher.matchesTarget(
          messageWithExactTarget,
          'exact-match',
          'subscriber'
        )
      ).toBe(true);
    });

    it('should handle wildcard at end', () => {
      const messageWithPattern = { ...testMessage, target: 'prefix-*' };
      expect(
        MessageMatcher.matchesTarget(
          messageWithPattern,
          'prefix-anything',
          'subscriber'
        )
      ).toBe(true);
    });

    it('should handle wildcard at beginning', () => {
      const messageWithPattern = { ...testMessage, target: '*-suffix' };
      expect(
        MessageMatcher.matchesTarget(
          messageWithPattern,
          'anything-suffix',
          'subscriber'
        )
      ).toBe(true);
    });

    it('should handle wildcard in middle', () => {
      const messageWithPattern = { ...testMessage, target: 'pre-*-suf' };
      expect(
        MessageMatcher.matchesTarget(
          messageWithPattern,
          'pre-middle-suf',
          'subscriber'
        )
      ).toBe(true);
    });

    it('should handle multiple wildcards', () => {
      const messageWithPattern = { ...testMessage, target: '*-*-*' };
      expect(
        MessageMatcher.matchesTarget(messageWithPattern, 'a-b-c', 'subscriber')
      ).toBe(true);
    });

    it('should escape special regex characters', () => {
      const messageWithSpecialChars = {
        ...testMessage,
        target: 'test.+^${}()|[]\\',
      };
      expect(
        MessageMatcher.matchesTarget(
          messageWithSpecialChars,
          'test.+^${}()|[]\\',
          'subscriber'
        )
      ).toBe(true);
    });
  });

  describe('filterMessages', () => {
    let messages: BusMessage[];

    beforeEach(() => {
      messages = [
        {
          id: 'msg-1',
          type: 'event-a',
          data: {},
          source: 'source-1',
          target: 'target-1',
          timestamp: 1000,
          priority: 5,
        },
        {
          id: 'msg-2',
          type: 'event-b',
          data: {},
          source: 'source-2',
          target: ['target-1', 'target-2'],
          timestamp: 2000,
          priority: 3,
        },
        {
          id: 'msg-3',
          type: 'event-a',
          data: {},
          source: 'source-1',
          target: undefined,
          timestamp: 3000,
          priority: 7,
        },
      ];
    });

    it('should filter by type', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        type: 'event-a',
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((msg) => msg.type === 'event-a')).toBe(true);
    });

    it('should filter by source', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        source: 'source-1',
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((msg) => msg.source === 'source-1')).toBe(true);
    });

    it('should filter by target', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        target: 'target-1',
      });
      expect(filtered).toHaveLength(2);
      expect(
        filtered.every((msg) => {
          const targets = Array.isArray(msg.target) ? msg.target : [msg.target];
          return targets.includes('target-1');
        })
      ).toBe(true);
    });

    it('should exclude messages with null target when filtering by target', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        target: 'target-1',
      });
      expect(filtered.some((msg) => msg.target == null)).toBe(false);
    });

    it('should filter by priority minimum', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        priority: { min: 5 },
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((msg) => msg.priority >= 5)).toBe(true);
    });

    it('should filter by priority maximum', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        priority: { max: 5 },
      });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((msg) => msg.priority <= 5)).toBe(true);
    });

    it('should filter by priority range', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        priority: { min: 4, max: 6 },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].priority).toBe(5);
    });

    it('should filter by time range', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        timeRange: { start: 1500, end: 2500 },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].timestamp).toBe(2000);
    });

    it('should limit results', () => {
      const filtered = MessageMatcher.filterMessages(messages, { limit: 2 });
      expect(filtered).toHaveLength(2);
      // Should take the last 2 messages
      expect(filtered.map((m) => m.id)).toEqual(['msg-2', 'msg-3']);
    });

    it('should apply multiple filters', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        type: 'event-a',
        source: 'source-1',
        priority: { min: 6 },
      });
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('msg-3');
    });

    it('should return empty array when no messages match', () => {
      const filtered = MessageMatcher.filterMessages(messages, {
        type: 'non-existent',
      });
      expect(filtered).toHaveLength(0);
    });

    it('should return all messages when no filters applied', () => {
      const filtered = MessageMatcher.filterMessages(messages, {});
      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual(messages);
    });
  });

  describe('validateMessage', () => {
    it('should validate a correct message', () => {
      const result = MessageMatcher.validateMessage(testMessage);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should require message ID', () => {
      const invalidMessage = { ...testMessage, id: '' };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message ID is required and must be a string'
      );
    });

    it('should require message ID to be string', () => {
      const invalidMessage = { ...testMessage, id: 123 as any };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message ID is required and must be a string'
      );
    });

    it('should require message type', () => {
      const invalidMessage = { ...testMessage, type: '' };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message type is required and must be a string'
      );
    });

    it('should require message type to be string', () => {
      const invalidMessage = { ...testMessage, type: 123 as any };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message type is required and must be a string'
      );
    });

    it('should require message source', () => {
      const invalidMessage = { ...testMessage, source: '' };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message source is required and must be a string'
      );
    });

    it('should require message source to be string', () => {
      const invalidMessage = { ...testMessage, source: 123 as any };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message source is required and must be a string'
      );
    });

    it('should require valid timestamp', () => {
      const invalidMessage = { ...testMessage, timestamp: 0 };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message timestamp must be a positive number'
      );
    });

    it('should require timestamp to be number', () => {
      const invalidMessage = { ...testMessage, timestamp: 'invalid' as any };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message timestamp must be a positive number'
      );
    });

    it('should require priority to be number', () => {
      const invalidMessage = { ...testMessage, priority: 'high' as any };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message priority must be a number');
    });

    it('should allow string target', () => {
      const messageWithStringTarget = {
        ...testMessage,
        target: 'target-string',
      };
      const result = MessageMatcher.validateMessage(messageWithStringTarget);
      expect(result.isValid).toBe(true);
    });

    it('should allow array target', () => {
      const messageWithArrayTarget = {
        ...testMessage,
        target: ['target-1', 'target-2'],
      };
      const result = MessageMatcher.validateMessage(messageWithArrayTarget);
      expect(result.isValid).toBe(true);
    });

    it('should allow undefined target', () => {
      const messageWithoutTarget = { ...testMessage, target: undefined };
      const result = MessageMatcher.validateMessage(messageWithoutTarget);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid target type', () => {
      const invalidMessage = { ...testMessage, target: 123 as any };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'Message target must be a string or array of strings'
      );
    });

    it('should reject array target with non-string values', () => {
      const invalidMessage = {
        ...testMessage,
        target: ['valid', 123, 'also-valid'] as any,
      };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('All message targets must be strings');
    });

    it('should validate TTL when provided', () => {
      const messageWithValidTTL = { ...testMessage, ttl: 5000 };
      const result = MessageMatcher.validateMessage(messageWithValidTTL);
      expect(result.isValid).toBe(true);
    });

    it('should reject invalid TTL', () => {
      const invalidMessage = { ...testMessage, ttl: 0 };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message TTL must be a positive number');
    });

    it('should reject non-number TTL', () => {
      const invalidMessage = { ...testMessage, ttl: 'forever' as any };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Message TTL must be a positive number');
    });

    it('should accumulate multiple errors', () => {
      const invalidMessage = {
        id: '',
        type: '',
        data: {},
        source: '',
        timestamp: 0,
        priority: 'high' as any,
        ttl: -1,
      };
      const result = MessageMatcher.validateMessage(invalidMessage);
      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });
  });

  describe('createMessageQuery', () => {
    let messages: BusMessage[];

    beforeEach(() => {
      messages = [
        {
          id: 'msg-1',
          type: 'event-a',
          data: {},
          source: 'source-1',
          target: 'target-1',
          timestamp: 1000,
          priority: 5,
          metadata: { tag: 'important', category: 'ui' },
        },
        {
          id: 'msg-2',
          type: 'event-b',
          data: {},
          source: 'source-2',
          target: ['target-1', 'target-2'],
          timestamp: 2000,
          priority: 3,
          metadata: { tag: 'normal' },
        },
        {
          id: 'msg-3',
          type: 'event-a',
          data: {},
          source: 'source-1',
          target: undefined,
          timestamp: 3000,
          priority: 7,
        },
      ];
    });

    it('should create query that filters by types', () => {
      const query = MessageMatcher.createMessageQuery({ types: ['event-a'] });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((msg) => msg.type === 'event-a')).toBe(true);
    });

    it('should create query that filters by sources', () => {
      const query = MessageMatcher.createMessageQuery({
        sources: ['source-1'],
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(2);
      expect(filtered.every((msg) => msg.source === 'source-1')).toBe(true);
    });

    it('should create query that filters by targets', () => {
      const query = MessageMatcher.createMessageQuery({
        targets: ['target-1'],
      });
      const filtered = messages.filter(query);
      // Only filters messages that have both query.targets AND message.target not null
      // Messages with null target are not filtered out
      expect(filtered).toHaveLength(3);
      const messagesWithTargets = filtered.filter((msg) => msg.target != null);
      expect(
        messagesWithTargets.every((msg) => {
          const targets = Array.isArray(msg.target) ? msg.target : [msg.target];
          return targets.includes('target-1');
        })
      ).toBe(true);
    });

    it('should skip target filtering when message has null target', () => {
      const query = MessageMatcher.createMessageQuery({
        targets: ['target-1'],
      });
      const messageWithoutTarget = messages[2]; // msg-3 has no target
      // Messages with null target pass through (not filtered out)
      expect(query(messageWithoutTarget)).toBe(true);
    });

    it('should create query that filters by priority range', () => {
      const query = MessageMatcher.createMessageQuery({
        priorityRange: { min: 4, max: 6 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].priority).toBe(5);
    });

    it('should create query that filters by priority minimum only', () => {
      const query = MessageMatcher.createMessageQuery({
        priorityRange: { min: 6 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].priority).toBe(7);
    });

    it('should create query that filters by priority maximum only', () => {
      const query = MessageMatcher.createMessageQuery({
        priorityRange: { max: 4 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].priority).toBe(3);
    });

    it('should create query that filters by time range', () => {
      const query = MessageMatcher.createMessageQuery({
        timeRange: { start: 1500, end: 2500 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].timestamp).toBe(2000);
    });

    it('should create query that filters by time start only', () => {
      const query = MessageMatcher.createMessageQuery({
        timeRange: { start: 2500 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].timestamp).toBe(3000);
    });

    it('should create query that filters by time end only', () => {
      const query = MessageMatcher.createMessageQuery({
        timeRange: { end: 1500 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].timestamp).toBe(1000);
    });

    it('should create query that filters by required metadata keys', () => {
      const query = MessageMatcher.createMessageQuery({ hasMetadata: ['tag'] });
      const filtered = messages.filter(query);
      // Only filters messages that have both query.hasMetadata AND message.metadata not null
      // Messages with null metadata pass through
      expect(filtered).toHaveLength(3);
      const messagesWithMetadata = filtered.filter(
        (msg) => msg.metadata != null
      );
      expect(
        messagesWithMetadata.every(
          (msg) => msg.metadata && 'tag' in msg.metadata
        )
      ).toBe(true);
    });

    it('should create query that requires multiple metadata keys', () => {
      const query = MessageMatcher.createMessageQuery({
        hasMetadata: ['tag', 'category'],
      });
      const filtered = messages.filter(query);
      // msg-1: has both tag and category ✓
      // msg-2: has tag but missing category ✗
      // msg-3: has null metadata, passes through ✓
      expect(filtered).toHaveLength(2);
      expect(filtered.map((m) => m.id)).toEqual(['msg-1', 'msg-3']);
    });

    it('should skip metadata filtering when message has no metadata', () => {
      const query = MessageMatcher.createMessageQuery({ hasMetadata: ['tag'] });
      const messageWithoutMetadata = messages[2]; // msg-3 has no metadata
      // Messages with null metadata pass through (not filtered out)
      expect(query(messageWithoutMetadata)).toBe(true);
    });

    it('should create query with multiple criteria', () => {
      const query = MessageMatcher.createMessageQuery({
        types: ['event-a'],
        sources: ['source-1'],
        priorityRange: { min: 6 },
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(1);
      expect(filtered[0].id).toBe('msg-3');
    });

    it('should return true for all messages when no criteria specified', () => {
      const query = MessageMatcher.createMessageQuery({});
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(3);
      expect(filtered).toEqual(messages);
    });

    it('should return false when no messages match criteria', () => {
      const query = MessageMatcher.createMessageQuery({
        types: ['non-existent'],
      });
      const filtered = messages.filter(query);
      expect(filtered).toHaveLength(0);
    });
  });

  describe('edge cases', () => {
    it('should handle message with all undefined/null optional fields', () => {
      const minimalMessage: BusMessage = {
        id: 'minimal',
        type: 'test',
        data: null,
        source: 'test-source',
        timestamp: Date.now(),
        priority: 0,
        target: undefined,
        ttl: undefined,
        metadata: undefined,
      };

      expect(MessageMatcher.matchesFilter(minimalMessage, {})).toBe(true);
      expect(MessageMatcher.validateMessage(minimalMessage).isValid).toBe(true);
    });

    it('should handle empty arrays in filters', () => {
      const filter: MessageFilter = {
        type: [],
        source: [],
        target: [],
      };

      // Empty arrays should not match anything
      expect(MessageMatcher.matchesFilter(testMessage, filter)).toBe(false);
    });

    it('should handle wildcard patterns with special characters', () => {
      const messageWithSpecialTarget = {
        ...testMessage,
        target: 'test.component[0]',
      };
      expect(
        MessageMatcher.matchesTarget(
          messageWithSpecialTarget,
          'test.component[0]',
          'subscriber'
        )
      ).toBe(true);
    });

    it('should handle very long patterns', () => {
      const longPattern = 'a'.repeat(1000) + '*';
      const longValue = 'a'.repeat(1000) + 'suffix';
      const messageWithLongTarget = { ...testMessage, target: longPattern };
      expect(
        MessageMatcher.matchesTarget(
          messageWithLongTarget,
          longValue,
          'subscriber'
        )
      ).toBe(true);
    });
  });
});

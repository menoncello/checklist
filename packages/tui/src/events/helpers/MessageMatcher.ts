import { BusMessage } from './MessageQueue';
import { MessageFilter } from './SubscriberManager';

export class MessageMatcher {
  public static matchesFilter(
    message: BusMessage,
    filter?: MessageFilter
  ): boolean {
    if (filter == null) return true;

    return (
      this.matchesType(message, filter.type) &&
      this.matchesSource(message, filter.source) &&
      this.matchesTargets(message, filter.target) &&
      this.matchesPriority(message, filter.priority) &&
      this.matchesMetadata(message, filter.metadata)
    );
  }

  private static matchesType(
    message: BusMessage,
    type?: string | string[]
  ): boolean {
    if (type == null) return true;
    return Array.isArray(type)
      ? type.includes(message.type)
      : type === message.type;
  }

  private static matchesSource(
    message: BusMessage,
    source?: string | string[]
  ): boolean {
    if (source == null) return true;
    return Array.isArray(source)
      ? source.includes(message.source)
      : source === message.source;
  }

  private static matchesTargets(
    message: BusMessage,
    target?: string | string[]
  ): boolean {
    if (target == null) return true;
    if (message.target == null) return false;

    const messageTargets = Array.isArray(message.target)
      ? message.target
      : [message.target];
    const filterTargets = Array.isArray(target) ? target : [target];

    return filterTargets.some((ft) => messageTargets.includes(ft));
  }

  private static matchesPriority(
    message: BusMessage,
    priority?: { min?: number; max?: number }
  ): boolean {
    if (priority == null) return true;
    const min = priority.min ?? -Infinity;
    const max = priority.max ?? Infinity;
    return message.priority >= min && message.priority <= max;
  }

  private static matchesMetadata(
    message: BusMessage,
    metadata?: Record<string, unknown>
  ): boolean {
    if (metadata == null || message.metadata == null) return true;
    const msgMetadata = message.metadata;
    return Object.entries(metadata).every(
      ([key, value]) => msgMetadata[key] === value
    );
  }

  public static matchesTarget(
    message: BusMessage,
    subscriberId: string,
    subscriberName: string
  ): boolean {
    // If no target specified, matches all
    if (message.target == null) return true;

    const targets = Array.isArray(message.target)
      ? message.target
      : [message.target];

    // Check if subscriber ID or name matches any target
    return targets.some(
      (target) =>
        target === subscriberId ||
        target === subscriberName ||
        target === '*' ||
        this.matchesPattern(subscriberId, target) ||
        this.matchesPattern(subscriberName, target)
    );
  }

  private static matchesPattern(value: string, pattern: string): boolean {
    // Simple wildcard matching
    if (!pattern.includes('*')) return value === pattern;

    const regexPattern = pattern
      .replace(/[.*+?^${}()|[\]\\]/g, '\\$&') // Escape special regex chars
      .replace(/\\\*/g, '.*'); // Convert * to .*

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(value);
  }

  public static filterMessages(
    messages: BusMessage[],
    filter: {
      type?: string;
      source?: string;
      target?: string;
      priority?: { min?: number; max?: number };
      timeRange?: { start: number; end: number };
      limit?: number;
    }
  ): BusMessage[] {
    const filtered = this.applyFilters(messages, filter);
    return filter.limit != null ? filtered.slice(-filter.limit) : filtered;
  }

  private static applyFilters(
    messages: BusMessage[],
    filter: {
      type?: string;
      source?: string;
      target?: string;
      priority?: { min?: number; max?: number };
      timeRange?: { start: number; end: number };
    }
  ): BusMessage[] {
    return messages.filter((msg) => this.passesAllFilters(msg, filter));
  }

  private static passesAllFilters(
    msg: BusMessage,
    filter: {
      type?: string;
      source?: string;
      target?: string;
      priority?: { min?: number; max?: number };
      timeRange?: { start: number; end: number };
    }
  ): boolean {
    return (
      this.passesTypeFilter(msg, filter.type) &&
      this.passesSourceFilter(msg, filter.source) &&
      this.passesTargetFilter(msg, filter.target) &&
      this.passesPriorityFilter(msg, filter.priority) &&
      this.passesTimeRangeFilter(msg, filter.timeRange)
    );
  }

  private static passesTypeFilter(msg: BusMessage, type?: string): boolean {
    return type == null || msg.type === type;
  }

  private static passesSourceFilter(msg: BusMessage, source?: string): boolean {
    return source == null || msg.source === source;
  }

  private static passesTargetFilter(msg: BusMessage, target?: string): boolean {
    return target == null || this.hasTarget(msg, target);
  }

  private static passesPriorityFilter(
    msg: BusMessage,
    priority?: { min?: number; max?: number }
  ): boolean {
    if (priority == null) return true;
    if (priority.min != null && msg.priority < priority.min) return false;
    if (priority.max != null && msg.priority > priority.max) return false;
    return true;
  }

  private static passesTimeRangeFilter(
    msg: BusMessage,
    timeRange?: { start: number; end: number }
  ): boolean {
    if (timeRange == null) return true;
    const { start, end } = timeRange;
    return msg.timestamp >= start && msg.timestamp <= end;
  }

  private static hasTarget(msg: BusMessage, target: string): boolean {
    if (msg.target == null) return false;
    const targets = Array.isArray(msg.target) ? msg.target : [msg.target];
    return targets.includes(target);
  }

  public static validateMessage(message: BusMessage): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!this.isValidId(message.id))
      errors.push('Message ID is required and must be a string');
    if (!this.isValidType(message.type))
      errors.push('Message type is required and must be a string');
    if (!this.isValidSource(message.source))
      errors.push('Message source is required and must be a string');
    if (!this.isValidTimestamp(message.timestamp))
      errors.push('Message timestamp must be a positive number');
    if (!this.isValidPriority(message.priority))
      errors.push('Message priority must be a number');
    if (!this.isValidTarget(message.target)) {
      if (
        Array.isArray(message.target) &&
        !message.target.every((t) => typeof t === 'string')
      ) {
        errors.push('All message targets must be strings');
      } else {
        errors.push('Message target must be a string or array of strings');
      }
    }
    if (!this.isValidTtl(message.ttl))
      errors.push('Message TTL must be a positive number');

    return { isValid: errors.length === 0, errors };
  }

  private static isValidId(id: unknown): boolean {
    return typeof id === 'string' && id.length > 0;
  }

  private static isValidType(type: unknown): boolean {
    return typeof type === 'string' && type.length > 0;
  }

  private static isValidSource(source: unknown): boolean {
    return typeof source === 'string' && source.length > 0;
  }

  private static isValidTimestamp(timestamp: unknown): boolean {
    return typeof timestamp === 'number' && timestamp > 0;
  }

  private static isValidPriority(priority: unknown): boolean {
    return typeof priority === 'number';
  }

  private static isValidTarget(target: unknown): boolean {
    if (target == null) return true;
    if (typeof target === 'string') return true;
    return Array.isArray(target) && target.every((t) => typeof t === 'string');
  }

  private static isValidTtl(ttl: unknown): boolean {
    return ttl == null || (typeof ttl === 'number' && ttl > 0);
  }

  public static createMessageQuery(query: {
    types?: string[];
    sources?: string[];
    targets?: string[];
    priorityRange?: { min?: number; max?: number };
    timeRange?: { start?: number; end?: number };
    hasMetadata?: string[];
  }): (message: BusMessage) => boolean {
    return (message: BusMessage) => this.messageMatchesQuery(message, query);
  }

  private static messageMatchesQuery(
    message: BusMessage,
    query: {
      types?: string[];
      sources?: string[];
      targets?: string[];
      priorityRange?: { min?: number; max?: number };
      timeRange?: { start?: number; end?: number };
      hasMetadata?: string[];
    }
  ): boolean {
    return (
      this.checkTypes(message, query.types) &&
      this.checkSources(message, query.sources) &&
      this.checkTargets(message, query.targets) &&
      this.checkPriority(message, query.priorityRange) &&
      this.checkTimeRange(message, query.timeRange) &&
      this.checkMetadata(message, query.hasMetadata)
    );
  }

  private static checkTypes(message: BusMessage, types?: string[]): boolean {
    return !types || types.includes(message.type);
  }

  private static checkSources(
    message: BusMessage,
    sources?: string[]
  ): boolean {
    return !sources || sources.includes(message.source);
  }

  private static checkTargets(
    message: BusMessage,
    targets?: string[]
  ): boolean {
    return !targets || this.matchesAnyTarget(message, targets);
  }

  private static checkPriority(
    message: BusMessage,
    range?: { min?: number; max?: number }
  ): boolean {
    if (!range) return true;
    const { min = -Infinity, max = Infinity } = range;
    return message.priority >= min && message.priority <= max;
  }

  private static checkTimeRange(
    message: BusMessage,
    range?: { start?: number; end?: number }
  ): boolean {
    if (!range) return true;
    const { start = 0, end = Infinity } = range;
    return message.timestamp >= start && message.timestamp <= end;
  }

  private static checkMetadata(
    message: BusMessage,
    hasMetadata?: string[]
  ): boolean {
    if (!hasMetadata) return true;
    // Messages with null/undefined metadata pass through (not filtered out)
    if (message.metadata == null) return true;
    return hasMetadata.every(
      (key) => message.metadata != null && key in message.metadata
    );
  }

  private static matchesAnyTarget(
    message: BusMessage,
    targets: string[]
  ): boolean {
    // Messages with null target pass through (not filtered out)
    if (message.target == null) return true;
    const msgTargets = Array.isArray(message.target)
      ? message.target
      : [message.target];
    return targets.some((t) => msgTargets.includes(t));
  }
}

import { BusMessage } from './MessageQueue.js';
import { MessageFilter } from './SubscriberManager.js';

export class MessageMatcher {
  public static matchesFilter(message: BusMessage, filter?: MessageFilter): boolean {
    if (filter == null) return true;

    // Type matching
    if (filter.type != null) {
      if (Array.isArray(filter.type)) {
        if (!filter.type.includes(message.type)) return false;
      } else {
        if (filter.type !== message.type) return false;
      }
    }

    // Source matching
    if (filter.source != null) {
      if (Array.isArray(filter.source)) {
        if (!filter.source.includes(message.source)) return false;
      } else {
        if (filter.source !== message.source) return false;
      }
    }

    // Target matching
    if (filter.target != null) {
      if (message.target == null) return false;

      const messageTargets = Array.isArray(message.target) ? message.target : [message.target];
      const filterTargets = Array.isArray(filter.target) ? filter.target : [filter.target];

      const hasMatch = filterTargets.some(filterTarget =>
        messageTargets.includes(filterTarget)
      );

      if (!hasMatch) return false;
    }

    // Priority matching
    if (filter.priority != null) {
      if (filter.priority.min != null && message.priority < filter.priority.min) {
        return false;
      }
      if (filter.priority.max != null && message.priority > filter.priority.max) {
        return false;
      }
    }

    // Metadata matching
    if (filter.metadata != null && message.metadata != null) {
      for (const [key, value] of Object.entries(filter.metadata)) {
        if (message.metadata[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  public static matchesTarget(
    message: BusMessage,
    subscriberId: string,
    subscriberName: string
  ): boolean {
    // If no target specified, matches all
    if (message.target == null) return true;

    const targets = Array.isArray(message.target) ? message.target : [message.target];

    // Check if subscriber ID or name matches any target
    return targets.some(target =>
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
    let filtered = messages;

    if (filter.type != null) {
      filtered = filtered.filter(msg => msg.type === filter.type);
    }

    if (filter.source != null) {
      filtered = filtered.filter(msg => msg.source === filter.source);
    }

    if (filter.target != null) {
      filtered = filtered.filter(msg => {
        if (msg.target == null) return false;
        const targets = Array.isArray(msg.target) ? msg.target : [msg.target];
        return targets.includes(filter.target!);
      });
    }

    if (filter.priority != null) {
      if (filter.priority.min != null) {
        filtered = filtered.filter(msg => msg.priority >= filter.priority!.min!);
      }
      if (filter.priority.max != null) {
        filtered = filtered.filter(msg => msg.priority <= filter.priority!.max!);
      }
    }

    if (filter.timeRange != null) {
      filtered = filtered.filter(msg =>
        msg.timestamp >= filter.timeRange!.start &&
        msg.timestamp <= filter.timeRange!.end
      );
    }

    if (filter.limit != null) {
      filtered = filtered.slice(-filter.limit);
    }

    return filtered;
  }

  public static validateMessage(message: BusMessage): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    if (!message.id || typeof message.id !== 'string') {
      errors.push('Message ID is required and must be a string');
    }

    if (!message.type || typeof message.type !== 'string') {
      errors.push('Message type is required and must be a string');
    }

    if (!message.source || typeof message.source !== 'string') {
      errors.push('Message source is required and must be a string');
    }

    if (typeof message.timestamp !== 'number' || message.timestamp <= 0) {
      errors.push('Message timestamp must be a positive number');
    }

    if (typeof message.priority !== 'number') {
      errors.push('Message priority must be a number');
    }

    if (message.target != null) {
      if (typeof message.target !== 'string' && !Array.isArray(message.target)) {
        errors.push('Message target must be a string or array of strings');
      } else if (Array.isArray(message.target)) {
        if (!message.target.every(t => typeof t === 'string')) {
          errors.push('All message targets must be strings');
        }
      }
    }

    if (message.ttl != null && (typeof message.ttl !== 'number' || message.ttl <= 0)) {
      errors.push('Message TTL must be a positive number');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  public static createMessageQuery(query: {
    types?: string[];
    sources?: string[];
    targets?: string[];
    priorityRange?: { min?: number; max?: number };
    timeRange?: { start?: number; end?: number };
    hasMetadata?: string[];
  }): (message: BusMessage) => boolean {
    return (message: BusMessage) => {
      if (query.types != null && !query.types.includes(message.type)) {
        return false;
      }

      if (query.sources != null && !query.sources.includes(message.source)) {
        return false;
      }

      if (query.targets != null && message.target != null) {
        const messageTargets = Array.isArray(message.target) ? message.target : [message.target];
        if (!query.targets.some(target => messageTargets.includes(target))) {
          return false;
        }
      }

      if (query.priorityRange != null) {
        if (query.priorityRange.min != null && message.priority < query.priorityRange.min) {
          return false;
        }
        if (query.priorityRange.max != null && message.priority > query.priorityRange.max) {
          return false;
        }
      }

      if (query.timeRange != null) {
        if (query.timeRange.start != null && message.timestamp < query.timeRange.start) {
          return false;
        }
        if (query.timeRange.end != null && message.timestamp > query.timeRange.end) {
          return false;
        }
      }

      if (query.hasMetadata != null && message.metadata != null) {
        if (!query.hasMetadata.every(key => key in message.metadata!)) {
          return false;
        }
      }

      return true;
    };
  }
}
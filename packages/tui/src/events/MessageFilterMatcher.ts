export interface MessageFilter {
  type?: string | string[];
  source?: string | string[];
  target?: string | string[];
  priority?: {
    min?: number;
    max?: number;
  };
  metadata?: Record<string, unknown>;
}

export interface BusMessage {
  id?: string;
  type: string;
  source: string;
  target?: string | string[];
  priority: number;
  metadata?: Record<string, unknown>;
  data?: unknown;
}

export class MessageFilterMatcher {
  static matches(message: BusMessage, filter?: MessageFilter): boolean {
    if (filter == null) return true;

    return (
      this.matchesType(message, filter) &&
      this.matchesSource(message, filter) &&
      this.matchesTarget(message, filter) &&
      this.matchesPriority(message, filter) &&
      this.matchesMetadata(message, filter)
    );
  }

  private static matchesType(
    message: BusMessage,
    filter: MessageFilter
  ): boolean {
    if (filter.type == null || filter.type.length === 0) return true;

    const types = Array.isArray(filter.type) ? filter.type : [filter.type];
    return types.includes(message.type);
  }

  private static matchesSource(
    message: BusMessage,
    filter: MessageFilter
  ): boolean {
    if (filter.source == null || filter.source.length === 0) return true;

    const sources = Array.isArray(filter.source)
      ? filter.source
      : [filter.source];
    return sources.includes(message.source);
  }

  private static matchesTarget(
    message: BusMessage,
    filter: MessageFilter
  ): boolean {
    if (filter.target == null || message.target == null) return true;

    const filterTargets = Array.isArray(filter.target)
      ? filter.target
      : [filter.target];
    const messageTargets = Array.isArray(message.target)
      ? message.target
      : [message.target];

    return filterTargets.some((ft) => messageTargets.includes(ft));
  }

  private static matchesPriority(
    message: BusMessage,
    filter: MessageFilter
  ): boolean {
    if (!filter.priority) return true;

    const { min, max } = filter.priority;

    if (min !== undefined && message.priority < min) return false;
    if (max !== undefined && message.priority > max) return false;

    return true;
  }

  private static matchesMetadata(
    message: BusMessage,
    filter: MessageFilter
  ): boolean {
    if (filter.metadata == null) return true;
    if (message.metadata == null) return false;

    for (const [key, value] of Object.entries(filter.metadata)) {
      if (message.metadata[key] !== value) return false;
    }

    return true;
  }
}
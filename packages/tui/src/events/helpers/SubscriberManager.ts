import { BusMessage } from './MessageQueue';

export class MessageFilter {
  type?: string | string[];
  source?: string | string[];
  target?: string | string[];
  priority?: { min?: number; max?: number };
  metadata?: Record<string, unknown>;
}

export class Subscriber {
  id!: string;
  name!: string;
  filter?: MessageFilter;
  handler!: (message: BusMessage) => void | Promise<void>;
  subscribed!: number;
  messagesReceived!: number;
  lastMessage?: number;
  active!: boolean;
}

export class SubscriberManager {
  private subscribers = new Map<string, Subscriber>();
  private subscriberIdCounter = 0;

  public subscribe(
    name: string,
    handler: (message: BusMessage) => void | Promise<void>,
    filter?: MessageFilter
  ): string {
    const id = `sub-${++this.subscriberIdCounter}`;

    const subscriber: Subscriber = {
      id,
      name,
      filter,
      handler,
      subscribed: Date.now(),
      messagesReceived: 0,
      active: true,
    };

    this.subscribers.set(id, subscriber);
    return id;
  }

  public unsubscribe(subscriberId: string): boolean {
    return this.subscribers.delete(subscriberId);
  }

  public getSubscriber(id: string): Subscriber | null {
    return this.subscribers.get(id) ?? null;
  }

  public getAllSubscribers(): Subscriber[] {
    return Array.from(this.subscribers.values());
  }

  public getActiveSubscribers(): Subscriber[] {
    return Array.from(this.subscribers.values()).filter((sub) => sub.active);
  }

  public setSubscriberActive(id: string, active: boolean): boolean {
    const subscriber = this.subscribers.get(id);
    if (subscriber != null) {
      subscriber.active = active;
      return true;
    }
    return false;
  }

  public getTargetSubscribers(
    message: BusMessage,
    filterMatcher: (message: BusMessage, filter?: MessageFilter) => boolean,
    targetMatcher: (
      message: BusMessage,
      subscriberId: string,
      subscriberName: string
    ) => boolean
  ): Subscriber[] {
    const subscribers: Subscriber[] = [];

    for (const subscriber of this.subscribers.values()) {
      if (!subscriber.active) continue;

      if (filterMatcher(message, subscriber.filter)) {
        if (targetMatcher(message, subscriber.id, subscriber.name)) {
          subscribers.push(subscriber);
        }
      }
    }

    return subscribers;
  }

  public updateSubscriberStats(subscriberId: string): void {
    const subscriber = this.subscribers.get(subscriberId);
    if (subscriber != null) {
      subscriber.messagesReceived++;
      subscriber.lastMessage = Date.now();
    }
  }

  public getSubscriberCount(): number {
    return this.subscribers.size;
  }

  public getActiveSubscriberCount(): number {
    return Array.from(this.subscribers.values()).filter((sub) => sub.active)
      .length;
  }

  public getSubscriberStats(): {
    total: number;
    active: number;
    inactive: number;
    totalMessages: number;
    averageMessages: number;
  } {
    const subscribers = Array.from(this.subscribers.values());
    const active = subscribers.filter((sub) => sub.active);
    const totalMessages = subscribers.reduce(
      (sum, sub) => sum + sub.messagesReceived,
      0
    );

    return {
      total: subscribers.length,
      active: active.length,
      inactive: subscribers.length - active.length,
      totalMessages,
      averageMessages:
        subscribers.length > 0 ? totalMessages / subscribers.length : 0,
    };
  }

  public findSubscribersByFilter(
    searchFilter: Partial<MessageFilter>
  ): Subscriber[] {
    return Array.from(this.subscribers.values()).filter((subscriber) => {
      if (subscriber.filter == null) return false;

      // Simple matching - can be enhanced
      if (
        searchFilter.type != null &&
        subscriber.filter.type !== searchFilter.type
      ) {
        return false;
      }

      if (
        searchFilter.source != null &&
        subscriber.filter.source !== searchFilter.source
      ) {
        return false;
      }

      return true;
    });
  }

  public validateSubscriber(id: string): {
    exists: boolean;
    active: boolean;
    lastActivity?: number;
    messageCount: number;
  } {
    const subscriber = this.subscribers.get(id);

    if (subscriber == null) {
      return { exists: false, active: false, messageCount: 0 };
    }

    return {
      exists: true,
      active: subscriber.active,
      lastActivity: subscriber.lastMessage,
      messageCount: subscriber.messagesReceived,
    };
  }

  public cleanup(): number {
    const before = this.subscribers.size;
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // 24 hours

    for (const [id, subscriber] of this.subscribers.entries()) {
      if (
        !subscriber.active &&
        (subscriber.lastMessage == null || subscriber.lastMessage < cutoff)
      ) {
        this.subscribers.delete(id);
      }
    }

    return before - this.subscribers.size;
  }

  public clear(): void {
    this.subscribers.clear();
  }

  public export(): Record<string, Omit<Subscriber, 'handler'>> {
    const exported: Record<string, Omit<Subscriber, 'handler'>> = {};

    for (const [id, subscriber] of this.subscribers.entries()) {
      const { handler: _handler, ...subscriberData } = subscriber;
      exported[id] = subscriberData;
    }

    return exported;
  }
}

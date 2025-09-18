import { EventHandler } from '../framework/UIFramework';

interface EventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  once: boolean;
  priority: number;
  subscribedAt: number;
  metadata?: Record<string, unknown>;
}

interface EventEmission {
  event: string;
  data: unknown;
  timestamp: number;
  source?: string;
  propagationStopped: boolean;
  handled: boolean;
}

export class EventManagerCore {
  protected subscriptions = new Map<string, Set<EventSubscription>>();
  protected subscriptionId = 0;
  protected eventHistory: EventEmission[] = [];
  protected maxHistorySize = 1000;
  protected globalHandlers = new Set<EventHandler>();
  protected isPaused = false;
  protected pausedEvents: EventEmission[] = [];

  protected recordEmission(emission: EventEmission): void {
    // Keep history limited
    if (this.eventHistory.length >= this.maxHistorySize) {
      this.eventHistory.shift();
    }
    this.eventHistory.push(emission);
  }

  protected handleEventError(
    error: Error,
    emission?: EventEmission,
    subscription?: EventSubscription
  ): void {
    console.error(`Event handling error for '${emission?.event}':`, error);

    // Emit error event
    const errorEmission: EventEmission = {
      event: 'eventError',
      data: { error, originalEvent: emission?.event, subscription },
      timestamp: Date.now(),
      source: 'EventManager',
      propagationStopped: false,
      handled: false,
    };

    // Process error emission without recursion
    setTimeout(() => this.processEmission(errorEmission), 0);
  }

  protected processEmission(emission: EventEmission): boolean {
    this.recordEmission(emission);
    const count =
      this.executeSubscriptions(emission) +
      this.executeGlobalHandlers(emission);
    return count > 0;
  }

  protected executeSubscriptions(emission: EventEmission): number {
    const subs = this.subscriptions.get(emission.event);
    if (!subs) return 0;

    const sorted = Array.from(subs).sort((a, b) => b.priority - a.priority);
    let count = 0;

    for (const sub of sorted) {
      if (emission.propagationStopped) break;
      if (this.executeHandler(sub, emission, subs)) count++;
    }

    if (subs.size === 0) this.subscriptions.delete(emission.event);
    return count;
  }

  protected executeGlobalHandlers(emission: EventEmission): number {
    let count = 0;
    this.globalHandlers.forEach((handler) => {
      try {
        handler(emission);
        count++;
      } catch (error) {
        this.handleEventError(error as Error, emission);
      }
    });
    return count;
  }

  protected executeHandler(
    subscription: EventSubscription,
    emission: EventEmission,
    subscriptions: Set<EventSubscription>
  ): boolean {
    try {
      subscription.handler(emission);

      // Handle once subscriptions
      if (subscription.once) {
        subscriptions.delete(subscription);
      }

      return true;
    } catch (error) {
      this.handleEventError(error as Error, emission, subscription);
      return false;
    }
  }

  public getEventHistory(event?: string, limit?: number): EventEmission[] {
    let history = this.eventHistory;

    if (event != null && event.length > 0) {
      history = history.filter((e) => e.event === event);
    }

    if (limit != null && limit > 0) {
      history = history.slice(-limit);
    }

    return [...history];
  }

  public getRegisteredEvents(): string[] {
    return Array.from(this.subscriptions.keys());
  }

  public hasSubscriptions(event: string): boolean {
    const subscriptions = this.subscriptions.get(event);
    return subscriptions ? subscriptions.size > 0 : false;
  }

  public getSubscriptionCount(event?: string): number {
    if (event != null && event.length > 0) {
      const subscriptions = this.subscriptions.get(event);
      return subscriptions ? subscriptions.size : 0;
    }

    let total = 0;
    this.subscriptions.forEach((subscriptions) => {
      total += subscriptions.size;
    });
    return total;
  }

  public clear(): void {
    this.subscriptions.clear();
    this.eventHistory = [];
    this.globalHandlers.clear();
    this.pausedEvents = [];
    this.isPaused = false;
    this.subscriptionId = 0;
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;
    // Process paused events
    const events = [...this.pausedEvents];
    this.pausedEvents = [];
    events.forEach((emission) => this.processEmission(emission));
  }
}

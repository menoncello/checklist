import { EventHandler } from '../framework/UIFramework';
import { EventValidator } from './EventValidator';

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

interface EventMetrics {
  subscriptionCount: number;
  emissionCount: number;
  handlerExecutions: number;
  totalHandlerTime: number;
  averageHandlerTime: number;
  errorCount: number;
  lastEmission: number;
}

interface EventSubscriptionOptions {
  once?: boolean;
  priority?: number;
  metadata?: Record<string, unknown>;
}

export interface EventManagerDebugInfo {
  totalSubscriptions: number;
  totalEvents: number;
  totalEmissions: number;
  isPaused: boolean;
  pausedEventCount: number;
  globalHandlerCount: number;
  subscriptionsByEvent: Record<string, number>;
  recentEmissions: EventEmission[];
}

export interface EventManagerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class EventManager {
  private subscriptions = new Map<string, Set<EventSubscription>>();
  private subscriptionId = 0;
  private eventHistory: EventEmission[] = [];
  private maxHistorySize = 1000;
  private globalHandlers = new Set<EventHandler>();
  private eventMetrics = new Map<string, EventMetrics>();
  private isPaused = false;
  private pausedEvents: EventEmission[] = [];
  private validator = new EventValidator(
    this.eventMetrics,
    this.eventHistory,
    this.maxHistorySize
  );

  public on(
    event: string,
    handler: EventHandler,
    options: EventSubscriptionOptions = {}
  ): string {
    const subscription: EventSubscription = {
      id: `sub-${++this.subscriptionId}`,
      event,
      handler,
      once: options.once ?? false,
      priority: options.priority ?? 0,
      subscribedAt: Date.now(),
      metadata: options.metadata,
    };

    if (!this.subscriptions.has(event)) {
      this.subscriptions.set(event, new Set());
    }

    const subs = this.subscriptions.get(event);
    if (subs != null) {
      subs.add(subscription);
    }

    // Sort by priority (higher priority first)
    this.sortSubscriptionsByPriority(event);

    this.updateEventMetrics(event, 'subscription_added');
    return subscription.id;
  }

  public once(
    event: string,
    handler: EventHandler,
    options: EventSubscriptionOptions = {}
  ): string {
    return this.on(event, handler, { ...options, once: true });
  }

  public off(event: string, handler?: EventHandler): number {
    if (!this.subscriptions.has(event)) return 0;

    const subscriptions = this.subscriptions.get(event);
    if (subscriptions == null) return 0;
    let removedCount = 0;

    if (handler) {
      // Remove specific handler
      for (const subscription of subscriptions) {
        if (subscription.handler === handler) {
          subscriptions.delete(subscription);
          removedCount++;
        }
      }
    } else {
      // Remove all handlers for the event
      removedCount = subscriptions.size;
      subscriptions.clear();
    }

    if (subscriptions.size === 0) {
      this.subscriptions.delete(event);
    }

    this.updateEventMetrics(event, 'subscription_removed', removedCount);
    return removedCount;
  }

  public offById(subscriptionId: string): boolean {
    for (const [event, subscriptions] of this.subscriptions) {
      for (const subscription of subscriptions) {
        if (subscription.id !== subscriptionId) {
          continue;
        }

        subscriptions.delete(subscription);
        if (subscriptions.size === 0) {
          this.subscriptions.delete(event);
        }
        this.updateEventMetrics(event, 'subscription_removed');
        return true;
      }
    }
    return false;
  }

  public emit(event: string, data?: unknown, source?: string): boolean {
    const emission: EventEmission = {
      event,
      data,
      timestamp: Date.now(),
      source,
      propagationStopped: false,
      handled: false,
    };

    if (this.isPaused) {
      this.pausedEvents.push(emission);
      return false;
    }

    return this.processEmission(emission);
  }

  private processEmission(emission: EventEmission): boolean {
    this.recordEmission(emission);
    const count =
      this.executeSubscriptions(emission) +
      this.executeGlobalHandlers(emission);
    this.updateEventMetrics(emission.event, 'emission_processed', count);
    return count > 0;
  }

  private executeSubscriptions(emission: EventEmission): number {
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

  private executeGlobalHandlers(emission: EventEmission): number {
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

  private executeHandler(
    subscription: EventSubscription,
    emission: EventEmission,
    subscriptions: Set<EventSubscription>
  ): boolean {
    try {
      const startTime = performance.now();
      subscription.handler(emission.data);
      const endTime = performance.now();

      emission.handled = true;

      this.updateEventMetrics(
        emission.event,
        'handler_executed',
        1,
        endTime - startTime
      );

      // Remove one-time subscriptions
      if (subscription.once) {
        subscriptions.delete(subscription);
      }

      return true;
    } catch (error) {
      this.handleEventError(error as Error, emission, subscription);
      return false;
    }
  }

  public stopPropagation(event: string): void {
    // This would be called by handlers to stop further propagation
    // Implementation depends on how we track current emission
    const currentEmission = this.getCurrentEmission(event);
    if (currentEmission) {
      currentEmission.propagationStopped = true;
    }
  }

  private getCurrentEmission(event: string): EventEmission | null {
    // Find the most recent emission of this event type
    return (
      this.eventHistory
        .slice()
        .reverse()
        .find((emission) => emission.event === event) ?? null
    );
  }

  private recordEmission(emission: EventEmission): void {
    this.eventHistory.push(emission);

    // Trim history if it exceeds max size
    if (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory = this.eventHistory.slice(-this.maxHistorySize);
    }
  }

  private sortSubscriptionsByPriority(event: string): void {
    const subscriptions = this.subscriptions.get(event);
    if (subscriptions) {
      // Convert to array, sort, and create new Set
      const sortedArray = Array.from(subscriptions).sort(
        (a, b) => b.priority - a.priority
      );
      this.subscriptions.set(event, new Set(sortedArray));
    }
  }

  private handleEventError(
    error: Error,
    emission: EventEmission,
    subscription?: EventSubscription
  ): void {
    console.error(`Event handling error for '${emission.event}':`, error);

    // Emit error event
    const errorEmission: EventEmission = {
      event: 'eventError',
      data: { error, originalEvent: emission.event, subscription },
      timestamp: Date.now(),
      source: 'EventManager',
      propagationStopped: false,
      handled: false,
    };

    // Process error emission without recursion
    setTimeout(() => this.processEmission(errorEmission), 0);
  }

  private updateEventMetrics(
    event: string,
    action: string,
    count: number = 1,
    duration?: number
  ): void {
    this.validator.updateMetrics(event, action, count, duration);
  }

  public addGlobalHandler(handler: EventHandler): void {
    this.globalHandlers.add(handler);
  }

  public removeGlobalHandler(handler: EventHandler): void {
    this.globalHandlers.delete(handler);
  }

  public pause(): void {
    this.isPaused = true;
  }

  public resume(): void {
    this.isPaused = false;

    // Process paused events
    const pausedEvents = [...this.pausedEvents];
    this.pausedEvents = [];

    pausedEvents.forEach((emission) => {
      this.processEmission(emission);
    });
  }

  public isPausedState(): boolean {
    return this.isPaused;
  }

  public clearPausedEvents(): void {
    this.pausedEvents = [];
  }

  public getSubscriptions(event?: string): EventSubscription[] {
    if (event != null && event.length > 0) {
      const subscriptions = this.subscriptions.get(event);
      return subscriptions ? Array.from(subscriptions) : [];
    }

    const allSubscriptions: EventSubscription[] = [];
    this.subscriptions.forEach((subscriptions) => {
      allSubscriptions.push(...Array.from(subscriptions));
    });
    return allSubscriptions;
  }

  public getEventHistory(event?: string, limit?: number): EventEmission[] {
    let history =
      event != null && event.length > 0
        ? this.eventHistory.filter((emission) => emission.event === event)
        : [...this.eventHistory];

    if (limit != null && limit !== 0) {
      history = history.slice(-limit);
    }

    return history;
  }

  public getEventMetrics(
    event?: string
  ): EventMetrics | Map<string, EventMetrics> {
    if (event != null && event.length > 0) {
      return (
        this.eventMetrics.get(event) ?? {
          subscriptionCount: 0,
          emissionCount: 0,
          handlerExecutions: 0,
          totalHandlerTime: 0,
          averageHandlerTime: 0,
          errorCount: 0,
          lastEmission: 0,
        }
      );
    }

    return new Map(this.eventMetrics);
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
    this.eventMetrics.clear();
    this.pausedEvents = [];
    this.isPaused = false;
    this.subscriptionId = 0;
  }

  public debug(): EventManagerDebugInfo {
    return {
      totalSubscriptions: this.getSubscriptionCount(),
      totalEvents: this.getRegisteredEvents().length,
      totalEmissions: this.eventHistory.length,
      isPaused: this.isPaused,
      pausedEventCount: this.pausedEvents.length,
      globalHandlerCount: this.globalHandlers.size,
      subscriptionsByEvent: Object.fromEntries(
        Array.from(this.subscriptions.entries()).map(([event, subs]) => [
          event,
          subs.size,
        ])
      ),
      recentEmissions: this.getEventHistory(undefined, 10),
    };
  }

  public validate(): EventManagerValidationResult {
    return this.validator.validate(
      (event?: string) => this.getSubscriptionCount(event),
      () => this.getRegisteredEvents()
    );
  }
}

// Types are imported from ./types.ts

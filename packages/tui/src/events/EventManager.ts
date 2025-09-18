import { EventHandler } from '../framework/UIFramework';
import { EventManagerCore } from './EventManagerCore';
import { EventValidator } from './EventValidator';

export interface EventManagerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface EventSubscription {
  id: string;
  event: string;
  handler: EventHandler;
  once: boolean;
  priority: number;
  subscribedAt: number;
  metadata?: Record<string, unknown>;
}

export interface EventEmission {
  event: string;
  data: unknown;
  timestamp: number;
  source?: string;
  propagationStopped: boolean;
  handled: boolean;
}

export interface EventMetrics {
  subscriptionCount: number;
  emissionCount: number;
  handlerExecutions: number;
  totalHandlerTime: number;
  averageHandlerTime: number;
  errorCount: number;
  lastEmission: number;
}

export interface EventSubscriptionOptions {
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

export class EventManager extends EventManagerCore {
  private eventMetrics = new Map<string, EventMetrics>();
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

    const subscriptions = this.subscriptions.get(event);
    if (subscriptions != null) {
      subscriptions.add(subscription);
      this.updateEventMetrics(event, 'subscription_added');
    }

    return subscription.id;
  }

  public once(event: string, handler: EventHandler): string {
    return this.on(event, handler, { once: true });
  }

  public off(event: string, handlerOrId?: EventHandler | string): number {
    const subscriptions = this.subscriptions.get(event);
    if (!subscriptions) return 0;

    let removedCount = 0;

    if (handlerOrId == null) {
      const count = subscriptions.size;
      subscriptions.clear();
      this.subscriptions.delete(event);
      this.updateEventMetrics(event, 'subscription_removed', count);
      return count;
    }

    subscriptions.forEach((subscription) => {
      const shouldRemove =
        typeof handlerOrId === 'string'
          ? subscription.id === handlerOrId
          : subscription.handler === handlerOrId;

      if (shouldRemove) {
        subscriptions.delete(subscription);
        removedCount++;
        this.updateEventMetrics(event, 'subscription_removed');
      }
    });

    if (subscriptions.size === 0) {
      this.subscriptions.delete(event);
    }

    return removedCount;
  }

  public emit(event: string, data?: unknown, source?: string): boolean {
    const emission: EventEmission = {
      event,
      data,
      timestamp: Date.now(),
      source: source ?? 'manual',
      propagationStopped: false,
      handled: false,
    };

    if (this.isPaused) {
      this.pausedEvents.push(emission);
      return false;
    }

    return this.processEmission(emission);
  }

  protected processEmission(emission: EventEmission): boolean {
    const result = super.processEmission(emission);
    this.updateEventMetrics(
      emission.event,
      'emission_processed',
      result ? 1 : 0
    );
    return result;
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

  public removeGlobalHandler(handler: EventHandler): boolean {
    return this.globalHandlers.delete(handler);
  }

  public removeAllSubscriptions(event?: string): void {
    if (event != null && event.length > 0) {
      this.subscriptions.delete(event);
    } else {
      this.subscriptions.clear();
    }
  }

  public stopPropagation(emission: EventEmission): void {
    emission.propagationStopped = true;
  }

  public getMetrics(event?: string): EventMetrics | Map<string, EventMetrics> {
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

  public getDebugInfo(): EventManagerDebugInfo {
    return {
      totalSubscriptions: this.getSubscriptionCount(),
      totalEvents: this.subscriptions.size,
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

  // Additional methods for test compatibility
  public getSubscriptions(event?: string): EventSubscription[] {
    if (event != null && event !== '') {
      const eventSubscriptions = this.subscriptions.get(event);
      return eventSubscriptions ? Array.from(eventSubscriptions) : [];
    }

    const allSubscriptions: EventSubscription[] = [];
    this.subscriptions.forEach((subs) => {
      allSubscriptions.push(...Array.from(subs));
    });
    return allSubscriptions;
  }

  public offById(subscriptionId: string): boolean {
    let found = false;

    this.subscriptions.forEach((subscriptions, event) => {
      subscriptions.forEach((subscription) => {
        if (subscription.id === subscriptionId) {
          subscriptions.delete(subscription);
          found = true;
          this.updateEventMetrics(event, 'subscription_removed');

          // Clean up empty subscription sets
          if (subscriptions.size === 0) {
            this.subscriptions.delete(event);
          }
        }
      });
    });

    return found;
  }
}

interface EventMetrics {
  subscriptionCount: number;
  emissionCount: number;
  handlerExecutions: number;
  totalHandlerTime: number;
  averageHandlerTime: number;
  errorCount: number;
  lastEmission: number;
}

export interface EventManagerValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class EventValidator {
  private eventMetrics: Map<string, EventMetrics>;
  private eventHistory: unknown[];
  private maxHistorySize: number;

  constructor(
    eventMetrics: Map<string, EventMetrics>,
    eventHistory: unknown[],
    maxHistorySize: number
  ) {
    this.eventMetrics = eventMetrics;
    this.eventHistory = eventHistory;
    this.maxHistorySize = maxHistorySize;
  }

  public validate(
    getSubscriptionCount: (event?: string) => number,
    getRegisteredEvents: () => string[]
  ): EventManagerValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.checkSubscriptionCount(warnings, getSubscriptionCount);
    this.checkEventHistory(warnings);
    this.checkUnsubscribedEvents(
      warnings,
      getRegisteredEvents,
      getSubscriptionCount
    );
    this.checkErrorRates(warnings);

    return { isValid: errors.length === 0, errors, warnings };
  }

  private checkSubscriptionCount(
    warnings: string[],
    getSubscriptionCount: (event?: string) => number
  ): void {
    const count = getSubscriptionCount();
    if (count > 1000) warnings.push(`High subscription count: ${count}`);
  }

  private checkEventHistory(warnings: string[]): void {
    if (this.eventHistory.length >= this.maxHistorySize) {
      warnings.push('Event history at maximum size, potential memory concern');
    }
  }

  private checkUnsubscribedEvents(
    warnings: string[],
    getRegisteredEvents: () => string[],
    getSubscriptionCount: (event?: string) => number
  ): void {
    const unsubscribed = getRegisteredEvents().filter(
      (e) => getSubscriptionCount(e) === 0
    );
    if (unsubscribed.length > 0)
      warnings.push(`${unsubscribed.length} event(s) with no subscriptions`);
  }

  private checkErrorRates(warnings: string[]): void {
    this.eventMetrics.forEach((metrics, event) => {
      if (metrics.errorCount > 0 && metrics.emissionCount > 0) {
        const rate = metrics.errorCount / metrics.emissionCount;
        if (rate > 0.1)
          warnings.push(
            `High error rate for event '${event}': ${(rate * 100).toFixed(1)}%`
          );
      }
    });
  }

  public updateMetrics(
    event: string,
    action: string,
    count: number = 1,
    duration?: number
  ): void {
    const metrics = this.getOrCreateMetrics(event);
    this.applyMetricUpdate(metrics, action, count, duration);
  }

  private getOrCreateMetrics(event: string): EventMetrics {
    let metrics = this.eventMetrics.get(event);
    if (!metrics) {
      metrics = {
        subscriptionCount: 0,
        emissionCount: 0,
        handlerExecutions: 0,
        totalHandlerTime: 0,
        averageHandlerTime: 0,
        errorCount: 0,
        lastEmission: 0,
      };
      this.eventMetrics.set(event, metrics);
    }
    return metrics;
  }

  private applyMetricUpdate(
    m: EventMetrics,
    action: string,
    count: number,
    duration?: number
  ): void {
    switch (action) {
      case 'subscription_added':
        m.subscriptionCount += count;
        break;
      case 'subscription_removed':
        m.subscriptionCount -= count;
        break;
      case 'emission_processed':
        m.emissionCount++;
        m.lastEmission = Date.now();
        break;
      case 'handler_executed':
        this.updateHandlerMetrics(m, count, duration);
        break;
      case 'error':
        m.errorCount++;
        break;
    }
  }

  private updateHandlerMetrics(
    m: EventMetrics,
    count: number,
    duration?: number
  ): void {
    m.handlerExecutions += count;
    if (duration !== undefined) {
      m.totalHandlerTime += duration;
      m.averageHandlerTime = m.totalHandlerTime / m.handlerExecutions;
    }
  }
}

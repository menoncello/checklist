import { EventBus, BusMessage } from '../../src/events/EventBus';

/**
 * EventTestHelper - Utility for testing event-driven code without spy interference
 *
 * Solves the problem of spying on EventBus.publish() which prevents actual event delivery.
 * Instead, subscribes to events and captures them for assertions.
 *
 * @example
 * ```typescript
 * const helper = new EventTestHelper(eventBus);
 *
 * // Trigger some action that publishes events
 * await someAction();
 *
 * // Wait for specific event
 * const event = await helper.waitForEvent('my-event', 1000);
 * expect(event.data.value).toBe(42);
 *
 * // Or get all events
 * const allEvents = helper.getEvents();
 * expect(allEvents).toHaveLength(3);
 *
 * // Cleanup
 * helper.cleanup();
 * ```
 */
export class EventTestHelper {
  private events: BusMessage[] = [];
  private subscriptionIds: string[] = [];
  private eventBus: EventBus;
  private waitingPromises = new Map<
    string,
    { resolve: (value: BusMessage) => void; reject: (error: Error) => void; timeoutId: NodeJS.Timeout }
  >();

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
    this.setupGlobalListener();
  }

  /**
   * Sets up a listener that captures ALL events published to the EventBus
   */
  private setupGlobalListener(): void {
    // Subscribe to '*' wildcard to catch all event types
    // If wildcard not supported, we'll need to subscribe to each type individually
    const subscriptionId = this.eventBus.subscribe(
      '*',
      (message: BusMessage) => {
        this.events.push(message);

        // Resolve any waiting promises for this event type
        const waiting = this.waitingPromises.get(message.type);
        if (waiting) {
          clearTimeout(waiting.timeoutId);
          waiting.resolve(message);
          this.waitingPromises.delete(message.type);
        }
      },
      // Use empty filter object that catches everything
      {} as any
    );

    this.subscriptionIds.push(subscriptionId);
  }

  /**
   * Wait for a specific event type to be published
   *
   * @param eventType - The event type to wait for
   * @param timeout - Maximum time to wait in milliseconds (default: 1000)
   * @returns Promise that resolves with the event data
   * @throws Error if timeout is reached
   */
  public waitForEvent(eventType: string, timeout = 1000): Promise<BusMessage> {
    // Check if event already captured
    const existingEvent = this.events.find((e) => e.type === eventType);
    if (existingEvent) {
      return Promise.resolve(existingEvent);
    }

    // Create promise that waits for event
    return new Promise<BusMessage>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.waitingPromises.delete(eventType);
        reject(new Error(`Timeout waiting for event '${eventType}' after ${timeout}ms`));
      }, timeout);

      this.waitingPromises.set(eventType, { resolve, reject, timeoutId });
    });
  }

  /**
   * Wait for multiple events in sequence
   *
   * @param eventTypes - Array of event types to wait for
   * @param timeout - Maximum time to wait for each event
   * @returns Promise that resolves with array of events
   */
  public async waitForEvents(eventTypes: string[], timeout = 1000): Promise<BusMessage[]> {
    const results: BusMessage[] = [];

    for (const eventType of eventTypes) {
      const event = await this.waitForEvent(eventType, timeout);
      results.push(event);
    }

    return results;
  }

  /**
   * Wait for ANY of the specified events to occur
   *
   * @param eventTypes - Array of event types to wait for
   * @param timeout - Maximum time to wait
   * @returns Promise that resolves with the first matching event
   */
  public waitForAnyEvent(eventTypes: string[], timeout = 1000): Promise<BusMessage> {
    // Check if any event already captured
    const existingEvent = this.events.find((e) => eventTypes.includes(e.type));
    if (existingEvent) {
      return Promise.resolve(existingEvent);
    }

    return new Promise<BusMessage>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        eventTypes.forEach((type) => this.waitingPromises.delete(type));
        reject(new Error(`Timeout waiting for any of [${eventTypes.join(', ')}] after ${timeout}ms`));
      }, timeout);

      const sharedPromise = {
        resolve: (value: BusMessage) => {
          clearTimeout(timeoutId);
          eventTypes.forEach((type) => this.waitingPromises.delete(type));
          resolve(value);
        },
        reject,
        timeoutId
      };

      eventTypes.forEach((type) => {
        this.waitingPromises.set(type, sharedPromise);
      });
    });
  }

  /**
   * Get all captured events, optionally filtered by type
   *
   * @param eventType - Optional event type to filter by
   * @returns Array of captured events
   */
  public getEvents(eventType?: string): BusMessage[] {
    if (eventType) {
      return this.events.filter((e) => e.type === eventType);
    }
    return [...this.events];
  }

  /**
   * Get the last event of a specific type
   *
   * @param eventType - The event type to search for
   * @returns The last event of that type, or undefined if not found
   */
  public getLastEvent(eventType: string): BusMessage | undefined {
    const filtered = this.events.filter((e) => e.type === eventType);
    return filtered[filtered.length - 1];
  }

  /**
   * Get the count of events, optionally filtered by type
   *
   * @param eventType - Optional event type to filter by
   * @returns Number of events
   */
  public getEventCount(eventType?: string): number {
    return this.getEvents(eventType).length;
  }

  /**
   * Check if a specific event type was published
   *
   * @param eventType - The event type to check
   * @returns true if at least one event of that type was captured
   */
  public hasEvent(eventType: string): boolean {
    return this.events.some((e) => e.type === eventType);
  }

  /**
   * Clear all captured events
   */
  public clear(): void {
    this.events = [];
  }

  /**
   * Clean up all subscriptions and pending promises
   * Should be called in test teardown (afterEach)
   */
  public cleanup(): void {
    // Clear all timeouts
    this.waitingPromises.forEach(({ timeoutId, reject }) => {
      clearTimeout(timeoutId);
      reject(new Error('EventTestHelper cleaned up'));
    });
    this.waitingPromises.clear();

    // Unsubscribe from EventBus
    this.subscriptionIds.forEach((id) => {
      try {
        this.eventBus.unsubscribe(id);
      } catch (error) {
        // Ignore errors during cleanup
      }
    });
    this.subscriptionIds = [];

    // Clear events
    this.events = [];
  }

  /**
   * Get a summary of all event types captured (useful for debugging)
   *
   * @returns Object with event types as keys and counts as values
   */
  public getEventSummary(): Record<string, number> {
    const summary: Record<string, number> = {};

    this.events.forEach((event) => {
      summary[event.type] = (summary[event.type] || 0) + 1;
    });

    return summary;
  }

  /**
   * Wait for all pending events to be processed
   * Useful when you want to ensure the event queue is empty
   *
   * @param maxWait - Maximum time to wait in milliseconds
   * @returns Promise that resolves when queue appears idle
   */
  public async waitForIdle(maxWait = 500): Promise<void> {
    const startCount = this.events.length;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 50));

      // If no new events in last 50ms, consider idle
      if (this.events.length === startCount) {
        return;
      }
    }
  }
}
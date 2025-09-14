import { BusMetrics } from './helpers/BusMetrics';
import { MessageMatcher } from './helpers/MessageMatcher';
import { MessageQueue, BusMessage } from './helpers/MessageQueue';
import {
  SubscriberManager,
  Subscriber,
  MessageFilter,
} from './helpers/SubscriberManager';

export { BusMessage, MessageFilter, Subscriber };

export interface EventBusDebugInfo {
  queueSize: number;
  subscriberCount: number;
  activeSubscribers: number;
  metrics: ReturnType<BusMetrics['getMetrics']>;
  subscribers: Subscriber[];
}

export interface EventBusValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class EventBus {
  private messageQueue: MessageQueue;
  private subscriberManager: SubscriberManager;
  private busMetrics: BusMetrics;
  private messageIdCounter = 0;

  constructor(
    options: {
      maxQueueSize?: number;
      maxHistorySize?: number;
      batchSize?: number;
    } = {}
  ) {
    this.messageQueue = new MessageQueue(
      options.maxQueueSize,
      options.maxHistorySize,
      options.batchSize
    );
    this.subscriberManager = new SubscriberManager();
    this.busMetrics = new BusMetrics();
  }

  public subscribe(
    name: string,
    handler: (message: BusMessage) => void | Promise<void>,
    filter?: MessageFilter
  ): string {
    return this.subscriberManager.subscribe(name, handler, filter);
  }

  public unsubscribe(subscriberId: string): boolean {
    return this.subscriberManager.unsubscribe(subscriberId);
  }

  public publish(
    type: string,
    data: unknown,
    options: {
      source?: string;
      target?: string | string[];
      priority?: number;
      ttl?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    const message = this.createMessage(type, data, options);
    return this.publishMessage(message);
  }

  public publishSync(
    type: string,
    data: unknown,
    options: {
      source?: string;
      target?: string | string[];
      priority?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): void {
    const message = this.createMessage(type, data, options);
    this.deliverMessageSync(message);
  }

  private createMessage(
    type: string,
    data: unknown,
    options: {
      source?: string;
      target?: string | string[];
      priority?: number;
      ttl?: number;
      metadata?: Record<string, unknown>;
    }
  ): BusMessage {
    return {
      id: `msg-${++this.messageIdCounter}`,
      type,
      data,
      source: options.source ?? 'unknown',
      target: options.target,
      timestamp: Date.now(),
      priority: options.priority ?? 0,
      ttl: options.ttl,
      metadata: options.metadata,
    };
  }

  private async publishMessage(message: BusMessage): Promise<void> {
    const validation = MessageMatcher.validateMessage(message);
    if (!validation.isValid) {
      throw new Error(`Invalid message: ${validation.errors.join(', ')}`);
    }

    this.busMetrics.recordMessage();
    this.busMetrics.updatePeakQueueSize(this.messageQueue.getQueueSize() + 1);

    this.messageQueue.enqueue(message);
    await this.messageQueue.processQueue((messages) =>
      this.processBatch(messages)
    );
  }

  private deliverMessageSync(message: BusMessage): void {
    const startTime = performance.now();
    const targetSubscribers = this.getTargetSubscribers(message);

    for (const subscriber of targetSubscribers) {
      if (!subscriber.active) continue;

      try {
        const result = subscriber.handler(message);
        if (result instanceof Promise) {
          // For sync delivery, we don't wait for promises
          result.catch((error) => {
            this.busMetrics.recordError();
            console.error(`Error in subscriber '${subscriber.name}':`, error);
          });
        }
        this.subscriberManager.updateSubscriberStats(subscriber.id);
      } catch (error) {
        this.busMetrics.recordError();
        console.error(`Error in subscriber '${subscriber.name}':`, error);
      }
    }

    this.messageQueue.recordMessage(message);
    this.busMetrics.recordProcessedMessage(performance.now() - startTime);
  }

  private async processBatch(messages: BusMessage[]): Promise<void> {
    for (const message of messages) {
      await this.deliverMessage(message);
    }
  }

  private async deliverMessage(message: BusMessage): Promise<void> {
    const startTime = performance.now();
    const targetSubscribers = this.getTargetSubscribers(message);

    for (const subscriber of targetSubscribers) {
      if (!subscriber.active) continue;
      await this.executeSubscriber(subscriber, message);
    }

    this.messageQueue.recordMessage(message);
    this.busMetrics.recordProcessedMessage(performance.now() - startTime);
  }

  private async executeSubscriber(
    subscriber: Subscriber,
    message: BusMessage
  ): Promise<void> {
    try {
      const result = subscriber.handler(message);
      if (result instanceof Promise) {
        await result;
      }
      this.subscriberManager.updateSubscriberStats(subscriber.id);
    } catch (error) {
      this.busMetrics.recordError();
      console.error(`Error in subscriber '${subscriber.name}':`, error);
    }
  }

  private getTargetSubscribers(message: BusMessage): Subscriber[] {
    return this.subscriberManager.getTargetSubscribers(
      message,
      MessageMatcher.matchesFilter,
      MessageMatcher.matchesTarget
    );
  }

  // Delegation methods
  public pause(): void {
    this.messageQueue.pause();
  }

  public resume(): void {
    this.messageQueue.resume();
  }

  public isPaused(): boolean {
    return this.messageQueue.isPaused();
  }

  public getQueueSize(): number {
    return this.messageQueue.getQueueSize();
  }

  public getSubscriberCount(): number {
    return this.subscriberManager.getSubscriberCount();
  }

  public getActiveSubscriberCount(): number {
    return this.subscriberManager.getActiveSubscriberCount();
  }

  public getSubscribers(): Subscriber[] {
    return this.subscriberManager.getAllSubscribers();
  }

  public getSubscriber(id: string): Subscriber | null {
    return this.subscriberManager.getSubscriber(id);
  }

  public setSubscriberActive(id: string, active: boolean): boolean {
    return this.subscriberManager.setSubscriberActive(id, active);
  }

  public getMessageHistory(filter?: {
    type?: string;
    source?: string;
    limit?: number;
    since?: number;
  }): BusMessage[] {
    return this.messageQueue.getMessageHistory(filter);
  }

  public clearHistory(): void {
    this.messageQueue.clearHistory();
  }

  public clearQueue(): void {
    this.messageQueue.clearQueue();
  }

  public getMetrics() {
    return this.busMetrics.getMetrics();
  }

  public setBatchSize(size: number): void {
    this.messageQueue.setBatchSize(size);
  }

  public setMaxQueueSize(size: number): void {
    this.messageQueue.setMaxQueueSize(size);
  }

  public setMaxHistorySize(size: number): void {
    this.messageQueue.setMaxHistorySize(size);
  }

  public createChannel(name: string): EventBusChannel {
    return new EventBusChannel(this, name);
  }

  public debug(): EventBusDebugInfo {
    return {
      queueSize: this.getQueueSize(),
      subscriberCount: this.getSubscriberCount(),
      activeSubscribers: this.getActiveSubscriberCount(),
      metrics: this.getMetrics(),
      subscribers: this.getSubscribers(),
    };
  }

  public validate(): EventBusValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const subscribers = this.getSubscribers();

    // Check for inactive subscribers
    const inactiveCount = subscribers.filter((s) => !s.active).length;
    if (inactiveCount > 0) {
      warnings.push(`${inactiveCount} inactive subscribers found`);
    }

    // Check queue size
    const queueSize = this.getQueueSize();
    if (queueSize > 100) {
      warnings.push(`Large queue size: ${queueSize} messages`);
    }

    // Check metrics for issues
    const metrics = this.getMetrics();
    if (metrics.errorCount > 0) {
      warnings.push(`${metrics.errorCount} errors recorded`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public destroy(): void {
    this.messageQueue.destroy();
    this.subscriberManager.clear();
    this.busMetrics.reset();
  }
}

export class EventBusChannel {
  constructor(
    private bus: EventBus,
    private channelName: string
  ) {}

  public publish(
    type: string,
    data: unknown,
    options: {
      target?: string | string[];
      priority?: number;
      ttl?: number;
      metadata?: Record<string, unknown>;
    } = {}
  ): Promise<void> {
    return this.bus.publish(type, data, {
      ...options,
      source: this.channelName,
    });
  }

  public subscribe(
    name: string,
    handler: (message: BusMessage) => void | Promise<void>,
    filter?: MessageFilter
  ): string {
    const channelFilter: MessageFilter = {
      ...filter,
      source: this.channelName,
    };
    return this.bus.subscribe(name, handler, channelFilter);
  }

  public getName(): string {
    return this.channelName;
  }
}

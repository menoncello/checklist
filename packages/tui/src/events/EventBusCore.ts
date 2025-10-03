import { BusMetrics } from './helpers/BusMetrics';
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
  private destroyed = false;

  constructor() {
    this.messageQueue = new MessageQueue();
    this.subscriberManager = new SubscriberManager();
    this.busMetrics = new BusMetrics();
  }

  public subscribe<T extends BusMessage>(
    messageType: string,
    handler: (message: T) => void,
    filter?: MessageFilter
  ): string {
    this.checkDestroyed();
    const subscriberId = this.subscriberManager.subscribe(
      messageType,
      handler as (message: BusMessage) => void,
      filter
    );
    this.busMetrics.recordSubscription(messageType);
    return subscriberId;
  }

  public unsubscribe<T extends BusMessage>(
    messageTypeOrId: string,
    handler?: (message: T) => void
  ): boolean {
    this.checkDestroyed();

    let result: boolean;
    if (handler) {
      // Unsubscribe by name and handler
      result = this.subscriberManager.unsubscribeByNameAndHandler(
        messageTypeOrId,
        handler as (message: BusMessage) => void
      );
    } else {
      // Unsubscribe by ID
      result = this.subscriberManager.unsubscribe(messageTypeOrId);
    }

    if (result) {
      this.busMetrics.recordUnsubscription(messageTypeOrId);
    }
    return result;
  }

  public publish<T = unknown>(
    messageType: string,
    data: T,
    options?: Partial<BusMessage>
  ): void {
    this.checkDestroyed();

    const message: BusMessage = {
      id: this.generateMessageId(),
      type: messageType,
      data,
      source: 'unknown',
      timestamp: Date.now(),
      priority: 0,
      ...options,
    };

    this.messageQueue.enqueue(message);
    this.busMetrics.recordPublication(messageType);
    this.processQueue();
  }

  public on<T extends BusMessage>(
    eventType: string,
    handler: (message: T) => void
  ): string {
    return this.subscribe(eventType, handler);
  }

  public off<T extends BusMessage>(
    eventType: string,
    handler: (message: T) => void
  ): void {
    this.unsubscribe(eventType, handler);
  }

  public emit<T = unknown>(
    eventType: string,
    data: T,
    options?: Partial<BusMessage>
  ): void {
    this.publish(eventType, data, options);
  }

  private processQueue(): void {
    // Don't process if the queue is paused
    if (this.messageQueue?.isPaused()) {
      return;
    }

    while (this.messageQueue?.isEmpty() === false) {
      const message = this.messageQueue.dequeue();
      if (message === undefined) break;

      this.subscriberManager.deliverMessage(message);
      this.messageQueue.recordMessage(message);
    }
  }

  private generateMessageId(): string {
    return `msg_${this.messageIdCounter++}_${Date.now()}`;
  }

  private checkDestroyed(): void {
    if (this.destroyed) {
      throw new Error('EventBus has been destroyed');
    }
  }

  public getDebugInfo(): EventBusDebugInfo {
    return {
      queueSize: this.messageQueue.size(),
      subscriberCount: this.subscriberManager.getSubscriberCount(),
      activeSubscribers: this.subscriberManager.getActiveSubscriberCount(),
      metrics: this.busMetrics.getMetrics(),
      subscribers: this.subscriberManager.getAllSubscribers(),
    };
  }

  public validate(): EventBusValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (this.messageQueue.size() > 1000) {
      warnings.push('Large message queue detected');
    }

    if (this.subscriberManager.getSubscriberCount() > 100) {
      warnings.push('High subscriber count detected');
    }

    const inactiveCount =
      this.subscriberManager.getSubscriberCount() -
      this.subscriberManager.getActiveSubscriberCount();
    if (inactiveCount > 0) {
      warnings.push(`${inactiveCount} inactive subscribers detected`);
    }

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

  public getMetrics() {
    return this.busMetrics.getMetrics();
  }

  public clear(): void {
    this.messageQueue.clear();
    this.subscriberManager.clear();
    this.busMetrics.reset();
  }

  public destroy(): void {
    this.destroyed = true;
    this.clear();
  }

  public getSubscriberCount(): number {
    return this.subscriberManager.getSubscriberCount();
  }

  public getActiveSubscriberCount(): number {
    return this.subscriberManager.getActiveSubscriberCount();
  }

  public getMessageQueueSize(): number {
    return this.messageQueue.size();
  }

  public getQueueSize(): number {
    return this.messageQueue.size();
  }

  public isPaused(): boolean {
    return this.messageQueue.isPaused();
  }

  public pause(): void {
    this.messageQueue.pause();
  }

  public resume(): void {
    this.messageQueue.resume();
  }

  public clearQueue(): void {
    this.messageQueue.clearQueue();
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

  public getMessageHistory(filter?: {
    type?: string;
    source?: string;
    limit?: number;
    since?: number;
  }): BusMessage[] {
    return this.messageQueue.getMessageHistory(filter);
  }

  public clearMessageHistory(): void {
    this.messageQueue.clearHistory();
  }

  public createChannel(name: string): EventBusChannel {
    return new EventBusChannel(this, name);
  }

  public isDestroyed(): boolean {
    return this.destroyed;
  }

  public debug(): EventBusDebugInfo {
    return this.getDebugInfo();
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
}

export class EventBusChannel {
  constructor(
    private eventBus: EventBus,
    public readonly name: string
  ) {}

  public publish<T = unknown>(
    messageType: string,
    data: T,
    options?: Partial<BusMessage>
  ): void {
    this.eventBus.publish(messageType, data, { ...options, source: this.name });
  }

  public subscribe<T extends BusMessage>(
    messageType: string,
    handler: (message: T) => void,
    filter?: MessageFilter
  ): string {
    // Create a combined filter that includes source filtering
    const combinedFilter: MessageFilter | undefined = filter
      ? {
          ...filter,
          source: this.name,
        }
      : {
          source: this.name,
        };

    return this.eventBus.subscribe(messageType, handler, combinedFilter);
  }

  public unsubscribe<T extends BusMessage>(
    messageType: string,
    handler: (message: T) => void
  ): void {
    this.eventBus.unsubscribe(messageType, handler);
  }

  public getName(): string {
    return this.name;
  }
}

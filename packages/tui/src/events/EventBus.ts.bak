export interface BusMessage {
  id: string;
  type: string;
  data: unknown;
  source: string;
  target?: string | string[];
  timestamp: number;
  priority: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface MessageFilter {
  type?: string | string[];
  source?: string | string[];
  target?: string | string[];
  priority?: { min?: number; max?: number };
  metadata?: Record<string, unknown>;
}

export interface Subscriber {
  id: string;
  name: string;
  filter?: MessageFilter;
  handler: (message: BusMessage) => void | Promise<void>;
  subscribed: number;
  messagesReceived: number;
  lastMessage?: number;
  active: boolean;
}

export class EventBus {
  private subscribers = new Map<string, Subscriber>();
  private messageQueue: BusMessage[] = [];
  private messageHistory: BusMessage[] = [];
  private maxHistorySize = 500;
  private maxQueueSize = 1000;
  private messageIdCounter = 0;
  private processingQueue = false;
  private paused = false;
  private batchSize = 10;
  private metrics = {
    totalMessages: 0,
    messagesProcessed: 0,
    messagesDropped: 0,
    averageProcessingTime: 0,
    totalProcessingTime: 0,
    errorCount: 0,
  };

  public subscribe(
    name: string,
    handler: (message: BusMessage) => void | Promise<void>,
    filter?: MessageFilter
  ): string {
    const subscriber: Subscriber = {
      id: `sub-${++this.messageIdCounter}`,
      name,
      handler,
      filter,
      subscribed: Date.now(),
      messagesReceived: 0,
      active: true,
    };

    this.subscribers.set(subscriber.id, subscriber);
    return subscriber.id;
  }

  public unsubscribe(subscriberId: string): boolean {
    return this.subscribers.delete(subscriberId);
  }

  public publish(
    type: string,
    data: unknown,
    source: string,
    options: PublishOptions = {}
  ): string {
    const message: BusMessage = {
      id: `msg-${++this.messageIdCounter}`,
      type,
      data,
      source,
      target: options.target,
      timestamp: Date.now(),
      priority: options.priority ?? 0,
      ttl: options.ttl,
      metadata: options.metadata,
    };

    this.metrics.totalMessages++;

    // Check if message queue is full
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.metrics.messagesDropped++;
      // Drop oldest low-priority message
      this.dropLowPriorityMessage();
    }

    this.enqueueMessage(message);

    if (!this.processingQueue && !this.paused) {
      this.processQueue();
    }

    return message.id;
  }

  public publishSync(
    type: string,
    data: unknown,
    source: string,
    options: PublishOptions = {}
  ): void {
    const message: BusMessage = {
      id: `msg-${++this.messageIdCounter}`,
      type,
      data,
      source,
      target: options.target,
      timestamp: Date.now(),
      priority: options.priority ?? 0,
      ttl: options.ttl,
      metadata: options.metadata,
    };

    this.deliverMessage(message);
  }

  private enqueueMessage(message: BusMessage): void {
    // Insert message in priority order
    const insertIndex = this.findInsertIndex(message.priority);
    this.messageQueue.splice(insertIndex, 0, message);
  }

  private findInsertIndex(priority: number): number {
    // Find position to maintain descending priority order
    for (let i = 0; i < this.messageQueue.length; i++) {
      if (this.messageQueue[i].priority < priority) {
        return i;
      }
    }
    return this.messageQueue.length;
  }

  private dropLowPriorityMessage(): void {
    // Find and remove the lowest priority message
    let lowestPriority = Infinity;
    let lowestIndex = -1;

    for (let i = 0; i < this.messageQueue.length; i++) {
      if (this.messageQueue[i].priority < lowestPriority) {
        lowestPriority = this.messageQueue[i].priority;
        lowestIndex = i;
      }
    }

    if (lowestIndex !== -1) {
      this.messageQueue.splice(lowestIndex, 1);
    }
  }

  private async processQueue(): Promise<void> {
    if (this.processingQueue) return;
    this.processingQueue = true;

    try {
      while (this.messageQueue.length > 0 && !this.paused) {
        const batch = this.messageQueue.splice(0, this.batchSize);

        for (const message of batch) {
          if (this.isMessageExpired(message)) {
            this.metrics.messagesDropped++;
            continue;
          }

          await this.deliverMessage(message);
        }

        // Allow other tasks to run
        await this.yield();
      }
    } finally {
      this.processingQueue = false;
    }
  }

  private isMessageExpired(message: BusMessage): boolean {
    if (message.ttl == null) return false;
    return Date.now() - message.timestamp > message.ttl;
  }

  private async deliverMessage(message: BusMessage): Promise<void> {
    const startTime = performance.now();

    try {
      const targetSubscribers = this.getTargetSubscribers(message);

      for (const subscriber of targetSubscribers) {
        if (!subscriber.active) continue;

        try {
          const result = subscriber.handler(message);
          if (result instanceof Promise) {
            await result;
          }

          subscriber.messagesReceived++;
          subscriber.lastMessage = Date.now();
        } catch (error) {
          this.metrics.errorCount++;
          console.error(`Error in subscriber '${subscriber.name}':`, error);
        }
      }

      this.recordMessage(message);
      this.metrics.messagesProcessed++;
    } catch (error) {
      this.metrics.errorCount++;
      console.error('Error delivering message:', error);
    } finally {
      const endTime = performance.now();
      const processingTime = endTime - startTime;
      this.metrics.totalProcessingTime += processingTime;
      this.metrics.averageProcessingTime =
        this.metrics.totalProcessingTime / this.metrics.messagesProcessed;
    }
  }

  private getTargetSubscribers(message: BusMessage): Subscriber[] {
    const subscribers: Subscriber[] = [];

    for (const subscriber of this.subscribers.values()) {
      if (this.matchesFilter(message, subscriber.filter)) {
        if (this.matchesTarget(message, subscriber.id, subscriber.name)) {
          subscribers.push(subscriber);
        }
      }
    }

    return subscribers;
  }

  private matchesFilter(message: BusMessage, filter?: MessageFilter): boolean {
    if (filter == null) return true;

    // Check message type
    if (filter.type != null && filter.type.length > 0) {
      const types = Array.isArray(filter.type) ? filter.type : [filter.type];
      if (!types.includes(message.type)) return false;
    }

    // Check source
    if (filter.source != null && filter.source.length > 0) {
      const sources = Array.isArray(filter.source)
        ? filter.source
        : [filter.source];
      if (!sources.includes(message.source)) return false;
    }

    // Check target
    if (filter.target != null && message.target != null) {
      const filterTargets = Array.isArray(filter.target)
        ? filter.target
        : [filter.target];
      const messageTargets = Array.isArray(message.target)
        ? message.target
        : [message.target];

      const hasMatch = filterTargets.some((ft) => messageTargets.includes(ft));
      if (!hasMatch) return false;
    }

    // Check priority range
    if (filter.priority) {
      if (
        filter.priority.min !== undefined &&
        message.priority < filter.priority.min
      ) {
        return false;
      }
      if (
        filter.priority.max !== undefined &&
        message.priority > filter.priority.max
      ) {
        return false;
      }
    }

    // Check metadata
    if (filter.metadata != null) {
      if (message.metadata == null) return false;

      for (const [key, value] of Object.entries(filter.metadata)) {
        if (message.metadata[key] !== value) return false;
      }
    }

    return true;
  }

  private matchesTarget(
    message: BusMessage,
    subscriberId: string,
    subscriberName: string
  ): boolean {
    if (message.target == null) return true; // Broadcast message

    const targets = Array.isArray(message.target)
      ? message.target
      : [message.target];
    return targets.includes(subscriberId) ?? targets.includes(subscriberName);
  }

  private recordMessage(message: BusMessage): void {
    this.messageHistory.push(message);

    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  private async yield(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    if (this.messageQueue.length > 0) {
      this.processQueue();
    }
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getQueueSize(): number {
    return this.messageQueue.length;
  }

  public getSubscriberCount(): number {
    return this.subscribers.size;
  }

  public getActiveSubscriberCount(): number {
    return Array.from(this.subscribers.values()).filter((s) => s.active).length;
  }

  public getSubscribers(): Subscriber[] {
    return Array.from(this.subscribers.values());
  }

  public getSubscriber(id: string): Subscriber | null {
    return this.subscribers.get(id) ?? null;
  }

  public setSubscriberActive(id: string, active: boolean): boolean {
    const subscriber = this.subscribers.get(id);
    if (subscriber != null) {
      subscriber.active = active;
      return true;
    }
    return false;
  }

  public getMessageHistory(
    filter?: MessageFilter,
    limit?: number
  ): BusMessage[] {
    let history = [...this.messageHistory];

    if (filter != null) {
      history = history.filter((message) =>
        this.matchesFilter(message, filter)
      );
    }

    if (limit != null) {
      history = history.slice(-limit);
    }

    return history;
  }

  public clearHistory(): void {
    this.messageHistory = [];
  }

  public clearQueue(): void {
    this.messageQueue = [];
  }

  public getMetrics() {
    return {
      ...this.metrics,
      queueSize: this.messageQueue.length,
      subscriberCount: this.getSubscriberCount(),
      activeSubscriberCount: this.getActiveSubscriberCount(),
      historySize: this.messageHistory.length,
      isPaused: this.paused,
      isProcessing: this.processingQueue,
    };
  }

  public setBatchSize(size: number): void {
    this.batchSize = Math.max(1, Math.min(100, size));
  }

  public setMaxQueueSize(size: number): void {
    this.maxQueueSize = Math.max(10, size);
  }

  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(10, size);

    // Trim current history if needed
    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  public createChannel(name: string): EventBusChannel {
    return new EventBusChannel(this, name);
  }

  public debug(): EventBusDebugInfo {
    return {
      metrics: this.getMetrics(),
      queueSnapshot: this.messageQueue.map((m) => ({
        id: m.id,
        type: m.type,
        priority: m.priority,
        age: Date.now() - m.timestamp,
      })),
      subscriberSnapshot: Array.from(this.subscribers.values()).map((s) => ({
        id: s.id,
        name: s.name,
        active: s.active,
        messagesReceived: s.messagesReceived,
        age: Date.now() - s.subscribed,
      })),
      recentMessages: this.messageHistory.slice(-10).map((m) => ({
        id: m.id,
        type: m.type,
        source: m.source,
        timestamp: m.timestamp,
      })),
    };
  }

  public validate(): EventBusValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check queue size
    if (this.messageQueue.length > this.maxQueueSize * 0.8) {
      warnings.push(
        `Queue size high: ${this.messageQueue.length}/${this.maxQueueSize}`
      );
    }

    // Check for inactive subscribers
    const inactiveSubscribers = Array.from(this.subscribers.values()).filter(
      (s) => !s.active
    ).length;

    if (inactiveSubscribers > 0) {
      warnings.push(`${inactiveSubscribers} inactive subscriber(s)`);
    }

    // Check error rate
    if (this.metrics.errorCount > 0 && this.metrics.messagesProcessed > 0) {
      const errorRate =
        this.metrics.errorCount / this.metrics.messagesProcessed;
      if (errorRate > 0.1) {
        warnings.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      }
    }

    // Check for slow processing
    if (this.metrics.averageProcessingTime > 10) {
      warnings.push(
        `Slow processing: ${this.metrics.averageProcessingTime.toFixed(2)}ms average`
      );
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public destroy(): void {
    this.pause();
    this.clearQueue();
    this.clearHistory();
    this.subscribers.clear();

    // Reset metrics
    this.metrics = {
      totalMessages: 0,
      messagesProcessed: 0,
      messagesDropped: 0,
      averageProcessingTime: 0,
      totalProcessingTime: 0,
      errorCount: 0,
    };
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
    options: PublishOptions = {}
  ): string {
    return this.bus.publish(type, data, this.channelName, options);
  }

  public subscribe(
    name: string,
    handler: (message: BusMessage) => void | Promise<void>,
    filter?: MessageFilter
  ): string {
    const channelFilter = {
      ...filter,
      source: this.channelName,
    };
    return this.bus.subscribe(name, handler, channelFilter);
  }

  public getName(): string {
    return this.channelName;
  }
}

export interface PublishOptions {
  target?: string | string[];
  priority?: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export interface EventBusDebugInfo {
  metrics: ReturnType<EventBus['getMetrics']>;
  queueSnapshot: Array<{
    id: string;
    type: string;
    priority: number;
    age: number;
  }>;
  subscriberSnapshot: Array<{
    id: string;
    name: string;
    active: boolean;
    messagesReceived: number;
    age: number;
  }>;
  recentMessages: Array<{
    id: string;
    type: string;
    source: string;
    timestamp: number;
  }>;
}

export interface EventBusValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

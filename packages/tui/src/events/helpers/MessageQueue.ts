export class BusMessage {
  id!: string;
  type!: string;
  data!: unknown;
  source!: string;
  target?: string | string[];
  timestamp!: number;
  priority!: number;
  ttl?: number;
  metadata?: Record<string, unknown>;
}

export class MessageQueue {
  private messageQueue: BusMessage[] = [];
  private messageHistory: BusMessage[] = [];
  private maxHistorySize = 500;
  private maxQueueSize = 1000;
  private processingQueue = false;
  private paused = false;
  private batchSize = 10;

  constructor(maxQueueSize = 1000, maxHistorySize = 500, batchSize = 10) {
    this.maxQueueSize = maxQueueSize;
    this.maxHistorySize = maxHistorySize;
    this.batchSize = batchSize;
  }

  public enqueue(message: BusMessage): boolean {
    if (this.messageQueue.length >= this.maxQueueSize) {
      this.dropLowPriorityMessage();
    }

    const insertIndex = this.findInsertIndex(message.priority);
    this.messageQueue.splice(insertIndex, 0, message);
    return true;
  }

  private findInsertIndex(priority: number): number {
    let left = 0;
    let right = this.messageQueue.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      if (this.messageQueue[mid].priority >= priority) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    return left;
  }

  private dropLowPriorityMessage(): void {
    if (this.messageQueue.length === 0) return;

    let minPriorityIndex = 0;
    let minPriority = this.messageQueue[0].priority;

    for (let i = 1; i < this.messageQueue.length; i++) {
      if (this.messageQueue[i].priority < minPriority) {
        minPriority = this.messageQueue[i].priority;
        minPriorityIndex = i;
      }
    }

    this.messageQueue.splice(minPriorityIndex, 1);
  }

  public async processQueue(
    processor: (messages: BusMessage[]) => Promise<void>
  ): Promise<void> {
    if (this.processingQueue || this.paused || this.messageQueue.length === 0) {
      return;
    }

    this.processingQueue = true;

    try {
      while (this.messageQueue.length > 0 && !this.paused) {
        const batch = this.messageQueue.splice(0, this.batchSize);
        const validMessages = batch.filter(
          (msg) => !this.isMessageExpired(msg)
        );

        if (validMessages.length > 0) {
          await processor(validMessages);
        }

        // Yield control to prevent blocking
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

  public recordMessage(message: BusMessage): void {
    this.messageHistory.push(message);

    if (this.messageHistory.length > this.maxHistorySize) {
      this.messageHistory = this.messageHistory.slice(-this.maxHistorySize);
    }
  }

  private async yield(): Promise<void> {
    return new Promise((resolve) => setImmediate(resolve));
  }

  public pause(): void {
    this.paused = true;
  }

  public resume(): void {
    this.paused = false;
    // Don't automatically process - let the caller decide
  }

  public isPaused(): boolean {
    return this.paused;
  }

  public getQueueSize(): number {
    return this.messageQueue.length;
  }

  public getMessageHistory(filter?: {
    type?: string;
    source?: string;
    limit?: number;
    since?: number;
  }): BusMessage[] {
    let filtered = this.messageHistory;

    if (filter != null) {
      if (filter.type != null) {
        filtered = filtered.filter((msg) => msg.type === filter.type);
      }

      if (filter.source != null) {
        filtered = filtered.filter((msg) => msg.source === filter.source);
      }

      if (filter.since != null) {
        const since = filter.since;
        filtered = filtered.filter((msg) => msg.timestamp >= since);
      }

      if (filter.limit != null) {
        filtered = filtered.slice(-filter.limit);
      }
    }

    return filtered;
  }

  public clearHistory(): void {
    this.messageHistory = [];
  }

  public clearQueue(): void {
    this.messageQueue = [];
  }

  public dequeue(): BusMessage | undefined {
    return this.messageQueue.shift();
  }

  public isEmpty(): boolean {
    return this.messageQueue.length === 0;
  }

  public size(): number {
    return this.messageQueue.length;
  }

  public clear(): void {
    this.clearQueue();
    this.clearHistory();
  }

  public setBatchSize(size: number): void {
    this.batchSize = Math.max(1, size);
  }

  public setMaxQueueSize(size: number): void {
    this.maxQueueSize = Math.max(1, size);
  }

  public setMaxHistorySize(size: number): void {
    this.maxHistorySize = Math.max(1, size);
    if (this.messageHistory.length > size) {
      this.messageHistory = this.messageHistory.slice(-size);
    }
  }

  public getQueueSnapshot(): {
    queueSize: number;
    historySize: number;
    paused: boolean;
    processing: boolean;
    batchSize: number;
  } {
    return {
      queueSize: this.messageQueue.length,
      historySize: this.messageHistory.length,
      paused: this.paused,
      processing: this.processingQueue,
      batchSize: this.batchSize,
    };
  }

  public destroy(): void {
    this.clearQueue();
    this.clearHistory();
    this.paused = true;
    this.processingQueue = false;
  }
}

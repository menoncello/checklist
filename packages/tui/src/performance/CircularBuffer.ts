export interface CircularBufferConfig<_T> {
  capacity: number;
  cleanupInterval?: number; // in milliseconds
  maxAge?: number; // maximum age for items in milliseconds
  autoCleanup?: boolean;
}

export interface MetricData {
  id: string;
  name: string;
  value: number;
  timestamp: number;
  [key: string]: unknown;
}

export class CircularBuffer<_T> {
  private buffer: (_T | null)[];
  private head = 0;
  private tail = 0;
  private size = 0;
  private timestamps: number[] = [];
  private cleanupTimer?: NodeJS.Timeout;
  private config: CircularBufferConfig<_T>;

  constructor(config: CircularBufferConfig<_T>) {
    if (config.capacity <= 0) {
      throw new RangeError('Capacity must be a positive integer');
    }

    this.config = {
      autoCleanup: true,
      cleanupInterval: 30000, // 30 seconds
      maxAge: 300000, // 5 minutes
      ...config,
    };

    this.buffer = new Array(this.config.capacity).fill(null);
    this.timestamps = new Array(this.config.capacity).fill(0);

    if (
      this.config.autoCleanup === true &&
      this.config.cleanupInterval !== undefined &&
      this.config.cleanupInterval > 0
    ) {
      this.startCleanupTimer();
    }
  }

  public push(item: _T): boolean {
    if (this.config.capacity <= 0) {
      return false;
    }

    const now = Date.now();

    // If buffer is full, overwrite the oldest item
    if (this.size === this.config.capacity) {
      this.buffer[this.head] = item;
      this.timestamps[this.head] = now;
      this.head = (this.head + 1) % this.config.capacity;
      this.tail = this.head; // Tail follows head when full
    } else {
      // Buffer has space
      this.buffer[this.tail] = item;
      this.timestamps[this.tail] = now;
      this.tail = (this.tail + 1) % this.config.capacity;
      this.size++;
    }

    return true;
  }

  public pop(): _T | null {
    if (this.size === 0) {
      return null;
    }

    // Move tail back to get the most recent item
    this.tail = (this.tail - 1 + this.config.capacity) % this.config.capacity;
    const item = this.buffer[this.tail];
    this.buffer[this.tail] = null;
    this.timestamps[this.tail] = 0;
    this.size--;

    return item;
  }

  public shift(): _T | null {
    if (this.size === 0) {
      return null;
    }

    const item = this.buffer[this.head];
    this.buffer[this.head] = null;
    this.timestamps[this.head] = 0;
    this.head = (this.head + 1) % this.config.capacity;
    this.size--;

    return item;
  }

  public get(index: number): _T | null {
    if (index < 0 || index >= this.size) {
      return null;
    }

    const actualIndex = (this.head + index) % this.config.capacity;
    return this.buffer[actualIndex];
  }

  public toArray(): _T[] {
    const result: _T[] = [];

    for (let i = 0; i < this.size; i++) {
      const item = this.get(i);
      if (item !== null) {
        result.push(item);
      }
    }

    return result;
  }

  public getRecent(count: number): _T[] {
    const actualCount = Math.min(count, this.size);
    const result: _T[] = [];

    for (let i = this.size - actualCount; i < this.size; i++) {
      const item = this.get(i);
      if (item !== null) {
        result.push(item);
      }
    }

    return result;
  }

  public filter(predicate: (item: _T) => boolean): _T[] {
    return this.toArray().filter(predicate);
  }

  public clear(): void {
    this.buffer.fill(null);
    this.timestamps.fill(0);
    this.head = 0;
    this.tail = 0;
    this.size = 0;
  }

  public cleanup(): void {
    if (this.config.maxAge === undefined || this.config.maxAge <= 0) {
      return;
    }

    const now = Date.now();
    const cutoff = now - this.config.maxAge;
    let newSize = 0;
    let newHead = this.head;

    // Find the first item that's not expired
    for (let i = 0; i < this.size; i++) {
      const timestamp = this.timestamps[(this.head + i) % this.config.capacity];
      if (timestamp > cutoff) {
        newHead = (this.head + i) % this.config.capacity;
        newSize = this.size - i;
        break;
      }
    }

    // If all items are expired, clear everything
    if (newSize === 0) {
      this.clear();
      return;
    }

    // Clear expired items from the arrays
    for (let i = 0; i < this.size - newSize; i++) {
      const index = (this.head + i) % this.config.capacity;
      this.buffer[index] = null;
      this.timestamps[index] = 0;
    }

    // Update head and size
    this.head = newHead;
    this.size = newSize;
  }

  private startCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, this.config.cleanupInterval);
  }

  public stopCleanupTimer(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = undefined;
    }
  }

  public getSize(): number {
    return this.size;
  }

  public getCapacity(): number {
    return this.config.capacity;
  }

  public isFull(): boolean {
    return this.size === this.config.capacity;
  }

  public isEmpty(): boolean {
    return this.size === 0;
  }

  public getOldest(): _T | null {
    return this.size > 0 ? this.get(0) : null;
  }

  public getNewest(): _T | null {
    return this.size > 0 ? this.get(this.size - 1) : null;
  }

  public getTimestamp(index: number): number | null {
    if (index < 0 || index >= this.size) {
      return null;
    }

    const actualIndex = (this.head + index) % this.config.capacity;
    return this.timestamps[actualIndex];
  }

  public updateConfig(newConfig: Partial<CircularBufferConfig<_T>>): void {
    const oldAutoCleanup = this.config.autoCleanup;
    const oldCleanupInterval = this.config.cleanupInterval;

    // Handle capacity change BEFORE updating config to avoid issues with getRecent
    this.handleCapacityChange(newConfig);

    this.config = { ...this.config, ...newConfig };
    this.handleTimerChange(oldAutoCleanup, oldCleanupInterval);
  }

  private handleCapacityChange(
    newConfig: Partial<CircularBufferConfig<_T>>
  ): void {
    if (
      newConfig.capacity === undefined ||
      newConfig.capacity === this.buffer.length
    ) {
      return;
    }

    if (newConfig.capacity <= 0) {
      throw new RangeError('Capacity must be a positive integer');
    }

    // Get the most recent items using the current buffer state
    const recentItems = this.getRecent(newConfig.capacity);
    this.createNewBuffer(newConfig.capacity, recentItems);
  }

  private createNewBuffer(newCapacity: number, recentItems: _T[]): void {
    this.buffer = new Array(newCapacity).fill(null);
    this.timestamps = new Array(newCapacity).fill(0);

    for (let i = 0; i < recentItems.length; i++) {
      this.buffer[i] = recentItems[i];
      this.timestamps[i] = Date.now();
    }

    this.head = 0;
    this.tail = recentItems.length;
    this.size = recentItems.length;
  }

  private handleTimerChange(
    oldAutoCleanup: boolean | undefined,
    oldCleanupInterval: number | undefined
  ): void {
    if (
      this.config.autoCleanup !== oldAutoCleanup ||
      this.config.cleanupInterval !== oldCleanupInterval
    ) {
      this.stopCleanupTimer();
      if (
        this.config.autoCleanup === true &&
        this.config.cleanupInterval !== undefined &&
        this.config.cleanupInterval > 0
      ) {
        this.startCleanupTimer();
      }
    }
  }

  public getConfig(): CircularBufferConfig<_T> {
    return { ...this.config };
  }

  public getHead(): number {
    return this.head;
  }

  public getTail(): number {
    return this.tail;
  }

  public getMemoryUsage(): {
    bufferSize: number;
    timestampsSize: number;
    totalSize: number;
    overhead: number;
  } {
    const bufferSize = this.buffer.length * (8 + 8); // Rough estimate of pointer size
    const timestampsSize = this.timestamps.length * 8; // 8 bytes per timestamp
    const totalSize = bufferSize + timestampsSize;
    const overhead = totalSize / (this.size * 16 || 1); // Overhead factor

    return {
      bufferSize,
      timestampsSize,
      totalSize,
      overhead,
    };
  }

  public destroy(): void {
    this.stopCleanupTimer();
    this.clear();
  }
}

import { KeyEvent } from './KeyBindingManager';

export class KeyMetrics {
  count!: number;
  lastPressed!: number;
  averageInterval!: number;
  totalTime!: number;
}

export class KeySequenceMetrics {
  sequence!: string;
  startTime!: number;
  keyCount!: number;
  completed!: boolean;
}

export class KeyMetricsTracker {
  private keyMetrics = new Map<string, KeyMetrics>();
  private keyHistory: KeyEvent[] = [];
  private activeSequence: KeySequenceMetrics | null = null;

  constructor(private maxHistorySize: number = 100) {}

  public recordKeyEvent(keyEvent: KeyEvent): void {
    this.keyHistory.push(keyEvent);

    // Trim history
    if (this.keyHistory.length > this.maxHistorySize) {
      this.keyHistory = this.keyHistory.slice(-this.maxHistorySize);
    }

    this.updateKeyMetrics(keyEvent);
  }

  private updateKeyMetrics(keyEvent: KeyEvent): void {
    const key = keyEvent.key ?? 'unknown';

    if (!this.keyMetrics.has(key)) {
      this.keyMetrics.set(key, {
        count: 0,
        lastPressed: 0,
        averageInterval: 0,
        totalTime: 0,
      });
    }

    const metrics = this.keyMetrics.get(key);
    if (metrics == null) return;

    metrics.count++;

    if (metrics.lastPressed > 0) {
      const interval = keyEvent.timestamp - metrics.lastPressed;
      metrics.totalTime += interval;
      metrics.averageInterval = metrics.totalTime / (metrics.count - 1);
    }

    metrics.lastPressed = keyEvent.timestamp;
  }

  public startSequence(name: string): void {
    this.activeSequence = {
      sequence: name,
      startTime: performance.now(),
      keyCount: 0,
      completed: false,
    };
  }

  public addToSequence(): void {
    if (this.activeSequence != null) {
      this.activeSequence.keyCount++;
    }
  }

  public completeSequence(): void {
    if (this.activeSequence != null) {
      this.activeSequence.completed = true;
      // Could emit an event or store completed sequences for analysis
      this.activeSequence = null;
    }
  }

  public cancelSequence(): void {
    this.activeSequence = null;
  }

  public getKeyMetrics(key: string): KeyMetrics | null {
    return this.keyMetrics.get(key) ?? null;
  }

  public getAllKeyMetrics(): Map<string, KeyMetrics> {
    return new Map(this.keyMetrics);
  }

  public getKeyHistory(): KeyEvent[] {
    return [...this.keyHistory];
  }

  public getActiveSequence(): KeySequenceMetrics | null {
    return this.activeSequence ? { ...this.activeSequence } : null;
  }

  public getMostUsedKeys(
    limit: number = 10
  ): Array<{ key: string; count: number }> {
    return Array.from(this.keyMetrics.entries())
      .map(([key, metrics]) => ({ key, count: metrics.count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  public getTypingSpeed(): number {
    if (this.keyHistory.length < 2) return 0;

    const recent = this.keyHistory.slice(-20); // Last 20 keys
    if (recent.length < 2) return 0;

    const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
    if (timeSpan <= 0) return 0;

    return (recent.length - 1) / (timeSpan / 1000 / 60); // Keys per minute
  }

  public getAverageKeyInterval(): number {
    if (this.keyHistory.length < 2) return 0;

    let totalInterval = 0;
    let count = 0;

    for (let i = 1; i < this.keyHistory.length; i++) {
      totalInterval +=
        this.keyHistory[i].timestamp - this.keyHistory[i - 1].timestamp;
      count++;
    }

    return count > 0 ? totalInterval / count : 0;
  }

  public getSessionMetrics(): {
    totalKeys: number;
    uniqueKeys: number;
    sessionDuration: number;
    averageKeysPerMinute: number;
    mostUsedKey: string | null;
  } {
    const totalKeys = this.keyHistory.length;
    const uniqueKeys = this.keyMetrics.size;
    const sessionDuration = this.calculateSessionDuration();
    const mostUsedKey = this.findMostUsedKey();
    const averageKeysPerMinute = this.calculateKeysPerMinute(
      totalKeys,
      sessionDuration
    );

    return {
      totalKeys,
      uniqueKeys,
      sessionDuration,
      averageKeysPerMinute,
      mostUsedKey,
    };
  }

  private calculateSessionDuration(): number {
    if (this.keyHistory.length <= 1) return 0;
    return (
      this.keyHistory[this.keyHistory.length - 1].timestamp -
      this.keyHistory[0].timestamp
    );
  }

  private findMostUsedKey(): string | null {
    let mostUsedKey: string | null = null;
    let maxCount = 0;

    for (const [key, metrics] of this.keyMetrics.entries()) {
      if (metrics.count > maxCount) {
        maxCount = metrics.count;
        mostUsedKey = key;
      }
    }

    return mostUsedKey;
  }

  private calculateKeysPerMinute(
    totalKeys: number,
    sessionDuration: number
  ): number {
    return sessionDuration > 0 ? totalKeys / (sessionDuration / 1000 / 60) : 0;
  }

  public clear(): void {
    this.keyMetrics.clear();
    this.keyHistory = [];
    this.activeSequence = null;
  }

  public pruneOldData(maxAge: number): number {
    const now = Date.now();
    const initialLength = this.keyHistory.length;

    this.keyHistory = this.keyHistory.filter(
      (event) => now - event.timestamp <= maxAge
    );

    return initialLength - this.keyHistory.length;
  }
}

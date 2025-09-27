export class StatePreservationTimerManager {
  private timers: Map<string, ReturnType<typeof setInterval>> = new Map();

  setAutoSave(id: string, interval: number, callback: () => void): void {
    this.clear(id);
    const timer = setInterval(callback, interval);
    this.timers.set(id, timer);
  }

  startCleanupTimer(callback: () => void, interval: number): void {
    this.setAutoSave('cleanup', interval, callback);
  }

  startPersistTimer(callback: () => void, interval: number): void {
    this.setAutoSave('persist', interval, callback);
  }

  stopPersistTimer(): void {
    this.clear('persist');
  }

  hasPersistTimer(): boolean {
    return this.has('persist');
  }

  clear(id: string): boolean {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
      return true;
    }
    return false;
  }

  clearAll(): void {
    this.timers.forEach((timer) => clearInterval(timer));
    this.timers.clear();
  }

  has(id: string): boolean {
    return this.timers.has(id);
  }

  destroy(): void {
    this.clearAll();
  }

  stop(): void {
    this.clearAll();
  }
}

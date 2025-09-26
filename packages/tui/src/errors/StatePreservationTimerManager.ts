export class StatePreservationTimerManager {
  private timers: Map<string, Timer> = new Map();

  setTimeout(id: string, callback: () => void, delay: number): void {
    this.clearTimeout(id);
    const timer = setTimeout(callback, delay);
    this.timers.set(id, timer);
  }

  setInterval(id: string, callback: () => void, interval: number): void {
    this.clearInterval(id);
    const timer = setInterval(callback, interval);
    this.timers.set(id, timer);
  }

  clearTimeout(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.timers.delete(id);
    }
  }

  clearInterval(id: string): void {
    const timer = this.timers.get(id);
    if (timer) {
      clearInterval(timer);
      this.timers.delete(id);
    }
  }

  clearAll(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }

  stop(): void {
    this.clearAll();
  }
}

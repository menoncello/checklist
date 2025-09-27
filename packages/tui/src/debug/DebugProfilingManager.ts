export class DebugProfilingManager {
  private profiles: Map<string, number> = new Map();
  private enabled: boolean;
  private logCallback: (message: string) => void;

  constructor(enabled: boolean, logCallback: (message: string) => void) {
    this.enabled = enabled;
    this.logCallback = logCallback;
  }

  startProfiling(label: string): void {
    if (!this.enabled) return;
    this.profiles.set(label, performance.now());
    this.logCallback(`Profiling started: ${label}`);
  }

  endProfiling(label: string): number | null {
    if (!this.enabled) return null;

    const startTime = this.profiles.get(label);
    if (startTime === undefined) return null;

    const duration = performance.now() - startTime;
    this.profiles.delete(label);
    this.logCallback(`Profiling ended: ${label} - ${duration}ms`);

    return duration;
  }

  start(label: string): void {
    this.startProfiling(label);
  }

  end(label: string): number | null {
    return this.endProfiling(label);
  }

  clear(): void {
    this.profiles.clear();
  }
}

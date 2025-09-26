export interface ProfileMeasurement {
  name: string;
  startTime: number;
  endTime?: number;
  duration?: number;
}

export class DebugProfilingManager {
  private measurements: Map<string, ProfileMeasurement> = new Map();
  private history: ProfileMeasurement[] = [];
  private maxHistorySize = 100;

  start(name: string): void {
    this.measurements.set(name, {
      name,
      startTime: performance.now(),
    });
  }

  end(name: string): number {
    const measurement = this.measurements.get(name);
    if (!measurement) {
      return 0;
    }

    measurement.endTime = performance.now();
    measurement.duration = measurement.endTime - measurement.startTime;

    this.history.push({ ...measurement });
    if (this.history.length > this.maxHistorySize) {
      this.history.shift();
    }

    this.measurements.delete(name);
    return measurement.duration;
  }

  getMeasurement(name: string): ProfileMeasurement | undefined {
    return this.measurements.get(name);
  }

  getHistory(): ProfileMeasurement[] {
    return [...this.history];
  }

  getAverageDuration(name: string): number {
    const measurements = this.history.filter((m) => m.name === name);
    if (measurements.length === 0) return 0;

    const total = measurements.reduce((sum, m) => sum + (m.duration ?? 0), 0);
    return total / measurements.length;
  }

  clear(): void {
    this.measurements.clear();
    this.history = [];
  }
}

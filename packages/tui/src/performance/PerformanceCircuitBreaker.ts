export interface PerformanceCircuitBreakerConfig {
  overheadThreshold: number; // 2% default
  checkInterval: number; // 5000ms default
  samplingWindow: number; // 60000ms default
  recoveryTime?: number; // Recovery time in ms
  enabled: boolean;
}

export interface CircuitBreakerState {
  isTripped: boolean;
  overhead: number;
  lastCheck: number;
  tripTime?: number;
  metricsDisabled: boolean;
  tripCount: number;
}

export class PerformanceCircuitBreaker {
  private config: PerformanceCircuitBreakerConfig;
  private state: CircuitBreakerState;
  private measurements: { overhead: number; timestamp: number }[] = [];
  private checkTimer?: NodeJS.Timeout;
  private baseMeasurements: number[] = [];
  private isDestroyed: boolean = false;
  private initializationTimeout?: NodeJS.Timeout;

  constructor(config?: Partial<PerformanceCircuitBreakerConfig>) {
    this.config = {
      overheadThreshold: 0.02, // 2%
      checkInterval: 5000, // 5 seconds
      samplingWindow: 60000, // 1 minute
      enabled: true,
      ...config,
    };

    this.state = {
      isTripped: false,
      overhead: 0,
      lastCheck: Date.now(),
      metricsDisabled: false,
      tripCount: 0,
    };

    this.initializeBaseMeasurement();

    // Safety timeout to prevent infinite initialization
    this.initializationTimeout = setTimeout(() => {
      if (this.baseMeasurements.length < 3) {
        // If we don't have enough measurements after timeout, use what we have
        console.warn(
          '[PerformanceCircuitBreaker] Initialization timeout - using limited baseline measurements'
        );
        this.config.enabled = false; // Disable to prevent issues
      }
    }, 2000);
  }

  private initializeBaseMeasurement(): void {
    // Check if still enabled and not destroyed before taking measurements
    if (!this.config.enabled || this.isDestroyed) return;

    // Measure baseline performance without monitoring
    const start = performance.now();
    for (let i = 0; i < 1000; i++) {
      // Perform a representative operation
      Math.random();
    }
    const duration = performance.now() - start;
    this.baseMeasurements.push(duration);

    // Take multiple measurements for accuracy, but with a safety limit
    if (
      this.baseMeasurements.length < 10 &&
      this.config.enabled &&
      !this.isDestroyed
    ) {
      setTimeout(() => this.initializeBaseMeasurement(), 100);
    }
  }

  private getBaselineAverage(): number {
    if (this.baseMeasurements.length === 0) return 1;
    const sum = this.baseMeasurements.reduce((a, b) => a + b, 0);
    return sum / this.baseMeasurements.length;
  }

  public startMonitoring(): void {
    if (!this.config.enabled) return;

    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(() => {
      this.checkOverhead();
    }, this.config.checkInterval);
  }

  public stopMonitoring(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = undefined;
    }
  }

  public measureOverhead(operation: () => void): number {
    if (this.state.isTripped) return 0;

    const start = performance.now();
    operation();
    const duration = performance.now() - start;

    // Calculate overhead relative to baseline
    const baseline = this.getBaselineAverage();

    // Handle edge cases where baseline is zero or very small
    if (baseline <= 0) {
      // If baseline is zero or negative, return duration as absolute overhead
      const overhead = duration;
      this.recordMeasurement(overhead);
      return overhead;
    }

    const overhead = Math.max(0, (duration - baseline) / baseline);

    this.recordMeasurement(overhead);
    return overhead;
  }

  private recordMeasurement(overhead: number): void {
    const now = Date.now();
    this.measurements.push({ overhead, timestamp: now });

    // Keep measurements within sampling window
    const cutoff = now - this.config.samplingWindow;
    this.measurements = this.measurements.filter((m) => m.timestamp > cutoff);
  }

  private checkOverhead(): void {
    if (this.measurements.length === 0) return;

    const recentOverhead = this.measurements.slice(-10); // Last 10 measurements
    const avgOverhead =
      recentOverhead.reduce((sum, m) => sum + m.overhead, 0) /
      recentOverhead.length;

    this.state.overhead = avgOverhead;
    this.state.lastCheck = Date.now();

    if (avgOverhead > this.config.overheadThreshold && !this.state.isTripped) {
      this.tripBreaker();
    } else if (
      avgOverhead < this.config.overheadThreshold / 2 &&
      this.state.isTripped
    ) {
      this.resetBreaker();
    } else if (
      avgOverhead <= this.config.overheadThreshold &&
      !this.state.isTripped
    ) {
      // Normal operation, do nothing
    }
  }

  public forceCheckOverhead(): void {
    this.checkOverhead();
  }

  private tripBreaker(): void {
    this.state.isTripped = true;
    this.state.tripTime = Date.now();
    this.state.metricsDisabled = true;

    // Stop monitoring to prevent further overhead
    this.stopMonitoring();

    // Emit alert
    this.emitAlert();
  }

  private resetBreaker(): void {
    this.state.isTripped = false;
    this.state.tripTime = undefined;
    this.state.metricsDisabled = false;

    // Resume monitoring
    this.startMonitoring();

    // Emit recovery alert
    this.emitRecovery();
  }

  private emitAlert(): void {
    console.warn(
      `[PerformanceCircuitBreaker] Tripped due to ${(
        this.state.overhead * 100
      ).toFixed(2)}% overhead (threshold: ${(
        this.config.overheadThreshold * 100
      ).toFixed(2)}%)`
    );
  }

  private emitRecovery(): void {
    console.info(
      `[PerformanceCircuitBreaker] Reset - overhead now ${(
        this.state.overhead * 100
      ).toFixed(2)}%`
    );
  }

  public shouldCollectMetrics(): boolean {
    return (
      this.config.enabled &&
      !this.state.isTripped &&
      !this.state.metricsDisabled
    );
  }

  public getState(): CircuitBreakerState {
    return { ...this.state };
  }

  public getConfig(): PerformanceCircuitBreakerConfig {
    return { ...this.config };
  }

  public updateConfig(
    newConfig: Partial<PerformanceCircuitBreakerConfig>
  ): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...newConfig };

    if (wasEnabled !== this.config.enabled) {
      if (this.config.enabled) {
        this.startMonitoring();
      } else {
        this.stopMonitoring();
      }
    }
  }

  public forceTrip(): void {
    this.tripBreaker();
  }

  public forceReset(): void {
    this.resetBreaker();
  }

  public getMetrics(): { overhead: number; measurements: number[] } {
    return {
      overhead: this.state.overhead,
      measurements: this.measurements.map((m) => m.overhead),
    };
  }

  public isActive(): boolean {
    return this.state.isTripped;
  }

  public reset(): void {
    this.state.isTripped = false;
    this.state.overhead = 0;
    this.state.tripCount = 0;
    this.state.tripTime = undefined;
    this.state.metricsDisabled = false;
    this.measurements = [];
  }

  public destroy(): void {
    // Mark as destroyed first to prevent any further operations
    this.isDestroyed = true;

    // Clear all timeouts and intervals
    this.stopMonitoring();

    if (this.initializationTimeout) {
      clearTimeout(this.initializationTimeout);
      this.initializationTimeout = undefined;
    }

    // Clean up data
    this.config.enabled = false;
    this.measurements = [];
    this.baseMeasurements = [];
  }
}

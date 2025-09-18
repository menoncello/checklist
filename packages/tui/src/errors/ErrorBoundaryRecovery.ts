import { ErrorInfo, ErrorRecoveryStrategy } from './ErrorBoundaryTypes';

export class ErrorBoundaryRecovery {
  private strategies: ErrorRecoveryStrategy[] = [];

  constructor() {
    this.setupDefaultStrategies();
  }

  private setupDefaultStrategies(): void {
    this.addStrategy({
      name: 'network-retry',
      condition: (error) => this.isNetworkError(error),
      handler: async (_error) => {
        await this.delay(1000);
        return true; // Retry
      },
      priority: 10,
    });

    this.addStrategy({
      name: 'memory-cleanup',
      condition: (error) => this.isMemoryError(error),
      handler: async (_error) => {
        this.performMemoryCleanup();
        return true;
      },
      priority: 8,
    });

    this.addStrategy({
      name: 'state-reset',
      condition: (error) => this.isStateError(error),
      handler: async (_error) => {
        // State reset would be handled by the boundary
        return true;
      },
      priority: 6,
    });
  }

  public addStrategy(strategy: ErrorRecoveryStrategy): void {
    this.strategies.push(strategy);
    this.strategies.sort((a, b) => b.priority - a.priority);
  }

  public async attemptRecovery(
    error: Error,
    errorInfo: ErrorInfo
  ): Promise<{ recovered: boolean; strategy?: string }> {
    for (const strategy of this.strategies) {
      if (!strategy.condition(error, errorInfo)) {
        continue;
      }

      try {
        const result = await strategy.handler(error, errorInfo);
        if (result) {
          return { recovered: true, strategy: strategy.name };
        }
      } catch (recoveryError) {
        console.error(
          `Recovery strategy '${strategy.name}' failed:`,
          recoveryError
        );
      }
    }

    return { recovered: false };
  }

  private isNetworkError(error: Error): boolean {
    return (
      error.message.includes('network') ||
      error.message.includes('fetch') ||
      error.message.includes('timeout')
    );
  }

  private isMemoryError(error: Error): boolean {
    return (
      error.message.includes('memory') ||
      error.message.includes('allocation') ||
      error.name === 'RangeError'
    );
  }

  private isStateError(error: Error): boolean {
    return (
      error.message.includes('state') ||
      error.message.includes('undefined') ||
      error.name === 'TypeError'
    );
  }

  private async delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private performMemoryCleanup(): void {
    // Trigger garbage collection if available
    if (typeof global !== 'undefined' && global.gc) {
      global.gc();
    }
  }

  public getStrategies(): ErrorRecoveryStrategy[] {
    return [...this.strategies];
  }

  public removeStrategy(name: string): boolean {
    const index = this.strategies.findIndex((s) => s.name === name);
    if (index !== -1) {
      this.strategies.splice(index, 1);
      return true;
    }
    return false;
  }
}

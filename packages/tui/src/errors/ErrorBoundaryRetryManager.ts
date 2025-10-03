export interface RetryOptions {
  maxAttempts?: number;
  delay?: number;
  backoff?: boolean;
  onRetry?: (attempt: number) => void;
}

export class ErrorBoundaryRetryManager {
  private attempts = 0;
  private maxAttempts = 3;
  private baseDelay = 1000;
  private retryTimer: Timer | null = null;

  constructor(
    private config?: unknown,
    private historyManager?: unknown
  ) {}

  async retry<T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
  ): Promise<T> {
    const {
      maxAttempts = this.maxAttempts,
      delay = this.baseDelay,
      backoff = true,
      onRetry,
    } = options;

    this.attempts = 0;

    while (this.attempts < maxAttempts) {
      try {
        this.attempts++;
        return await operation();
      } catch (error) {
        if (this.attempts >= maxAttempts) {
          throw error;
        }

        if (onRetry) {
          onRetry(this.attempts);
        }

        const waitTime = backoff
          ? delay * Math.pow(2, this.attempts - 1)
          : delay;
        await new Promise((resolve) => setTimeout(resolve, waitTime));
      }
    }

    throw new Error('Max retry attempts reached');
  }

  getAttempts(): number {
    return this.attempts;
  }

  reset(): void {
    this.attempts = 0;
  }

  // Additional methods needed by ErrorBoundaryCore
  scheduleRetry(delay: number): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
    }

    this.retryTimer = setTimeout(() => {
      // Default implementation - could trigger retry callback
      this.retryTimer = null;
    }, delay);
  }

  clearRetryTimer(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  cancelRetry(): void {
    this.clearRetryTimer();
  }

  retryOperation<T>(operation?: () => T | Promise<T>): Promise<T> {
    // Default implementation
    if (!operation) {
      return Promise.resolve(undefined as unknown as T);
    }
    return Promise.resolve(operation());
  }
}

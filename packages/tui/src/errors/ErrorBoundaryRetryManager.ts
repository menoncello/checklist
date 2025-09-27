export class ErrorBoundaryRetryManager {
  private retryTimer: NodeJS.Timeout | null = null;
  private attemptRetryCallback: (() => void) | null = null;

  constructor(attemptRetryCallback: () => void) {
    this.attemptRetryCallback = attemptRetryCallback;
  }

  scheduleRetry(delay: number): void {
    this.cancelRetry();
    if (this.attemptRetryCallback != null) {
      this.retryTimer = setTimeout(() => {
        if (this.attemptRetryCallback != null) {
          this.attemptRetryCallback();
        }
      }, delay);
    }
  }

  cancelRetry(): void {
    if (this.retryTimer != null) {
      clearTimeout(this.retryTimer);
      this.retryTimer = null;
    }
  }

  async retryOperation<T>(
    operation: () => T,
    maxRetries: number,
    delay: number
  ): Promise<T> {
    let lastError: Error | null = null;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await Promise.resolve(operation());
      } catch (error) {
        lastError = error as Error;
        if (attempt < maxRetries) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError ?? new Error('Operation failed after retries');
  }

  destroy(): void {
    this.cancelRetry();
    this.attemptRetryCallback = null;
  }

  clearRetryTimer(): void {
    this.cancelRetry();
  }
}

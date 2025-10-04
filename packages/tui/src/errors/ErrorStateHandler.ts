import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:error-state-handler');

export class ErrorStateHandler {
  private retryCount = 0;
  private maxRetries: number;
  private errorState: {
    hasError: boolean;
    error: Error | null;
    errorInfo: Record<string, unknown> | null;
  } = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  constructor(maxRetries: number = 3) {
    this.maxRetries = maxRetries;
  }

  public getState(): {
    hasError: boolean;
    error: Error | null;
    errorInfo: Record<string, unknown> | null;
  } {
    return { ...this.errorState };
  }

  public setState(error: Error, errorInfo: Record<string, unknown>): void {
    this.errorState = {
      hasError: true,
      error,
      errorInfo,
    };

    logger.debug({
      msg: 'Error state updated',
      error: error.message,
      errorInfo,
    });
  }

  public clearState(): void {
    this.errorState = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this.retryCount = 0;

    logger.debug({ msg: 'Error state cleared' });
  }

  public getRetryCount(): number {
    return this.retryCount;
  }

  public incrementRetryCount(): void {
    this.retryCount++;
    logger.debug({
      msg: 'Retry count incremented',
      retryCount: this.retryCount,
      maxRetries: this.maxRetries,
    });
  }

  public resetRetryCount(): void {
    this.retryCount = 0;
    logger.debug({ msg: 'Retry count reset' });
  }

  public canRetry(): boolean {
    return this.retryCount < this.maxRetries;
  }

  public isMaxRetriesReached(): boolean {
    return this.retryCount >= this.maxRetries;
  }

  public getMaxRetries(): number {
    return this.maxRetries;
  }
}

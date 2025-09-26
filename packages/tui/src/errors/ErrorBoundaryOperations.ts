export class ErrorBoundaryOperations {
  private operations: Map<string, () => void> = new Map();

  registerOperation(name: string, operation: () => void): void {
    this.operations.set(name, operation);
  }

  executeOperation(name: string): void {
    const operation = this.operations.get(name);
    if (operation) {
      operation();
    }
  }

  hasOperation(name: string): boolean {
    return this.operations.has(name);
  }

  clearOperations(): void {
    this.operations.clear();
  }

  getOperationNames(): string[] {
    return Array.from(this.operations.keys());
  }

  // Methods needed by ErrorBoundaryCore
  canRetry(retryCount: number): boolean {
    // Default implementation - can be overridden
    return retryCount < 3;
  }

  getRemainingRetries(retryCount: number, maxRetries: number = 3): number {
    return Math.max(0, maxRetries - retryCount);
  }

  logError(
    _error: Error,
    _errorInfo?: unknown,
    _retryCount?: number,
    _maxRetries?: number
  ): void {
    // Default no-op implementation
  }

  executeErrorCallback(_error: Error, _errorInfo?: unknown): void {
    // Default no-op implementation
  }

  executeRetryCallback(_retryCount: number, _maxRetries?: number): void {
    // Default no-op implementation
  }

  executeRecoveryCallback(): void {
    // Default no-op implementation
  }

  updateConfig(_config: unknown): void {
    // Default no-op implementation
  }
}

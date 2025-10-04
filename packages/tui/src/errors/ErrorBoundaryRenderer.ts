export class ErrorBoundaryRenderer {
  render(error: Error, errorInfo?: unknown): string {
    return this.renderError(error, errorInfo);
  }

  renderError(error: Error, _errorInfo?: unknown): string {
    return `Error: ${error.message}\n${error.stack ?? ''}`;
  }

  renderRecoveryMessage(message: string): string {
    return `Recovery: ${message}`;
  }

  renderRetryPrompt(attempts: number, maxAttempts: number): string {
    return `Retry attempt ${attempts}/${maxAttempts}. Press R to retry, Q to quit.`;
  }

  renderStateSnapshot(state: unknown): string {
    try {
      return JSON.stringify(state, null, 2);
    } catch {
      return 'Unable to render state snapshot';
    }
  }

  renderMetrics(metrics: Record<string, unknown>): string {
    const lines: string[] = ['=== Error Metrics ==='];
    for (const [key, value] of Object.entries(metrics)) {
      lines.push(`${key}: ${value}`);
    }
    return lines.join('\n');
  }
}

export interface ErrorInfo {
  componentStack?: string;
  errorBoundary?: string;
  errorBoundaryStack?: string;
}

export class ErrorBoundaryRenderer {
  static renderError(
    error: Error,
    config?: { showDetails: boolean; retryEnabled: boolean }
  ): string {
    const showDetails = config?.showDetails ?? false;
    const retryEnabled = config?.retryEnabled ?? false;

    const lines = [
      '┌─ Error Boundary ─────────────────────────────┐',
      '│                                              │',
      `│ ${error.name}: ${error.message.slice(0, 35).padEnd(35)} │`,
      '│                                              │',
    ];

    if (showDetails && error.stack != null) {
      const stackLines = error.stack.split('\n').slice(1, 4);
      stackLines.forEach((line) => {
        const truncated = line.trim().slice(0, 42).padEnd(42);
        lines.push(`│ ${truncated} │`);
      });
      lines.push('│                                              │');
    }

    if (retryEnabled) {
      lines.push('│ Press R to retry or Q to quit               │');
    } else {
      lines.push('│ Press Q to quit                             │');
    }

    lines.push('└──────────────────────────────────────────────┘');

    return lines.join('\n');
  }
}

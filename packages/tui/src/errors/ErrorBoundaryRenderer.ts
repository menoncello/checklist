export class ErrorBoundaryRenderer {
  renderError(error: Error, errorInfo: Record<string, unknown>): string {
    return ErrorBoundaryRenderer.defaultFallbackRenderer(error, errorInfo);
  }

  static defaultFallbackRenderer(
    error: Error,
    _errorInfo: Record<string, unknown>
  ): string {
    return `
╭─────────────────────────────────────╮
│        Error Boundary               │
├─────────────────────────────────────┤
│ ${error.message.padEnd(35)} │
│                                     │
│ Stack trace available in debug mode │
╰─────────────────────────────────────╯
    `.trim();
  }

  static renderError(
    error: Error,
    errorInfo: Record<string, unknown>,
    customRenderer?: (
      error: Error,
      errorInfo: Record<string, unknown>
    ) => string
  ): string {
    if (customRenderer != null) {
      try {
        return customRenderer(error, errorInfo);
      } catch (renderError) {
        // Emergency fallback if custom renderer fails
        return `
╭─────────────────────────────────────╮
│    ERROR BOUNDARY FAILURE           │
├─────────────────────────────────────┤
│ Original error: ${error.message.substring(0, 20)}
│ Renderer error: ${(renderError as Error).message.substring(0, 20)}
│                                     │
│ Using emergency fallback            │
╰─────────────────────────────────────╯
        `.trim();
      }
    }
    return this.defaultFallbackRenderer(error, errorInfo);
  }
}

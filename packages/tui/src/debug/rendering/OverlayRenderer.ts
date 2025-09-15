export interface OverlayConfig {
  enabled: boolean;
  showOverlay: boolean;
}

export interface OverlayDimensions {
  width: number;
  height: number;
  overlayWidth: number;
  overlayHeight: number;
}

export interface OverlayContent {
  selectedPanel: string;
  contentLines: string[];
}

export class OverlayRenderer {
  static render(
    config: OverlayConfig,
    isVisible: boolean,
    content: OverlayContent,
    dimensions: { width: number; height: number }
  ): string {
    if (!config.enabled || !isVisible || !config.showOverlay) {
      return '';
    }

    const overlayDims = this.calculateDimensions(dimensions);
    const lines = this.buildOverlayLines(content, overlayDims);
    return this.positionOverlay(lines, dimensions, overlayDims);
  }

  private static calculateDimensions(dimensions: {
    width: number;
    height: number;
  }): OverlayDimensions {
    return {
      width: dimensions.width,
      height: dimensions.height,
      overlayWidth: Math.min(dimensions.width - 4, 80),
      overlayHeight: Math.min(dimensions.height - 4, 30),
    };
  }

  private static buildOverlayLines(
    content: OverlayContent,
    dims: OverlayDimensions
  ): string[] {
    const lines: string[] = [];

    // Header
    lines.push(`┌${'─'.repeat(dims.overlayWidth - 2)}┐`);
    lines.push(
      `│ Debug Panel - ${content.selectedPanel.toUpperCase()} ${' '.repeat(dims.overlayWidth - 20)}│`
    );
    lines.push(`├${'─'.repeat(dims.overlayWidth - 2)}┤`);

    // Content
    for (const line of content.contentLines) {
      const paddedLine = line
        .padEnd(dims.overlayWidth - 2, ' ')
        .slice(0, dims.overlayWidth - 2);
      lines.push(`│${paddedLine}│`);
    }

    // Fill remaining space
    while (lines.length < dims.overlayHeight - 1) {
      lines.push(`│${' '.repeat(dims.overlayWidth - 2)}│`);
    }

    // Footer
    lines.push(`└${'─'.repeat(dims.overlayWidth - 2)}┘`);

    return lines;
  }

  private static positionOverlay(
    lines: string[],
    dimensions: { width: number; height: number },
    overlayDims: OverlayDimensions
  ): string {
    const overlayContent = lines.join('\n');
    const positionedLines = overlayContent.split('\n').map((line, index) => {
      const x = dimensions.width - overlayDims.overlayWidth;
      const y = dimensions.height - overlayDims.overlayHeight + index;
      return `\x1b[${y + 1};${x + 1}H${line}`;
    });

    return positionedLines.join('');
  }
}

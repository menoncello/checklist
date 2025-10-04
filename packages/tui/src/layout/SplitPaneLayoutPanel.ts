import { createLogger } from '@checklist/core/utils/logger';

const _logger = createLogger('checklist:tui:split-pane-layout-panel');

export interface PanelContent {
  lines: string[];
  cursor?: { x: number; y: number };
  needsRefresh?: boolean;
}

export class SplitPaneLayoutPanel {
  private leftPanelContent: PanelContent;
  private rightPanelContent: PanelContent;

  constructor() {
    this.leftPanelContent = { lines: [] };
    this.rightPanelContent = { lines: [] };
  }

  public getLeftPanel(): PanelContent {
    return this.leftPanelContent;
  }

  public getRightPanel(): PanelContent {
    return this.rightPanelContent;
  }

  public updateLeftPanelContent(content: string[]): void {
    this.leftPanelContent = {
      lines: content,
      needsRefresh: true,
    };
  }

  public updateRightPanelContent(content: string[]): void {
    this.rightPanelContent = {
      lines: content,
      needsRefresh: true,
    };
  }

  public getLeftPanelContent(): string[] {
    return this.leftPanelContent.lines;
  }

  public getRightPanelContent(): string[] {
    return this.rightPanelContent.lines;
  }

  public processPanelContent(
    content: string[],
    maxWidth: number,
    maxHeight: number
  ): string[] {
    const processedLines: string[] = [];

    for (const line of content) {
      if (line.length <= maxWidth) {
        processedLines.push(line.padEnd(maxWidth));
      } else {
        processedLines.push(line.substring(0, maxWidth));
        const remaining = line.substring(maxWidth);
        if (remaining.length > 0) {
          const continuationLines = this.wrapText(remaining, maxWidth);
          processedLines.push(...continuationLines);
        }
      }

      if (processedLines.length >= maxHeight) {
        break;
      }
    }

    while (processedLines.length < maxHeight) {
      processedLines.push(''.padEnd(maxWidth));
    }

    return processedLines.slice(0, maxHeight);
  }

  private wrapText(text: string, maxWidth: number): string[] {
    const lines: string[] = [];
    let remaining = text;

    while (remaining.length > 0) {
      lines.push(remaining.substring(0, maxWidth));
      remaining = remaining.substring(maxWidth);
    }

    return lines;
  }

  public clearRefreshFlags(): void {
    this.leftPanelContent.needsRefresh = false;
    this.rightPanelContent.needsRefresh = false;
  }

  public reset(): void {
    this.leftPanelContent = { lines: [] };
    this.rightPanelContent = { lines: [] };
  }
}

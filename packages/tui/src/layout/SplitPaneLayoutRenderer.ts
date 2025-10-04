import { createLogger } from '@checklist/core/utils/logger';
import { LayoutDimensions } from './SplitPaneLayoutDimensions';
import { PanelContent } from './SplitPaneLayoutPanel';

const _logger = createLogger('checklist:tui:split-pane-layout-renderer');

export interface SplitPaneLayoutConfig {
  splitRatio: number;
  minPanelWidth: number;
  borderColor?: string;
  focusColor?: string;
  enableVerticalSplit?: boolean;
  resizable?: boolean;
}

export class SplitPaneLayoutRenderer {
  private focusedPanel: 'left' | 'right';

  constructor(focusedPanel: 'left' | 'right' = 'left') {
    this.focusedPanel = focusedPanel;
  }

  public setFocusedPanel(panel: 'left' | 'right'): void {
    this.focusedPanel = panel;
  }

  public getFocusedPanel(): 'left' | 'right' {
    return this.focusedPanel;
  }

  public buildLayoutOutput(
    config: SplitPaneLayoutConfig,
    dimensions: LayoutDimensions,
    leftPanelContent: PanelContent,
    rightPanelContent: PanelContent
  ): string {
    if (config.enableVerticalSplit === true) {
      return this.buildVerticalSplitOutput(
        dimensions,
        leftPanelContent,
        rightPanelContent
      );
    } else {
      return this.buildHorizontalSplitOutput(
        config,
        dimensions,
        leftPanelContent,
        rightPanelContent
      );
    }
  }

  private buildHorizontalSplitOutput(
    config: SplitPaneLayoutConfig,
    dimensions: LayoutDimensions,
    leftPanelContent: PanelContent,
    rightPanelContent: PanelContent
  ): string {
    const output: string[] = [];
    const borderChar = config.borderColor ?? '│';

    for (let row = 0; row < dimensions.totalHeight; row++) {
      const leftLine = leftPanelContent.lines[row] || '';
      const rightLine = rightPanelContent.lines[row] || '';

      if (row === 0) {
        const header = '═'.repeat(dimensions.totalWidth);
        output.push(`╔${header}╗`);
      } else if (row === dimensions.totalHeight - 1) {
        const footer = '═'.repeat(dimensions.totalWidth);
        output.push(`╚${footer}╝`);
      } else {
        const isFocusedBorder =
          this.focusedPanel === 'left' && row === dimensions.leftPanelWidth;
        const border = isFocusedBorder ? '┃' : borderChar;

        output.push(`║${leftLine}${border}${rightLine}║`);
      }
    }

    return output.join('\n');
  }

  private buildVerticalSplitOutput(
    dimensions: LayoutDimensions,
    leftPanelContent: PanelContent,
    rightPanelContent: PanelContent
  ): string {
    const output: string[] = [];

    output.push('╔' + '═'.repeat(dimensions.totalWidth) + '╗');

    for (let row = 0; row < dimensions.leftPanelHeight; row++) {
      const line = leftPanelContent.lines[row] || '';
      output.push(`║${line}║`);
    }

    const divider = '╠' + '═'.repeat(dimensions.totalWidth) + '╣';
    output.push(divider);

    for (let row = 0; row < dimensions.rightPanelHeight; row++) {
      const line = rightPanelContent.lines[row] || '';
      output.push(`║${line}║`);
    }

    output.push('╚' + '═'.repeat(dimensions.totalWidth) + '╝');

    return output.join('\n');
  }

  public renderFallbackError(error: Error): string {
    return [
      '╔══════════════════════════════════════════════════════════════╗',
      '║                        ERROR IN LAYOUT                        ║',
      `║  ${(error.message || 'Unknown error').padEnd(58)}  ║`,
      '╚══════════════════════════════════════════════════════════════╝',
    ].join('\n');
  }
}

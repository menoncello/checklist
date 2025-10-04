import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:split-pane-layout-dimensions');

export interface LayoutDimensions {
  totalWidth: number;
  totalHeight: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
  leftPanelHeight: number;
  rightPanelHeight: number;
}

export interface SplitPaneLayoutConfig {
  splitRatio: number;
  minPanelWidth: number;
  borderColor?: string;
  focusColor?: string;
  enableVerticalSplit?: boolean;
  resizable?: boolean;
}

export class SplitPaneLayoutDimensions {
  private dimensions: LayoutDimensions;

  constructor() {
    this.dimensions = {
      totalWidth: 80,
      totalHeight: 24,
      leftPanelWidth: 0,
      rightPanelWidth: 0,
      leftPanelHeight: 0,
      rightPanelHeight: 0,
    };
  }

  public getDimensions(): LayoutDimensions {
    return { ...this.dimensions };
  }

  public setTotalDimensions(width: number, height: number): void {
    this.dimensions.totalWidth = width;
    this.dimensions.totalHeight = height;
  }

  public updateDimensions(config: SplitPaneLayoutConfig): void {
    if (config.enableVerticalSplit === true) {
      this.dimensions.leftPanelHeight = Math.floor(
        this.dimensions.totalHeight * config.splitRatio
      );
      this.dimensions.rightPanelHeight =
        this.dimensions.totalHeight - this.dimensions.leftPanelHeight;
      this.dimensions.leftPanelWidth = this.dimensions.totalWidth;
      this.dimensions.rightPanelWidth = this.dimensions.totalWidth;
    } else {
      this.dimensions.leftPanelWidth = Math.floor(
        this.dimensions.totalWidth * config.splitRatio
      );
      this.dimensions.rightPanelWidth =
        this.dimensions.totalWidth - this.dimensions.leftPanelWidth - 1;
      this.dimensions.leftPanelHeight = this.dimensions.totalHeight;
      this.dimensions.rightPanelHeight = this.dimensions.totalHeight;
    }
  }

  public validateDimensions(config: SplitPaneLayoutConfig): void {
    this.validateWidthDimensions(config);
    this.validateHeightDimensions(config);
  }

  private validateWidthDimensions(config: SplitPaneLayoutConfig): void {
    const minTotalWidth = config.minPanelWidth * 2 + 1;

    if (this.dimensions.totalWidth < minTotalWidth) {
      this.handleSmallTerminalWidth(minTotalWidth);
    } else {
      this.enforceMinimumWidthRequirements(config);
    }

    this.ensureNoNegativeWidths();
  }

  private handleSmallTerminalWidth(minTotalWidth: number): void {
    logger.warn({
      msg: 'Terminal width too small for split layout',
      width: this.dimensions.totalWidth,
      minWidth: minTotalWidth,
    });

    // When terminal is too small, ensure both panels get at least 1 width
    const availableWidth = Math.max(2, this.dimensions.totalWidth - 1);
    this.dimensions.leftPanelWidth = Math.max(
      1,
      Math.floor(availableWidth / 2)
    );
    this.dimensions.rightPanelWidth = Math.max(
      1,
      availableWidth - this.dimensions.leftPanelWidth
    );
  }

  private enforceMinimumWidthRequirements(config: SplitPaneLayoutConfig): void {
    // Ensure each panel meets minimum width requirement
    if (this.dimensions.leftPanelWidth < config.minPanelWidth) {
      this.dimensions.leftPanelWidth = config.minPanelWidth;
      this.dimensions.rightPanelWidth =
        this.dimensions.totalWidth - config.minPanelWidth - 1;
    }
    if (this.dimensions.rightPanelWidth < config.minPanelWidth) {
      this.dimensions.rightPanelWidth = config.minPanelWidth;
      this.dimensions.leftPanelWidth =
        this.dimensions.totalWidth - config.minPanelWidth - 1;
    }
  }

  private ensureNoNegativeWidths(): void {
    // Final validation to ensure no negative values
    this.dimensions.leftPanelWidth = Math.max(
      1,
      this.dimensions.leftPanelWidth
    );
    this.dimensions.rightPanelWidth = Math.max(
      1,
      this.dimensions.rightPanelWidth
    );
  }

  private validateHeightDimensions(config: SplitPaneLayoutConfig): void {
    const minPanelHeight = 5;
    const minTotalHeight =
      config.enableVerticalSplit === true
        ? minPanelHeight * 2 + 1
        : minPanelHeight;

    if (
      this.dimensions.totalHeight < minTotalHeight &&
      config.enableVerticalSplit === true
    ) {
      logger.warn({
        msg: 'Terminal height too small for vertical split',
        height: this.dimensions.totalHeight,
        minHeight: minTotalHeight,
      });
    }
  }

  public hasDimensionsChanged(width: number, height: number): boolean {
    return (
      this.dimensions.totalWidth !== width ||
      this.dimensions.totalHeight !== height
    );
  }
}

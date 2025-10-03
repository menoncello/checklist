export interface SplitPaneLayoutConfig {
  splitRatio: number;
  minPanelWidth: number;
  borderColor?: string;
  focusColor?: string;
  enableVerticalSplit?: boolean;
  resizable?: boolean;
}

export interface PanelContent {
  lines: string[];
  cursor?: { x: number; y: number };
  needsRefresh?: boolean;
}

export interface LayoutDimensions {
  totalWidth: number;
  totalHeight: number;
  leftPanelWidth: number;
  rightPanelWidth: number;
  leftPanelHeight: number;
  rightPanelHeight: number;
}

export class SplitPaneLayoutConfigManager {
  private config: SplitPaneLayoutConfig;

  constructor(splitRatio: number = 0.7) {
    this.config = {
      splitRatio,
      minPanelWidth: 20,
      borderColor: '│',
      focusColor: '',
      enableVerticalSplit: false,
      resizable: true,
    };
  }

  public getConfig(): SplitPaneLayoutConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<SplitPaneLayoutConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public setSplitRatio(ratio: number): void {
    const newRatio = Math.max(0.1, Math.min(0.9, ratio));
    this.config.splitRatio = newRatio;
  }

  public getSplitRatio(): number {
    return this.config.splitRatio;
  }

  public createDefaultDimensions(): LayoutDimensions {
    return {
      totalWidth: 80,
      totalHeight: 24,
      leftPanelWidth: 0,
      rightPanelWidth: 0,
      leftPanelHeight: 0,
      rightPanelHeight: 0,
    };
  }

  public createDefaultPanelContent(): PanelContent {
    return { lines: [] };
  }
}

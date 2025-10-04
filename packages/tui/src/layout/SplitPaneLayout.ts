import { createLogger } from '@checklist/core/utils/logger';
import { LifecycleManager, LifecycleHooks } from '../framework/Lifecycle';
import { SplitPaneLayoutConfigManager } from './SplitPaneLayoutConfig';
import {
  SplitPaneLayoutDimensions,
  LayoutDimensions,
} from './SplitPaneLayoutDimensions';
import { SplitPaneLayoutPanel } from './SplitPaneLayoutPanel';
import { SplitPaneLayoutRenderer } from './SplitPaneLayoutRenderer';

const logger = createLogger('checklist:tui:split-pane-layout');

export interface SplitPaneLayoutConfig {
  splitRatio: number;
  minPanelWidth: number;
  borderColor?: string;
  focusColor?: string;
  enableVerticalSplit?: boolean;
  resizable?: boolean;
}

export class SplitPaneLayout implements LifecycleHooks {
  private configManager: SplitPaneLayoutConfigManager;
  private dimensionsManager: SplitPaneLayoutDimensions;
  private panelManager: SplitPaneLayoutPanel;
  private renderer: SplitPaneLayoutRenderer;
  private resizeInProgress = false;
  private needsReflow = false;

  constructor(splitRatio: number = 0.7) {
    this.configManager = new SplitPaneLayoutConfigManager(splitRatio);
    this.dimensionsManager = new SplitPaneLayoutDimensions();
    this.panelManager = new SplitPaneLayoutPanel();
    this.renderer = new SplitPaneLayoutRenderer();
  }

  public async onInitialize(): Promise<void> {
    const config = this.configManager.getConfig();
    logger.info({
      msg: 'Initializing Split Pane Layout',
      config,
    });

    this.updateDimensions();
    this.validateDimensions();

    logger.info({
      msg: 'Split Pane Layout initialized',
      dimensions: this.dimensionsManager.getDimensions(),
    });
  }

  public async onShutdown(): Promise<void> {
    logger.info({ msg: 'Shutting down Split Pane Layout' });

    this.panelManager.reset();
    this.resizeInProgress = false;
    this.needsReflow = false;

    logger.info({ msg: 'Split Pane Layout shutdown complete' });
  }

  public registerHooks(lifecycleManager: LifecycleManager): void {
    lifecycleManager.registerHooks(this);
  }

  public resize(width: number, height: number): void {
    if (!this.dimensionsManager.hasDimensionsChanged(width, height)) {
      return;
    }

    this.dimensionsManager.setTotalDimensions(width, height);
    this.updateDimensions();
    this.validateDimensions();
    this.needsReflow = true;

    logger.debug({
      msg: 'Split pane layout resized',
      width,
      height,
      dimensions: this.dimensionsManager.getDimensions(),
    });
  }

  private updateDimensions(): void {
    const config = this.configManager.getConfig();
    this.dimensionsManager.updateDimensions(config);
  }

  private validateDimensions(): void {
    const config = this.configManager.getConfig();
    this.dimensionsManager.validateDimensions(config);
  }

  public setSplitRatio(ratio: number): void {
    this.configManager.setSplitRatio(ratio);
    this.updateDimensions();
    this.validateDimensions();
    this.needsReflow = true;

    logger.debug({
      msg: 'Split ratio updated',
      ratio: this.configManager.getSplitRatio(),
      dimensions: this.dimensionsManager.getDimensions(),
    });
  }

  public getSplitRatio(): number {
    return this.configManager.getSplitRatio();
  }

  public setFocusedPanel(panel: 'left' | 'right'): void {
    this.renderer.setFocusedPanel(panel);
    this.needsReflow = true;

    logger.debug({
      msg: 'Focus changed',
      focusedPanel: panel,
    });
  }

  public getFocusedPanel(): 'left' | 'right' {
    return this.renderer.getFocusedPanel();
  }

  public updateLeftPanelContent(content: string[]): void {
    this.panelManager.updateLeftPanelContent(content);
    this.needsReflow = true;
  }

  public updateRightPanelContent(content: string[]): void {
    this.panelManager.updateRightPanelContent(content);
    this.needsReflow = true;
  }

  public getLeftPanelContent(): string[] {
    return this.panelManager.getLeftPanelContent();
  }

  public getRightPanelContent(): string[] {
    return this.panelManager.getRightPanelContent();
  }

  public getDimensions(): LayoutDimensions {
    return this.dimensionsManager.getDimensions();
  }

  public render(leftContent: string[], rightContent: string[]): string {
    const renderStart = performance.now();

    try {
      if (this.needsReflow) {
        this.performLayoutReflow(leftContent, rightContent);
      }

      const output = this.buildLayoutOutput();

      const renderDuration = performance.now() - renderStart;
      if (renderDuration > 50) {
        logger.warn({
          msg: 'Split pane render time exceeds 50ms threshold',
          duration: renderDuration,
        });
      }

      return output;
    } catch (error) {
      logger.error({
        msg: 'Error rendering split pane layout',
        error: (error as Error).message,
      });
      return this.renderer.renderFallbackError(error as Error);
    }
  }

  private performLayoutReflow(
    leftContent: string[],
    rightContent: string[]
  ): void {
    const dimensions = this.dimensionsManager.getDimensions();

    const processedLeftContent = this.panelManager.processPanelContent(
      leftContent,
      dimensions.leftPanelWidth,
      dimensions.leftPanelHeight
    );

    const processedRightContent = this.panelManager.processPanelContent(
      rightContent,
      dimensions.rightPanelWidth,
      dimensions.rightPanelHeight
    );

    this.panelManager.updateLeftPanelContent(processedLeftContent);
    this.panelManager.updateRightPanelContent(processedRightContent);
    this.panelManager.clearRefreshFlags();
    this.needsReflow = false;
  }

  private buildLayoutOutput(): string {
    const config = this.configManager.getConfig();
    const dimensions = this.dimensionsManager.getDimensions();
    const leftPanelContent = this.panelManager.getLeftPanel();
    const rightPanelContent = this.panelManager.getRightPanel();

    return this.renderer.buildLayoutOutput(
      config,
      dimensions,
      leftPanelContent,
      rightPanelContent
    );
  }

  public startResize(): void {
    const config = this.configManager.getConfig();
    if (config.resizable === true && this.resizeInProgress === false) {
      this.resizeInProgress = true;
      logger.debug({ msg: 'Started panel resize' });
    }
  }

  public endResize(): void {
    if (this.resizeInProgress === true) {
      this.resizeInProgress = false;
      this.needsReflow = true;
      logger.debug({ msg: 'Ended panel resize' });
    }
  }

  public adjustResize(delta: number): void {
    if (this.resizeInProgress !== true) {
      return;
    }

    const config = this.configManager.getConfig();
    if (config.resizable !== true) {
      return;
    }

    const dimensions = this.dimensionsManager.getDimensions();
    const currentRatio = this.configManager.getSplitRatio();
    const adjustment = delta / dimensions.totalWidth;
    const newRatio = Math.max(0.1, Math.min(0.9, currentRatio + adjustment));

    this.setSplitRatio(newRatio);
  }

  public isResizeInProgress(): boolean {
    return this.resizeInProgress;
  }

  public needsLayoutReflow(): boolean {
    return this.needsReflow;
  }

  public getConfig(): SplitPaneLayoutConfig {
    return this.configManager.getConfig();
  }

  public updateConfig(newConfig: Partial<SplitPaneLayoutConfig>): void {
    const oldConfig = this.configManager.getConfig();
    this.configManager.updateConfig(newConfig);

    if (
      oldConfig.splitRatio !== newConfig.splitRatio ||
      oldConfig.enableVerticalSplit !== newConfig.enableVerticalSplit
    ) {
      this.updateDimensions();
      this.validateDimensions();
      this.needsReflow = true;
    }

    logger.debug({
      msg: 'Split pane layout config updated',
      oldConfig,
      newConfig: this.configManager.getConfig(),
    });
  }

  public async initialize(): Promise<void> {
    await this.onInitialize();
  }

  public async cleanup(): Promise<void> {
    await this.onShutdown();
  }
}

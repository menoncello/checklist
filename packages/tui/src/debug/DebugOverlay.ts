import { BaseComponent } from '../components/BaseComponent';
import { RenderContext } from '../framework/UIFramework';
import { DebugManager } from './DebugManager';
import { DebugOverlayHelpers } from './DebugOverlayHelpers';
import { DebugPanelRenderer } from './DebugPanels';

export interface DebugOverlayConfig {
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
  size: { width: number; height: number };
  opacity: number;
  autoHide: boolean;
  autoHideDelay: number;
  resizable: boolean;
  movable: boolean;
  theme: 'dark' | 'light' | 'auto';
}

export interface DebugPanel {
  id: string;
  title: string;
  hotkey: string;
  render: (width: number, height: number) => string[];
  enabled: boolean;
  icon?: string;
}

export class DebugOverlay extends BaseComponent {
  public readonly id: string = 'debug-overlay';
  private debugManager: DebugManager;
  private config: DebugOverlayConfig;
  private panels = new Map<string, DebugPanel>();
  private selectedPanelId = 'logs';
  private scrollOffset = 0;
  private lastInteraction = Date.now();
  private autoHideTimer: NodeJS.Timeout | null = null;
  private panelRenderer!: DebugPanelRenderer;
  protected eventHandlers = new Map<string, Set<(data: unknown) => void>>();

  constructor(
    debugManager: DebugManager,
    config: Partial<DebugOverlayConfig> = {}
  ) {
    super({ id: 'debug-overlay' });
    this.debugManager = debugManager;
    this.panelRenderer = new DebugPanelRenderer(this.debugManager);
    this.config = {
      position: 'bottom-right',
      size: { width: 80, height: 25 },
      opacity: 0.9,
      autoHide: false,
      autoHideDelay: 5000,
      resizable: true,
      movable: true,
      theme: 'dark',
      ...config,
    };
    this.setupDefaultPanels();
    this.setupEventHandlers();
    this.startAutoHideTimer();
  }

  private setupDefaultPanels(): void {
    const panels = [
      { id: 'logs', title: 'Logs', hotkey: '1', icon: '📋' },
      { id: 'metrics', title: 'Metrics', hotkey: '2', icon: '📊' },
      { id: 'components', title: 'Components', hotkey: '3', icon: '🧩' },
      { id: 'performance', title: 'Performance', hotkey: '4', icon: '⚡' },
    ];
    panels.forEach((panel) =>
      this.addPanel({
        ...panel,
        enabled: true,
        render: this.createPanelRenderer(panel.id),
      })
    );
  }

  private createPanelRenderer(id: string): (w: number, h: number) => string[] {
    const renderers: Record<string, (w: number, h: number) => string[]> = {
      logs: (w, h) =>
        this.panelRenderer.renderLogsPanel(w, h, this.scrollOffset),
      metrics: (w, h) => this.panelRenderer.renderMetricsPanel(w, h),
      components: (w, h) =>
        this.panelRenderer.renderComponentsPanel(w, h, this.scrollOffset),
      performance: (w, h) =>
        this.panelRenderer.renderPerformancePanel(w, h, this.scrollOffset),
    };
    return renderers[id] ?? (() => []);
  }

  private setupEventHandlers(): void {
    this.debugManager.on('logAdded', () => {
      if (this.selectedPanelId === 'logs') this.markDirty();
    });
    this.debugManager.on('metricsUpdated', () => {
      if (this.selectedPanelId === 'metrics') this.markDirty();
    });
    this.debugManager.on('componentTreeUpdated', () => {
      if (this.selectedPanelId === 'components') this.markDirty();
    });
  }

  private startAutoHideTimer(): void {
    if (!this.config.autoHide) return;
    if (this.autoHideTimer) clearTimeout(this.autoHideTimer);
    this.autoHideTimer = setTimeout(() => {
      if (Date.now() - this.lastInteraction > this.config.autoHideDelay)
        this.hide();
    }, this.config.autoHideDelay);
  }

  public addPanel(panel: DebugPanel): void {
    this.panels.set(panel.id, panel);
  }

  public removePanel(id: string): boolean {
    return this.panels.delete(id);
  }

  public selectPanel(id: string): boolean {
    if (this.panels.has(id)) {
      this.selectedPanelId = id;
      this.scrollOffset = 0;
      this.recordInteraction();
      this.markDirty();
      return true;
    }
    return false;
  }

  public handleKeyPress(key: string): boolean {
    this.recordInteraction();
    for (const [id, panel] of this.panels) {
      if (panel.hotkey === key && panel.enabled) {
        this.selectPanel(id);
        return true;
      }
    }
    return this.handleNavigationKey(key);
  }

  public handleMouseEvent(
    x: number,
    y: number,
    button: 'left' | 'right' | 'wheel',
    _delta?: number
  ): boolean {
    this.recordInteraction();
    const bounds = this.getOverlayBounds();
    if (
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height
    ) {
      if (button === 'left' && y === bounds.y) {
        const panelIds = Array.from(this.panels.keys());
        const tabIndex = Math.floor(
          (x - bounds.x) / Math.floor(bounds.width / panelIds.length)
        );
        if (tabIndex < panelIds.length) {
          this.selectPanel(panelIds[tabIndex]);
          return true;
        }
      }
    }
    return false;
  }

  private handleNavigationKey(key: string): boolean {
    const actions: Record<string, () => void> = {
      ArrowUp: () => this.scrollUp(),
      ArrowDown: () => this.scrollDown(),
      PageUp: () => {
        this.scrollOffset = Math.max(0, this.scrollOffset - 10);
        this.markDirty();
      },
      PageDown: () => {
        this.scrollOffset += 10;
        this.markDirty();
      },
      Home: () => {
        this.scrollOffset = 0;
        this.markDirty();
      },
      c: () => {
        if (this.selectedPanelId === 'logs') this.debugManager.clearLogs();
      },
      e: () => {
        this.debugManager.log({
          level: 'info',
          category: 'Debug',
          message: 'Export panel data',
        });
      },
    };
    return actions[key] !== undefined ? (actions[key](), true) : false;
  }

  private scrollUp(): void {
    this.scrollOffset = Math.max(0, this.scrollOffset - 1);
    this.markDirty();
  }

  private scrollDown(): void {
    this.scrollOffset += 1;
    this.markDirty();
  }

  private recordInteraction(): void {
    this.lastInteraction = Date.now();
    this.startAutoHideTimer();
  }

  private getOverlayBounds() {
    return {
      x: 0,
      y: 0,
      width: this.config.size.width,
      height: this.config.size.height,
    };
  }

  public render(props: unknown): string {
    const context = props as RenderContext;
    if (
      !this.debugManager.isEnabled() ||
      (this.debugManager.getConfig().showOverlay ?? false) !== true
    )
      return '';
    const selectedPanel = this.panels.get(this.selectedPanelId);
    if (!selectedPanel) return '';

    const { width, height } = this.calculateDimensions(context);
    const tabs = this.createTabs(width);
    const contentLines = selectedPanel.render(width - 2, height - 4);
    const lines = DebugOverlayHelpers.buildOverlayLines({
      panelContent: contentLines,
      width,
      height,
      title: 'Debug Panel',
      tabs,
    });
    const { x, y } = this.calculatePosition(context, width, height);
    return lines
      .map((line, i) => `\x1b[${y + i + 1};${x + 1}H${line}`)
      .join('');
  }

  private calculateDimensions(context: RenderContext) {
    return {
      width: Math.min(this.config.size.width, context.width),
      height: Math.min(this.config.size.height, context.height),
    };
  }

  private createTabs(width: number) {
    return DebugOverlayHelpers.formatTabs(
      Array.from(this.panels.values()),
      this.selectedPanelId,
      width - 2
    );
  }

  private calculatePosition(
    context: RenderContext,
    width: number,
    height: number
  ) {
    return DebugOverlayHelpers.calculatePosition({
      position: this.config.position,
      termWidth: context.width,
      termHeight: context.height,
      overlayWidth: width,
      overlayHeight: height,
    });
  }

  public show(): void {
    this.debugManager.updateConfig({ enabled: true, showOverlay: true });
    this.recordInteraction();
    this.markDirty();
  }

  public hide(): void {
    this.debugManager.updateConfig({ showOverlay: false });
    this.recordInteraction();
    this.markDirty();
  }

  public toggle(): void {
    const isVisible = this.debugManager.getConfig().showOverlay ?? false;
    isVisible ? this.hide() : this.show();
    this.emit('toggle', !isVisible);
  }

  public isVisible(): boolean {
    return this.debugManager.getConfig().showOverlay ?? false;
  }

  public destroy(): void {
    if (this.autoHideTimer) {
      clearTimeout(this.autoHideTimer);
      this.autoHideTimer = null;
    }
    this.panels.clear();
    this.eventHandlers.clear();
  }

  public on(event: string, handler: (data: unknown) => void): void {
    if (!this.eventHandlers.has(event))
      this.eventHandlers.set(event, new Set());
    this.eventHandlers.get(event)?.add(handler);
  }

  public off(event: string, handler: (data: unknown) => void): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  protected emit(event: string, data: unknown): void {
    const handlers = this.eventHandlers.get(event);
    handlers?.forEach((handler) => {
      try {
        handler(data);
      } catch (error) {
        console.error(`Error in event handler for ${event}:`, error);
      }
    });
  }
}

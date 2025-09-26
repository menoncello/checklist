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
  private isResizing = false;
  private isMoving = false;
  private lastInteraction = Date.now();
  private autoHideTimer: NodeJS.Timeout | null = null;
  private panelRenderer!: DebugPanelRenderer;

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
    [
      { id: 'logs', title: 'Logs', hotkey: '1', icon: '📋' },
      { id: 'metrics', title: 'Metrics', hotkey: '2', icon: '📊' },
      { id: 'components', title: 'Components', hotkey: '3', icon: '🧩' },
      { id: 'performance', title: 'Performance', hotkey: '4', icon: '⚡' },
      { id: 'console', title: 'Console', hotkey: '5', icon: '💻' },
    ].forEach((panel) =>
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
      console: (w, h) => this.panelRenderer.renderConsolePanel(w, h),
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
      e: () => this.exportCurrentPanel(),
    };
    const action = actions[key];
    if (action != null) {
      action();
      return true;
    }
    return false;
  }

  public handleMouseEvent(
    x: number,
    y: number,
    button: 'left' | 'right' | 'wheel',
    delta?: number
  ): boolean {
    this.recordInteraction();
    const overlayBounds = this.getOverlayBounds();
    if (!this.isPointInOverlay(x, y, overlayBounds)) return false;
    if (button === 'wheel' && delta != null) {
      delta > 0 ? this.scrollDown() : this.scrollUp();
      return true;
    }
    if (button === 'left') {
      const tabY = overlayBounds.y + 2;
      if (y === tabY) {
        const tabIndex = Math.floor((x - overlayBounds.x) / 12);
        const enabledPanels = Array.from(this.panels.values()).filter(
          (p) => p.enabled
        );
        if (tabIndex >= 0 && tabIndex < enabledPanels.length) {
          this.selectPanel(enabledPanels[tabIndex].id);
          return true;
        }
      }
    }
    return true;
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

  private exportCurrentPanel(): void {
    const panel = this.panels.get(this.selectedPanelId);
    if (panel == null) return;
    const _content = panel.render(
      this.config.size.width - 4,
      this.config.size.height - 6
    );
    this.debugManager.log({
      level: 'info',
      category: 'Debug',
      message: `Exported ${panel.title} panel data`,
    });
  }

  private getOverlayBounds(): {
    x: number;
    y: number;
    width: number;
    height: number;
  } {
    return {
      x: 0,
      y: 0,
      width: this.config.size.width,
      height: this.config.size.height,
    };
  }

  private isPointInOverlay(
    x: number,
    y: number,
    bounds: ReturnType<typeof this.getOverlayBounds>
  ): boolean {
    return DebugOverlayHelpers.isPointInBounds(x, y, bounds);
  }

  public render(props: unknown): string {
    const context = props as RenderContext;
    if (
      !this.debugManager.isEnabled() ||
      this.debugManager.isDebugVisible?.() !== true
    )
      return '';
    const selectedPanel = this.panels.get(this.selectedPanelId);
    if (!selectedPanel) return '';
    return this.renderSelectedPanel(context, selectedPanel);
  }

  private renderSelectedPanel(
    context: RenderContext,
    selectedPanel: DebugPanel
  ): string {
    const width = Math.min(this.config.size.width, context.width);
    const height = Math.min(this.config.size.height, context.height);
    const tabs = DebugOverlayHelpers.formatTabs(
      Array.from(this.panels.values()),
      this.selectedPanelId,
      width - 2
    );
    const contentLines = selectedPanel.render(width - 2, height - 4);
    const lines = DebugOverlayHelpers.buildOverlayLines({
      panelContent: contentLines,
      width,
      height,
      title: 'Debug Panel',
      tabs,
    });
    const { x, y } = DebugOverlayHelpers.calculatePosition({
      position: this.config.position,
      termWidth: context.width,
      termHeight: context.height,
      overlayWidth: width,
      overlayHeight: height,
    });
    return lines
      .map((line, i) => `\x1b[${y + i + 1};${x + 1}H${line}`)
      .join('');
  }

  public show(): void {
    this.debugManager.enable();
    this.recordInteraction();
    this.markDirty();
  }
  public hide(): void {
    this.recordInteraction();
    this.markDirty();
  }
  public toggle(): void {
    this.debugManager.isDebugVisible?.() === true ? this.hide() : this.show();
  }
  public updateConfig(cfg: Partial<DebugOverlayConfig>): void {
    this.config = { ...this.config, ...cfg };
    this.markDirty();
  }
  public getConfig(): DebugOverlayConfig {
    return { ...this.config };
  }
}

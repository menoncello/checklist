export interface DebugConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  showOverlay: boolean;
  showMetrics: boolean;
  showComponentTree: boolean;
  showEventLog: boolean;
  showPerformanceMetrics: boolean;
  maxLogEntries: number;
  enableProfiling: boolean;
  hotkeys: Record<string, string>;
}

export interface DebugLogEntry {
  id: string;
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: unknown;
  stack?: string;
}

export interface DebugMetrics {
  renderTime: number;
  componentCount: number;
  eventCount: number;
  memoryUsage: number;
  fps: number;
  lastUpdate: number;
}

export interface ComponentDebugInfo {
  id: string;
  type: string;
  state: string;
  renderCount: number;
  lastRenderTime: number;
  children: ComponentDebugInfo[];
  props?: Record<string, unknown>;
  metrics?: Record<string, number>;
}

import { DebugKeyHandler } from './DebugKeyHandler';
import { ConfigInitializer } from './helpers/ConfigInitializer';
import { OverlayRenderer } from './rendering/OverlayRenderer';

export class DebugManager {
  private config: DebugConfig;
  private logs: DebugLogEntry[] = [];
  private metrics: DebugMetrics;
  private componentTree: ComponentDebugInfo | null = null;
  private eventHandlers = new Map<string, Set<Function>>();
  private isVisible = false;
  private selectedPanel:
    | 'logs'
    | 'metrics'
    | 'components'
    | 'events'
    | 'performance' = 'logs';
  private logIdCounter = 0;

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = ConfigInitializer.createDefaultConfig(config);
    this.metrics = ConfigInitializer.createDefaultMetrics();
    ConfigInitializer.setupEventCapture((level, category, message, data) => {
      const validLevel = ['debug', 'info', 'warn', 'error'].includes(level)
        ? (level as 'debug' | 'info' | 'warn' | 'error')
        : 'info';
      this.log(validLevel, category, message, data);
    });
  }

  public enable(): void {
    this.config.enabled = true;
    this.log('info', 'Debug', 'Debug mode enabled');
    this.emit('debugEnabled');
  }

  public disable(): void {
    this.config.enabled = false;
    this.isVisible = false;
    this.log('info', 'Debug', 'Debug mode disabled');
    this.emit('debugDisabled');
  }

  public toggle(): void {
    if (this.config.enabled) {
      this.isVisible = !this.isVisible;
    } else {
      this.enable();
      this.isVisible = true;
    }
    this.emit('debugVisibilityChanged', { visible: this.isVisible });
  }

  public log(
    level: DebugLogEntry['level'],
    category: string,
    message: string,
    data?: unknown
  ): void {
    if (!this.config.enabled) return;

    // Check log level
    const levels = ['debug', 'info', 'warn', 'error'];
    const configLevelIndex = levels.indexOf(this.config.logLevel);
    const messageLevelIndex = levels.indexOf(level);

    if (messageLevelIndex < configLevelIndex) return;

    const entry: DebugLogEntry = {
      id: `debug-${++this.logIdCounter}`,
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
      stack: level === 'error' ? new Error().stack : undefined,
    };

    this.logs.push(entry);

    // Trim logs if too many
    if (this.logs.length > this.config.maxLogEntries) {
      this.logs = this.logs.slice(-this.config.maxLogEntries);
    }

    this.emit('logAdded', { entry });

    // Also log to console in development
    if (typeof console !== 'undefined') {
      const consoleMethod = console[level] ?? console.log;
      consoleMethod(`[${category}] ${message}`, data ?? '');
    }
  }

  public updateMetrics(newMetrics: Partial<DebugMetrics>): void {
    this.metrics = { ...this.metrics, ...newMetrics, lastUpdate: Date.now() };
    this.emit('metricsUpdated', { metrics: this.metrics });
  }

  public updateComponentTree(tree: ComponentDebugInfo): void {
    this.componentTree = tree;
    this.metrics.componentCount = this.countComponents(tree);
    this.emit('componentTreeUpdated', { tree });
  }

  private countComponents(tree: ComponentDebugInfo): number {
    let count = 1;
    for (const child of tree.children) {
      count += this.countComponents(child);
    }
    return count;
  }

  public logEvent(eventType: string, target: string, data?: unknown): void {
    this.log('debug', 'Event', `${eventType} on ${target}`, data);
    this.metrics.eventCount++;
  }

  public startProfiling(name: string): string {
    if (!this.config.enableProfiling) return '';

    const profileId = `profile-${name}-${Date.now()}`;
    this.log('debug', 'Profiler', `Started profiling: ${name}`, { profileId });
    return profileId;
  }

  public endProfiling(profileId: string, name: string): number {
    if (!this.config.enableProfiling || !profileId) return 0;

    const duration = performance.now(); // This would need proper timing
    this.log('debug', 'Profiler', `Finished profiling: ${name}`, {
      profileId,
      duration,
    });
    return duration;
  }

  public handleKeyPress(key: string): boolean {
    const context = {
      isVisible: this.isVisible,
      config: this.config,
      selectedPanel: this.selectedPanel,
      toggle: () => this.toggle(),
      clearLogs: () => this.clearLogs(),
      exportLogs: () => this.exportLogs(),
      emit: (event: string, data: unknown) => this.emit(event, data),
    };

    const result = this.handleKeypressWithContext(key, context);
    if (context.selectedPanel !== this.selectedPanel) {
      this.selectedPanel = context.selectedPanel;
    }

    return result;
  }

  private handleKeypressWithContext(
    key: string,
    context: Record<string, unknown>
  ): boolean {
    const config = context.config as DebugConfig;
    if (config.enabled !== true) return false;

    const { hotkeys } = config;

    if (key === hotkeys.toggle) {
      return DebugKeyHandler.handleToggleKey(context);
    }

    if (context.isVisible !== true) return false;

    return DebugKeyHandler.handleVisiblePanelKeys(
      key,
      hotkeys as {
        clear: string;
        export: string;
        logs: string;
        metrics: string;
        components: string;
        events: string;
        performance: string;
      },
      context
    );
  }

  public clearLogs(): void {
    this.logs = [];
    this.log('info', 'Debug', 'Debug logs cleared');
  }

  public exportLogs(): string {
    const exportData = {
      timestamp: new Date().toISOString(),
      config: this.config,
      metrics: this.metrics,
      logs: this.logs,
      componentTree: this.componentTree,
    };

    const jsonString = JSON.stringify(exportData, null, 2);
    this.log('info', 'Debug', 'Debug data exported', {
      size: jsonString.length,
    });

    return jsonString;
  }

  public renderDebugOverlay(width: number, height: number): string {
    const contentLines = this.renderPanelContent(
      Math.min(width - 6, 78),
      Math.min(height - 8, 26)
    );

    return OverlayRenderer.render(
      { enabled: this.config.enabled, showOverlay: this.config.showOverlay },
      this.isVisible,
      { selectedPanel: this.selectedPanel, contentLines },
      { width, height }
    );
  }

  private renderPanelContent(width: number, height: number): string[] {
    switch (this.selectedPanel) {
      case 'logs':
        return this.renderLogsPanel(width, height);
      case 'metrics':
        return this.renderMetricsPanel(width, height);
      case 'components':
        return this.renderComponentsPanel(width, height);
      case 'events':
        return this.renderEventsPanel(width, height);
      case 'performance':
        return this.renderPerformancePanel(width, height);
      default:
        return ['Invalid panel selected'];
    }
  }

  private renderLogsPanel(width: number, height: number): string[] {
    const lines: string[] = [];
    const recentLogs = this.logs.slice(-height);

    for (const log of recentLogs) {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const levelIcon = this.getLevelIcon(log.level);
      const line = `${levelIcon} ${timestamp} [${log.category}] ${log.message}`;
      lines.push(line.slice(0, width));
    }

    if (lines.length === 0) {
      lines.push('No logs available');
    }

    return lines;
  }

  private renderMetricsPanel(_width: number, _height: number): string[] {
    const lines: string[] = [];

    lines.push(`Render Time: ${this.metrics.renderTime.toFixed(2)}ms`);
    lines.push(`Components: ${this.metrics.componentCount}`);
    lines.push(`Events: ${this.metrics.eventCount}`);
    lines.push(
      `Memory: ${(this.metrics.memoryUsage / 1024 / 1024).toFixed(2)}MB`
    );
    lines.push(`FPS: ${this.metrics.fps.toFixed(1)}`);
    lines.push(
      `Last Update: ${new Date(this.metrics.lastUpdate).toLocaleTimeString()}`
    );

    return lines;
  }

  private renderComponentsPanel(width: number, height: number): string[] {
    const lines: string[] = [];

    if (this.componentTree) {
      this.renderComponentTreeRecursive(this.componentTree, lines, 0, height);
    } else {
      lines.push('No component tree available');
    }

    return lines;
  }

  private renderComponentTreeRecursive(
    component: ComponentDebugInfo,
    lines: string[],
    depth: number,
    maxLines: number
  ): void {
    if (lines.length >= maxLines) return;

    const indent = '  '.repeat(depth);
    const line = `${indent}${component.type} (${component.id}) - ${component.state}`;
    lines.push(line);

    for (const child of component.children) {
      this.renderComponentTreeRecursive(child, lines, depth + 1, maxLines);
    }
  }

  private renderEventsPanel(width: number, height: number): string[] {
    const eventLogs = this.logs
      .filter((log) => log.category === 'Event')
      .slice(-height);
    const lines: string[] = [];

    for (const log of eventLogs) {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const line = `${timestamp} ${log.message}`;
      lines.push(line.slice(0, width));
    }

    if (lines.length === 0) {
      lines.push('No events logged');
    }

    return lines;
  }

  private renderPerformancePanel(width: number, height: number): string[] {
    const perfLogs = this.logs
      .filter((log) => log.category === 'Profiler')
      .slice(-height);
    const lines: string[] = [];

    for (const log of perfLogs) {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const line = `${timestamp} ${log.message}`;
      lines.push(line.slice(0, width));
    }

    if (lines.length === 0) {
      lines.push('No performance data available');
    }

    return lines;
  }

  private getLevelIcon(level: DebugLogEntry['level']): string {
    switch (level) {
      case 'debug':
        return '🔍';
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '•';
    }
  }

  public getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  public getMetrics(): DebugMetrics {
    return { ...this.metrics };
  }

  public getComponentTree(): ComponentDebugInfo | null {
    return this.componentTree ? { ...this.componentTree } : null;
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public isDebugVisible(): boolean {
    return this.isVisible;
  }

  public getSelectedPanel(): string {
    return this.selectedPanel;
  }

  public setSelectedPanel(panel: typeof this.selectedPanel): void {
    this.selectedPanel = panel;
    this.emit('panelChanged', { panel });
  }

  public updateConfig(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { config: this.config });
  }

  public getConfig(): DebugConfig {
    return { ...this.config };
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          // Avoid infinite loops in debug logging
          if (typeof console !== 'undefined') {
            console.error(
              `Error in debug manager event handler for '${event}':`,
              error
            );
          }
        }
      });
    }
  }
}

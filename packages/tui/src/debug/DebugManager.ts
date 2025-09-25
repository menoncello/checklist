import { DebugComponentManager } from './DebugComponentManager';
import { DebugConfigDefaults } from './DebugConfigDefaults';
import { DebugKeyboardHandler } from './DebugKeyboardHandler';
import {
  DebugConfig,
  DebugLogEntry,
  DebugMetrics,
  ComponentDebugInfo,
  DebugLogManager,
  DebugEventManager,
} from './DebugManagerHelpers';
import { DebugMetricsCollector } from './DebugMetricsCollector';
import { DebugOverlayManager } from './DebugOverlayManager';
import { DebugProfilingManager } from './DebugProfilingManager';

export {
  DebugConfig,
  DebugLogEntry,
  DebugMetrics,
  ComponentDebugInfo,
} from './DebugManagerHelpers';

import { DebugKeyHandler } from './DebugKeyHandler';
import { ConfigInitializer } from './helpers/ConfigInitializer';
import { OverlayRenderer } from './rendering/OverlayRenderer';

export class DebugManager {
  private config: DebugConfig;
  private logManager: DebugLogManager;
  private eventManager: DebugEventManager;
  private keyboardHandler: DebugKeyboardHandler;
  private metricsCollector: DebugMetricsCollector;
  private profilingManager: DebugProfilingManager;
  private overlayManager: DebugOverlayManager;
  private componentManager: DebugComponentManager;
  private metrics: DebugMetrics;

  constructor(config: Partial<DebugConfig> = {}) {
    this.config = {
      ...DebugConfigDefaults.getDefaultConfig(),
      ...config,
    };

    this.initializeMetrics();
    this.initializeManagers();

    if (this.config.enabled) {
      this.initialize();
    }
  }

  private initializeMetrics(): void {
    this.metrics = {
      renderTime: 0,
      componentCount: 0,
      eventCount: 0,
      memoryUsage: 0,
      fps: 0,
      lastUpdate: Date.now(),
    };
  }

  private initializeManagers(): void {
    this.logManager = new DebugLogManager(this.config.maxLogEntries);
    this.eventManager = new DebugEventManager();

    this.keyboardHandler = new DebugKeyboardHandler(
      this.config,
      this.handleHotkeyAction.bind(this)
    );
    this.metricsCollector = new DebugMetricsCollector(
      this.metrics,
      this.eventManager
    );
    this.profilingManager = new DebugProfilingManager(
      this.config.enableProfiling,
      this.logForProfiler.bind(this)
    );
    this.overlayManager = new DebugOverlayManager(
      this.config,
      this.logForOverlay.bind(this)
    );
    this.componentManager = new DebugComponentManager((count) =>
      this.metricsCollector.updateComponentCount(count)
    );
  }

  private initialize(): void {
    this.keyboardHandler.setup();
    this.metricsCollector.start();
    this.log({
      level: 'info',
      category: 'debug',
      message: 'Debug manager initialized',
    });
  }

  private setupKeyboardHandlers(): void {
    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('keydown', (event) => {
        const key = this.getKeyCombo(event);
        const action = this.config.hotkeys[key];

        if (action) {
          event.preventDefault();
          this.handleHotkeyAction(action);
        }
      });
    }
  }

  private getKeyCombo(event: KeyboardEvent): string {
    const parts: string[] = [];
    if (event.ctrlKey) parts.push('ctrl');
    if (event.shiftKey) parts.push('shift');
    if (event.altKey) parts.push('alt');
    if (event.metaKey) parts.push('meta');
    parts.push(event.key.toLowerCase());
    return parts.join('+');
  }

  private handleHotkeyAction(action: string): void {
    switch (action) {
      case 'toggle_overlay':
        this.toggleOverlay();
        break;
      case 'toggle_logs':
        this.config.showEventLog = !this.config.showEventLog;
        this.updateOverlay();
        break;
      case 'toggle_metrics':
        this.config.showMetrics = !this.config.showMetrics;
        this.updateOverlay();
        break;
      case 'clear_logs':
        this.clearLogs();
        break;
      default:
        this.log({
          level: 'warn',
          category: 'debug',
          message: `Unknown hotkey action: ${action}`,
        });
    }
  }

  private startMetricsCollection(): void {
    if (typeof setInterval === 'undefined') return;

    setInterval(() => {
      this.updateMetrics();
    }, 1000);
  }

  private updateMetrics(): void {
    const now = Date.now();
    const deltaTime = now - this.metrics.lastUpdate;

    this.metrics.lastUpdate = now;

    if (typeof process !== 'undefined' && process.memoryUsage) {
      this.metrics.memoryUsage = process.memoryUsage().heapUsed;
    }

    this.metrics.fps = deltaTime > 0 ? Math.round(1000 / deltaTime) : 0;

    this.eventManager.emit('metricsUpdated', this.metrics);
  }

  public log(params: {
    level: 'debug' | 'info' | 'warn' | 'error';
    category: string;
    message: string;
    data?: unknown;
  }): void {
    const { level, category, message, data } = params;
    if (!this.config.enabled) return;

    const levelPriority = this.getLevelPriority(level);
    const configPriority = this.getLevelPriority(this.config.logLevel);

    if (levelPriority < configPriority) return;

    this.logManager.log(level, category, message, data);
    this.eventManager.emit('logAdded', { level, category, message, data });

    if (this.config.showOverlay && this.overlayManager.isShowing()) {
      this.updateOverlay();
    }
  }

  private getLevelPriority(level: string): number {
    const priorities = { debug: 0, info: 1, warn: 2, error: 3 };
    return priorities[level as keyof typeof priorities] ?? 1;
  }

  public debug(category: string, message: string, data?: unknown): void {
    this.log({ level: 'debug', category, message, data });
  }

  public info(category: string, message: string, data?: unknown): void {
    this.log({ level: 'info', category, message, data });
  }

  public warn(category: string, message: string, data?: unknown): void {
    this.log({ level: 'warn', category, message, data });
  }

  public error(category: string, message: string, data?: unknown): void {
    this.log({ level: 'error', category, message, data });
  }

  public startProfiling(label: string): void {
    this.profilingManager.startProfiling(label);
  }

  public endProfiling(label: string): number | null {
    return this.profilingManager.endProfiling(label);
  }

  public updateComponentTree(tree: ComponentDebugInfo): void {
    this.componentManager.updateComponentTree(tree);

    if (this.config.showOverlay && this.overlayManager.isShowing()) {
      this.updateOverlay();
    }

    this.eventManager.emit('componentTreeUpdated', tree);
  }

  public recordRenderTime(time: number): void {
    this.metricsCollector.updateRenderTime(time);

    if (this.config.showOverlay && this.overlayManager.isShowing()) {
      this.updateOverlay();
    }
  }

  public recordEvent(eventType: string, data?: unknown): void {
    this.metricsCollector.incrementEventCount();
    this.log({
      level: 'debug',
      category: 'event',
      message: `Event: ${eventType}`,
      data,
    });
  }

  public getMetrics(): DebugMetrics {
    return this.metricsCollector.getMetrics();
  }

  public getLogs(): DebugLogEntry[] {
    return this.logManager.getLogs();
  }

  public getLogsByLevel(
    level: 'debug' | 'info' | 'warn' | 'error'
  ): DebugLogEntry[] {
    return this.logManager.getLogsByLevel(level);
  }

  public getLogsByCategory(category: string): DebugLogEntry[] {
    return this.logManager.getLogsByCategory(category);
  }

  public clearLogs(): void {
    this.logManager.clearLogs();
    this.log({ level: 'info', category: 'debug', message: 'Logs cleared' });

    if (this.config.showOverlay && this.overlayManager.isShowing()) {
      this.updateOverlay();
    }
  }

  private logForProfiler(
    level: string,
    category: string,
    message: string,
    data?: unknown
  ): void {
    this.log({ level: level as any, category, message, data });
  }

  private logForOverlay(
    level: string,
    category: string,
    message: string
  ): void {
    this.log({ level: level as any, category, message });
  }

  public toggleOverlay(): void {
    this.overlayManager.toggle();
    this.eventManager.emit('overlayToggled', this.overlayManager.isShowing());
  }

  private updateOverlay(): void {
    this.overlayManager.update({
      metrics: this.metricsCollector.getMetrics(),
      componentTree: this.componentManager.getComponentTree(),
      logs: this.logManager.getLogs(),
    });
  }

  public updateConfig(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig };

    this.logManager.updateMaxEntries(this.config.maxLogEntries);
    this.keyboardHandler.updateConfig(this.config);
    this.overlayManager.updateConfig(this.config);
    this.profilingManager.setEnabled(this.config.enableProfiling);

    if (this.config.enabled && !this.logManager) {
      this.initialize();
    }

    this.log({
      level: 'info',
      category: 'debug',
      message: 'Debug config updated',
      data: newConfig,
    });
  }

  public getConfig(): DebugConfig {
    return { ...this.config };
  }

  public isEnabled(): boolean {
    return this.config.enabled;
  }

  public on(event: string, handler: Function): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.eventManager.off(event, handler);
  }

  public destroy(): void {
    this.overlayManager.destroy();
    this.metricsCollector.stop();
    this.eventManager.clear();
    this.logManager.clearLogs();
    this.profilingManager.clear();
    this.componentManager.clear();
    this.log({
      level: 'info',
      category: 'debug',
      message: 'Debug manager destroyed',
    });
  }
}

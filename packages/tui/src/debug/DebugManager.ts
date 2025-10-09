import { DebugComponentManager } from './DebugComponentManager';
import { DebugConfigDefaults } from './DebugConfigDefaults';
import { DebugKeyboardHandler } from './DebugKeyboardHandler';
import type {
  DebugConfig,
  DebugLogEntry,
  ComponentDebugInfo,
} from './DebugManagerHelpers';
import { DebugLogManager, DebugEventManager } from './DebugManagerHelpers';
import type { DebugMetrics } from './helpers/ConfigInitializer';
import { DebugMetricsCollector } from './DebugMetricsCollector';
import { DebugOverlayManager } from './DebugOverlayManager';
import { DebugProfilingManager } from './DebugProfilingManager';

export type {
  DebugConfig,
  DebugLogEntry,
  ComponentDebugInfo,
} from './DebugManagerHelpers';
export type { DebugMetrics } from './helpers/ConfigInitializer';

export class DebugManager {
  private config: DebugConfig;
  private logManager!: DebugLogManager;
  private eventManager!: DebugEventManager;
  private keyboardHandler!: DebugKeyboardHandler;
  private metricsCollector!: DebugMetricsCollector;
  private profilingManager!: DebugProfilingManager;
  private overlayManager!: DebugOverlayManager;
  private componentManager!: DebugComponentManager;
  private metrics!: DebugMetrics;

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
      (action: string) => {
        this.log({
          level: 'debug',
          category: 'keyboard',
          message: `Action triggered: ${action}`,
        });
      }
    );
    this.metricsCollector = new DebugMetricsCollector();
    this.profilingManager = new DebugProfilingManager(
      this.config.enableProfiling,
      (message: string) => {
        this.log({ level: 'debug', category: 'profiling', message });
      }
    );
    this.overlayManager = new DebugOverlayManager(
      this.config,
      (message: string) => {
        this.log({ level: 'info', category: 'overlay', message });
      }
    );
    this.componentManager = new DebugComponentManager();
  }

  private initialize(): void {
    // Setup keyboard handlers if needed
    this.setupKeyboardHandlers();
    // Start metrics collection if needed
    this.startMetricsCollection();
    this.log({
      level: 'info',
      category: 'debug',
      message: 'Debug manager initialized',
    });
  }

  private setupKeyboardHandlers(): void {
    // Skip keyboard handlers in Node.js environment
    // This is a TUI app, not a browser app
  }

  private getKeyCombo(event: {
    key?: string;
    ctrlKey?: boolean;
    shiftKey?: boolean;
    altKey?: boolean;
    metaKey?: boolean;
  }): string {
    const parts: string[] = [];
    if ('ctrlKey' in event && event.ctrlKey) parts.push('ctrl');
    if ('shiftKey' in event && event.shiftKey) parts.push('shift');
    if ('altKey' in event && event.altKey) parts.push('alt');
    if ('metaKey' in event && event.metaKey) parts.push('meta');
    if ('key' in event && typeof event.key === 'string')
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
    const deltaTime = now - (this.metrics.lastUpdate ?? now);

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

    if (this.config.showOverlay && this.overlayManager.isVisible()) {
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

  public startProfiling(label: string): string {
    this.profilingManager.start(label);
    return label;
  }

  public endProfiling(label: string): number {
    const result = this.profilingManager.end(label);
    return result || 0;
  }

  public updateComponentTree(tree: ComponentDebugInfo): void {
    // Store component tree for debugging
    this.componentManager.register('root', tree);

    if (this.config.showOverlay && this.overlayManager.isVisible()) {
      this.updateOverlay();
    }

    this.eventManager.emit('componentTreeUpdated', tree);
  }

  public recordRenderTime(time: number): void {
    this.metricsCollector.updateRenderTime(time);

    if (this.config.showOverlay && this.overlayManager.isVisible()) {
      this.updateOverlay();
    }
  }

  public recordEvent(eventType: string, data?: unknown): void {
    // Increment event count in metrics
    this.metrics.eventCount++;
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
    return this.logManager.filterLogs({ level });
  }

  public getLogsByCategory(category: string): DebugLogEntry[] {
    return this.logManager.getLogs().filter((log) => log.category === category);
  }

  public clearLogs(): void {
    this.logManager.clearLogs();
    this.log({ level: 'info', category: 'debug', message: 'Logs cleared' });

    if (this.config.showOverlay && this.overlayManager.isVisible()) {
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
    this.eventManager.emit('overlayToggled', this.overlayManager.isVisible());
  }

  // Public methods needed by DebugIntegrationCore
  public handleKeyPress(key: string): boolean {
    // Default implementation - can be overridden
    return false;
  }

  public isDebugVisible(): boolean {
    return this.config.enabled === true;
  }

  public enable(): void {
    this.config.enabled = true;
    this.initialize();
  }

  public disable(): void {
    this.config.enabled = false;
    this.cleanup();
  }

  public toggle(): void {
    if (this.config.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  public logEvent(event: string, data?: unknown): void {
    this.log({ level: 'debug', category: 'event', message: event, data });
  }

  public exportLogs(): string {
    return JSON.stringify(this.logManager.getLogs(), null, 2);
  }

  public getComponentTree(): unknown {
    return this.componentManager.getComponent('root');
  }

  private updateOverlay(): void {
    // Update overlay content
    const content: string[] = [];
    const metrics = this.getMetrics();
    content.push(`FPS: ${metrics.fps}`);
    content.push(`Memory: ${metrics.memoryUsage}`);
    content.push(`Components: ${metrics.componentCount}`);
    this.overlayManager.setContent(content);
  }

  public updateConfig(newConfig: Partial<DebugConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update configuration for all components
    if (newConfig.overlayPosition) {
      this.overlayManager.setPosition(newConfig.overlayPosition);
    }

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

  public on(event: string, handler: (data: unknown) => void): void {
    this.eventManager.on(event, handler);
  }

  public off(event: string, handler: (data: unknown) => void): void {
    this.eventManager.off(event, handler);
  }

  public destroy(): void {
    this.cleanup();
  }

  private cleanup(): void {
    this.overlayManager.hide();
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

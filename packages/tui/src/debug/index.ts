export { DebugManager } from './DebugManager';
export { DebugOverlay } from './DebugOverlay';

export type {
  DebugConfig,
  DebugLogEntry,
  DebugMetrics,
  ComponentDebugInfo,
} from './DebugManager';

export type { DebugOverlayConfig, DebugPanel } from './DebugOverlay';

import { PerformanceManager } from '../performance';
import type { ComponentDebugInfo } from './DebugManager';
import { DebugManager } from './DebugManager';
import { DebugOverlay } from './DebugOverlay';

export interface DebugIntegrationConfig {
  enableInProduction: boolean;
  defaultLogLevel: 'debug' | 'info' | 'warn' | 'error';
  enableKeyboardShortcuts: boolean;
  enablePerformanceIntegration: boolean;
  overlayConfig: Partial<import('./DebugOverlay').DebugOverlayConfig>;
  managerConfig: Partial<import('./DebugManager').DebugConfig>;
}

export class DebugIntegration {
  private debugManager: DebugManager;
  private debugOverlay: DebugOverlay;
  private performanceManager: PerformanceManager | null = null;
  private config: DebugIntegrationConfig;
  private isProduction: boolean;

  constructor(config: Partial<DebugIntegrationConfig> = {}) {
    this.isProduction = process.env.NODE_ENV === 'production';

    this.config = {
      enableInProduction: false,
      defaultLogLevel: this.isProduction ? 'warn' : 'debug',
      enableKeyboardShortcuts: true,
      enablePerformanceIntegration: true,
      overlayConfig: {},
      managerConfig: {},
      ...config,
    };

    // Don't enable debug in production unless explicitly requested
    const shouldEnable = !this.isProduction || this.config.enableInProduction;

    this.debugManager = new DebugManager({
      enabled: shouldEnable,
      logLevel: this.config.defaultLogLevel,
      ...this.config.managerConfig,
    });

    this.debugOverlay = new DebugOverlay(this.debugManager, {
      ...this.config.overlayConfig,
    });

    this.setupIntegrations();
  }

  private setupIntegrations(): void {
    // Setup performance integration if requested
    if (this.config.enablePerformanceIntegration) {
      this.setupPerformanceIntegration();
    }

    // Setup global error handling
    this.setupGlobalErrorHandling();

    // Setup console integration
    this.setupConsoleIntegration();
  }

  private setupPerformanceIntegration(): void {
    if (!this.performanceManager) return;

    // Listen to performance events and log them
    this.performanceManager.on('metricRecorded', (data: unknown) => {
      if (
        data !== null &&
        data !== undefined &&
        typeof data === 'object' &&
        'metric' in data
      ) {
        const metricData = data as {
          metric: { name: string; value: number; tags?: unknown };
        };
        this.debugManager.log(
          'debug',
          'Performance',
          `Metric recorded: ${metricData.metric.name}`,
          {
            value: metricData.metric.value,
            tags: metricData.metric.tags,
          }
        );
      }
    });

    this.performanceManager.on('performanceAlert', (data: unknown) => {
      if (
        data !== null &&
        data !== undefined &&
        typeof data === 'object' &&
        'alert' in data
      ) {
        const alertData = data as { alert: { message: string } };
        this.debugManager.log(
          'warn',
          'Performance',
          `Performance alert: ${alertData.alert.message}`,
          alertData.alert
        );
      }
    });

    this.performanceManager.on('memoryAlert', (data: unknown) => {
      if (
        data !== null &&
        data !== undefined &&
        typeof data === 'object' &&
        'type' in data
      ) {
        const memoryData = data as { type: string };
        this.debugManager.log(
          'error',
          'Memory',
          `Memory alert: ${memoryData.type}`,
          data
        );
      }
    });

    this.performanceManager.on('memoryLeak', (data: unknown) => {
      if (
        data !== null &&
        data !== undefined &&
        typeof data === 'object' &&
        'leak' in data
      ) {
        const leakData = data as { leak: { type: string } };
        this.debugManager.log(
          'error',
          'Memory',
          `Memory leak detected: ${leakData.leak.type}`,
          leakData.leak
        );
      }
    });

    // Update debug metrics with performance data
    setInterval(() => {
      if (this.performanceManager == null) return;
      const perfReport = this.performanceManager.getPerformanceReport();

      this.debugManager.updateMetrics({
        renderTime: perfReport.metrics.sampleRate,
        memoryUsage: perfReport.system.memory.heapUsed,
        eventCount: 0, // This would need to be tracked separately
        fps: 60, // This would need to be calculated from frame timing
      });
    }, 1000);
  }

  private setupGlobalErrorHandling(): void {
    // Capture uncaught exceptions
    if (typeof process !== 'undefined') {
      process.on('uncaughtException', (error) => {
        this.debugManager.log('error', 'System', 'Uncaught exception', {
          message: error.message,
          stack: error.stack,
          name: error.name,
        });
      });

      process.on('unhandledRejection', (reason, promise) => {
        this.debugManager.log(
          'error',
          'System',
          'Unhandled promise rejection',
          {
            reason: reason instanceof Error ? reason.message : String(reason),
            stack: reason instanceof Error ? reason.stack : undefined,
            promise: promise.toString(),
          }
        );
      });

      // Memory warnings
      process.on('warning', (warning) => {
        this.debugManager.log(
          'warn',
          'System',
          `Node.js warning: ${warning.name}`,
          {
            message: warning.message,
            stack: warning.stack,
          }
        );
      });
    }
  }

  private setupConsoleIntegration(): void {
    if (typeof console !== 'undefined' && this.debugManager.isEnabled()) {
      // Intercept console methods to also log to debug manager
      const originalLog = console.log;
      const originalWarn = console.warn;
      const originalError = console.error;
      const originalInfo = console.info;

      console.log = (...args) => {
        this.debugManager.log('info', 'Console', args.join(' '));
        originalLog.apply(console, args);
      };

      console.warn = (...args) => {
        this.debugManager.log('warn', 'Console', args.join(' '));
        originalWarn.apply(console, args);
      };

      console.error = (...args) => {
        this.debugManager.log('error', 'Console', args.join(' '));
        originalError.apply(console, args);
      };

      console.info = (...args) => {
        this.debugManager.log('info', 'Console', args.join(' '));
        originalInfo.apply(console, args);
      };
    }
  }

  public setPerformanceManager(performanceManager: PerformanceManager): void {
    this.performanceManager = performanceManager;
    if (this.config.enablePerformanceIntegration) {
      this.setupPerformanceIntegration();
    }
  }

  public handleKeyPress(key: string): boolean {
    if (!this.config.enableKeyboardShortcuts) return false;

    // First try debug manager
    if (this.debugManager.handleKeyPress(key)) {
      return true;
    }

    // Then try overlay
    if (this.debugManager.isDebugVisible()) {
      return this.debugOverlay.handleKeyPress(key);
    }

    return false;
  }

  public handleMouseEvent(
    x: number,
    y: number,
    button: 'left' | 'right' | 'wheel',
    delta?: number
  ): boolean {
    if (this.debugManager.isDebugVisible()) {
      return this.debugOverlay.handleMouseEvent(x, y, button, delta);
    }
    return false;
  }

  public logComponentEvent(
    componentId: string,
    event: string,
    data?: unknown
  ): void {
    this.debugManager.logEvent(event, componentId, data);
  }

  public updateComponentTree(tree: ComponentDebugInfo): void {
    this.debugManager.updateComponentTree(tree);
  }

  public startProfiling(name: string): string {
    return this.debugManager.startProfiling(name);
  }

  public endProfiling(profileId: string, name: string): number {
    return this.debugManager.endProfiling(profileId, name);
  }

  public log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: string,
    message: string,
    data?: unknown
  ): void {
    this.debugManager.log(level, category, message, data);
  }

  public enable(): void {
    this.debugManager.enable();
  }

  public disable(): void {
    this.debugManager.disable();
  }

  public toggle(): void {
    this.debugManager.toggle();
  }

  public show(): void {
    this.debugOverlay.show();
  }

  public hide(): void {
    this.debugOverlay.hide();
  }

  public isEnabled(): boolean {
    return this.debugManager.isEnabled();
  }

  public isVisible(): boolean {
    return this.debugManager.isDebugVisible();
  }

  public exportDebugData(): string {
    return this.debugManager.exportLogs();
  }

  public getDebugManager(): DebugManager {
    return this.debugManager;
  }

  public getDebugOverlay(): DebugOverlay {
    return this.debugOverlay;
  }

  public renderOverlay(width: number, height: number): string {
    if (this.debugManager.isEnabled() && this.debugManager.isDebugVisible()) {
      return this.debugOverlay.render({
        width,
        height,
        capabilities: {
          colors: 256,
          unicodeSupport: true,
          cursorSupport: true,
          alternateScreenSupport: true,
        },
        buffer: [],
        cursor: { x: 0, y: 0 },
        scrollX: 0,
        scrollY: 0,
      });
    }
    return '';
  }

  public updateConfig(newConfig: Partial<DebugIntegrationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.managerConfig) {
      this.debugManager.updateConfig(newConfig.managerConfig);
    }

    if (newConfig.overlayConfig) {
      this.debugOverlay.updateConfig(newConfig.overlayConfig);
    }
  }

  public getConfig(): DebugIntegrationConfig {
    return { ...this.config };
  }
}

// Convenience function to create a debug integration
export function createDebugIntegration(
  config?: Partial<DebugIntegrationConfig>
): DebugIntegration {
  return new DebugIntegration(config);
}

// Type re-exports for convenience - ComponentDebugInfo already exported above

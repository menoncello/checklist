export * from './DebugExports';

import { PerformanceManager } from '../performance';
import type { DebugIntegrationConfig } from './DebugExports';
import {
  DebugIntegrationCore,
  GlobalErrorHandlerSetup,
} from './DebugIntegrationCore';
import {
  PerformanceIntegrationSetup,
  ConsoleIntegrationSetup,
} from './DebugIntegrationHelpers';
import type { ComponentDebugInfo } from './DebugManager';
import { DebugManager } from './DebugManager';
import { DebugOverlay } from './DebugOverlay';

export class DebugIntegration {
  private core: DebugIntegrationCore;
  private performanceManager: PerformanceManager | null = null;
  private config: DebugIntegrationConfig;
  private isProduction: boolean;
  private debugManager: DebugManager;
  private debugOverlay: DebugOverlay;

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

    const shouldEnable = !this.isProduction || this.config.enableInProduction;

    this.debugManager = new DebugManager({
      enabled: shouldEnable,
      logLevel: this.config.defaultLogLevel,
      ...this.config.managerConfig,
    });

    this.debugOverlay = new DebugOverlay(
      this.debugManager,
      this.config.overlayConfig
    );
    this.core = new DebugIntegrationCore(this.debugManager, this.debugOverlay);
    this.setupIntegrations();
  }

  private setupIntegrations(): void {
    if (this.config.enablePerformanceIntegration) {
      this.setupPerformanceIntegration();
    }
    GlobalErrorHandlerSetup.setup(this.debugManager);
    this.setupConsoleIntegration();
  }

  private setupPerformanceIntegration(): void {
    if (this.performanceManager == null) return;
    PerformanceIntegrationSetup.setupMetricRecording(
      this.performanceManager,
      this.debugManager
    );
    PerformanceIntegrationSetup.setupAlerts(
      this.performanceManager,
      this.debugManager
    );
    PerformanceIntegrationSetup.setupMetricsInterval(
      this.performanceManager,
      this.debugManager
    );
  }

  private setupConsoleIntegration(): void {
    if (typeof console !== 'undefined' && this.debugManager.isEnabled()) {
      ConsoleIntegrationSetup.setup(this.debugManager);
    }
  }

  public setPerformanceManager(performanceManager: PerformanceManager): void {
    this.performanceManager = performanceManager;
    if (this.config.enablePerformanceIntegration) {
      this.setupPerformanceIntegration();
    }
  }

  public handleKeyPress(key: string): boolean {
    return this.core.handleKeyPress(key, this.config.enableKeyboardShortcuts);
  }

  public handleMouseEvent(
    x: number,
    y: number,
    button: 'left' | 'right' | 'wheel',
    delta?: number
  ): boolean {
    return this.core.handleMouseEvent(x, y, button, delta);
  }

  public logComponentEvent(
    componentId: string,
    event: string,
    data?: unknown
  ): void {
    this.core.logComponentEvent(componentId, event, data);
  }

  public updateComponentTree(tree: ComponentDebugInfo): void {
    this.core.updateComponentTree(tree);
  }

  public startProfiling(name: string): string {
    return this.core.startProfiling(name);
  }

  public endProfiling(profileId: string): number {
    return this.core.endProfiling(profileId);
  }

  public log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: string,
    message: string,
    data?: unknown
  ): void {
    this.core.log(level, category, message, data);
  }

  public enable(): void {
    this.core.enable();
  }
  public disable(): void {
    this.core.disable();
  }
  public toggle(): void {
    this.core.toggle();
  }
  public getDebugManager(): DebugManager {
    return this.debugManager;
  }
  public getDebugOverlay(): DebugOverlay {
    return this.debugOverlay;
  }
}

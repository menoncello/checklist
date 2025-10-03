import { createLogger } from '@checklist/core/utils/logger';
import { LifecycleManager, LifecycleHooks } from '../framework/Lifecycle';
import { CapabilityDetector } from './CapabilityDetector';
import { FallbackRenderer } from './FallbackRenderer';
import { TerminalEventHandler } from './TerminalEventHandler';
import { TerminalInfo } from './TerminalInfo';
import { TerminalInitializer } from './TerminalInitializer';
import { TerminalManagerConfigManager } from './TerminalManagerConfig';
import { TerminalStateManager } from './TerminalStateManager';

const logger = createLogger('checklist:tui:terminal-manager');

export interface TerminalManagerConfig {
  enableRawMode: boolean;
  enableMouseSupport: boolean;
  enableAltScreen: boolean;
  fallbackRenderer: boolean;
  autoDetectCapabilities: boolean;
}

export interface TerminalState {
  initialized: boolean;
  supportsColor: boolean;
  supportsUnicode: boolean;
  width: number;
  height: number;
  originalMode?: number;
  capabilities: Map<string, boolean>;
  fallbackMode: boolean;
}

export class TerminalManager implements LifecycleHooks {
  private configManager: TerminalManagerConfigManager;
  private stateManager: TerminalStateManager;
  private capabilityDetector: CapabilityDetector;
  private terminalInfo: TerminalInfo;
  private fallbackRenderer: FallbackRenderer;
  private initializer: TerminalInitializer;
  private eventHandler: TerminalEventHandler;

  constructor(config: Partial<TerminalManagerConfig> = {}) {
    // Use test-friendly defaults if running in test environment, but allow override
    const testDefaults =
      process.env.NODE_ENV === 'test'
        ? {
            enableRawMode: false,
            enableMouseSupport: false,
            enableAltScreen: false,
            fallbackRenderer: true,
            autoDetectCapabilities: false, // Disable for faster startup in tests
          }
        : {};

    // Merge provided config with test defaults
    const finalConfig = { ...testDefaults, ...config };

    this.configManager = new TerminalManagerConfigManager(finalConfig);
    this.stateManager = new TerminalStateManager();
    this.capabilityDetector = new CapabilityDetector();
    this.terminalInfo = new TerminalInfo();
    this.fallbackRenderer = new FallbackRenderer();

    const configObj = this.configManager.getConfig();
    this.initializer = new TerminalInitializer(
      configObj,
      this.stateManager,
      this.capabilityDetector,
      this.fallbackRenderer
    );

    this.eventHandler = new TerminalEventHandler(this.stateManager);
  }

  public async onInitialize(): Promise<void> {
    await this.initializer.initialize();
    this.eventHandler.setupResizeHandling();
    this.eventHandler.setupSignalHandlers();
  }

  public async onShutdown(): Promise<void> {
    logger.info({ msg: 'Shutting down Terminal Manager' });

    try {
      this.eventHandler.cleanup();

      const config = this.configManager.getConfig();
      const state = this.stateManager.getState();

      if (config.enableRawMode && state.originalMode !== undefined) {
        this.restoreTerminalMode();
      }

      this.stateManager.setInitialized(false);
      logger.info({ msg: 'Terminal Manager shutdown complete' });
    } catch (error) {
      logger.error({
        msg: 'Error during Terminal Manager shutdown',
        error: (error as Error).message,
      });
    }
  }

  public registerHooks(lifecycleManager: LifecycleManager): void {
    lifecycleManager.registerHooks(this);
  }

  private restoreTerminalMode(): void {
    const state = this.stateManager.getState();

    if (!process.stdin.isTTY || state.originalMode === undefined) {
      return;
    }

    try {
      process.stdin.setRawMode(state.originalMode === 1);
      this.stateManager.setState({ originalMode: undefined });

      logger.info({ msg: 'Terminal mode restored to original state' });
    } catch (error) {
      logger.error({
        msg: 'Failed to restore terminal mode',
        error: (error as Error).message,
      });
    }
  }

  public getState(): TerminalState {
    return this.stateManager.getState();
  }

  public getConfig(): TerminalManagerConfig {
    return this.configManager.getConfig();
  }

  public updateConfig(newConfig: Partial<TerminalManagerConfig>): void {
    this.configManager.updateConfig(newConfig);
  }

  public getTerminalInfo(): TerminalInfo {
    return this.terminalInfo;
  }

  public getCapabilityDetector(): CapabilityDetector {
    return this.capabilityDetector;
  }

  public getFallbackRenderer(): FallbackRenderer {
    return this.fallbackRenderer;
  }

  public isInitialized(): boolean {
    return this.stateManager.getState().initialized;
  }

  public supportsColor(): boolean {
    return this.stateManager.getState().supportsColor;
  }

  public supportsUnicode(): boolean {
    return this.stateManager.getState().supportsUnicode;
  }

  public getDimensions(): { width: number; height: number } {
    const state = this.stateManager.getState();
    return { width: state.width, height: state.height };
  }

  public hasCapability(name: string): boolean {
    return this.stateManager.getCapability(name);
  }

  public isFallbackMode(): boolean {
    return this.stateManager.getState().fallbackMode;
  }

  public async initialize(): Promise<boolean> {
    try {
      await this.onInitialize();
      return true;
    } catch (error) {
      logger.error({
        msg: 'Terminal Manager initialization failed',
        error: (error as Error).message,
      });
      return false;
    }
  }

  public async cleanup(): Promise<boolean> {
    try {
      await this.onShutdown();
      return true;
    } catch (error) {
      logger.error({
        msg: 'Terminal Manager cleanup failed',
        error: (error as Error).message,
      });
      return false;
    }
  }
}

import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:shutdown-config-manager');

export interface ShutdownStep {
  id: string;
  name: string;
  priority: number;
  handler: () => Promise<void>;
  timeout?: number;
}

export interface ShutdownManagerConfig {
  timeout: number;
  enableStateSave: boolean;
  stateSavePath?: string;
  forceKillTimeout: number;
  cleanupOrder: ShutdownStep[];
}

export class ShutdownConfigManager {
  private config: ShutdownManagerConfig;

  constructor(config: Partial<ShutdownManagerConfig> = {}) {
    this.config = {
      timeout: 5000,
      enableStateSave: true,
      forceKillTimeout: 10000,
      cleanupOrder: [],
      ...config,
    };

    logger.debug({
      msg: 'Shutdown Config Manager initialized',
      config: this.config,
    });
  }

  public getConfig(): ShutdownManagerConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ShutdownManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.debug({
      msg: 'Shutdown Manager config updated',
      newConfig,
    });
  }

  public getTimeout(): number {
    return this.config.timeout;
  }

  public getForceKillTimeout(): number {
    return this.config.forceKillTimeout;
  }

  public isStateSaveEnabled(): boolean {
    return this.config.enableStateSave;
  }

  public getStateSavePath(): string | undefined {
    return this.config.stateSavePath;
  }
}

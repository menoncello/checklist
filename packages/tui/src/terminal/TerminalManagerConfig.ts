export interface TerminalManagerConfig {
  enableRawMode: boolean;
  enableMouseSupport: boolean;
  enableAltScreen: boolean;
  fallbackRenderer: boolean;
  autoDetectCapabilities: boolean;
}

export class TerminalManagerConfigManager {
  private config: TerminalManagerConfig;

  constructor(config: Partial<TerminalManagerConfig> = {}) {
    this.config = {
      enableRawMode: true,
      enableMouseSupport: false,
      enableAltScreen: false,
      fallbackRenderer: true,
      autoDetectCapabilities: true,
      ...config,
    };
  }

  public getConfig(): TerminalManagerConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<TerminalManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public createDefaultConfig(): TerminalManagerConfig {
    return {
      enableRawMode: true,
      enableMouseSupport: false,
      enableAltScreen: false,
      fallbackRenderer: true,
      autoDetectCapabilities: true,
    };
  }
}

import { DebugConfig } from './DebugManagerHelpers';

export class DebugConfigDefaults {
  static getDefaultConfig(): DebugConfig {
    return {
      enabled: false,
      logLevel: 'info',
      overlayPosition: 'bottom',
      showMetrics: true,
      showLogs: true,
      maxLogEntries: 100,
    };
  }

  static merge(config: Partial<DebugConfig>): DebugConfig {
    return {
      ...this.getDefaultConfig(),
      ...config,
    };
  }
}

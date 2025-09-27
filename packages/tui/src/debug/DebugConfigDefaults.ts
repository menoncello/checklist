import type { DebugConfig } from './helpers/ConfigInitializer';

export class DebugConfigDefaults {
  static getDefaultConfig(): DebugConfig {
    return {
      enabled: false,
      logLevel: 'debug',
      showOverlay: false,
      showMetrics: true,
      showComponentTree: true,
      showEventLog: true,
      showPerformanceMetrics: true,
      maxLogEntries: 1000,
      enableProfiling: false,
      hotkeys: {
        'ctrl+d': 'toggle_overlay',
        'ctrl+l': 'toggle_logs',
        'ctrl+m': 'toggle_metrics',
        'ctrl+c': 'clear_logs',
      },
    };
  }
}

import type { AppConfig, ServiceConfig } from '../interfaces/IConfigService';

/**
 * Default configuration factory
 */
export class ConfigDefaults {
  /**
   * Create default application configuration
   */
  static createDefault(): AppConfig {
    return {
      appName: 'checklist-app',
      version: '1.0.0',
      environment: 'production',
      debug: false,
      workingDirectory: '.checklist',
      featureFlags: this.createDefaultFeatureFlags(),
      services: this.createDefaultServices(),
      metadata: this.createDefaultMetadata(),
    };
  }

  /**
   * Create default feature flags
   */
  private static createDefaultFeatureFlags(): Record<string, boolean | string> {
    return {
      undo: true,
      templates: true,
      search: true,
      shortcuts: true,
      sync: false,
      darkMode: false,
      animations: true,
    };
  }

  /**
   * Create default services configuration
   */
  private static createDefaultServices(): Record<string, ServiceConfig> {
    return {
      storage: this.createStorageService(),
      performance: this.createPerformanceService(),
      logging: this.createLoggingService(),
    };
  }

  private static createStorageService(): ServiceConfig {
    return {
      enabled: true,
      config: {
        path: '.checklist/data',
        format: 'yaml',
        autoSave: true,
        autoSaveInterval: 5000,
      },
    };
  }

  private static createPerformanceService(): ServiceConfig {
    return {
      enabled: true,
      config: {
        lazyLoad: true,
        cacheSize: 100,
        maxConcurrent: 5,
        timeout: 30000,
      },
    };
  }

  private static createLoggingService(): ServiceConfig {
    return {
      enabled: true,
      config: {
        level: 'info',
        console: true,
        file: false,
        maxFiles: 5,
        maxFileSize: 10485760, // 10MB
      },
    };
  }

  /**
   * Create default metadata
   */
  private static createDefaultMetadata(): Record<string, unknown> {
    return {
      theme: 'default',
      colors: {
        primary: 'blue',
        secondary: 'gray',
        accent: 'green',
      },
      shortcuts: {
        save: 'Ctrl+S',
        load: 'Ctrl+O',
        quit: 'Ctrl+Q',
      },
      ui: {
        animations: true,
        autoComplete: true,
      },
    };
  }
}

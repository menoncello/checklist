import type { IConfigService } from '../interfaces/IConfigService';
import type { IFileSystemService } from '../interfaces/IFileSystemService';
import type { ILogger } from '../interfaces/ILogger';
import type { IStateManager } from '../interfaces/IStateManager';
import type { IWorkflowEngine } from '../interfaces/IWorkflowEngine';
import { LoggerServiceAdapter } from '../services/LoggerServiceAdapter';
import { ServiceProvider } from './ServiceProvider';

/**
 * Compatibility layer for gradual migration from singleton to DI pattern
 * This allows existing code to continue working while we migrate incrementally
 */
export class CompatibilityLayer {
  private static provider: ServiceProvider | null = null;
  private static cachedServices: Map<string, unknown> = new Map();

  /**
   * Initialize the compatibility layer with a service provider
   */
  static initialize(provider: ServiceProvider): void {
    this.provider = provider;
    this.cachedServices.clear();
  }

  /**
   * Get logger instance (backward compatible)
   */
  static async getLogger(): Promise<ILogger> {
    const cacheKey = 'ILogger';

    if (this.cachedServices.has(cacheKey)) {
      return this.cachedServices.get(cacheKey) as ILogger;
    }

    let logger: ILogger;

    if (this.isDIEnabled('DI_LOGGER_ENABLED')) {
      // Use DI pattern
      if (!this.provider) {
        throw new Error('ServiceProvider not initialized');
      }
      logger = (await this.provider.getLogger()) as ILogger;
    } else {
      // Fall back to singleton pattern
      logger = LoggerServiceAdapter.fromSingleton();
    }

    this.cachedServices.set(cacheKey, logger);
    return logger;
  }

  /**
   * Get config service instance
   */
  static async getConfigService(): Promise<IConfigService> {
    const cacheKey = 'IConfigService';

    if (this.cachedServices.has(cacheKey)) {
      return this.cachedServices.get(cacheKey) as IConfigService;
    }

    let service: IConfigService;

    // Check if DI is enabled (accepts 'partial' or 'full' or true)
    const diEnabled =
      this.isDIEnabled('DI_ENABLED', 'partial') ||
      this.isDIEnabled('DI_ENABLED', 'full') ||
      this.isDIEnabled('DI_ENABLED', true);

    if (diEnabled) {
      // Use DI pattern
      if (!this.provider) {
        throw new Error('ServiceProvider not initialized');
      }
      service = (await this.provider.getConfigService()) as IConfigService;
    } else {
      // Create standalone instance (not recommended)
      throw new Error('ConfigService requires DI. Enable DI_ENABLED flag.');
    }

    this.cachedServices.set(cacheKey, service);
    return service;
  }

  /**
   * Get file system service instance
   */
  static async getFileSystemService(): Promise<IFileSystemService> {
    const cacheKey = 'IFileSystemService';

    if (this.cachedServices.has(cacheKey)) {
      return this.cachedServices.get(cacheKey) as IFileSystemService;
    }

    let service: IFileSystemService;

    // Check if DI is enabled (accepts 'partial' or 'full' or true)
    const diEnabled =
      this.isDIEnabled('DI_ENABLED', 'partial') ||
      this.isDIEnabled('DI_ENABLED', 'full') ||
      this.isDIEnabled('DI_ENABLED', true);

    if (diEnabled) {
      // Use DI pattern
      if (!this.provider) {
        throw new Error('ServiceProvider not initialized');
      }
      service =
        (await this.provider.getFileSystemService()) as IFileSystemService;
    } else {
      // Create standalone instance (not recommended)
      throw new Error('FileSystemService requires DI. Enable DI_ENABLED flag.');
    }

    this.cachedServices.set(cacheKey, service);
    return service;
  }

  /**
   * Get state manager instance
   */
  static async getStateManager(): Promise<IStateManager> {
    const cacheKey = 'IStateManager';

    if (this.cachedServices.has(cacheKey)) {
      return this.cachedServices.get(cacheKey) as IStateManager;
    }

    let service: IStateManager;

    if (this.isDIEnabled('DI_ENABLED', 'full')) {
      // Use DI pattern
      if (!this.provider) {
        throw new Error('ServiceProvider not initialized');
      }
      service = (await this.provider.getStateManager()) as IStateManager;
    } else {
      // Create standalone instance or use existing singleton
      throw new Error('StateManager requires full DI. Set DI_ENABLED=full.');
    }

    this.cachedServices.set(cacheKey, service);
    return service;
  }

  /**
   * Get workflow engine instance
   */
  static async getWorkflowEngine(): Promise<IWorkflowEngine> {
    const cacheKey = 'IWorkflowEngine';

    if (this.cachedServices.has(cacheKey)) {
      return this.cachedServices.get(cacheKey) as IWorkflowEngine;
    }

    let service: IWorkflowEngine;

    if (this.isDIEnabled('DI_ENABLED', 'full')) {
      // Use DI pattern
      if (!this.provider) {
        throw new Error('ServiceProvider not initialized');
      }
      service = (await this.provider.getWorkflowEngine()) as IWorkflowEngine;
    } else {
      // Create standalone instance or use existing singleton
      throw new Error('WorkflowEngine requires full DI. Set DI_ENABLED=full.');
    }

    this.cachedServices.set(cacheKey, service);
    return service;
  }

  /**
   * Check if a DI feature is enabled
   */
  static isDIEnabled(
    flag: string,
    expectedValue: string | boolean = true
  ): boolean {
    if (!this.provider) {
      // Check environment variables as fallback
      const envValue = process.env[flag] ?? Bun.env[flag];

      if (typeof expectedValue === 'boolean') {
        return envValue === 'true';
      }

      return envValue === expectedValue;
    }

    const boolFlagValue = this.provider.isFeatureEnabled(flag);

    if (typeof expectedValue === 'boolean') {
      return boolFlagValue === expectedValue;
    }

    // For string values like 'partial' or 'full'
    const config = this.provider['config'];
    const stringFlagValue = config.featureFlags?.[flag];
    return stringFlagValue === expectedValue;
  }

  /**
   * Clear cached services (useful for testing)
   */
  static clearCache(): void {
    this.cachedServices.clear();
  }

  /**
   * Destroy compatibility layer and cleanup
   */
  static async destroy(): Promise<void> {
    this.clearCache();

    if (this.provider) {
      await this.provider.destroy();
      this.provider = null;
    }
  }

  /**
   * Get the current service provider
   */
  static getProvider(): ServiceProvider | null {
    return this.provider;
  }

  /**
   * Check if compatibility layer is initialized
   */
  static isInitialized(): boolean {
    return this.provider !== null;
  }
}

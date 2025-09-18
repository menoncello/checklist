import type { ServiceLifecycle, ServiceOptions } from './Container';
import type { Constructor } from './Container';

/**
 * Service binding configuration for different environments
 */
export interface ServiceBinding {
  service: string | Constructor<unknown>;
  implementation: Constructor<unknown>;
  options?: ServiceOptions;
  environments?: Array<'development' | 'test' | 'production'>;
  condition?: () => boolean;
}

/**
 * Service configuration definition
 */
export interface ServiceConfiguration {
  name: string;
  version?: string;
  bindings: ServiceBinding[];
  defaultOptions?: ServiceOptions;
  healthCheck?: () => Promise<boolean>;
  autoStart?: boolean;
  priority?: number;
}

/**
 * Environment-specific service configuration
 */
export interface EnvironmentConfig {
  environment: 'development' | 'test' | 'production';
  services: ServiceConfiguration[];
  featureFlags?: Record<string, unknown>;
  globalOptions?: ServiceOptions;
}

/**
 * Service configuration loader
 */
export class ServiceConfigurationLoader {
  private configurations: Map<string, ServiceConfiguration> = new Map();
  private environmentConfig: EnvironmentConfig | null = null;

  /**
   * Load configuration from object
   */
  loadConfiguration(config: EnvironmentConfig): void {
    this.environmentConfig = config;

    for (const serviceConfig of config.services) {
      this.configurations.set(serviceConfig.name, serviceConfig);
    }
  }

  /**
   * Load configuration from YAML file
   */
  async loadFromFile(filePath: string): Promise<void> {
    const { load } = await import('js-yaml');
    const { readFile } = await import('fs/promises');

    const content = await readFile(filePath, 'utf8');
    const config = load(content) as EnvironmentConfig;

    this.loadConfiguration(config);
  }

  /**
   * Get service configuration by name
   */
  getServiceConfiguration(name: string): ServiceConfiguration | undefined {
    return this.configurations.get(name);
  }

  /**
   * Get all service configurations
   */
  getAllConfigurations(): ServiceConfiguration[] {
    return Array.from(this.configurations.values());
  }

  /**
   * Get configurations for specific environment
   */
  getConfigurationsForEnvironment(
    environment: 'development' | 'test' | 'production'
  ): ServiceConfiguration[] {
    return this.getAllConfigurations().filter((config) =>
      config.bindings.some(
        (binding) =>
          !binding.environments || binding.environments.includes(environment)
      )
    );
  }

  /**
   * Get environment configuration
   */
  getEnvironmentConfig(): EnvironmentConfig | null {
    return this.environmentConfig;
  }

  /**
   * Clear all configurations
   */
  clear(): void {
    this.configurations.clear();
    this.environmentConfig = null;
  }
}

/**
 * Service lifecycle manager
 */
export class ServiceLifecycleManager {
  private lifecycles: Map<string, ServiceLifecycle> = new Map();
  private healthChecks: Map<string, () => Promise<boolean>> = new Map();

  /**
   * Register lifecycle hooks for a service
   */
  registerLifecycle(serviceName: string, lifecycle: ServiceLifecycle): void {
    this.lifecycles.set(serviceName, lifecycle);
  }

  /**
   * Register health check for a service
   */
  registerHealthCheck(
    serviceName: string,
    check: () => Promise<boolean>
  ): void {
    this.healthChecks.set(serviceName, check);
  }

  /**
   * Execute beforeInit hook
   */
  async executeBeforeInit(
    serviceName: string,
    instance: unknown
  ): Promise<void> {
    const lifecycle = this.lifecycles.get(serviceName);
    if (lifecycle?.beforeInit) {
      await lifecycle.beforeInit(instance);
    }
  }

  /**
   * Execute afterInit hook
   */
  async executeAfterInit(
    serviceName: string,
    instance: unknown
  ): Promise<void> {
    const lifecycle = this.lifecycles.get(serviceName);
    if (lifecycle?.afterInit) {
      await lifecycle.afterInit(instance);
    }
  }

  /**
   * Execute beforeDestroy hook
   */
  async executeBeforeDestroy(
    serviceName: string,
    instance: unknown
  ): Promise<void> {
    const lifecycle = this.lifecycles.get(serviceName);
    if (lifecycle?.beforeDestroy) {
      await lifecycle.beforeDestroy(instance);
    }
  }

  /**
   * Execute afterDestroy hook
   */
  async executeAfterDestroy(
    serviceName: string,
    instance: unknown
  ): Promise<void> {
    const lifecycle = this.lifecycles.get(serviceName);
    if (lifecycle?.afterDestroy) {
      await lifecycle.afterDestroy(instance);
    }
  }

  /**
   * Execute onError hook
   */
  async executeOnError(
    serviceName: string,
    error: Error,
    instance: unknown
  ): Promise<void> {
    const lifecycle = this.lifecycles.get(serviceName);
    if (lifecycle?.onError) {
      await lifecycle.onError(error, instance);
    }
  }

  /**
   * Execute health check
   */
  async executeHealthCheck(serviceName: string): Promise<boolean> {
    const check = this.healthChecks.get(serviceName);
    if (check) {
      try {
        return await check();
      } catch {
        return false;
      }
    }
    return true;
  }

  /**
   * Check health of all services
   */
  async checkAllHealth(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();

    for (const [name, _check] of this.healthChecks) {
      results.set(name, await this.executeHealthCheck(name));
    }

    return results;
  }

  /**
   * Get lifecycle for a service
   */
  getLifecycle(serviceName: string): ServiceLifecycle | undefined {
    return this.lifecycles.get(serviceName);
  }

  /**
   * Clear all lifecycles
   */
  clear(): void {
    this.lifecycles.clear();
    this.healthChecks.clear();
  }
}

/**
 * Recovery strategies for service errors
 */
export enum RecoveryStrategy {
  RETRY = 'retry',
  RESTART = 'restart',
  FAILOVER = 'failover',
  IGNORE = 'ignore',
  ROLLBACK = 'rollback',
}

/**
 * Service recovery configuration
 */
export interface ServiceRecoveryConfig {
  strategy: RecoveryStrategy;
  maxRetries?: number;
  retryDelay?: number;
  fallbackService?: string;
  onRecoveryFailed?: (error: Error) => void;
}

/**
 * Service recovery manager
 */
export class ServiceRecoveryManager {
  private recoveryConfigs: Map<string, ServiceRecoveryConfig> = new Map();
  private retryCount: Map<string, number> = new Map();

  /**
   * Register recovery configuration for a service
   */
  registerRecovery(serviceName: string, config: ServiceRecoveryConfig): void {
    this.recoveryConfigs.set(serviceName, config);
    this.retryCount.set(serviceName, 0);
  }

  /**
   * Handle service error with recovery
   */
  async handleError(
    serviceName: string,
    error: Error,
    retryFn?: () => Promise<unknown>
  ): Promise<unknown> {
    const config = this.recoveryConfigs.get(serviceName);
    if (!config) {
      throw error;
    }

    return this.executeRecoveryStrategy(serviceName, error, config, retryFn);
  }

  private async executeRecoveryStrategy(
    serviceName: string,
    error: Error,
    config: ServiceRecoveryConfig,
    retryFn?: () => Promise<unknown>
  ): Promise<unknown> {
    switch (config.strategy) {
      case RecoveryStrategy.RETRY:
        return this.handleRetryStrategy(serviceName, error, config, retryFn);
      case RecoveryStrategy.RESTART:
        return this.handleRestartStrategy(serviceName, retryFn);
      case RecoveryStrategy.FAILOVER:
        return this.handleFailoverStrategy(error, config);
      case RecoveryStrategy.IGNORE:
        return null;
      case RecoveryStrategy.ROLLBACK:
        return this.handleRollbackStrategy(serviceName, error, config);
      default:
        throw error;
    }
  }

  private async handleRetryStrategy(
    serviceName: string,
    error: Error,
    config: ServiceRecoveryConfig,
    retryFn?: () => Promise<unknown>
  ): Promise<unknown> {
    const currentRetries = this.retryCount.get(serviceName) ?? 0;
    const maxRetries = config.maxRetries ?? 3;

    if (currentRetries >= maxRetries) {
      this.handleRecoveryFailed(serviceName, error, config);
      throw error;
    }

    this.retryCount.set(serviceName, currentRetries + 1);
    await this.applyRetryDelay(config.retryDelay);

    if (retryFn) {
      return retryFn();
    }
    return undefined;
  }

  private async applyRetryDelay(retryDelay?: number): Promise<void> {
    if (retryDelay !== undefined && retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  private handleRestartStrategy(
    serviceName: string,
    retryFn?: () => Promise<unknown>
  ): Promise<unknown> | undefined {
    this.retryCount.set(serviceName, 0);
    return retryFn ? retryFn() : undefined;
  }

  private handleFailoverStrategy(
    error: Error,
    config: ServiceRecoveryConfig
  ): unknown {
    if (config.fallbackService != null && config.fallbackService !== '') {
      return config.fallbackService;
    }
    throw error;
  }

  private handleRollbackStrategy(
    serviceName: string,
    error: Error,
    config: ServiceRecoveryConfig
  ): never {
    this.handleRecoveryFailed(serviceName, error, config);
    throw new Error(
      `Rollback required for service ${serviceName}: ${error.message}`
    );
  }

  /**
   * Reset retry count for a service
   */
  resetRetryCount(serviceName: string): void {
    this.retryCount.set(serviceName, 0);
  }

  /**
   * Handle recovery failure
   */
  private handleRecoveryFailed(
    serviceName: string,
    error: Error,
    config: ServiceRecoveryConfig
  ): void {
    if (config.onRecoveryFailed) {
      config.onRecoveryFailed(error);
    }

    // Recovery failed for service - error propagated
  }

  /**
   * Clear all recovery configurations
   */
  clear(): void {
    this.recoveryConfigs.clear();
    this.retryCount.clear();
  }
}

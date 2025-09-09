import type { IConfigService } from '../interfaces/IConfigService';
import type { IFileSystemService } from '../interfaces/IFileSystemService';
import type { ILogger } from '../interfaces/ILogger';
import type { IStateManager } from '../interfaces/IStateManager';
import type { IWorkflowEngine } from '../interfaces/IWorkflowEngine';
import { Container, Constructor, ServiceOptions } from './Container';

export interface ServiceProviderConfig {
  environment?: 'development' | 'test' | 'production';
  logger?: ILogger;
  enableDebug?: boolean;
  featureFlags?: Record<string, boolean | string>;
}

export class ServiceProvider {
  private container: Container;
  private config: ServiceProviderConfig;
  private serviceBindings: Map<string, Constructor<unknown>> = new Map();

  constructor(config: ServiceProviderConfig = {}) {
    this.config = {
      environment: config.environment ?? 'development',
      logger: config.logger,
      enableDebug: config.enableDebug ?? false,
      featureFlags: config.featureFlags ?? {},
    };

    this.container = new Container(this.config.logger);
    this.registerDefaultBindings();
  }

  // Service registration methods
  registerLogger(
    implementation: Constructor<ILogger>,
    options?: ServiceOptions<ILogger>
  ): void {
    this.container.register('ILogger', implementation, options);
    this.serviceBindings.set('ILogger', implementation);
  }

  registerStateManager(
    implementation: Constructor<IStateManager>,
    options?: ServiceOptions<IStateManager>
  ): void {
    this.container.register('IStateManager', implementation, options);
    this.serviceBindings.set('IStateManager', implementation);
  }

  registerWorkflowEngine(
    implementation: Constructor<IWorkflowEngine>,
    options?: ServiceOptions<IWorkflowEngine>
  ): void {
    this.container.register('IWorkflowEngine', implementation, options);
    this.serviceBindings.set('IWorkflowEngine', implementation);
  }

  registerConfigService(
    implementation: Constructor<IConfigService>,
    options?: ServiceOptions<IConfigService>
  ): void {
    this.container.register('IConfigService', implementation, options);
    this.serviceBindings.set('IConfigService', implementation);
  }

  registerFileSystemService(
    implementation: Constructor<IFileSystemService>,
    options?: ServiceOptions<IFileSystemService>
  ): void {
    this.container.register('IFileSystemService', implementation, options);
    this.serviceBindings.set('IFileSystemService', implementation);
  }

  // Generic registration for custom services
  register<T>(
    name: string,
    implementation: Constructor<T>,
    options?: ServiceOptions<T>
  ): void {
    this.container.register(name, implementation, options);
    this.serviceBindings.set(name, implementation);
  }

  // Service resolution methods
  async getLogger(): Promise<ILogger> {
    return this.container.resolve<ILogger>('ILogger');
  }

  async getStateManager(): Promise<IStateManager> {
    return this.container.resolve<IStateManager>('IStateManager');
  }

  async getWorkflowEngine(): Promise<IWorkflowEngine> {
    return this.container.resolve<IWorkflowEngine>('IWorkflowEngine');
  }

  async getConfigService(): Promise<IConfigService> {
    return this.container.resolve<IConfigService>('IConfigService');
  }

  async getFileSystemService(): Promise<IFileSystemService> {
    return this.container.resolve<IFileSystemService>('IFileSystemService');
  }

  async get<T>(name: string): Promise<T> {
    return this.container.resolve<T>(name);
  }

  // Environment-specific configuration
  configureForEnvironment(
    environment: 'development' | 'test' | 'production'
  ): void {
    this.config.environment = environment;

    switch (environment) {
      case 'development':
        this.configureDevelopment();
        break;
      case 'test':
        this.configureTest();
        break;
      case 'production':
        this.configureProduction();
        break;
    }
  }

  // Feature flag management
  isFeatureEnabled(feature: string): boolean {
    const value = this.config.featureFlags?.[feature];
    return typeof value === 'boolean' ? value : false;
  }

  setFeatureFlag(feature: string, value: boolean | string): void {
    this.config.featureFlags ??= {};
    this.config.featureFlags[feature] = value;
  }

  // Container management
  getContainer(): Container {
    return this.container;
  }

  async destroy(): Promise<void> {
    await this.container.destroy();
  }

  reset(): void {
    this.container.reset();
    this.serviceBindings.clear();
    // Reset feature flags to defaults
    this.config.featureFlags = {};
    this.registerDefaultBindings();
  }

  // Debugging and inspection
  getServiceBindings(): Map<string, Constructor<unknown>> {
    return new Map(this.serviceBindings);
  }

  getDependencyGraph() {
    return this.container.getDependencyGraph();
  }

  listRegisteredServices(): string[] {
    return this.container.listRegisteredServices();
  }

  // Private methods
  private registerDefaultBindings(): void {
    // Register any default service bindings here
    // These can be overridden by explicit registration

    if (this.config.logger) {
      this.container.registerValue('ILogger', this.config.logger);
    }
  }

  private configureDevelopment(): void {
    this.config.enableDebug = true;
    // Add development-specific configuration
  }

  private configureTest(): void {
    // Add test-specific configuration
    // Use mock services by default in test environment
  }

  private configureProduction(): void {
    this.config.enableDebug = false;
    // Add production-specific configuration
  }

  // Static factory methods
  static createForDevelopment(logger?: ILogger): ServiceProvider {
    return new ServiceProvider({
      environment: 'development',
      logger,
      enableDebug: true,
    });
  }

  static createForTest(logger?: ILogger): ServiceProvider {
    return new ServiceProvider({
      environment: 'test',
      logger,
      enableDebug: false,
    });
  }

  static createForProduction(logger?: ILogger): ServiceProvider {
    return new ServiceProvider({
      environment: 'production',
      logger,
      enableDebug: false,
    });
  }
}

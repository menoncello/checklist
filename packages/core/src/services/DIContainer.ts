import { createLogger, type Logger } from '../utils/logger';
import type { ServiceConfig } from './BaseService';

export interface ServiceRegistration {
  name: string;
  factory: (container: DIContainer) => unknown;
  singleton?: boolean;
}

export class DIContainer {
  private services = new Map<string, unknown>();
  private factories = new Map<string, ServiceRegistration>();
  private logger: Logger;

  constructor() {
    this.logger = createLogger('checklist:di:container');
    this.registerDefaults();
  }

  private registerDefaults(): void {
    // Register logger factory
    this.register({
      name: 'logger',
      factory: (container) => {
        const config = container.get<Record<string, unknown>>('config');
        const namespace =
          (config?.loggerNamespace as string | undefined) ?? 'checklist:app';
        return createLogger(namespace);
      },
      singleton: false,
    });

    // Register default config
    this.register({
      name: 'config',
      factory: () => ({
        name: 'default',
        version: '1.0.0',
      }),
      singleton: true,
    });
  }

  register(registration: ServiceRegistration): void {
    this.logger.debug({
      msg: 'Registering service',
      name: registration.name,
      singleton: registration.singleton ?? false,
    });
    this.factories.set(registration.name, registration);
  }

  get<T = unknown>(name: string): T {
    // Check if singleton instance exists
    if (this.services.has(name)) {
      return this.services.get(name) as T;
    }

    // Check if factory exists
    const registration = this.factories.get(name);
    if (!registration) {
      throw new Error(`Service '${name}' not registered`);
    }

    // Create instance
    const instance = registration.factory(this);

    // Store if singleton
    if (registration.singleton === true) {
      this.services.set(name, instance);
    }

    return instance as T;
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  createLogger(namespace: string): Logger {
    return createLogger(namespace);
  }

  // Helper method to create services with injected logger
  createService<T>(
    ServiceClass: new (config: ServiceConfig, logger: Logger) => T,
    config: ServiceConfig
  ): T {
    const logger = this.createLogger(config.name);
    return new ServiceClass(config, logger);
  }

  clear(): void {
    this.services.clear();
    this.factories.clear();
    this.registerDefaults();
  }
}

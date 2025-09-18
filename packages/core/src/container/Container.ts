import type { ILogger } from '../interfaces/ILogger';
import { DependencyResolver } from './DependencyResolver';
import {
  Constructor,
  ServiceResolver,
  ServiceDefinition,
  ServiceOptions,
  ServiceLifecycle,
  ServiceMetadata,
  LifecycleState,
  DependencyGraph,
  CircularDependencyError,
  ServiceNotFoundError,
} from './types';

// Re-export for backward compatibility
export * from './types';

export class Container {
  private services: Map<string, ServiceDefinition> = new Map();
  private instances: Map<string, unknown> = new Map();
  private lifecycleStates: Map<string, LifecycleState> = new Map();
  private resolutionStack: Set<string> = new Set();
  private logger?: ILogger;

  constructor(logger?: ILogger) {
    this.logger = logger;
  }

  register<T>(
    identifier: string | Constructor<T>,
    resolver?: ServiceResolver<T>,
    options: ServiceOptions<T> = {}
  ): void {
    const name = this.getServiceName(identifier);

    if (this.logger) {
      this.logger.debug({ msg: 'Registering service', service: name });
    }

    const actualResolver = resolver ?? (identifier as Constructor<T>);

    this.services.set(name, {
      resolver: actualResolver,
      singleton: options.singleton ?? true,
      dependencies: options.dependencies ?? [],
      lifecycle: options.lifecycle as ServiceLifecycle<unknown> | undefined,
      metadata: options.metadata,
    });

    this.lifecycleStates.set(name, LifecycleState.REGISTERED);
  }

  registerValue<T>(name: string, value: T): void {
    this.instances.set(name, value);
    this.lifecycleStates.set(name, LifecycleState.INITIALIZED);
  }

  async resolve<T>(identifier: string | Constructor<T>): Promise<T> {
    const name = this.getServiceName(identifier);

    this.checkCircularDependency(name);

    const existing = this.getExistingInstance<T>(name);
    if (existing != null) return existing;

    const definition = this.getServiceDefinition(name);
    return await this.createAndInitialize<T>(name, definition);
  }

  private checkCircularDependency(name: string): void {
    if (this.resolutionStack.has(name)) {
      const cycle = Array.from(this.resolutionStack);
      cycle.push(name);
      throw new CircularDependencyError(cycle);
    }
  }

  private getExistingInstance<T>(name: string): T | null {
    if (this.instances.has(name)) {
      return this.instances.get(name) as T;
    }
    return null;
  }

  private getServiceDefinition(name: string): ServiceDefinition {
    const definition = this.services.get(name);
    if (!definition) {
      throw new ServiceNotFoundError(name);
    }
    return definition;
  }

  private async createAndInitialize<T>(
    name: string,
    definition: ServiceDefinition
  ): Promise<T> {
    this.resolutionStack.add(name);
    this.lifecycleStates.set(name, LifecycleState.INITIALIZING);

    try {
      const instance = await this.buildInstance<T>(definition);
      await this.runLifecycleHooks(instance, definition.lifecycle);
      this.storeIfSingleton(name, instance, definition.singleton);
      this.markAsInitialized(name);
      return instance;
    } catch (error) {
      await this.handleError(name, definition, error as Error);
      throw error;
    } finally {
      this.resolutionStack.delete(name);
    }
  }

  private async buildInstance<T>(definition: ServiceDefinition): Promise<T> {
    const deps = await this.resolveDependencies(definition.dependencies ?? []);
    return (await this.createInstance(definition.resolver, deps)) as T;
  }

  private async runLifecycleHooks<T>(
    instance: T,
    lifecycle?: ServiceLifecycle<unknown>
  ): Promise<void> {
    if (lifecycle?.beforeInit !== undefined) {
      await lifecycle.beforeInit(instance);
    }
    if (lifecycle?.afterInit !== undefined) {
      await lifecycle.afterInit(instance);
    }
  }

  private storeIfSingleton<T>(
    name: string,
    instance: T,
    singleton?: boolean
  ): void {
    if (singleton === true) {
      this.instances.set(name, instance);
    }
  }

  private markAsInitialized(name: string): void {
    this.lifecycleStates.set(name, LifecycleState.INITIALIZED);
    if (this.logger) {
      this.logger.debug({ msg: 'Service resolved', service: name });
    }
  }

  private async handleError(
    name: string,
    definition: ServiceDefinition,
    error: Error
  ): Promise<void> {
    this.lifecycleStates.set(name, LifecycleState.ERROR);
    if (definition.lifecycle?.onError) {
      await definition.lifecycle.onError(error, undefined as unknown as never);
    }
  }

  async resolveAll<T>(
    ...identifiers: Array<string | Constructor<T>>
  ): Promise<T[]> {
    return Promise.all(identifiers.map((id) => this.resolve(id)));
  }

  has(identifier: string | Constructor<unknown>): boolean {
    const name = this.getServiceName(identifier);
    return this.services.has(name) || this.instances.has(name);
  }

  async destroy(identifier?: string | Constructor<unknown>): Promise<void> {
    if (identifier !== undefined) {
      const name = this.getServiceName(identifier);
      await this.destroyService(name);
    } else {
      // Destroy all services
      for (const name of this.instances.keys()) {
        await this.destroyService(name);
      }
      this.reset();
    }
  }

  reset(): void {
    this.services.clear();
    this.instances.clear();
    this.lifecycleStates.clear();
    this.resolutionStack.clear();
  }

  getDependencyGraph(): DependencyGraph {
    const resolver = new DependencyResolver(this.services, this.logger);
    return resolver.buildDependencyGraph();
  }

  getServiceMetadata(
    identifier: string | Constructor<unknown>
  ): ServiceMetadata | undefined {
    const name = this.getServiceName(identifier);
    return this.services.get(name)?.metadata;
  }

  getServiceLifecycleState(
    identifier: string | Constructor<unknown>
  ): LifecycleState | undefined {
    const name = this.getServiceName(identifier);
    return this.lifecycleStates.get(name);
  }

  listRegisteredServices(): string[] {
    return Array.from(this.services.keys());
  }

  private async resolveDependencies(
    dependencies: Array<string | Constructor<unknown>>
  ): Promise<unknown[]> {
    return Promise.all(
      dependencies.map((dep) => {
        if (typeof dep === 'string') {
          return this.resolve(dep);
        }
        return this.resolve(dep);
      })
    );
  }

  private async createInstance<T>(
    resolver: ServiceResolver<T>,
    dependencies: unknown[]
  ): Promise<T> {
    if (this.isConstructor(resolver)) {
      return new resolver(...dependencies);
    }
    return resolver(...dependencies);
  }

  private isConstructor<T>(
    resolver: ServiceResolver<T>
  ): resolver is Constructor<T> {
    return typeof resolver === 'function' && resolver.prototype !== undefined;
  }

  private getServiceName(identifier: string | Constructor<unknown>): string {
    if (typeof identifier === 'string') {
      return identifier;
    }
    return identifier.name || identifier.toString();
  }

  private async destroyService(name: string): Promise<void> {
    const instance = this.instances.get(name);
    const definition = this.services.get(name);

    if (instance !== undefined && definition?.lifecycle !== undefined) {
      this.lifecycleStates.set(name, LifecycleState.DESTROYING);

      if (definition.lifecycle.beforeDestroy) {
        await definition.lifecycle.beforeDestroy(instance);
      }

      if (definition.lifecycle.afterDestroy) {
        await definition.lifecycle.afterDestroy(instance);
      }

      this.lifecycleStates.set(name, LifecycleState.DESTROYED);
    }

    this.instances.delete(name);
  }
}

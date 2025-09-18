import { CircularDependencyError, ServiceNotFoundError } from './errors';
import type {
  Constructor,
  ServiceDefinition,
  ServiceLifecycle,
  ServiceResolver,
} from './types';
import { LifecycleState } from './types';

export class ContainerResolver {
  private resolutionStack = new Set<string>();

  constructor(
    private services: Map<string, ServiceDefinition>,
    private instances: Map<string, unknown>,
    private lifecycleStates: Map<string, LifecycleState>
  ) {}

  async resolve<T>(
    identifier: string | Constructor<T>,
    getServiceName: (id: string | Constructor<unknown>) => string
  ): Promise<T> {
    const name = getServiceName(identifier);

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

  private async resolveDependencies(
    dependencies: Array<string | Constructor<unknown>>
  ): Promise<unknown[]> {
    const resolved: unknown[] = [];
    for (const dep of dependencies) {
      const depInstance = await this.resolve(
        dep,
        this.getServiceNameHelper.bind(this)
      );
      resolved.push(depInstance);
    }
    return resolved;
  }

  private getServiceNameHelper(
    identifier: string | Constructor<unknown>
  ): string {
    if (typeof identifier === 'string') {
      return identifier;
    }
    return identifier.name;
  }

  private async createInstance(
    resolver: ServiceResolver<unknown>,
    deps: unknown[]
  ): Promise<unknown> {
    if (this.isConstructor(resolver)) {
      return new resolver(...deps);
    }
    return await resolver(...deps);
  }

  private isConstructor(
    resolver: ServiceResolver<unknown>
  ): resolver is Constructor<unknown> {
    return typeof resolver === 'function' && resolver.prototype !== undefined;
  }

  private async runLifecycleHooks<T>(
    instance: T,
    lifecycle?: ServiceLifecycle<unknown>
  ): Promise<void> {
    if (lifecycle?.beforeInit !== undefined) {
      await lifecycle.beforeInit(instance);
    }
    if (lifecycle?.afterInit) {
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
  }

  private async handleError(
    name: string,
    definition: ServiceDefinition,
    error: Error
  ): Promise<void> {
    this.lifecycleStates.set(name, LifecycleState.ERROR);
    if (definition.lifecycle?.onError) {
      const instance = this.instances.get(name);
      if (instance !== null && instance !== undefined) {
        await definition.lifecycle.onError(error, instance);
      }
    }
  }

  clearResolutionStack(): void {
    this.resolutionStack.clear();
  }
}

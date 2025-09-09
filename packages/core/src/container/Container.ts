import type { ILogger } from '../interfaces/ILogger';

export type Constructor<T = unknown> = new (...args: unknown[]) => T;
export type Factory<T = unknown> = (...args: unknown[]) => T | Promise<T>;
export type ServiceResolver<T = unknown> = Constructor<T> | Factory<T>;

export interface ServiceDefinition<T = unknown> {
  resolver: ServiceResolver<T>;
  singleton?: boolean;
  dependencies?: Array<string | Constructor<unknown>>;
  lifecycle?: ServiceLifecycle<T>;
  metadata?: ServiceMetadata;
}

export interface ServiceLifecycle<T = unknown> {
  beforeInit?: (service: T) => void | Promise<void>;
  afterInit?: (service: T) => void | Promise<void>;
  beforeDestroy?: (service: T) => void | Promise<void>;
  afterDestroy?: (service: T) => void | Promise<void>;
  onError?: (error: Error, service: T) => void | Promise<void>;
  healthCheck?: (service: T) => boolean | Promise<boolean>;
}

export interface ServiceMetadata {
  name?: string;
  version?: string;
  description?: string;
  tags?: string[];
  createdAt?: Date;
  [key: string]: unknown;
}

export interface ServiceOptions<T = unknown> {
  singleton?: boolean;
  dependencies?: Array<string | Constructor<unknown>>;
  lifecycle?: ServiceLifecycle<T>;
  metadata?: ServiceMetadata;
}

export enum LifecycleState {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
  ERROR = 'error',
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>;
}

export interface DependencyNode {
  id: string;
  type: 'class' | 'factory' | 'value';
  dependencies: string[];
  dependents: string[];
  metadata?: ServiceMetadata;
}

export class CircularDependencyError extends Error {
  constructor(public readonly cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class ServiceNotFoundError extends Error {
  constructor(public readonly serviceName: string) {
    super(`Service not found: ${serviceName}`);
    this.name = 'ServiceNotFoundError';
  }
}

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

    // Check for circular dependencies
    if (this.resolutionStack.has(name)) {
      const cycle = Array.from(this.resolutionStack);
      cycle.push(name);
      throw new CircularDependencyError(cycle);
    }

    // Return existing instance if available
    if (this.instances.has(name)) {
      return this.instances.get(name) as T;
    }

    const definition = this.services.get(name);
    if (!definition) {
      throw new ServiceNotFoundError(name);
    }

    this.resolutionStack.add(name);
    this.lifecycleStates.set(name, LifecycleState.INITIALIZING);

    try {
      // Resolve dependencies
      const deps = await this.resolveDependencies(
        definition.dependencies ?? []
      );

      // Create instance
      const instance = await this.createInstance(definition.resolver, deps);

      // Run lifecycle hooks
      if (definition.lifecycle?.beforeInit !== undefined) {
        await definition.lifecycle.beforeInit(instance);
      }

      if (definition.lifecycle?.afterInit) {
        await definition.lifecycle.afterInit(instance);
      }

      // Store instance if singleton
      if (definition.singleton === true) {
        this.instances.set(name, instance);
      }

      this.lifecycleStates.set(name, LifecycleState.INITIALIZED);

      if (this.logger) {
        this.logger.debug({ msg: 'Service resolved', service: name });
      }

      return instance as T;
    } catch (error) {
      this.lifecycleStates.set(name, LifecycleState.ERROR);

      if (definition.lifecycle?.onError) {
        await definition.lifecycle.onError(
          error as Error,
          undefined as unknown as T
        );
      }

      throw error;
    } finally {
      this.resolutionStack.delete(name);
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
    const nodes = new Map<string, DependencyNode>();
    const edges = new Map<string, Set<string>>();

    for (const [name, definition] of this.services) {
      const dependencies = (definition.dependencies ?? []).map((dep) =>
        typeof dep === 'string' ? dep : this.getServiceName(dep)
      );

      nodes.set(name, {
        id: name,
        type: this.isConstructor(definition.resolver) ? 'class' : 'factory',
        dependencies,
        dependents: [],
        metadata: definition.metadata,
      });

      edges.set(name, new Set(dependencies));
    }

    // Calculate dependents
    for (const [name, deps] of edges) {
      for (const dep of deps) {
        const node = nodes.get(dep);
        if (node) {
          node.dependents.push(name);
        }
      }
    }

    return { nodes, edges };
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

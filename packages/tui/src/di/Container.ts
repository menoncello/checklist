/**
 * Lightweight Dependency Injection Container
 *
 * Provides simple IoC functionality without external dependencies.
 * Solves testability issues by allowing easy mocking and lifecycle management.
 *
 * @example
 * ```typescript
 * // Define tokens
 * export const EVENT_BUS = Symbol('EventBus');
 * export const COMMAND_QUEUE = Symbol('CommandQueue');
 *
 * // Register dependencies
 * container.register(EVENT_BUS, () => new EventBus());
 * container.register(COMMAND_QUEUE, (c) => new CommandQueue(c.resolve(EVENT_BUS)));
 *
 * // Resolve dependencies
 * const eventBus = container.resolve<EventBus>(EVENT_BUS);
 *
 * // In tests
 * container.register(EVENT_BUS, () => mockEventBus);
 * ```
 */

export type Token = symbol | string;

export type Factory<T> = (container: Container) => T;

export enum Lifecycle {
  /**
   * Create a new instance every time resolve() is called
   */
  Transient = 'transient',

  /**
   * Create one instance and reuse it for all resolve() calls (default)
   */
  Singleton = 'singleton',

  /**
   * Create one instance per scope
   */
  Scoped = 'scoped',
}

interface Registration<T> {
  factory: Factory<T>;
  lifecycle: Lifecycle;
  instance?: T;
}

/**
 * Lightweight IoC Container
 */
export class Container {
  private registrations = new Map<Token, Registration<unknown>>();
  private instances = new Map<Token, unknown>();
  private parent?: Container;
  private isDisposed = false;

  constructor(parent?: Container) {
    this.parent = parent;
  }

  /**
   * Register a dependency with its factory function
   *
   * @param token - Unique identifier for the dependency
   * @param factory - Function that creates the dependency
   * @param lifecycle - Lifecycle management strategy (default: Singleton)
   */
  public register<T>(
    token: Token,
    factory: Factory<T>,
    lifecycle: Lifecycle = Lifecycle.Singleton
  ): this {
    if (this.isDisposed) {
      throw new Error('Cannot register on disposed container');
    }

    this.registrations.set(token, {
      factory,
      lifecycle,
    } as Registration<unknown>);
    return this;
  }

  /**
   * Register an existing instance as a singleton
   *
   * @param token - Unique identifier for the dependency
   * @param instance - Pre-created instance
   */
  public registerInstance<T>(token: Token, instance: T): this {
    if (this.isDisposed) {
      throw new Error('Cannot register on disposed container');
    }

    this.registrations.set(token, {
      factory: () => instance,
      lifecycle: Lifecycle.Singleton,
      instance,
    } as Registration<unknown>);
    this.instances.set(token, instance);
    return this;
  }

  /**
   * Resolve a dependency by its token
   *
   * @param token - Unique identifier for the dependency
   * @returns The resolved instance
   * @throws Error if dependency not registered
   */
  public resolve<T>(token: Token): T {
    if (this.isDisposed) {
      throw new Error('Cannot resolve from disposed container');
    }

    // Check for existing instance (singleton/scoped)
    const existingInstance = this.instances.get(token);
    if (existingInstance !== undefined) {
      return existingInstance as T;
    }

    // Get registration
    const registration = this.getRegistration<T>(token);
    if (!registration) {
      throw new Error(`No registration found for token: ${String(token)}`);
    }

    // Create instance
    const instance = registration.factory(this);

    // Cache based on lifecycle
    if (
      registration.lifecycle === Lifecycle.Singleton ||
      registration.lifecycle === Lifecycle.Scoped
    ) {
      this.instances.set(token, instance);
      registration.instance = instance;
    }

    return instance;
  }

  /**
   * Try to resolve a dependency, returns undefined if not registered
   *
   * @param token - Unique identifier for the dependency
   * @returns The resolved instance or undefined
   */
  public tryResolve<T>(token: Token): T | undefined {
    try {
      return this.resolve<T>(token);
    } catch {
      return undefined;
    }
  }

  /**
   * Check if a token is registered
   *
   * @param token - Unique identifier to check
   * @returns true if registered
   */
  public isRegistered(token: Token): boolean {
    return (
      this.registrations.has(token) ||
      (this.parent?.isRegistered(token) ?? false)
    );
  }

  /**
   * Create a child container (useful for scoped dependencies)
   *
   * @returns New child container
   */
  public createScope(): Container {
    return new Container(this);
  }

  /**
   * Get registration, checking parent if not found
   */
  private getRegistration<T>(token: Token): Registration<T> | undefined {
    const registration = this.registrations.get(token) as
      | Registration<T>
      | undefined;

    if (registration !== undefined) {
      return registration;
    }

    return this.parent?.getRegistration(token);
  }

  /**
   * Dispose all singletons that implement dispose/destroy methods
   */
  public async dispose(): Promise<void> {
    if (this.isDisposed) {
      return;
    }

    this.isDisposed = true;

    // Dispose all instances in reverse registration order
    const instances = Array.from(this.instances.values()).reverse();

    for (const instance of instances) {
      await this.disposeInstance(instance);
    }

    this.instances.clear();
    this.registrations.clear();
  }

  /**
   * Dispose a single instance if it has a dispose/destroy method
   */
  private async disposeInstance(instance: unknown): Promise<void> {
    if (instance == null) {
      return;
    }

    // Check for dispose/destroy methods
    if (typeof (instance as { dispose?: unknown }).dispose === 'function') {
      const result = (instance as { dispose: () => unknown }).dispose();
      if (result instanceof Promise) {
        await result;
      }
    } else if (
      typeof (instance as { destroy?: unknown }).destroy === 'function'
    ) {
      const result = (instance as { destroy: () => unknown }).destroy();
      if (result instanceof Promise) {
        await result;
      }
    } else if (
      typeof (instance as { onUnmount?: unknown }).onUnmount === 'function'
    ) {
      const result = (instance as { onUnmount: () => unknown }).onUnmount();
      if (result instanceof Promise) {
        await result;
      }
    }
  }

  /**
   * Clear all cached instances (useful for testing)
   */
  public reset(): void {
    this.instances.clear();
  }
}

/**
 * Global container instance (optional - can create your own)
 */
export const globalContainer = new Container();

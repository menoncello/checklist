import { Component, ComponentInstance } from '../framework/UIFramework';
import { ComponentInstanceImpl } from './ComponentInstance';
import {
  ComponentRegistration,
  ComponentFactory,
  RegistryConfig,
  ComponentQuery,
  RegistryMetrics,
  ValidationResult,
  ComponentExport,
} from './ComponentRegistryTypes';
import { ComponentRegistryUtils } from './ComponentRegistryUtils';
import { ComponentRegistryValidator } from './ComponentRegistryValidator';

export * from './ComponentRegistryTypes';

export class ComponentRegistry {
  private components = new Map<string, ComponentRegistration>();
  private factories = new Map<string, ComponentFactory>();
  private instances = new Map<string, ComponentInstance>();
  private instanceCounter = 0;
  private eventHandlers = new Map<string, Set<Function>>();
  private config: RegistryConfig;
  private lastCleanupTime = Date.now();

  constructor(config: RegistryConfig = {}) {
    this.config = {
      maxInstances: 10000,
      enableMetrics: true,
      autoCleanup: true,
      cleanupInterval: 300000, // 5 minutes
      ...config,
    };

    if (this.config.autoCleanup === true) {
      this.setupAutoCleanup();
    }
  }

  public register(
    name: string,
    component: Component,
    version: string = '1.0.0',
    metadata?: Record<string, unknown>
  ): void {
    if (this.components.has(name)) {
      throw new Error(`Component '${name}' is already registered`);
    }

    const registration: ComponentRegistration = {
      name,
      component,
      registeredAt: Date.now(),
      version,
      metadata,
    };

    this.components.set(name, registration);

    const factory: ComponentFactory = (props) => {
      const instanceId = `${name}-${++this.instanceCounter}`;
      return new ComponentInstanceImpl(instanceId, component, props);
    };

    this.factories.set(name, factory);
    this.emit('componentRegistered', { name, registration });
  }

  public unregister(name: string): boolean {
    if (!this.components.has(name)) {
      return false;
    }

    // Destroy all instances of this component
    const instances = ComponentRegistryUtils.getInstancesByComponent(
      this.instances,
      name
    );

    for (const instance of instances) {
      instance.destroy();
    }

    // Remove from registry
    this.components.delete(name);
    this.factories.delete(name);

    this.emit('componentUnregistered', { name });
    return true;
  }

  public isRegistered(name: string): boolean {
    return this.components.has(name);
  }

  public getComponent(name: string): Component | null {
    const registration = this.components.get(name);
    return registration ? registration.component : null;
  }

  public getRegistration(name: string): ComponentRegistration | null {
    return this.components.get(name) ?? null;
  }

  public getFactory(name: string): ComponentFactory | null {
    return this.factories.get(name) ?? null;
  }

  public createInstance(
    name: string,
    props: Record<string, unknown> = {}
  ): ComponentInstance | null {
    const factory = this.factories.get(name);
    if (!factory) {
      return null;
    }

    const maxInstances = this.config.maxInstances ?? 10000;
    if (this.instances.size >= maxInstances) {
      throw new Error('Maximum number of instances reached');
    }

    const instance = factory(props);
    const instanceId = `${name}-${this.instanceCounter}`;
    this.instances.set(instanceId, instance);

    this.emit('instanceCreated', { instanceId, name, instance });
    return instance;
  }

  public getInstance(instanceId: string): ComponentInstance | null {
    return this.instances.get(instanceId) ?? null;
  }

  public getAllInstances(): ComponentInstance[] {
    return Array.from(this.instances.values());
  }

  public getInstancesByComponent(componentName: string): ComponentInstance[] {
    return ComponentRegistryUtils.getInstancesByComponent(
      this.instances,
      componentName
    );
  }

  public destroyInstance(instanceId: string): boolean {
    const instance = this.instances.get(instanceId);
    if (!instance) {
      return false;
    }

    try {
      instance.destroy();
      this.instances.delete(instanceId);
      this.emit('instanceDestroyed', { instanceId, instance });
      return true;
    } catch (error) {
      this.emit('instanceDestroyError', { instanceId, error });
      return false;
    }
  }

  public destroyAllInstances(): void {
    const instanceIds = Array.from(this.instances.keys());
    for (const instanceId of instanceIds) {
      this.destroyInstance(instanceId);
    }
  }

  public getRegisteredComponents(): string[] {
    return Array.from(this.components.keys());
  }

  public getComponentCount(): number {
    return this.components.size;
  }

  public getInstanceCount(): number {
    return this.instances.size;
  }

  public findComponents(query: ComponentQuery): ComponentRegistration[] {
    return ComponentRegistryUtils.findComponents(this.components, query);
  }

  public findInstancesByPredicate(
    predicate: (instance: ComponentInstance) => boolean
  ): ComponentInstance[] {
    return ComponentRegistryUtils.findInstancesByPredicate(
      this.instances,
      predicate
    );
  }

  public getComponentsByVersion(version: string): ComponentRegistration[] {
    return ComponentRegistryUtils.getComponentsByVersion(
      this.components,
      version
    );
  }

  public getComponentsRegisteredAfter(
    timestamp: number
  ): ComponentRegistration[] {
    return ComponentRegistryUtils.getComponentsRegisteredAfter(
      this.components,
      timestamp
    );
  }

  public validateComponents(): ValidationResult {
    return ComponentRegistryValidator.validateComponents(
      this.components,
      this.instances
    );
  }

  public getMetrics(): RegistryMetrics {
    return ComponentRegistryUtils.calculateMetrics(
      this.components,
      this.instances,
      this.lastCleanupTime
    );
  }

  public exportComponents(): ComponentExport[] {
    return ComponentRegistryUtils.exportComponents(this.components);
  }

  public importComponents(exports: ComponentExport[]): void {
    if (!ComponentRegistryUtils.validateImportData(exports)) {
      throw new Error('Invalid export data format');
    }

    this.emit('importStarted', { count: exports.length });
  }

  public clear(): void {
    this.destroyAllInstances();
    this.components.clear();
    this.factories.clear();
    this.emit('registryCleared');
  }

  private setupAutoCleanup(): void {
    setInterval(() => {
      this.performCleanup();
    }, this.config.cleanupInterval);
  }

  private performCleanup(): void {
    const destroyedInstances: string[] = [];

    for (const [instanceId, instance] of this.instances) {
      if (!instance.mounted) {
        this.destroyInstance(instanceId);
        destroyedInstances.push(instanceId);
      }
    }

    this.lastCleanupTime = Date.now();
    this.emit('cleanupCompleted', {
      destroyedCount: destroyedInstances.length,
    });
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  public off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in registry event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

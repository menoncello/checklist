import { Component, ComponentInstance } from '../framework/UIFramework';
import { ComponentInstanceImpl } from './ComponentInstance';

export interface ComponentRegistration {
  name: string;
  component: Component;
  registeredAt: number;
  version: string;
  metadata?: Record<string, unknown>;
}

export interface ComponentFactory {
  (props: Record<string, unknown>): ComponentInstance;
}

export interface RegistryConfig {
  maxInstances?: number;
  enableMetrics?: boolean;
  autoCleanup?: boolean;
  cleanupInterval?: number;
}

export interface ComponentQuery {
  name?: string;
  version?: string;
  metadata?: Record<string, unknown>;
  registeredAfter?: number;
  registeredBefore?: number;
}

export interface RegistryMetrics {
  totalComponents: number;
  totalInstances: number;
  activeInstances: number;
  memoryUsage: number;
  avgCreationTime: number;
  lastCleanupTime: number;
}

export class ComponentRegistry {
  private components = new Map<string, ComponentRegistration>();
  private factories = new Map<string, ComponentFactory>();
  private instances = new Map<string, ComponentInstance>();
  private instanceCounter = 0;
  private eventHandlers = new Map<string, Set<Function>>();

  public register(
    name: string,
    component: Component,
    version: string = '1.0.0',
    metadata?: Record<string, unknown>
  ): void {
    if (this.components.has(name)) {
      const existing = this.components.get(name);
      if (existing != null) {
        this.emit('componentOverwritten', {
          name,
          oldVersion: existing.version,
          newVersion: version,
        });
      }
    }

    const registration: ComponentRegistration = {
      name,
      component,
      registeredAt: Date.now(),
      version,
      metadata,
    };

    this.components.set(name, registration);

    // Create a factory function for this component
    this.factories.set(name, (props: Record<string, unknown>) =>
      this.createInstance(name, props)
    );

    this.emit('componentRegistered', { name, version, metadata });
  }

  public unregister(name: string): boolean {
    if (!this.components.has(name)) {
      return false;
    }

    // Destroy all instances of this component
    const instancesToDestroy = Array.from(this.instances.values()).filter(
      (instance) => instance.component.id.startsWith(`${name}-`)
    );

    instancesToDestroy.forEach((instance) =>
      this.destroyInstance(instance.component.id)
    );

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
  ): ComponentInstance {
    const registration = this.components.get(name);
    if (!registration) {
      throw new Error(`Component '${name}' is not registered`);
    }

    const instanceId = `${name}-${++this.instanceCounter}`;
    const instance = new ComponentInstanceImpl(
      instanceId,
      registration.component,
      props
    );

    this.instances.set(instanceId, instance);

    this.emit('instanceCreated', {
      instanceId,
      componentName: name,
      props,
    });

    return instance;
  }

  public getInstance(instanceId: string): ComponentInstance | null {
    return this.instances.get(instanceId) ?? null;
  }

  public getAllInstances(): ComponentInstance[] {
    return Array.from(this.instances.values());
  }

  public getInstancesByComponent(componentName: string): ComponentInstance[] {
    return Array.from(this.instances.values()).filter((instance) =>
      instance.component.id.startsWith(`${componentName}-`)
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

      this.emit('instanceDestroyed', { instanceId });
      return true;
    } catch (error) {
      this.emit('instanceDestroyError', { instanceId, error });
      throw error;
    }
  }

  public destroyAllInstances(): void {
    const instanceIds = Array.from(this.instances.keys());

    instanceIds.forEach((instanceId) => {
      try {
        this.destroyInstance(instanceId);
      } catch (error) {
        console.error(`Error destroying instance ${instanceId}:`, error);
      }
    });
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

  public findComponents(
    predicate: (registration: ComponentRegistration) => boolean
  ): ComponentRegistration[] {
    return Array.from(this.components.values()).filter(predicate);
  }

  public findInstancesByPredicate(
    predicate: (instance: ComponentInstance) => boolean
  ): ComponentInstance[] {
    return Array.from(this.instances.values()).filter(predicate);
  }

  public getComponentsByVersion(version: string): ComponentRegistration[] {
    return this.findComponents((reg) => reg.version === version);
  }

  public getComponentsRegisteredAfter(
    timestamp: number
  ): ComponentRegistration[] {
    return this.findComponents((reg) => reg.registeredAt > timestamp);
  }

  public validateComponents(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.validateDuplicateIds(errors);
    this.validateRenderMethods(errors);
    this.validateOrphanedInstances(warnings);
    this.validateInstanceCounts(warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private validateDuplicateIds(errors: string[]): void {
    const componentIds = this.buildComponentIdMap();
    componentIds.forEach((names, id) => {
      if (names.length > 1) {
        errors.push(
          `Duplicate component ID '${id}' found in components: ${names.join(', ')}`
        );
      }
    });
  }

  private buildComponentIdMap(): Map<string, string[]> {
    const componentIds = new Map<string, string[]>();
    this.components.forEach((registration, name) => {
      const id = registration.component.id;
      if (!componentIds.has(id)) {
        componentIds.set(id, []);
      }
      const names = componentIds.get(id);
      if (names != null) {
        names.push(name);
      }
    });
    return componentIds;
  }

  private validateRenderMethods(errors: string[]): void {
    this.components.forEach((registration, name) => {
      if (registration.component.render == null) {
        errors.push(`Component '${name}' missing render method`);
      }
    });
  }

  private validateOrphanedInstances(warnings: string[]): void {
    const orphanedInstances = Array.from(this.instances.values()).filter(
      (instance) => {
        const componentName = instance.component.id.split('-')[0];
        return !this.components.has(componentName);
      }
    );

    if (orphanedInstances.length > 0) {
      warnings.push(`${orphanedInstances.length} orphaned instance(s) found`);
    }
  }

  private validateInstanceCounts(warnings: string[]): void {
    // Check for high instance count
    if (this.instances.size > 100) {
      warnings.push(`High instance count: ${this.instances.size} instances`);
    }
  }

  public getMetrics() {
    const now = Date.now();
    const registrations = Array.from(this.components.values());

    return {
      componentCount: this.getComponentCount(),
      instanceCount: this.getInstanceCount(),
      averageInstancesPerComponent:
        this.getInstanceCount() / Math.max(1, this.getComponentCount()),
      oldestRegistration: registrations.reduce(
        (oldest, reg) =>
          reg.registeredAt < oldest ? reg.registeredAt : oldest,
        now
      ),
      newestRegistration: registrations.reduce(
        (newest, reg) =>
          reg.registeredAt > newest ? reg.registeredAt : newest,
        0
      ),
      componentVersions: this.getVersionDistribution(),
      memoryUsage: this.estimateMemoryUsage(),
    };
  }

  private getVersionDistribution(): Record<string, number> {
    const distribution: Record<string, number> = {};

    this.components.forEach((registration) => {
      const version = registration.version;
      distribution[version] = (distribution[version] ?? 0) + 1;
    });

    return distribution;
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let totalSize = 0;

    // Components
    totalSize += this.components.size * 1000; // Rough estimate per component

    // Instances
    totalSize += this.instances.size * 500; // Rough estimate per instance

    return totalSize;
  }

  public exportComponents(): ComponentExport[] {
    return Array.from(this.components.entries()).map(
      ([name, registration]) => ({
        name,
        version: registration.version,
        registeredAt: registration.registeredAt,
        metadata: registration.metadata,
        instanceCount: this.getInstancesByComponent(name).length,
      })
    );
  }

  public importComponents(exports: ComponentExport[]): void {
    // Note: This would require actual component implementations
    // For now, we just emit an event
    this.emit('componentsImported', { count: exports.length });
  }

  public clear(): void {
    this.destroyAllInstances();
    this.components.clear();
    this.factories.clear();

    this.emit('registryCleared');
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in component registry event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ComponentExport {
  name: string;
  version: string;
  registeredAt: number;
  metadata?: Record<string, unknown>;
  instanceCount: number;
}

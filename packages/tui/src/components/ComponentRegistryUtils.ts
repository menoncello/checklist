import { ComponentInstance } from '../framework/UIFramework';
import {
  ComponentRegistration,
  ComponentQuery,
  RegistryMetrics,
  ComponentExport,
} from './ComponentRegistryTypes';

export class ComponentRegistryUtils {
  static findComponents(
    components: Map<string, ComponentRegistration>,
    query: ComponentQuery
  ): ComponentRegistration[] {
    return Array.from(components.values()).filter((registration) =>
      this.matchesQuery(registration, query)
    );
  }

  private static matchesQuery(
    registration: ComponentRegistration,
    query: ComponentQuery
  ): boolean {
    if (!this.matchesName(registration, query.name)) return false;
    if (!this.matchesVersion(registration, query.version)) return false;
    if (!this.matchesTimeRange(registration, query)) return false;
    if (!this.matchesMetadata(registration, query.metadata)) return false;
    return true;
  }

  private static matchesName(
    registration: ComponentRegistration,
    name?: string
  ): boolean {
    return name == null || registration.name === name;
  }

  private static matchesVersion(
    registration: ComponentRegistration,
    version?: string
  ): boolean {
    return version == null || registration.version === version;
  }

  private static matchesTimeRange(
    registration: ComponentRegistration,
    query: ComponentQuery
  ): boolean {
    const { registeredAfter, registeredBefore } = query;

    if (
      registeredAfter != null &&
      registration.registeredAt <= registeredAfter
    ) {
      return false;
    }

    if (
      registeredBefore != null &&
      registration.registeredAt >= registeredBefore
    ) {
      return false;
    }

    return true;
  }

  private static matchesMetadata(
    registration: ComponentRegistration,
    metadata?: Record<string, unknown>
  ): boolean {
    if (metadata == null) return true;

    for (const [key, value] of Object.entries(metadata)) {
      if (registration.metadata?.[key] !== value) return false;
    }

    return true;
  }

  static findInstancesByPredicate(
    instances: Map<string, ComponentInstance>,
    predicate: (instance: ComponentInstance) => boolean
  ): ComponentInstance[] {
    return Array.from(instances.values()).filter(predicate);
  }

  static getComponentsByVersion(
    components: Map<string, ComponentRegistration>,
    version: string
  ): ComponentRegistration[] {
    return Array.from(components.values()).filter(
      (registration) => registration.version === version
    );
  }

  static getComponentsRegisteredAfter(
    components: Map<string, ComponentRegistration>,
    timestamp: number
  ): ComponentRegistration[] {
    return Array.from(components.values()).filter(
      (registration) => registration.registeredAt > timestamp
    );
  }

  static getInstancesByComponent(
    instances: Map<string, ComponentInstance>,
    componentName: string
  ): ComponentInstance[] {
    return Array.from(instances.values()).filter(
      (instance) => instance.component.id === componentName
    );
  }

  static calculateMetrics(
    components: Map<string, ComponentRegistration>,
    instances: Map<string, ComponentInstance>,
    lastCleanupTime: number
  ): RegistryMetrics {
    const activeInstances = Array.from(instances.values()).filter(
      (instance) => instance.mounted
    ).length;

    return {
      totalComponents: components.size,
      totalInstances: instances.size,
      activeInstances,
      memoryUsage: this.estimateMemoryUsage(components, instances),
      avgCreationTime: this.calculateAverageCreationTime(components),
      lastCleanupTime,
    };
  }

  private static getVersionDistribution(
    components: Map<string, ComponentRegistration>
  ): Record<string, number> {
    const distribution: Record<string, number> = {};

    for (const registration of components.values()) {
      distribution[registration.version] =
        (distribution[registration.version] || 0) + 1;
    }

    return distribution;
  }

  private static estimateMemoryUsage(
    components: Map<string, ComponentRegistration>,
    instances: Map<string, ComponentInstance>
  ): number {
    let total = 0;

    // Estimate component registration memory
    for (const registration of components.values()) {
      total += JSON.stringify(registration).length * 2; // Rough estimate
    }

    // Estimate instance memory
    for (const instance of instances.values()) {
      total += JSON.stringify(instance.props).length * 2; // Rough estimate
      total += 1000; // Base overhead per instance
    }

    return total;
  }

  private static calculateAverageCreationTime(
    components: Map<string, ComponentRegistration>
  ): number {
    if (components.size === 0) return 0;

    const now = Date.now();
    const totalTime = Array.from(components.values()).reduce(
      (sum, reg) => sum + (now - reg.registeredAt),
      0
    );

    return totalTime / components.size;
  }

  static exportComponents(
    components: Map<string, ComponentRegistration>
  ): ComponentExport[] {
    return Array.from(components.values()).map((registration) => ({
      name: registration.name,
      version: registration.version,
      metadata: registration.metadata,
      registeredAt: registration.registeredAt,
    }));
  }

  static validateImportData(exports: ComponentExport[]): boolean {
    return exports.every(
      (exp) =>
        typeof exp.name === 'string' &&
        typeof exp.version === 'string' &&
        typeof exp.registeredAt === 'number'
    );
  }
}

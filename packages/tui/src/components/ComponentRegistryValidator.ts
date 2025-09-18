import { ComponentInstance } from '../framework/UIFramework';
import {
  ComponentRegistration,
  ValidationResult,
} from './ComponentRegistryTypes';

export class ComponentRegistryValidator {
  static validateComponents(
    components: Map<string, ComponentRegistration>,
    instances: Map<string, ComponentInstance>
  ): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    this.validateDuplicateIds(components, errors);
    this.validateRenderMethods(components, errors);
    this.validateOrphanedInstances(components, instances, warnings);
    this.validateInstanceCounts(instances, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateDuplicateIds(
    components: Map<string, ComponentRegistration>,
    errors: string[]
  ): void {
    const componentIdMap = this.buildComponentIdMap(components);

    for (const [id, names] of componentIdMap) {
      if (names.length > 1) {
        errors.push(
          `Duplicate component ID '${id}' found in components: ${names.join(', ')}`
        );
      }
    }
  }

  private static buildComponentIdMap(
    components: Map<string, ComponentRegistration>
  ): Map<string, string[]> {
    const componentIdMap = new Map<string, string[]>();

    for (const [name, registration] of components) {
      const componentId = registration.component.id;
      if (!componentIdMap.has(componentId)) {
        componentIdMap.set(componentId, []);
      }
      componentIdMap.get(componentId)?.push(name);
    }

    return componentIdMap;
  }

  private static validateRenderMethods(
    components: Map<string, ComponentRegistration>,
    errors: string[]
  ): void {
    for (const [name, registration] of components) {
      if (typeof registration.component.render !== 'function') {
        errors.push(`Component '${name}' is missing a render method`);
      }
    }
  }

  private static validateOrphanedInstances(
    components: Map<string, ComponentRegistration>,
    instances: Map<string, ComponentInstance>,
    warnings: string[]
  ): void {
    const registeredComponentIds = new Set(
      Array.from(components.values()).map((reg) => reg.component.id)
    );

    for (const [instanceId, instance] of instances) {
      if (!registeredComponentIds.has(instance.component.id)) {
        warnings.push(
          `Instance '${instanceId}' references unregistered component '${instance.component.id}'`
        );
      }
    }
  }

  private static validateInstanceCounts(
    instances: Map<string, ComponentInstance>,
    warnings: string[]
  ): void {
    const activeInstances = Array.from(instances.values()).filter(
      (instance) => instance.mounted
    ).length;

    if (activeInstances > 1000) {
      warnings.push(`High number of active instances: ${activeInstances}`);
    }
  }
}

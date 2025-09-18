import { Component } from '../framework/UIFramework';
import { ComponentValidationResult } from './ComponentInstanceTypes';
import { ComponentLifecycle } from './ComponentLifecycle';

export class ComponentInstanceUtils {
  static calculateCacheHitRate(renderCount: number): number {
    // Simple estimation - would need more detailed tracking for accuracy
    return renderCount > 0 ? Math.min(0.8, 1 - renderCount / 100) : 0;
  }

  static estimateMemoryUsage(
    props: Record<string, unknown>,
    renderCache: string | null
  ): number {
    // Rough estimation of memory usage in bytes
    let size = 0;

    // Props
    size += JSON.stringify(props).length * 2; // Rough estimate

    // Render cache
    if (renderCache != null) {
      size += renderCache.length * 2;
    }

    // Base overhead
    size += 1000;

    return size;
  }

  static validateComponent(options: {
    component: Component;
    renderCount: number;
    errorCount: number;
    lastRenderTime: number;
    lifecycle: ComponentLifecycle;
  }): ComponentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const { component, renderCount, errorCount, lastRenderTime, lifecycle } =
      options;

    this.validateComponentStructure(component, errors);
    this.validatePerformanceMetrics(
      renderCount,
      errorCount,
      lastRenderTime,
      warnings
    );
    this.validateLifecycleState(lifecycle, errors, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateComponentStructure(
    component: Component,
    errors: string[]
  ): void {
    if (component.render == null) {
      errors.push('Component missing render method');
    }

    if (!component.id || component.id.trim() === '') {
      errors.push('Component has invalid ID');
    }
  }

  private static validatePerformanceMetrics(
    renderCount: number,
    errorCount: number,
    lastRenderTime: number,
    warnings: string[]
  ): void {
    if (errorCount > 0 && renderCount > 0) {
      const errorRate = errorCount / renderCount;
      if (errorRate > 0.1) {
        warnings.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      }
    }

    if (lastRenderTime > 50) {
      warnings.push(`Slow rendering detected: ${lastRenderTime.toFixed(2)}ms`);
    }
  }

  private static validateLifecycleState(
    lifecycle: ComponentLifecycle,
    errors: string[],
    warnings: string[]
  ): void {
    const lifecycleValidation = lifecycle.validate();
    errors.push(...lifecycleValidation.errors);
    warnings.push(...lifecycleValidation.warnings);
  }

  static cloneComponent(
    component: Component,
    originalProps: Record<string, unknown>,
    newProps?: Record<string, unknown>
  ): { id: string; props: Record<string, unknown> } {
    const clonedProps = newProps ?? { ...originalProps };
    const clonedId = `${component.id}-clone-${Date.now()}`;

    return {
      id: clonedId,
      props: clonedProps,
    };
  }
}

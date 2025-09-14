import { Component, ComponentInstance } from '../framework/UIFramework';
import { ComponentLifecycle, LifecyclePhase } from './ComponentLifecycle';

// Component instance types
export interface ComponentInstanceState {
  mounted: boolean;
  renderCount: number;
  totalRenderTime: number;
  lastRenderTime: number;
  errorCount: number;
  cacheHitRate: number;
}

export interface ComponentInstanceConfig {
  cacheTTL?: number;
  enableMetrics?: boolean;
  maxErrors?: number;
}

export interface ComponentInstanceMetrics {
  componentId: string;
  mounted: boolean;
  renderCount: number;
  totalRenderTime: number;
  averageRenderTime: number;
  lastRenderTime: number;
  errorCount: number;
  lastError?: string;
  cacheHitRate: number;
  cacheTTL: number;
  isCached: boolean;
  lifecyclePhase: LifecyclePhase;
  eventHandlerCount: number;
  memoryEstimate: number;
}

export class ComponentInstanceImpl implements ComponentInstance {
  public readonly component: Component;
  public readonly props: Record<string, unknown>;
  public mounted: boolean = false;

  private lifecycle: ComponentLifecycle;
  private renderCache: string | null = null;
  private renderCacheTimestamp: number = 0;
  private cacheTTL: number = 100; // Cache TTL in milliseconds
  private renderCount: number = 0;
  private totalRenderTime: number = 0;
  private lastRenderTime: number = 0;
  private errorCount: number = 0;
  private lastError: Error | null = null;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(
    id: string,
    component: Component,
    props: Record<string, unknown> = {},
    options: ComponentInstanceOptions = {}
  ) {
    // Create a component instance with unique ID
    this.component = {
      ...component,
      id: id,
    };

    this.props = { ...props };
    this.cacheTTL = options.cacheTTL ?? 100;

    this.lifecycle = new ComponentLifecycle(id);
    this.setupLifecycleHandlers();
    this.initialize();
  }

  private setupLifecycleHandlers(): void {
    this.lifecycle.on('phaseChange', (data: unknown) => {
      this.emit('lifecyclePhaseChange', data);
    });

    this.lifecycle.on('error', (error: Error) => {
      this.handleError(error);
    });
  }

  private initialize(): void {
    try {
      this.lifecycle.initialize();
      this.emit('initialized');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public render(): string {
    if (!this.mounted) {
      this.mount();
    }

    // Check cache first
    if (this.isCacheValid() && this.renderCache != null) {
      return this.renderCache;
    }

    const startTime = performance.now();

    try {
      this.lifecycle.setPhase('rendering');

      const result = this.component.render(this.props);

      const endTime = performance.now();
      const renderTime = endTime - startTime;

      // Update metrics
      this.renderCount++;
      this.totalRenderTime += renderTime;
      this.lastRenderTime = renderTime;

      // Update cache
      this.renderCache = result;
      this.renderCacheTimestamp = endTime;

      this.lifecycle.setPhase('rendered');
      this.emit('rendered', { result, renderTime });

      return result;
    } catch (error) {
      this.handleError(error as Error);
      return this.renderError(error as Error);
    }
  }

  private isCacheValid(): boolean {
    if (this.renderCache == null) return false;

    const now = performance.now();
    return now - this.renderCacheTimestamp < this.cacheTTL;
  }

  private renderError(error: Error): string {
    return `[Component Error in ${this.component.id}: ${error.message}]`;
  }

  public mount(): void {
    if (this.mounted) return;

    try {
      this.lifecycle.setPhase('mounting');

      if (this.component.onMount) {
        this.component.onMount();
      }

      this.mounted = true;
      this.lifecycle.setPhase('mounted');
      this.emit('mounted');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public unmount(): void {
    if (!this.mounted) return;

    try {
      this.lifecycle.setPhase('unmounting');

      if (this.component.onUnmount) {
        this.component.onUnmount();
      }

      this.mounted = false;
      this.invalidateCache();
      this.lifecycle.setPhase('unmounted');
      this.emit('unmounted');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public destroy(): void {
    try {
      this.lifecycle.setPhase('destroying');

      this.unmount();
      this.cleanup();

      this.lifecycle.setPhase('destroyed');
      this.emit('destroyed');
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private cleanup(): void {
    this.invalidateCache();
    this.eventHandlers.clear();
    this.lifecycle.destroy();
  }

  public handleInput(input: string): void {
    if (!this.mounted) return;

    try {
      if (this.component.handleInput) {
        this.component.handleInput(input);
      }

      this.emit('input', { input });
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  public updateProps(newProps: Record<string, unknown>): void {
    const oldProps = { ...this.props };
    Object.assign(this.props, newProps);

    this.invalidateCache();
    this.emit('propsUpdated', { oldProps, newProps });
  }

  public getProps(): Record<string, unknown> {
    return { ...this.props };
  }

  public invalidateCache(): void {
    this.renderCache = null;
    this.renderCacheTimestamp = 0;
    this.emit('cacheInvalidated');
  }

  public setCacheTTL(ttl: number): void {
    this.cacheTTL = Math.max(0, ttl);
    this.emit('cacheTTLChanged', { ttl });
  }

  public getCacheTTL(): number {
    return this.cacheTTL;
  }

  public isCached(): boolean {
    return this.isCacheValid();
  }

  public getLifecyclePhase(): LifecyclePhase {
    return this.lifecycle.getCurrentPhase();
  }

  public getLifecycle(): ComponentLifecycle {
    return this.lifecycle;
  }

  private handleError(error: Error): void {
    this.errorCount++;
    this.lastError = error;
    this.lifecycle.setError(error);

    this.emit('error', { error, errorCount: this.errorCount });
  }

  public getMetrics() {
    const lifecycleMetrics = this.lifecycle.getMetrics();

    return {
      componentId: this.component.id,
      mounted: this.mounted,
      renderCount: this.renderCount,
      totalRenderTime: this.totalRenderTime,
      averageRenderTime:
        this.renderCount > 0 ? this.totalRenderTime / this.renderCount : 0,
      lastRenderTime: this.lastRenderTime,
      errorCount: this.errorCount,
      lastError: this.lastError?.message,
      cacheHitRate: this.calculateCacheHitRate(),
      cacheTTL: this.cacheTTL,
      isCached: this.isCached(),
      lifecyclePhase: this.getLifecyclePhase(),
      lifecycleMetrics,
      eventHandlerCount: Array.from(this.eventHandlers.values()).reduce(
        (total, handlers) => total + handlers.size,
        0
      ),
      memoryEstimate: this.estimateMemoryUsage(),
    };
  }

  private calculateCacheHitRate(): number {
    // Simple estimation - would need more detailed tracking for accuracy
    return this.renderCount > 0 ? Math.min(0.8, 1 - this.renderCount / 100) : 0;
  }

  private estimateMemoryUsage(): number {
    // Rough estimation of memory usage in bytes
    let size = 0;

    // Props
    size += JSON.stringify(this.props).length * 2; // Rough estimate

    // Render cache
    if (this.renderCache != null) {
      size += this.renderCache.length * 2;
    }

    // Base overhead
    size += 1000;

    return size;
  }

  public validate(): ComponentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check if component has required methods
    if (this.component.render == null) {
      errors.push('Component missing render method');
    }

    // Check if component ID is valid
    if (!this.component.id || this.component.id.trim() === '') {
      errors.push('Component has invalid ID');
    }

    // Check for high error rate
    if (this.errorCount > 0 && this.renderCount > 0) {
      const errorRate = this.errorCount / this.renderCount;
      if (errorRate > 0.1) {
        warnings.push(`High error rate: ${(errorRate * 100).toFixed(1)}%`);
      }
    }

    // Check for slow rendering
    if (this.lastRenderTime > 50) {
      warnings.push(
        `Slow rendering detected: ${this.lastRenderTime.toFixed(2)}ms`
      );
    }

    // Check lifecycle state consistency
    const lifecycleValidation = this.lifecycle.validate();
    errors.push(...lifecycleValidation.errors);
    warnings.push(...lifecycleValidation.warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  public reset(): void {
    this.unmount();
    this.renderCount = 0;
    this.totalRenderTime = 0;
    this.lastRenderTime = 0;
    this.errorCount = 0;
    this.lastError = null;
    this.invalidateCache();

    this.emit('reset');
  }

  public clone(newProps?: Record<string, unknown>): ComponentInstanceImpl {
    const clonedProps = newProps ?? { ...this.props };
    const clonedId = `${this.component.id}-clone-${Date.now()}`;

    return new ComponentInstanceImpl(clonedId, this.component, clonedProps, {
      cacheTTL: this.cacheTTL,
    });
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
            `Error in component instance event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

export interface ComponentInstanceOptions {
  cacheTTL?: number;
}

export interface ComponentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

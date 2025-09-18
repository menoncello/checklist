import { Component, ComponentInstance } from '../framework/UIFramework';
import { ComponentInstanceEventHandler } from './ComponentInstanceEvents';
import { ComponentInstanceMetricsCollector } from './ComponentInstanceMetrics';
import {
  ComponentInstanceOptions,
  ComponentValidationResult,
  ComponentInstanceMetrics,
} from './ComponentInstanceTypes';
import { ComponentInstanceUtils } from './ComponentInstanceUtils';
import { ComponentLifecycle, LifecyclePhase } from './ComponentLifecycle';

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
  private eventHandler = new ComponentInstanceEventHandler();

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
    this.eventHandler.clear();
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

  public getMetrics(): ComponentInstanceMetrics {
    return ComponentInstanceMetricsCollector.collectMetrics({
      componentId: this.component.id,
      mounted: this.mounted,
      renderCount: this.renderCount,
      totalRenderTime: this.totalRenderTime,
      lastRenderTime: this.lastRenderTime,
      errorCount: this.errorCount,
      lastError: this.lastError,
      cacheTTL: this.cacheTTL,
      isCached: this.isCached(),
      lifecycle: this.lifecycle,
      eventHandlers: this.eventHandler.getHandlers(),
      props: this.props,
      renderCache: this.renderCache,
    });
  }

  public validate(): ComponentValidationResult {
    return ComponentInstanceUtils.validateComponent({
      component: this.component,
      renderCount: this.renderCount,
      errorCount: this.errorCount,
      lastRenderTime: this.lastRenderTime,
      lifecycle: this.lifecycle,
    });
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
    const cloneData = ComponentInstanceUtils.cloneComponent(
      this.component,
      this.props,
      newProps
    );

    return new ComponentInstanceImpl(
      cloneData.id,
      this.component,
      cloneData.props,
      { cacheTTL: this.cacheTTL }
    );
  }

  public on(event: string, handler: Function): void {
    this.eventHandler.on(event, handler);
  }

  public off(event: string, handler: Function): void {
    this.eventHandler.off(event, handler);
  }

  private emit(event: string, data?: unknown): void {
    this.eventHandler.emit(event, data);
  }
}

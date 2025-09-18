import { ComponentInstanceMetrics } from './ComponentInstanceTypes';
import { ComponentInstanceUtils } from './ComponentInstanceUtils';
import { ComponentLifecycle } from './ComponentLifecycle';

type ComponentInstanceMetricsOptions = {
  componentId: string;
  mounted: boolean;
  renderCount: number;
  totalRenderTime: number;
  lastRenderTime: number;
  errorCount: number;
  lastError: Error | null;
  cacheTTL: number;
  isCached: boolean;
  lifecycle: ComponentLifecycle;
  eventHandlers: Map<string, Set<Function>>;
  props: Record<string, unknown>;
  renderCache: string | null;
};

export class ComponentInstanceMetricsCollector {
  static collectMetrics(
    options: ComponentInstanceMetricsOptions
  ): ComponentInstanceMetrics {
    const basicMetrics = this.collectBasicMetrics(options);
    const performanceMetrics = this.collectPerformanceMetrics(options);
    const lifecycleMetrics = this.collectLifecycleMetrics(options);

    return {
      ...basicMetrics,
      ...performanceMetrics,
      ...lifecycleMetrics,
    };
  }

  private static collectBasicMetrics(options: ComponentInstanceMetricsOptions) {
    const { componentId, mounted, renderCount, errorCount, lastError } =
      options;

    return {
      componentId,
      mounted,
      renderCount,
      errorCount,
      lastError: lastError?.message,
    };
  }

  private static collectPerformanceMetrics(
    options: ComponentInstanceMetricsOptions
  ) {
    const {
      renderCount,
      totalRenderTime,
      lastRenderTime,
      cacheTTL,
      props,
      renderCache,
    } = options;

    return {
      totalRenderTime,
      averageRenderTime: this.calculateAverageRenderTime(
        renderCount,
        totalRenderTime
      ),
      lastRenderTime,
      cacheHitRate: ComponentInstanceUtils.calculateCacheHitRate(renderCount),
      cacheTTL,
      memoryUsage: ComponentInstanceUtils.estimateMemoryUsage(
        props,
        renderCache
      ),
    };
  }

  private static collectLifecycleMetrics(
    options: ComponentInstanceMetricsOptions
  ) {
    return {
      lifecycle: this.createLifecycleInfo(options.lifecycle),
    };
  }

  private static calculateAverageRenderTime(
    renderCount: number,
    totalRenderTime: number
  ): number {
    return renderCount > 0 ? totalRenderTime / renderCount : 0;
  }

  private static createLifecycleInfo(lifecycle: ComponentLifecycle) {
    const lifecycleMetrics = lifecycle.getMetrics();
    return {
      phase: lifecycle.getCurrentPhase(),
      timestamp: Date.now() - lifecycleMetrics.age,
      duration: lifecycleMetrics.timeInCurrentPhase,
    };
  }
}

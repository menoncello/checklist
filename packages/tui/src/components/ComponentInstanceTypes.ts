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
  memoryUsage: number;
  lifecycle: {
    phase: string;
    timestamp: number;
    duration: number;
  };
}

export interface ComponentInstanceOptions {
  enablePerformanceMode?: boolean;
  cacheTTL?: number;
}

export interface ComponentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

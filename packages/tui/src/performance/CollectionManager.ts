import type { MetricsCollectorConfig } from './MetricsTypes';

export interface CollectionManagerConfig {
  config: MetricsCollectorConfig;
  flushCallback: () => void;
  aggregationCallback: () => void;
  cleanupCallback: () => void;
}

export class CollectionManager {
  private config: CollectionManagerConfig;

  constructor(config: CollectionManagerConfig) {
    this.config = config;
  }

  destroy(): void {
    // Cleanup implementation
  }
}

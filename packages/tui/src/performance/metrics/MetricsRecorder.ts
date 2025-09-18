import { MetricsBuffer } from './MetricsBuffer';
import { MetricPoint } from './types';

export class MetricsRecorder {
  private totalPointsCollected = 0;

  constructor(
    private buffer: MetricsBuffer,
    private sampleRate: number
  ) {}

  shouldRecord(enableCollection: boolean): boolean {
    return enableCollection === true && this.shouldSample();
  }

  private shouldSample(): boolean {
    return Math.random() < this.sampleRate;
  }

  createMetricPoint(params: {
    name: string;
    value: number;
    tags?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): MetricPoint {
    return {
      timestamp: Date.now(),
      value: params.value,
      tags: params.tags ?? {},
      metadata: { ...params.metadata, metric: params.name },
    };
  }

  recordPoint(
    name: string,
    point: MetricPoint,
    onRecord?: (name: string, point: MetricPoint) => void
  ): void {
    this.buffer.addPoint(name, point);
    this.totalPointsCollected++;

    if (onRecord) {
      onRecord(name, point);
    }
  }

  getTotalPointsCollected(): number {
    return this.totalPointsCollected;
  }

  reset(): void {
    this.totalPointsCollected = 0;
  }

  parseRecordParams(
    nameOrObj:
      | string
      | {
          name: string;
          value: number;
          tags?: Record<string, string>;
          metadata?: Record<string, unknown>;
        },
    value?: number,
    tags?: Record<string, string>,
    metadata?: Record<string, unknown>
  ) {
    if (typeof nameOrObj === 'object') {
      return {
        name: nameOrObj.name,
        value: nameOrObj.value,
        tags: nameOrObj.tags,
        metadata: nameOrObj.metadata,
      };
    }
    return {
      name: nameOrObj,
      value: value ?? 0,
      tags,
      metadata,
    };
  }
}

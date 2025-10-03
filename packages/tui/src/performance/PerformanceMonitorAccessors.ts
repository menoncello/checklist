import type { PerformanceCircuitBreaker } from './PerformanceCircuitBreaker';
import type { AlertManager } from './helpers/AlertManager';
import type { SystemProfiler } from './helpers/SystemProfiler';

export interface PerformanceMonitorComponents {
  alertManager: AlertManager;
  systemProfiler: SystemProfiler;
  circuitBreaker: PerformanceCircuitBreaker;
}

export class PerformanceMonitorAccessors {
  constructor(
    private _core: Record<string, Function>,
    private _components: PerformanceMonitorComponents
  ) {}

  public get components(): PerformanceMonitorComponents {
    return this._components;
  }

  public get core(): Record<string, Function> {
    return this._core;
  }
}

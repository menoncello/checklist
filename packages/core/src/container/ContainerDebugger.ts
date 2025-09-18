import type { ILogger } from '../interfaces/ILogger';
import type { Container, Constructor } from './Container';
import {
  DependencyAnalyzer,
  CircularDependencyInfo,
} from './helpers/DependencyAnalyzer';
import {
  PerformanceTracker,
  PerformanceMetrics,
} from './helpers/PerformanceTracker';
import {
  ServiceInspector,
  ServiceInspection,
} from './helpers/ServiceInspector';

export { ServiceInspection, PerformanceMetrics, CircularDependencyInfo };

export class ContainerDebugger {
  private container: Container;
  private logger?: ILogger;
  private dependencyAnalyzer: DependencyAnalyzer;
  private performanceTracker: PerformanceTracker;
  private serviceInspector: ServiceInspector;

  constructor(container: Container, logger?: ILogger) {
    this.container = container;
    this.logger = logger;
    this.dependencyAnalyzer = new DependencyAnalyzer(container);
    this.performanceTracker = new PerformanceTracker();
    this.serviceInspector = new ServiceInspector(container, logger);
  }

  inspectService(
    identifier: string | Constructor<unknown>
  ): ServiceInspection | null {
    return this.serviceInspector.inspectService(identifier);
  }

  getDependencyGraph() {
    return this.dependencyAnalyzer.getDependencyGraph();
  }

  visualizeDependencyGraph(): string {
    return this.dependencyAnalyzer.visualizeDependencyGraph();
  }

  detectCircularDependencies(): CircularDependencyInfo {
    return this.dependencyAnalyzer.detectCircularDependencies();
  }

  listRegisteredServices(): string[] {
    return this.serviceInspector.listRegisteredServices();
  }

  getServiceLifecycleState(identifier: string | Constructor<unknown>) {
    return this.serviceInspector.getServiceLifecycleState(identifier);
  }

  getServiceHealthStatus(): Map<string, boolean> {
    return this.serviceInspector.getServiceHealthStatus();
  }

  enableVerboseLogging(): void {
    this.serviceInspector.enableVerboseLogging();
  }

  disableVerboseLogging(): void {
    this.serviceInspector.disableVerboseLogging();
  }

  async measureResolutionPerformance<T>(
    identifier: string | Constructor<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    return this.performanceTracker.measureResolutionPerformance(
      identifier,
      () => this.container.resolve(identifier)
    );
  }

  getPerformanceMetrics(
    serviceName?: string
  ): PerformanceMetrics[] | Map<string, PerformanceMetrics[]> {
    return this.performanceTracker.getPerformanceMetrics(serviceName);
  }

  clearPerformanceMetrics(serviceName?: string): void {
    this.performanceTracker.clearPerformanceMetrics(serviceName);
  }

  generateDebugReport(): string {
    const lines: string[] = [
      'Container Debug Report',
      '====================',
      '',
    ];

    this.serviceInspector.addRegisteredServices(lines);
    lines.push('');
    lines.push('\n' + this.visualizeDependencyGraph());
    this.addCircularDependencies(lines);
    this.serviceInspector.addHealthStatus(lines);
    this.performanceTracker.addPerformanceMetrics(lines);

    return lines.join('\n');
  }

  private addCircularDependencies(lines: string[]): void {
    const circularDeps = this.detectCircularDependencies();
    lines.push('\nCircular Dependencies:');
    if (circularDeps.detected) {
      for (const cycle of circularDeps.cycles) {
        lines.push(`  - ${cycle.join(' -> ')}`);
      }
    } else {
      lines.push('  None detected');
    }
  }
}

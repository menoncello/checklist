import type { ILogger } from '../interfaces/ILogger';
import {
  Container,
  ServiceMetadata,
  LifecycleState,
  DependencyGraph,
  Constructor,
} from './Container';

export interface ServiceInspection {
  name: string;
  state: LifecycleState;
  metadata?: ServiceMetadata;
  dependencies: string[];
  dependents: string[];
  isSingleton: boolean;
  hasInstance: boolean;
}

export interface PerformanceMetrics {
  serviceName: string;
  resolutionTime: number;
  memoryUsage: number;
  timestamp: Date;
}

export interface CircularDependencyInfo {
  detected: boolean;
  cycles: string[][];
}

export class ContainerDebugger {
  private container: Container;
  private logger?: ILogger;
  private performanceMetrics: Map<string, PerformanceMetrics[]> = new Map();
  private verboseLogging = false;

  constructor(container: Container, logger?: ILogger) {
    this.container = container;
    this.logger = logger;
  }

  inspectService(
    identifier: string | Constructor<unknown>
  ): ServiceInspection | null {
    const name = this.getServiceName(identifier);
    const state = this.container.getServiceLifecycleState(name);

    if (state === undefined) {
      return null;
    }

    const graph = this.container.getDependencyGraph();
    const node = graph.nodes.get(name);

    return {
      name,
      state,
      metadata: this.container.getServiceMetadata(name),
      dependencies: node?.dependencies ?? [],
      dependents: node?.dependents ?? [],
      isSingleton: true, // Would need Container API update to expose this
      hasInstance: false, // Would need Container API update to expose this
    };
  }

  getDependencyGraph(): DependencyGraph {
    return this.container.getDependencyGraph();
  }

  visualizeDependencyGraph(): string {
    const graph = this.getDependencyGraph();
    const lines: string[] = ['Dependency Graph:'];

    for (const [name, node] of graph.nodes) {
      lines.push(`\n${name}:`);

      if (node.dependencies.length > 0) {
        lines.push(`  Dependencies: ${node.dependencies.join(', ')}`);
      }

      if (node.dependents.length > 0) {
        lines.push(`  Dependents: ${node.dependents.join(', ')}`);
      }

      if (node.metadata) {
        lines.push(`  Metadata: ${JSON.stringify(node.metadata)}`);
      }
    }

    return lines.join('\n');
  }

  detectCircularDependencies(): CircularDependencyInfo {
    const graph = this.getDependencyGraph();
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[] = []): void => {
      if (stack.has(node)) {
        // Found a cycle
        const cycleStart = path.indexOf(node);
        if (cycleStart !== -1) {
          cycles.push([...path.slice(cycleStart), node]);
        }
        return;
      }

      if (visited.has(node)) {
        return;
      }

      visited.add(node);
      stack.add(node);
      path.push(node);

      const dependencies = graph.edges.get(node) ?? new Set();
      for (const dep of dependencies) {
        dfs(dep, [...path]);
      }

      stack.delete(node);
    };

    for (const node of graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node);
      }
    }

    return {
      detected: cycles.length > 0,
      cycles,
    };
  }

  listRegisteredServices(): string[] {
    return this.container.listRegisteredServices();
  }

  getServiceLifecycleState(
    identifier: string | Constructor<unknown>
  ): LifecycleState | undefined {
    const name = this.getServiceName(identifier);
    return this.container.getServiceLifecycleState(name);
  }

  getServiceHealthStatus(): Map<string, boolean> {
    const healthStatus = new Map<string, boolean>();
    const services = this.listRegisteredServices();

    for (const service of services) {
      const state = this.container.getServiceLifecycleState(service);
      healthStatus.set(service, state === LifecycleState.INITIALIZED);
    }

    return healthStatus;
  }

  enableVerboseLogging(): void {
    this.verboseLogging = true;

    if (this.logger !== undefined) {
      this.logger.info({ msg: 'Verbose logging enabled for Container' });
    }
  }

  disableVerboseLogging(): void {
    this.verboseLogging = false;

    if (this.logger !== undefined) {
      this.logger.info({ msg: 'Verbose logging disabled for Container' });
    }
  }

  async measureResolutionPerformance<T>(
    identifier: string | Constructor<T>
  ): Promise<{ result: T; metrics: PerformanceMetrics }> {
    const name = this.getServiceName(identifier);
    const startTime = performance.now();
    const startMemory = process.memoryUsage().heapUsed;

    try {
      const result = await this.container.resolve<T>(identifier);

      const endTime = performance.now();
      const endMemory = process.memoryUsage().heapUsed;

      const metrics: PerformanceMetrics = {
        serviceName: name,
        resolutionTime: endTime - startTime,
        memoryUsage: endMemory - startMemory,
        timestamp: new Date(),
      };

      this.recordPerformanceMetrics(name, metrics);

      if (this.verboseLogging && this.logger) {
        this.logger.debug({
          msg: 'Service resolution performance',
          ...metrics,
        });
      }

      return { result, metrics };
    } catch (error) {
      if (this.verboseLogging && this.logger) {
        this.logger.error({
          msg: 'Service resolution failed',
          service: name,
          error: (error as Error).message,
        });
      }
      throw error;
    }
  }

  getPerformanceMetrics(
    serviceName?: string
  ): Map<string, PerformanceMetrics[]> | PerformanceMetrics[] | null {
    if (serviceName !== undefined && serviceName !== '') {
      return this.performanceMetrics.get(serviceName) ?? null;
    }
    return new Map(this.performanceMetrics);
  }

  clearPerformanceMetrics(): void {
    this.performanceMetrics.clear();
  }

  generateDebugReport(): string {
    const lines: string[] = ['=== Container Debug Report ===\n'];

    // Registered services
    lines.push('Registered Services:');
    for (const service of this.listRegisteredServices()) {
      const state = this.getServiceLifecycleState(service);
      lines.push(`  - ${service}: ${state}`);
    }

    // Dependency graph
    lines.push('\n' + this.visualizeDependencyGraph());

    // Circular dependencies
    const circularDeps = this.detectCircularDependencies();
    lines.push('\nCircular Dependencies:');
    if (circularDeps.detected) {
      for (const cycle of circularDeps.cycles) {
        lines.push(`  - ${cycle.join(' -> ')}`);
      }
    } else {
      lines.push('  None detected');
    }

    // Health status
    lines.push('\nService Health Status:');
    for (const [service, healthy] of this.getServiceHealthStatus()) {
      lines.push(`  - ${service}: ${healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    }

    // Performance metrics summary
    lines.push('\nPerformance Metrics Summary:');
    for (const [service, metrics] of this.performanceMetrics) {
      if (metrics.length > 0) {
        const avgTime =
          metrics.reduce((sum, m) => sum + m.resolutionTime, 0) /
          metrics.length;
        const avgMemory =
          metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
        lines.push(`  - ${service}:`);
        lines.push(`    Average Resolution Time: ${avgTime.toFixed(2)}ms`);
        lines.push(
          `    Average Memory Usage: ${(avgMemory / 1024).toFixed(2)}KB`
        );
        lines.push(`    Total Resolutions: ${metrics.length}`);
      }
    }

    return lines.join('\n');
  }

  private getServiceName(identifier: string | Constructor<unknown>): string {
    if (typeof identifier === 'string') {
      return identifier;
    }
    return identifier.name || identifier.toString();
  }

  private recordPerformanceMetrics(
    serviceName: string,
    metrics: PerformanceMetrics
  ): void {
    if (!this.performanceMetrics.has(serviceName)) {
      this.performanceMetrics.set(serviceName, []);
    }
    const perfMetrics = this.performanceMetrics.get(serviceName);
    if (perfMetrics !== undefined) {
      perfMetrics.push(metrics);
    }
  }
}

import type { ILogger } from '../../interfaces/ILogger';
import type {
  Container,
  ServiceMetadata,
  LifecycleState,
  Constructor,
} from '../Container';

export interface ServiceInspection {
  name: string;
  state: LifecycleState;
  metadata?: ServiceMetadata;
  dependencies: string[];
  dependents: string[];
  isSingleton: boolean;
  hasInstance: boolean;
}

export class ServiceInspector {
  private container: Container;
  private logger?: ILogger;
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
      if (this.verboseLogging && this.logger !== undefined) {
        this.logger.warn({ msg: 'Service not found', service: name });
      }
      return null;
    }

    const metadata = this.container.getServiceMetadata?.(name);
    const graph = this.container.getDependencyGraph();
    const dependencies = Array.from(graph.edges.get(name) ?? []);
    const dependents = this.findDependents(name, graph.edges);

    return {
      name,
      state,
      metadata,
      dependencies,
      dependents,
      isSingleton: this.container.isSingleton?.(name) ?? false,
      hasInstance: state === LifecycleState.INITIALIZED,
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

  addRegisteredServices(lines: string[]): void {
    lines.push('Registered Services:');
    for (const service of this.listRegisteredServices()) {
      const state = this.getServiceLifecycleState(service);
      lines.push(`  - ${service}: ${state}`);
    }
  }

  addHealthStatus(lines: string[]): void {
    lines.push('\\nService Health Status:');
    for (const [service, healthy] of this.getServiceHealthStatus()) {
      lines.push(`  - ${service}: ${healthy ? '✓ Healthy' : '✗ Unhealthy'}`);
    }
  }

  private findDependents(
    serviceName: string,
    edges: Map<string, Set<string>>
  ): string[] {
    const dependents: string[] = [];

    for (const [service, dependencies] of edges) {
      if (dependencies.has(serviceName)) {
        dependents.push(service);
      }
    }

    return dependents;
  }

  private getServiceName(identifier: string | Constructor<unknown>): string {
    if (typeof identifier === 'string') {
      return identifier;
    }
    return identifier.name || identifier.toString();
  }
}
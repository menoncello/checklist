import type { ILogger } from '../interfaces/ILogger';
import {
  Constructor,
  ServiceDefinition,
  DependencyGraph,
  DependencyNode,
  CircularDependencyError,
  ServiceNotFoundError,
  LifecycleState,
} from './types';

export class DependencyResolver {
  constructor(
    private services: Map<string, ServiceDefinition>,
    private logger?: ILogger
  ) {}

  buildDependencyGraph(): DependencyGraph {
    const nodes = new Map<string, DependencyNode>();
    const edges = new Map<string, Set<string>>();

    for (const [name, definition] of this.services) {
      const dependencies = (definition.dependencies ?? []).map((dep) =>
        typeof dep === 'string' ? dep : this.getServiceName(dep)
      );

      nodes.set(name, {
        id: name,
        definition,
        dependencies,
        dependents: [],
        state: LifecycleState.REGISTERED,
      });

      edges.set(name, new Set(dependencies));
    }

    // Calculate dependents
    for (const [name, deps] of edges) {
      for (const dep of deps) {
        const node = nodes.get(dep);
        if (node) {
          node.dependents.push(name);
        }
      }
    }

    return { nodes, edges };
  }

  checkCircularDependencies(
    serviceName: string,
    visited: Set<string> = new Set(),
    path: string[] = []
  ): void {
    if (visited.has(serviceName)) {
      const cycleStart = path.indexOf(serviceName);
      if (cycleStart !== -1) {
        throw new CircularDependencyError([
          ...path.slice(cycleStart),
          serviceName,
        ]);
      }
      return;
    }

    visited.add(serviceName);
    path.push(serviceName);

    const service = this.services.get(serviceName);
    if (service?.dependencies) {
      for (const dep of service.dependencies) {
        const depName =
          typeof dep === 'string' ? dep : this.getServiceName(dep);
        this.checkCircularDependencies(depName, visited, path);
      }
    }

    path.pop();
  }

  resolveDependencies(serviceName: string): unknown[] {
    const service = this.services.get(serviceName);
    if (!service) {
      throw new ServiceNotFoundError(serviceName);
    }

    if (!service.dependencies || service.dependencies.length === 0) {
      return [];
    }

    return service.dependencies.map((dep) => {
      const depName = typeof dep === 'string' ? dep : this.getServiceName(dep);
      if (!this.services.has(depName)) {
        throw new ServiceNotFoundError(depName);
      }
      return depName;
    });
  }

  private getServiceName(identifier: string | Constructor<unknown>): string {
    if (typeof identifier === 'string') {
      return identifier;
    }
    return identifier.name || identifier.toString();
  }
}

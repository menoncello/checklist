import type {
  Container,
  DependencyGraph,
  DependencyNode,
  Constructor,
} from '../Container';

export interface CircularDependencyInfo {
  detected: boolean;
  cycles: string[][];
}

export class DependencyAnalyzer {
  private container: Container;

  constructor(container: Container) {
    this.container = container;
  }

  getDependencyGraph(): DependencyGraph {
    return this.container.getDependencyGraph();
  }

  visualizeDependencyGraph(): string {
    const graph = this.getDependencyGraph();
    const lines: string[] = ['Dependency Graph:'];

    this.addGraphNodes(lines, graph);
    return lines.join('\n');
  }

  detectCircularDependencies(): CircularDependencyInfo {
    const graph = this.getDependencyGraph();
    const cycles = this.findCycles(graph);

    return {
      detected: cycles.length > 0,
      cycles,
    };
  }

  private addGraphNodes(lines: string[], graph: DependencyGraph): void {
    const processedNodes = new Set<string>();

    for (const node of graph.nodes.values()) {
      if (!processedNodes.has(node.name)) {
        this.addNodeDetails(lines, node);
        processedNodes.add(node.name);
      }
    }
  }

  private addNodeDetails(lines: string[], node: DependencyNode): void {
    lines.push(`  ${node.name}`);

    const dependencies = node.dependencies || [];
    for (const dep of dependencies) {
      lines.push(`    ├── ${dep}`);
    }
  }

  private findCycles(graph: DependencyGraph): string[][] {
    const cycles: string[][] = [];
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (node: string, path: string[]): void => {
      if (stack.has(node)) {
        const cycleStart = path.indexOf(node);
        const cycle = path.slice(cycleStart);
        cycles.push([...cycle, node]);
        return;
      }

      if (visited.has(node)) return;

      visited.add(node);
      stack.add(node);

      const dependencies = graph.edges.get(node) ?? new Set();
      for (const dep of dependencies) {
        dfs(dep, [...path, node]);
      }

      stack.delete(node);
    };

    for (const node of graph.nodes.keys()) {
      if (!visited.has(node)) {
        dfs(node, []);
      }
    }

    return cycles;
  }

  private checkCycle(
    node: string,
    graph: DependencyGraph,
    visited: Set<string>,
    stack: Set<string>,
    path: string[]
  ): string[] | null {
    if (stack.has(node)) {
      const cycleStart = path.indexOf(node);
      return path.slice(cycleStart);
    }

    if (visited.has(node)) return null;

    visited.add(node);
    stack.add(node);

    const dependencies = graph.edges.get(node) ?? new Set();
    for (const dep of dependencies) {
      const cycle = this.checkCycle(dep, graph, visited, stack, [...path, node]);
      if (cycle !== null) return cycle;
    }

    stack.delete(node);
    return null;
  }
}
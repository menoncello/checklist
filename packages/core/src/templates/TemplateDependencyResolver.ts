/**
 * Template dependency resolution
 * Resolves dependencies, builds dependency trees, detects circular deps
 */

import * as semver from 'semver';
import { createLogger } from '../utils/logger';
import { TemplateVersionManager } from './TemplateVersionManager';
import type {
  TemplateDependency,
  DependencyTree,
  DependencyNode,
} from './types';

const logger = createLogger('checklist:templates:dependencies');

/**
 * Dependency resolution error
 */
export class DependencyResolutionError extends Error {
  constructor(
    message: string,
    public readonly dependency: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'DependencyResolutionError';
  }
}

/**
 * Circular dependency error
 */
export class CircularDependencyError extends DependencyResolutionError {
  constructor(public readonly cycle: string[]) {
    super(
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      cycle[0] ?? 'unknown'
    );
    this.name = 'CircularDependencyError';
  }
}

/**
 * Dependency resolver options
 */
export interface DependencyResolverOptions {
  /**
   * Maximum depth for dependency resolution
   */
  maxDepth?: number;

  /**
   * Version manager for version resolution
   */
  versionManager?: TemplateVersionManager;
}

/**
 * Dependency fetch function type
 */
export type DependencyFetcher = (
  name: string,
  version: string
) => Promise<TemplateDependency[]>;

/**
 * Resolves template dependencies
 */
export class TemplateDependencyResolver {
  private readonly maxDepth: number;
  private readonly versionManager: TemplateVersionManager;
  private readonly visitedNodes = new Set<string>();
  private readonly nodeStack: string[] = [];

  constructor(options: DependencyResolverOptions = {}) {
    this.maxDepth = options.maxDepth ?? 10;
    this.versionManager =
      options.versionManager ?? new TemplateVersionManager();
  }

  /**
   * Build complete dependency tree
   * @param rootDeps - Root template dependencies
   * @param fetcher - Function to fetch dependencies for a template
   * @returns Complete dependency tree
   */
  async buildDependencyTree(
    rootDeps: TemplateDependency[],
    fetcher: DependencyFetcher
  ): Promise<DependencyTree> {
    logger.info({
      msg: 'Building dependency tree',
      rootCount: rootDeps.length,
    });

    this.visitedNodes.clear();
    this.nodeStack.length = 0;

    const nodes: DependencyNode[] = [];

    for (const dep of rootDeps) {
      const node = await this.resolveDependencyNode(dep, fetcher, 0);
      nodes.push(node);
    }

    const tree: DependencyTree = {
      dependencies: nodes,
      totalCount: this.countTotalDependencies(nodes),
    };

    logger.info({
      msg: 'Dependency tree built',
      totalCount: tree.totalCount,
    });

    return tree;
  }

  /**
   * Resolve a single dependency node
   */
  private async resolveDependencyNode(
    dep: TemplateDependency,
    fetcher: DependencyFetcher,
    depth: number
  ): Promise<DependencyNode> {
    if (depth >= this.maxDepth) {
      throw new DependencyResolutionError(
        `Maximum dependency depth (${this.maxDepth}) exceeded`,
        dep.name
      );
    }

    const nodeKey = this.createNodeKey(dep);

    this.checkCircularDependency(nodeKey);
    this.nodeStack.push(nodeKey);

    try {
      const resolved = await this.resolveWithFetcher(dep, fetcher, depth);
      return resolved;
    } finally {
      this.nodeStack.pop();
      this.visitedNodes.add(nodeKey);
    }
  }

  /**
   * Check for circular dependencies
   */
  private checkCircularDependency(nodeKey: string): void {
    if (this.nodeStack.includes(nodeKey)) {
      const cycleStart = this.nodeStack.indexOf(nodeKey);
      const cycle = [...this.nodeStack.slice(cycleStart), nodeKey];
      throw new CircularDependencyError(cycle);
    }
  }

  /**
   * Resolve dependency with fetcher
   */
  private async resolveWithFetcher(
    dep: TemplateDependency,
    fetcher: DependencyFetcher,
    depth: number
  ): Promise<DependencyNode> {
    logger.debug({
      msg: 'Resolving dependency',
      name: dep.name,
      version: dep.version,
      depth,
    });

    try {
      const childDeps = await fetcher(dep.name, dep.version);
      const children = await this.resolveChildren(childDeps, fetcher, depth);
      return this.createDependencyNode(dep, children);
    } catch (error) {
      return this.handleResolutionError(error, dep);
    }
  }

  /**
   * Create dependency node from resolved children
   */
  private createDependencyNode(
    dep: TemplateDependency,
    children: DependencyNode[]
  ): DependencyNode {
    return {
      name: dep.name,
      version: dep.version,
      optional: dep.optional ?? false,
      dependencies: children,
    };
  }

  /**
   * Handle resolution errors
   */
  private handleResolutionError(
    error: unknown,
    dep: TemplateDependency
  ): never {
    if (error instanceof DependencyResolutionError) {
      throw error;
    }

    throw new DependencyResolutionError(
      `Failed to resolve dependency: ${dep.name}@${dep.version}`,
      dep.name,
      error as Error
    );
  }

  /**
   * Resolve child dependencies
   */
  private async resolveChildren(
    deps: TemplateDependency[],
    fetcher: DependencyFetcher,
    parentDepth: number
  ): Promise<DependencyNode[]> {
    const children: DependencyNode[] = [];

    for (const childDep of deps) {
      const child = await this.resolveDependencyNode(
        childDep,
        fetcher,
        parentDepth + 1
      );
      children.push(child);
    }

    return children;
  }

  /**
   * Create unique key for dependency node
   */
  private createNodeKey(dep: TemplateDependency): string {
    return `${dep.name}@${dep.version}`;
  }

  /**
   * Count total dependencies in tree
   */
  private countTotalDependencies(nodes: DependencyNode[]): number {
    let count = nodes.length;

    for (const node of nodes) {
      if (node.dependencies !== undefined && node.dependencies.length > 0) {
        count += this.countTotalDependencies(node.dependencies);
      }
    }

    return count;
  }

  /**
   * Flatten dependency tree into installation order
   * @param tree - Dependency tree
   * @returns Ordered list of dependencies (deepest first)
   */
  flattenDependencyTree(tree: DependencyTree): DependencyNode[] {
    const flattened: DependencyNode[] = [];
    const seen = new Set<string>();

    this.flattenNodes(tree.dependencies, flattened, seen);

    logger.info({
      msg: 'Dependency tree flattened',
      total: tree.totalCount,
      unique: flattened.length,
    });

    return flattened;
  }

  /**
   * Recursively flatten dependency nodes
   */
  private flattenNodes(
    nodes: DependencyNode[],
    result: DependencyNode[],
    seen: Set<string>
  ): void {
    for (const node of nodes) {
      // Process children first (depth-first)
      if (node.dependencies !== undefined && node.dependencies.length > 0) {
        this.flattenNodes(node.dependencies, result, seen);
      }

      // Add node if not already seen
      const nodeKey = `${node.name}@${node.version}`;
      if (!seen.has(nodeKey)) {
        result.push(node);
        seen.add(nodeKey);
      }
    }
  }

  /**
   * Validate dependency constraints
   * @param deps - Dependencies to validate
   * @returns True if all constraints are valid
   */
  validateDependencyConstraints(deps: TemplateDependency[]): boolean {
    for (const dep of deps) {
      if (!this.isValidConstraint(dep.version)) {
        logger.error({
          msg: 'Invalid version constraint',
          name: dep.name,
          version: dep.version,
        });
        return false;
      }
    }
    return true;
  }

  /**
   * Check if version constraint is valid
   */
  private isValidConstraint(constraint: string): boolean {
    try {
      // Try to create a Range - will throw if invalid
      new semver.Range(constraint);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Find conflicts in dependency tree
   * @param tree - Dependency tree to check
   * @returns List of conflicting dependencies
   */
  findConflicts(tree: DependencyTree): Array<{
    name: string;
    versions: string[];
  }> {
    const versionMap = new Map<string, Set<string>>();

    this.collectVersions(tree.dependencies, versionMap);

    const conflicts: Array<{ name: string; versions: string[] }> = [];

    for (const [name, versions] of versionMap.entries()) {
      if (versions.size > 1) {
        conflicts.push({
          name,
          versions: Array.from(versions),
        });
      }
    }

    if (conflicts.length > 0) {
      logger.warn({
        msg: 'Dependency conflicts detected',
        conflicts: conflicts.length,
      });
    }

    return conflicts;
  }

  /**
   * Collect all versions for each dependency
   */
  private collectVersions(
    nodes: DependencyNode[],
    versionMap: Map<string, Set<string>>
  ): void {
    for (const node of nodes) {
      const versions = versionMap.get(node.name) ?? new Set<string>();
      versions.add(node.version);
      versionMap.set(node.name, versions);

      if (node.dependencies !== undefined && node.dependencies.length > 0) {
        this.collectVersions(node.dependencies, versionMap);
      }
    }
  }
}

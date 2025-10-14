/**
 * Tests for TemplateDependencyResolver
 * Covers dependency tree building, circular deps, and conflict detection
 */

import { describe, expect, test, mock } from 'bun:test';
import {
  TemplateDependencyResolver,
  DependencyResolutionError,
  CircularDependencyError,
} from '../../src/templates/TemplateDependencyResolver';
import type {
  TemplateDependency,
  DependencyTree,
} from '../../src/templates/types';
import type { DependencyFetcher } from '../../src/templates/TemplateDependencyResolver';

describe('TemplateDependencyResolver', () => {
  describe('constructor', () => {
    test('should create resolver with default options', () => {
      const resolver = new TemplateDependencyResolver();
      expect(resolver).toBeDefined();
    });

    test('should create resolver with custom max depth', () => {
      const resolver = new TemplateDependencyResolver({ maxDepth: 5 });
      expect(resolver).toBeDefined();
    });
  });

  describe('buildDependencyTree', () => {
    test('should build tree with no dependencies', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [];
      const fetcher: DependencyFetcher = mock(() => Promise.resolve([]));

      const tree = await resolver.buildDependencyTree(rootDeps, fetcher);

      expect(tree.dependencies).toHaveLength(0);
      expect(tree.totalCount).toBe(0);
    });

    test('should build tree with single dependency', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
      ];
      const fetcher: DependencyFetcher = mock(() => Promise.resolve([]));

      const tree = await resolver.buildDependencyTree(rootDeps, fetcher);

      expect(tree.dependencies).toHaveLength(1);
      expect(tree.dependencies[0].name).toBe('dep1');
      expect(tree.totalCount).toBe(1);
    });

    test('should build tree with nested dependencies', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
      ];
      const fetcher: DependencyFetcher = mock((name: string) => {
        if (name === 'dep1') {
          return Promise.resolve([
            { name: 'dep2', version: '^2.0.0' },
            { name: 'dep3', version: '^1.5.0' },
          ]);
        }
        return Promise.resolve([]);
      });

      const tree = await resolver.buildDependencyTree(rootDeps, fetcher);

      expect(tree.dependencies).toHaveLength(1);
      expect(tree.dependencies[0].dependencies).toHaveLength(2);
      expect(tree.totalCount).toBe(3);
    });

    test('should build tree with multiple root dependencies', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
        { name: 'dep2', version: '^2.0.0' },
      ];
      const fetcher: DependencyFetcher = mock(() => Promise.resolve([]));

      const tree = await resolver.buildDependencyTree(rootDeps, fetcher);

      expect(tree.dependencies).toHaveLength(2);
      expect(tree.totalCount).toBe(2);
    });

    test('should handle optional dependencies', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0', optional: true },
      ];
      const fetcher: DependencyFetcher = mock(() => Promise.resolve([]));

      const tree = await resolver.buildDependencyTree(rootDeps, fetcher);

      expect(tree.dependencies[0].optional).toBe(true);
    });

    test('should detect circular dependencies', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
      ];
      const fetcher: DependencyFetcher = mock((name: string) => {
        if (name === 'dep1') {
          return Promise.resolve([{ name: 'dep2', version: '^2.0.0' }]);
        }
        if (name === 'dep2') {
          return Promise.resolve([{ name: 'dep1', version: '^1.0.0' }]);
        }
        return Promise.resolve([]);
      });

      await expect(
        resolver.buildDependencyTree(rootDeps, fetcher)
      ).rejects.toThrow(CircularDependencyError);
    });

    test('should detect self-referencing dependency', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
      ];
      const fetcher: DependencyFetcher = mock((name: string) => {
        if (name === 'dep1') {
          return Promise.resolve([{ name: 'dep1', version: '^1.0.0' }]);
        }
        return Promise.resolve([]);
      });

      await expect(
        resolver.buildDependencyTree(rootDeps, fetcher)
      ).rejects.toThrow(CircularDependencyError);
    });

    test('should handle max depth exceeded', async () => {
      const resolver = new TemplateDependencyResolver({ maxDepth: 2 });
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
      ];
      const fetcher: DependencyFetcher = mock((name: string, version: string) => {
        // Each dep depends on the next one, creating deep nesting
        const num = Number.parseInt(name.replace('dep', ''), 10);
        return Promise.resolve([
          { name: `dep${num + 1}`, version: '^1.0.0' },
        ]);
      });

      await expect(
        resolver.buildDependencyTree(rootDeps, fetcher)
      ).rejects.toThrow(DependencyResolutionError);
    });

    test('should handle fetcher errors', async () => {
      const resolver = new TemplateDependencyResolver();
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
      ];
      const fetcher: DependencyFetcher = mock(() =>
        Promise.reject(new Error('Network error'))
      );

      await expect(
        resolver.buildDependencyTree(rootDeps, fetcher)
      ).rejects.toThrow(DependencyResolutionError);
    });

    test('should build deep dependency tree', async () => {
      const resolver = new TemplateDependencyResolver({ maxDepth: 5 });
      const rootDeps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
      ];
      const fetcher: DependencyFetcher = mock((name: string) => {
        const num = Number.parseInt(name.replace('dep', ''), 10);
        if (num < 4) {
          return Promise.resolve([
            { name: `dep${num + 1}`, version: '^1.0.0' },
          ]);
        }
        return Promise.resolve([]);
      });

      const tree = await resolver.buildDependencyTree(rootDeps, fetcher);

      expect(tree.totalCount).toBe(4);
    });
  });

  describe('flattenDependencyTree', () => {
    test('should flatten empty tree', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [],
        totalCount: 0,
      };

      const flattened = resolver.flattenDependencyTree(tree);

      expect(flattened).toHaveLength(0);
    });

    test('should flatten single dependency', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [
          {
            name: 'dep1',
            version: '1.0.0',
            optional: false,
            dependencies: [],
          },
        ],
        totalCount: 1,
      };

      const flattened = resolver.flattenDependencyTree(tree);

      expect(flattened).toHaveLength(1);
      expect(flattened[0].name).toBe('dep1');
    });

    test('should flatten nested dependencies in correct order', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [
          {
            name: 'dep1',
            version: '1.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.0.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
        ],
        totalCount: 2,
      };

      const flattened = resolver.flattenDependencyTree(tree);

      expect(flattened).toHaveLength(2);
      expect(flattened[0].name).toBe('dep2'); // Deepest first
      expect(flattened[1].name).toBe('dep1');
    });

    test('should deduplicate same dependency', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [
          {
            name: 'dep1',
            version: '1.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.0.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
          {
            name: 'dep3',
            version: '3.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.0.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
        ],
        totalCount: 4,
      };

      const flattened = resolver.flattenDependencyTree(tree);

      expect(flattened).toHaveLength(3); // dep2 counted once
      expect(flattened.filter((d) => d.name === 'dep2')).toHaveLength(1);
    });

    test('should handle complex nested tree', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [
          {
            name: 'dep1',
            version: '1.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.0.0',
                optional: false,
                dependencies: [
                  {
                    name: 'dep4',
                    version: '4.0.0',
                    optional: false,
                    dependencies: [],
                  },
                ],
              },
              {
                name: 'dep3',
                version: '3.0.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
        ],
        totalCount: 4,
      };

      const flattened = resolver.flattenDependencyTree(tree);

      expect(flattened).toHaveLength(4);
      // Deepest first: dep4, then dep2 or dep3, then dep1
      expect(flattened[0].name).toBe('dep4');
      expect(flattened[3].name).toBe('dep1');
    });
  });

  describe('validateDependencyConstraints', () => {
    test('should validate valid constraints', () => {
      const resolver = new TemplateDependencyResolver();
      const deps: TemplateDependency[] = [
        { name: 'dep1', version: '^1.0.0' },
        { name: 'dep2', version: '~2.1.0' },
        { name: 'dep3', version: '>=1.0.0 <2.0.0' },
      ];

      const valid = resolver.validateDependencyConstraints(deps);

      expect(valid).toBe(true);
    });

    test('should invalidate bad constraints', () => {
      const resolver = new TemplateDependencyResolver();
      const deps: TemplateDependency[] = [
        { name: 'dep1', version: 'invalid-version' },
      ];

      const valid = resolver.validateDependencyConstraints(deps);

      expect(valid).toBe(false);
    });

    test('should validate empty array', () => {
      const resolver = new TemplateDependencyResolver();
      const deps: TemplateDependency[] = [];

      const valid = resolver.validateDependencyConstraints(deps);

      expect(valid).toBe(true);
    });
  });

  describe('findConflicts', () => {
    test('should find no conflicts in simple tree', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [
          {
            name: 'dep1',
            version: '1.0.0',
            optional: false,
            dependencies: [],
          },
          {
            name: 'dep2',
            version: '2.0.0',
            optional: false,
            dependencies: [],
          },
        ],
        totalCount: 2,
      };

      const conflicts = resolver.findConflicts(tree);

      expect(conflicts).toHaveLength(0);
    });

    test('should find version conflicts', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [
          {
            name: 'dep1',
            version: '1.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.0.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
          {
            name: 'dep3',
            version: '3.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.1.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
        ],
        totalCount: 4,
      };

      const conflicts = resolver.findConflicts(tree);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].name).toBe('dep2');
      expect(conflicts[0].versions).toContain('2.0.0');
      expect(conflicts[0].versions).toContain('2.1.0');
    });

    test('should find multiple conflicts', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [
          {
            name: 'dep1',
            version: '1.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.0.0',
                optional: false,
                dependencies: [],
              },
              {
                name: 'dep3',
                version: '3.0.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
          {
            name: 'dep4',
            version: '4.0.0',
            optional: false,
            dependencies: [
              {
                name: 'dep2',
                version: '2.1.0',
                optional: false,
                dependencies: [],
              },
              {
                name: 'dep3',
                version: '3.1.0',
                optional: false,
                dependencies: [],
              },
            ],
          },
        ],
        totalCount: 6,
      };

      const conflicts = resolver.findConflicts(tree);

      expect(conflicts).toHaveLength(2);
      expect(conflicts.some((c) => c.name === 'dep2')).toBe(true);
      expect(conflicts.some((c) => c.name === 'dep3')).toBe(true);
    });

    test('should handle empty tree', () => {
      const resolver = new TemplateDependencyResolver();
      const tree: DependencyTree = {
        dependencies: [],
        totalCount: 0,
      };

      const conflicts = resolver.findConflicts(tree);

      expect(conflicts).toHaveLength(0);
    });
  });

  describe('error handling', () => {
    test('should create DependencyResolutionError', () => {
      const error = new DependencyResolutionError('Test error', 'dep1');

      expect(error.name).toBe('DependencyResolutionError');
      expect(error.message).toBe('Test error');
      expect(error.dependency).toBe('dep1');
    });

    test('should create CircularDependencyError', () => {
      const cycle = ['dep1', 'dep2', 'dep1'];
      const error = new CircularDependencyError(cycle);

      expect(error.name).toBe('CircularDependencyError');
      expect(error.cycle).toEqual(cycle);
      expect(error.message).toContain('dep1 -> dep2 -> dep1');
    });

    test('should include cause in DependencyResolutionError', () => {
      const cause = new Error('Original error');
      const error = new DependencyResolutionError('Test error', 'dep1', cause);

      expect(error.cause).toBe(cause);
    });
  });
});

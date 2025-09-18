import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { DependencyResolver } from '../../src/container/DependencyResolver';
import {
  ServiceDefinition,
  CircularDependencyError,
  ServiceNotFoundError,
  LifecycleState,
  Constructor,
} from '../../src/container/types';
import type { ILogger } from '../../src/interfaces/ILogger';

// Mock classes for testing
class MockServiceA {}
class MockServiceB {}
class MockServiceC {}
class MockServiceD {}

// Mock logger
const createMockLogger = (): ILogger => ({
  debug: mock(() => {}),
  info: mock(() => {}),
  warn: mock(() => {}),
  error: mock(() => {}),
  fatal: mock(() => {}),
  child: mock(() => createMockLogger()),
});

describe('DependencyResolver', () => {
  let services: Map<string, ServiceDefinition>;
  let resolver: DependencyResolver;
  let mockLogger: ILogger;

  beforeEach(() => {
    services = new Map();
    mockLogger = createMockLogger();
    resolver = new DependencyResolver(services, mockLogger);
  });

  describe('constructor', () => {
    test('should create resolver with services map', () => {
      const servicesMap = new Map<string, ServiceDefinition>();
      const resolver = new DependencyResolver(servicesMap);

      expect(resolver).toBeInstanceOf(DependencyResolver);
    });

    test('should create resolver with services map and logger', () => {
      const servicesMap = new Map<string, ServiceDefinition>();
      const logger = createMockLogger();
      const resolver = new DependencyResolver(servicesMap, logger);

      expect(resolver).toBeInstanceOf(DependencyResolver);
    });
  });

  describe('buildDependencyGraph', () => {
    test('should build empty graph for no services', () => {
      const graph = resolver.buildDependencyGraph();

      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);
    });

    test('should build graph for single service without dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        singleton: true,
      });

      const graph = resolver.buildDependencyGraph();

      expect(graph.nodes.size).toBe(1);
      expect(graph.edges.size).toBe(1);

      const node = graph.nodes.get('serviceA');
      expect(node).toBeDefined();
      expect(node?.id).toBe('serviceA');
      expect(node?.dependencies).toEqual([]);
      expect(node?.dependents).toEqual([]);
      expect(node?.state).toBe(LifecycleState.REGISTERED);

      const edges = graph.edges.get('serviceA');
      expect(edges).toBeInstanceOf(Set);
      expect(edges?.size).toBe(0);
    });

    test('should build graph for services with string dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
      });

      const graph = resolver.buildDependencyGraph();

      expect(graph.nodes.size).toBe(2);
      expect(graph.edges.size).toBe(2);

      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.dependencies).toEqual(['serviceB']);
      expect(nodeA?.dependents).toEqual([]);

      const nodeB = graph.nodes.get('serviceB');
      expect(nodeB?.dependencies).toEqual([]);
      expect(nodeB?.dependents).toEqual(['serviceA']);
    });

    test('should build graph for services with constructor dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [MockServiceB],
      });
      services.set('MockServiceB', {
        resolver: MockServiceB,
      });

      const graph = resolver.buildDependencyGraph();

      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.dependencies).toEqual(['MockServiceB']);

      const nodeB = graph.nodes.get('MockServiceB');
      expect(nodeB?.dependents).toEqual(['serviceA']);
    });

    test('should build graph for complex dependency chains', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB', 'serviceC'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
        dependencies: ['serviceD'],
      });
      services.set('serviceC', {
        resolver: MockServiceC,
      });
      services.set('serviceD', {
        resolver: MockServiceD,
      });

      const graph = resolver.buildDependencyGraph();

      expect(graph.nodes.size).toBe(4);

      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.dependencies).toEqual(['serviceB', 'serviceC']);
      expect(nodeA?.dependents).toEqual([]);

      const nodeB = graph.nodes.get('serviceB');
      expect(nodeB?.dependencies).toEqual(['serviceD']);
      expect(nodeB?.dependents).toEqual(['serviceA']);

      const nodeC = graph.nodes.get('serviceC');
      expect(nodeC?.dependencies).toEqual([]);
      expect(nodeC?.dependents).toEqual(['serviceA']);

      const nodeD = graph.nodes.get('serviceD');
      expect(nodeD?.dependencies).toEqual([]);
      expect(nodeD?.dependents).toEqual(['serviceB']);
    });

    test('should handle mixed string and constructor dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB', MockServiceC],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
      });
      services.set('MockServiceC', {
        resolver: MockServiceC,
      });

      const graph = resolver.buildDependencyGraph();

      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.dependencies).toEqual(['serviceB', 'MockServiceC']);
    });

    test('should handle services with empty dependencies array', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [],
      });

      const graph = resolver.buildDependencyGraph();

      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.dependencies).toEqual([]);
      expect(nodeA?.dependents).toEqual([]);
    });

    test('should build graph with all service definition properties', () => {
      const serviceDefinition: ServiceDefinition = {
        resolver: MockServiceA,
        singleton: true,
        dependencies: ['serviceB'],
        lifecycle: {
          beforeInit: () => {},
          afterInit: () => {},
        },
        metadata: {
          name: 'Service A',
          version: '1.0.0',
        },
      };

      services.set('serviceA', serviceDefinition);
      services.set('serviceB', { resolver: MockServiceB });

      const graph = resolver.buildDependencyGraph();

      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.definition).toBe(serviceDefinition);
      expect(nodeA?.definition.singleton).toBe(true);
      expect(nodeA?.definition.metadata?.name).toBe('Service A');
    });
  });

  describe('checkCircularDependencies', () => {
    test('should not throw for service without dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).not.toThrow();
    });

    test('should not throw for valid dependency chain', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
        dependencies: ['serviceC'],
      });
      services.set('serviceC', {
        resolver: MockServiceC,
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).not.toThrow();
    });

    test('should throw CircularDependencyError for direct circular dependency', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceA'],
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).toThrow(CircularDependencyError);

      try {
        resolver.checkCircularDependencies('serviceA');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        expect((error as CircularDependencyError).message).toContain('serviceA -> serviceA');
      }
    });

    test('should throw CircularDependencyError for two-service cycle', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
        dependencies: ['serviceA'],
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).toThrow(CircularDependencyError);

      try {
        resolver.checkCircularDependencies('serviceA');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const message = (error as CircularDependencyError).message;
        expect(message).toContain('serviceA -> serviceB -> serviceA');
      }
    });

    test('should throw CircularDependencyError for three-service cycle', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
        dependencies: ['serviceC'],
      });
      services.set('serviceC', {
        resolver: MockServiceC,
        dependencies: ['serviceA'],
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).toThrow(CircularDependencyError);

      try {
        resolver.checkCircularDependencies('serviceA');
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const message = (error as CircularDependencyError).message;
        expect(message).toContain('serviceA -> serviceB -> serviceC -> serviceA');
      }
    });

    test('should handle complex graph with no cycles', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB', 'serviceC'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
        dependencies: ['serviceD'],
      });
      services.set('serviceC', {
        resolver: MockServiceC,
        dependencies: ['serviceD'],
      });
      services.set('serviceD', {
        resolver: MockServiceD,
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).not.toThrow();
    });

    test('should detect cycle in partial cycle (not from root)', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
        dependencies: ['serviceC'],
      });
      services.set('serviceC', {
        resolver: MockServiceC,
        dependencies: ['serviceB'], // Cycle between B and C
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).toThrow(CircularDependencyError);
    });

    test('should handle constructor dependencies in cycle detection', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [MockServiceB],
      });
      services.set('MockServiceB', {
        resolver: MockServiceB,
        dependencies: ['serviceA'],
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).toThrow(CircularDependencyError);
    });

    test('should handle missing dependencies in cycle check', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['missingService'],
      });

      // Should not throw for missing dependency in cycle check
      // (missing dependency error should be handled elsewhere)
      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).not.toThrow();
    });

    test('should handle service with undefined dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: undefined,
      });

      expect(() => {
        resolver.checkCircularDependencies('serviceA');
      }).not.toThrow();
    });
  });

  describe('resolveDependencies', () => {
    test('should return empty array for service without dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
      });

      const deps = resolver.resolveDependencies('serviceA');
      expect(deps).toEqual([]);
    });

    test('should return empty array for service with empty dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [],
      });

      const deps = resolver.resolveDependencies('serviceA');
      expect(deps).toEqual([]);
    });

    test('should throw ServiceNotFoundError for non-existent service', () => {
      expect(() => {
        resolver.resolveDependencies('nonExistentService');
      }).toThrow(ServiceNotFoundError);

      try {
        resolver.resolveDependencies('nonExistentService');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceNotFoundError);
        expect((error as ServiceNotFoundError).message).toContain('nonExistentService');
      }
    });

    test('should resolve string dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB', 'serviceC'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
      });
      services.set('serviceC', {
        resolver: MockServiceC,
      });

      const deps = resolver.resolveDependencies('serviceA');
      expect(deps).toEqual(['serviceB', 'serviceC']);
    });

    test('should resolve constructor dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [MockServiceB, MockServiceC],
      });
      services.set('MockServiceB', {
        resolver: MockServiceB,
      });
      services.set('MockServiceC', {
        resolver: MockServiceC,
      });

      const deps = resolver.resolveDependencies('serviceA');
      expect(deps).toEqual(['MockServiceB', 'MockServiceC']);
    });

    test('should resolve mixed string and constructor dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB', MockServiceC],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
      });
      services.set('MockServiceC', {
        resolver: MockServiceC,
      });

      const deps = resolver.resolveDependencies('serviceA');
      expect(deps).toEqual(['serviceB', 'MockServiceC']);
    });

    test('should throw ServiceNotFoundError for missing string dependency', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB', 'missingService'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
      });

      expect(() => {
        resolver.resolveDependencies('serviceA');
      }).toThrow(ServiceNotFoundError);

      try {
        resolver.resolveDependencies('serviceA');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceNotFoundError);
        expect((error as ServiceNotFoundError).message).toContain('missingService');
      }
    });

    test('should throw ServiceNotFoundError for missing constructor dependency', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [MockServiceB],
      });
      // MockServiceB is not registered

      expect(() => {
        resolver.resolveDependencies('serviceA');
      }).toThrow(ServiceNotFoundError);

      try {
        resolver.resolveDependencies('serviceA');
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceNotFoundError);
        expect((error as ServiceNotFoundError).message).toContain('MockServiceB');
      }
    });

    test('should handle complex dependency resolution', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: ['serviceB', MockServiceC, 'serviceD'],
      });
      services.set('serviceB', {
        resolver: MockServiceB,
      });
      services.set('MockServiceC', {
        resolver: MockServiceC,
      });
      services.set('serviceD', {
        resolver: MockServiceD,
      });

      const deps = resolver.resolveDependencies('serviceA');
      expect(deps).toEqual(['serviceB', 'MockServiceC', 'serviceD']);
    });
  });

  describe('getServiceName (private method behavior)', () => {
    test('should handle constructor with name property', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [MockServiceB],
      });
      services.set('MockServiceB', {
        resolver: MockServiceB,
      });

      const graph = resolver.buildDependencyGraph();
      const nodeA = graph.nodes.get('serviceA');

      // MockServiceB constructor should use class name
      expect(nodeA?.dependencies).toEqual(['MockServiceB']);
    });

    test('should handle anonymous constructor', () => {
      const AnonymousClass = class {};
      Object.defineProperty(AnonymousClass, 'name', { value: '' });

      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: [AnonymousClass as Constructor<unknown>],
      });

      // For anonymous classes, it should use toString()
      const graph = resolver.buildDependencyGraph();
      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.dependencies[0]).toContain('class');
    });
  });

  describe('integration tests', () => {
    test('should work with complex service registry', () => {
      // Create a realistic service dependency graph
      services.set('databaseService', {
        resolver: MockServiceA,
        singleton: true,
      });
      services.set('cacheService', {
        resolver: MockServiceB,
        singleton: true,
      });
      services.set('userService', {
        resolver: MockServiceC,
        dependencies: ['databaseService', 'cacheService'],
      });
      services.set('authService', {
        resolver: MockServiceD,
        dependencies: ['userService'],
      });

      // Should build graph without errors
      const graph = resolver.buildDependencyGraph();
      expect(graph.nodes.size).toBe(4);

      // Should resolve dependencies correctly
      const userDeps = resolver.resolveDependencies('userService');
      expect(userDeps).toEqual(['databaseService', 'cacheService']);

      const authDeps = resolver.resolveDependencies('authService');
      expect(authDeps).toEqual(['userService']);

      // Should not have circular dependencies
      expect(() => {
        resolver.checkCircularDependencies('authService');
      }).not.toThrow();
    });

    test('should handle empty service registry', () => {
      const emptyResolver = new DependencyResolver(new Map());

      const graph = emptyResolver.buildDependencyGraph();
      expect(graph.nodes.size).toBe(0);
      expect(graph.edges.size).toBe(0);

      expect(() => {
        emptyResolver.resolveDependencies('anyService');
      }).toThrow(ServiceNotFoundError);
    });
  });

  describe('error handling', () => {
    test('should handle CircularDependencyError with proper message format', () => {
      services.set('A', {
        resolver: MockServiceA,
        dependencies: ['B'],
      });
      services.set('B', {
        resolver: MockServiceB,
        dependencies: ['C'],
      });
      services.set('C', {
        resolver: MockServiceC,
        dependencies: ['A'],
      });

      try {
        resolver.checkCircularDependencies('A');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(CircularDependencyError);
        const circularError = error as CircularDependencyError;
        expect(circularError.name).toBe('CircularDependencyError');
        expect(circularError.message).toMatch(/Circular dependency detected: A -> B -> C -> A/);
      }
    });

    test('should handle ServiceNotFoundError with proper message format', () => {
      try {
        resolver.resolveDependencies('unknownService');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ServiceNotFoundError);
        const notFoundError = error as ServiceNotFoundError;
        expect(notFoundError.name).toBe('ServiceNotFoundError');
        expect(notFoundError.message).toMatch(/Service not found: unknownService/);
      }
    });
  });

  describe('edge cases', () => {
    test('should handle service with null dependencies', () => {
      services.set('serviceA', {
        resolver: MockServiceA,
        dependencies: null as unknown as Array<string | Constructor<unknown>>,
      });

      const graph = resolver.buildDependencyGraph();
      const nodeA = graph.nodes.get('serviceA');
      expect(nodeA?.dependencies).toEqual([]);
    });

    test('should handle service definition with all optional properties', () => {
      const minimalDefinition: ServiceDefinition = {
        resolver: MockServiceA,
      };

      services.set('minimal', minimalDefinition);

      const graph = resolver.buildDependencyGraph();
      const node = graph.nodes.get('minimal');

      expect(node?.dependencies).toEqual([]);
      expect(node?.dependents).toEqual([]);
      expect(node?.state).toBe(LifecycleState.REGISTERED);
    });

    test('should handle large dependency graphs efficiently', () => {
      // Create a large but valid dependency graph
      const serviceCount = 100;

      for (let i = 0; i < serviceCount; i++) {
        const deps = i > 0 ? [`service${i - 1}`] : [];
        services.set(`service${i}`, {
          resolver: MockServiceA,
          dependencies: deps,
        });
      }

      const startTime = performance.now();
      const graph = resolver.buildDependencyGraph();
      resolver.checkCircularDependencies('service99');
      const endTime = performance.now();

      expect(graph.nodes.size).toBe(serviceCount);
      expect(endTime - startTime).toBeLessThan(100); // Should be fast
    });
  });
});
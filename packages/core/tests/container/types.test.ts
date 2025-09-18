import { describe, test, expect } from 'bun:test';
import {
  CircularDependencyError,
  ServiceNotFoundError,
  ServiceInitializationError,
  LifecycleState,
  type Constructor,
  type Factory,
  type ServiceResolver,
  type ServiceDefinition,
  type ServiceLifecycle,
  type ServiceMetadata,
  type ServiceOptions,
  type DependencyGraph,
  type DependencyNode,
} from '../../src/container/types';

describe('Container Types', () => {
  describe('CircularDependencyError', () => {
    test('should create error with proper message for simple cycle', () => {
      const cycle = ['serviceA', 'serviceB', 'serviceA'];
      const error = new CircularDependencyError(cycle);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(CircularDependencyError);
      expect(error.name).toBe('CircularDependencyError');
      expect(error.message).toBe('Circular dependency detected: serviceA -> serviceB -> serviceA');
    });

    test('should create error with proper message for complex cycle', () => {
      const cycle = ['serviceA', 'serviceB', 'serviceC', 'serviceD', 'serviceA'];
      const error = new CircularDependencyError(cycle);

      expect(error.message).toBe('Circular dependency detected: serviceA -> serviceB -> serviceC -> serviceD -> serviceA');
    });

    test('should create error with single service cycle', () => {
      const cycle = ['serviceA', 'serviceA'];
      const error = new CircularDependencyError(cycle);

      expect(error.message).toBe('Circular dependency detected: serviceA -> serviceA');
    });

    test('should create error with empty cycle', () => {
      const cycle: string[] = [];
      const error = new CircularDependencyError(cycle);

      expect(error.message).toBe('Circular dependency detected: ');
    });

    test('should create error with single element cycle', () => {
      const cycle = ['onlyService'];
      const error = new CircularDependencyError(cycle);

      expect(error.message).toBe('Circular dependency detected: onlyService');
    });

    test('should handle cycles with special characters', () => {
      const cycle = ['service@1', 'service-with-dash', 'service_with_underscore', 'service@1'];
      const error = new CircularDependencyError(cycle);

      expect(error.message).toBe('Circular dependency detected: service@1 -> service-with-dash -> service_with_underscore -> service@1');
    });

    test('should handle cycles with long service names', () => {
      const longName = 'very'.repeat(50) + 'LongServiceName';
      const cycle = ['serviceA', longName, 'serviceA'];
      const error = new CircularDependencyError(cycle);

      expect(error.message).toContain(longName);
      expect(error.message).toContain('serviceA -> ');
    });

    test('should be instanceof Error and CircularDependencyError', () => {
      const error = new CircularDependencyError(['A', 'B', 'A']);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof CircularDependencyError).toBe(true);
    });

    test('should have proper error properties', () => {
      const cycle = ['serviceA', 'serviceB', 'serviceA'];
      const error = new CircularDependencyError(cycle);

      expect(error.name).toBe('CircularDependencyError');
      expect(error.message).toBeDefined();
      expect(error.stack).toBeDefined();
    });
  });

  describe('ServiceNotFoundError', () => {
    test('should create error with proper message', () => {
      const serviceId = 'nonExistentService';
      const error = new ServiceNotFoundError(serviceId);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ServiceNotFoundError);
      expect(error.name).toBe('ServiceNotFoundError');
      expect(error.message).toBe('Service not found: nonExistentService');
    });

    test('should handle empty service id', () => {
      const error = new ServiceNotFoundError('');

      expect(error.message).toBe('Service not found: ');
    });

    test('should handle service id with special characters', () => {
      const serviceId = 'service@special-chars_123';
      const error = new ServiceNotFoundError(serviceId);

      expect(error.message).toBe('Service not found: service@special-chars_123');
    });

    test('should handle very long service id', () => {
      const longId = 'service' + 'Name'.repeat(100);
      const error = new ServiceNotFoundError(longId);

      expect(error.message).toBe(`Service not found: ${longId}`);
    });

    test('should handle service id with unicode characters', () => {
      const serviceId = 'service-ñáéíóú-中文-🚀';
      const error = new ServiceNotFoundError(serviceId);

      expect(error.message).toBe(`Service not found: ${serviceId}`);
    });

    test('should be instanceof Error and ServiceNotFoundError', () => {
      const error = new ServiceNotFoundError('testService');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ServiceNotFoundError).toBe(true);
    });

    test('should have proper error properties', () => {
      const error = new ServiceNotFoundError('testService');

      expect(error.name).toBe('ServiceNotFoundError');
      expect(error.message).toBeDefined();
      expect(error.stack).toBeDefined();
    });
  });

  describe('ServiceInitializationError', () => {
    test('should create error with proper message and cause', () => {
      const serviceId = 'testService';
      const causeError = new Error('Database connection failed');
      const error = new ServiceInitializationError(serviceId, causeError);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(ServiceInitializationError);
      expect(error.name).toBe('ServiceInitializationError');
      expect(error.message).toBe('Failed to initialize service: testService - Database connection failed');
      expect(error.cause).toBe(causeError);
    });

    test('should handle empty service id', () => {
      const causeError = new Error('Some error');
      const error = new ServiceInitializationError('', causeError);

      expect(error.message).toBe('Failed to initialize service:  - Some error');
    });

    test('should handle cause error with empty message', () => {
      const causeError = new Error('');
      const error = new ServiceInitializationError('testService', causeError);

      expect(error.message).toBe('Failed to initialize service: testService - ');
    });

    test('should handle complex cause error', () => {
      const causeError = new TypeError('Cannot read property of undefined');
      const error = new ServiceInitializationError('complexService', causeError);

      expect(error.message).toBe('Failed to initialize service: complexService - Cannot read property of undefined');
      expect(error.cause).toBe(causeError);
      expect(error.cause).toBeInstanceOf(TypeError);
    });

    test('should handle nested errors', () => {
      const rootCause = new Error('Root cause');
      const intermediateCause = new ServiceInitializationError('intermediate', rootCause);
      const error = new ServiceInitializationError('finalService', intermediateCause);

      expect(error.message).toBe('Failed to initialize service: finalService - Failed to initialize service: intermediate - Root cause');
      expect(error.cause).toBe(intermediateCause);
    });

    test('should handle service id with special characters', () => {
      const serviceId = 'service@special-chars_123';
      const causeError = new Error('Network timeout');
      const error = new ServiceInitializationError(serviceId, causeError);

      expect(error.message).toBe('Failed to initialize service: service@special-chars_123 - Network timeout');
    });

    test('should be instanceof Error and ServiceInitializationError', () => {
      const causeError = new Error('Test error');
      const error = new ServiceInitializationError('testService', causeError);

      expect(error instanceof Error).toBe(true);
      expect(error instanceof ServiceInitializationError).toBe(true);
    });

    test('should have proper error properties', () => {
      const causeError = new Error('Test error');
      const error = new ServiceInitializationError('testService', causeError);

      expect(error.name).toBe('ServiceInitializationError');
      expect(error.message).toBeDefined();
      expect(error.stack).toBeDefined();
      expect(error.cause).toBe(causeError);
    });

    test('should handle very long service names and error messages', () => {
      const longServiceId = 'service' + 'Name'.repeat(50);
      const longErrorMessage = 'error'.repeat(100);
      const causeError = new Error(longErrorMessage);
      const error = new ServiceInitializationError(longServiceId, causeError);

      expect(error.message).toContain(longServiceId);
      expect(error.message).toContain(longErrorMessage);
    });
  });

  describe('LifecycleState enum', () => {
    test('should have all expected values', () => {
      expect(LifecycleState.REGISTERED).toBe(LifecycleState.REGISTERED);
      expect(LifecycleState.INITIALIZING).toBe(LifecycleState.INITIALIZING);
      expect(LifecycleState.INITIALIZED).toBe(LifecycleState.INITIALIZED);
      expect(LifecycleState.DESTROYING).toBe(LifecycleState.DESTROYING);
      expect(LifecycleState.DESTROYED).toBe(LifecycleState.DESTROYED);
      expect(LifecycleState.ERROR).toBe(LifecycleState.ERROR);
    });

    test('should be enumerable', () => {
      const states = Object.values(LifecycleState);
      expect(states).toContain(LifecycleState.REGISTERED);
      expect(states).toContain(LifecycleState.INITIALIZING);
      expect(states).toContain(LifecycleState.INITIALIZED);
      expect(states).toContain(LifecycleState.DESTROYING);
      expect(states).toContain(LifecycleState.DESTROYED);
      expect(states).toContain(LifecycleState.ERROR);
      expect(states).toHaveLength(6);
    });

    test('should have correct keys', () => {
      const keys = Object.keys(LifecycleState);
      expect(keys).toContain('REGISTERED');
      expect(keys).toContain('INITIALIZING');
      expect(keys).toContain('INITIALIZED');
      expect(keys).toContain('DESTROYING');
      expect(keys).toContain('DESTROYED');
      expect(keys).toContain('ERROR');
      expect(keys).toHaveLength(6);
    });

    test('should allow comparison', () => {
      expect(LifecycleState.REGISTERED === LifecycleState.REGISTERED).toBe(true);
      const initialized: string = LifecycleState.INITIALIZED;
      const initializing: string = LifecycleState.INITIALIZING;
      expect(initialized !== initializing).toBe(true);
    });
  });

  describe('Type definitions', () => {
    describe('Constructor type', () => {
      test('should accept class constructors', () => {
        class TestService {}
        const constructor: Constructor<TestService> = TestService;
        expect(typeof constructor).toBe('function');
      });

      test('should work with generic types', () => {
        class GenericService<T> {
          constructor(public value: T) {}
        }
        const constructor: Constructor<GenericService<string>> = GenericService as Constructor<GenericService<string>>;
        expect(typeof constructor).toBe('function');
      });
    });

    describe('Factory type', () => {
      test('should accept function factories', () => {
        const factory: Factory<string> = () => 'test';
        expect(typeof factory).toBe('function');
        expect(factory()).toBe('test');
      });

      test('should accept async factories', () => {
        const asyncFactory: Factory<Promise<string>> = async () => 'test';
        expect(typeof asyncFactory).toBe('function');
      });
    });

    describe('ServiceDefinition interface', () => {
      test('should accept minimal definition', () => {
        class TestService {}
        const definition: ServiceDefinition<TestService> = {
          resolver: TestService,
        };
        expect(definition.resolver).toBe(TestService);
      });

      test('should accept full definition', () => {
        class TestService {}
        const definition: ServiceDefinition<TestService> = {
          resolver: TestService,
          singleton: true,
          dependencies: ['dependency1', TestService],
          lifecycle: {
            beforeInit: async () => {},
            afterInit: () => {},
          },
          metadata: {
            name: 'Test Service',
            version: '1.0.0',
            tags: ['test'],
          },
        };
        expect(definition.singleton).toBe(true);
        expect(definition.dependencies).toHaveLength(2);
      });
    });

    describe('ServiceLifecycle interface', () => {
      test('should accept all lifecycle hooks', () => {
        class TestService {}
        const service = new TestService();

        const lifecycle: ServiceLifecycle<TestService> = {
          beforeInit: (svc) => {
            expect(svc).toBe(service);
          },
          afterInit: async (svc) => {
            expect(svc).toBe(service);
          },
          beforeDestroy: (svc) => {
            expect(svc).toBe(service);
          },
          afterDestroy: async (svc) => {
            expect(svc).toBe(service);
          },
          onError: (error, svc) => {
            expect(error).toBeInstanceOf(Error);
            expect(svc).toBe(service);
          },
          healthCheck: (svc) => {
            expect(svc).toBe(service);
            return true;
          },
        };

        expect(typeof lifecycle.beforeInit).toBe('function');
        expect(typeof lifecycle.afterInit).toBe('function');
        expect(typeof lifecycle.beforeDestroy).toBe('function');
        expect(typeof lifecycle.afterDestroy).toBe('function');
        expect(typeof lifecycle.onError).toBe('function');
        expect(typeof lifecycle.healthCheck).toBe('function');
      });
    });

    describe('ServiceMetadata interface', () => {
      test('should accept standard metadata', () => {
        const metadata: ServiceMetadata = {
          name: 'Test Service',
          version: '1.0.0',
          description: 'A test service',
          tags: ['test', 'example'],
          createdAt: new Date(),
        };

        expect(metadata.name).toBe('Test Service');
        expect(metadata.version).toBe('1.0.0');
        expect(metadata.tags).toContain('test');
      });

      test('should accept custom metadata properties', () => {
        const metadata: ServiceMetadata = {
          customProperty: 'custom value',
          nested: {
            property: 'nested value',
          },
          arrayProperty: [1, 2, 3],
        };

        expect(metadata.customProperty).toBe('custom value');
        expect(metadata.nested).toBeDefined();
        expect(metadata.arrayProperty).toHaveLength(3);
      });
    });

    describe('DependencyGraph interface', () => {
      test('should work with maps', () => {
        const nodes = new Map<string, DependencyNode>();
        const edges = new Map<string, Set<string>>();

        const graph: DependencyGraph = { nodes, edges };

        expect(graph.nodes).toBe(nodes);
        expect(graph.edges).toBe(edges);
      });
    });

    describe('DependencyNode interface', () => {
      test('should contain all required properties', () => {
        class TestService {}
        const definition: ServiceDefinition = { resolver: TestService };

        const node: DependencyNode = {
          id: 'testService',
          definition,
          dependencies: ['dep1', 'dep2'],
          dependents: ['dependent1'],
          state: LifecycleState.REGISTERED,
        };

        expect(node.id).toBe('testService');
        expect(node.definition).toBe(definition);
        expect(node.dependencies).toHaveLength(2);
        expect(node.dependents).toHaveLength(1);
        expect(node.state).toBe(LifecycleState.REGISTERED);
      });
    });
  });

  describe('Integration tests', () => {
    test('should work together in realistic scenarios', () => {
      class DatabaseService {}
      class UserService {}

      // Create a service definition
      const userServiceDef: ServiceDefinition<UserService> = {
        resolver: UserService,
        singleton: true,
        dependencies: [DatabaseService],
        lifecycle: {
          healthCheck: () => true,
        },
        metadata: {
          name: 'User Service',
          version: '2.0.0',
        },
      };

      // Create a dependency node
      const node: DependencyNode = {
        id: 'userService',
        definition: userServiceDef as ServiceDefinition<unknown>,
        dependencies: ['DatabaseService'],
        dependents: [],
        state: LifecycleState.INITIALIZED,
      };

      // Create dependency graph
      const graph: DependencyGraph = {
        nodes: new Map([['userService', node]]),
        edges: new Map([['userService', new Set(['DatabaseService'])]]),
      };

      expect(graph.nodes.get('userService')).toBe(node);
      expect(graph.edges.get('userService')?.has('DatabaseService')).toBe(true);
    });

    test('should handle error scenarios', () => {
      // Test error classes work together
      const rootError = new Error('Connection timeout');
      const initError = new ServiceInitializationError('userService', rootError);
      const circularError = new CircularDependencyError(['A', 'B', 'A']);
      const notFoundError = new ServiceNotFoundError('missingService');

      expect(initError.cause).toBe(rootError);
      expect(circularError.message).toContain('A -> B -> A');
      expect(notFoundError.message).toContain('missingService');
    });
  });
});
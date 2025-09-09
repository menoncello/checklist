import { describe, test, expect, beforeEach } from 'bun:test';
import { 
  Container, 
  CircularDependencyError, 
  ServiceNotFoundError,
  LifecycleState 
} from '../../src/container/Container';

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('Service Registration', () => {
    test('should register a service with factory', () => {
      const factory = () => ({ name: 'test' });
      container.register('TestService', factory);
      
      expect(container.has('TestService')).toBe(true);
    });

    test('should register a service with constructor', () => {
      class TestService {
        name = 'test';
      }
      
      container.register('TestService', TestService);
      expect(container.has('TestService')).toBe(true);
    });

    test('should register a value directly', () => {
      const value = { name: 'test' };
      container.registerValue('TestValue', value);
      
      expect(container.has('TestValue')).toBe(true);
    });
  });

  describe('Service Resolution', () => {
    test('should resolve a simple service', async () => {
      const factory = () => ({ name: 'test' });
      container.register('TestService', factory);
      
      const service = await container.resolve('TestService');
      expect(service).toEqual({ name: 'test' });
    });

    test('should resolve a service with dependencies', async () => {
      container.register('Logger', () => ({ log: () => {} }));
      container.register('Service', (logger: any) => ({ logger }), {
        dependencies: ['Logger'],
      });
      
      const service = await container.resolve<any>('Service');
      expect(service.logger).toBeDefined();
      expect(service.logger.log).toBeDefined();
    });

    test('should resolve multiple services', async () => {
      container.register('Service1', () => ({ id: 1 }));
      container.register('Service2', () => ({ id: 2 }));
      
      const [s1, s2] = await container.resolveAll('Service1', 'Service2');
      expect(s1).toEqual({ id: 1 });
      expect(s2).toEqual({ id: 2 });
    });

    test('should return singleton instance', async () => {
      let counter = 0;
      container.register('Counter', () => ({ id: ++counter }), {
        singleton: true,
      });
      
      const instance1 = await container.resolve('Counter');
      const instance2 = await container.resolve('Counter');
      
      expect(instance1).toBe(instance2);
      expect(counter).toBe(1);
    });

    test('should create new instance when not singleton', async () => {
      let counter = 0;
      container.register('Counter', () => ({ id: ++counter }), {
        singleton: false,
      });
      
      const instance1 = await container.resolve('Counter');
      const instance2 = await container.resolve('Counter');
      
      expect(instance1).not.toBe(instance2);
      expect(counter).toBe(2);
    });

    test('should throw ServiceNotFoundError for unknown service', async () => {
      await expect(container.resolve('Unknown')).rejects.toThrow(ServiceNotFoundError);
    });
  });

  describe('Circular Dependencies', () => {
    test('should detect direct circular dependency', async () => {
      container.register('A', () => ({}), { dependencies: ['B'] });
      container.register('B', () => ({}), { dependencies: ['A'] });
      
      await expect(container.resolve('A')).rejects.toThrow(CircularDependencyError);
    });

    test('should detect indirect circular dependency', async () => {
      container.register('A', () => ({}), { dependencies: ['B'] });
      container.register('B', () => ({}), { dependencies: ['C'] });
      container.register('C', () => ({}), { dependencies: ['A'] });
      
      await expect(container.resolve('A')).rejects.toThrow(CircularDependencyError);
    });
  });

  describe('Lifecycle Hooks', () => {
    test('should call beforeInit and afterInit hooks', async () => {
      const calls: string[] = [];
      
      container.register('Service', () => ({ name: 'test' }), {
        lifecycle: {
          beforeInit: async () => { calls.push('beforeInit'); },
          afterInit: async () => { calls.push('afterInit'); },
        },
      });
      
      await container.resolve('Service');
      
      expect(calls).toEqual(['beforeInit', 'afterInit']);
    });

    test('should call onError hook on failure', async () => {
      let errorHandled = false;
      const testError = new Error('Test error');
      
      container.register('Service', () => {
        throw testError;
      }, {
        lifecycle: {
          onError: async (error) => {
            errorHandled = true;
            expect(error).toBe(testError);
          },
        },
      });
      
      await expect(container.resolve('Service')).rejects.toThrow(testError);
      expect(errorHandled).toBe(true);
    });

    test('should call destroy hooks', async () => {
      const calls: string[] = [];
      
      container.register('Service', () => ({ name: 'test' }), {
        lifecycle: {
          beforeDestroy: async () => { calls.push('beforeDestroy'); },
          afterDestroy: async () => { calls.push('afterDestroy'); },
        },
      });
      
      await container.resolve('Service');
      await container.destroy('Service');
      
      expect(calls).toContain('beforeDestroy');
      expect(calls).toContain('afterDestroy');
    });
  });

  describe('Dependency Graph', () => {
    test('should generate correct dependency graph', () => {
      container.register('A', () => ({}), { dependencies: ['B', 'C'] });
      container.register('B', () => ({}), { dependencies: ['C'] });
      container.register('C', () => ({}));
      
      const graph = container.getDependencyGraph();
      
      expect(graph.nodes.get('A')?.dependencies).toEqual(['B', 'C']);
      expect(graph.nodes.get('B')?.dependencies).toEqual(['C']);
      expect(graph.nodes.get('C')?.dependencies).toEqual([]);
      
      expect(graph.edges.get('A')?.has('B')).toBe(true);
      expect(graph.edges.get('A')?.has('C')).toBe(true);
      expect(graph.edges.get('B')?.has('C')).toBe(true);
    });

    test('should calculate dependents correctly', () => {
      container.register('A', () => ({}), { dependencies: ['B'] });
      container.register('B', () => ({}), { dependencies: ['C'] });
      container.register('C', () => ({}));
      
      const graph = container.getDependencyGraph();
      
      expect(graph.nodes.get('C')?.dependents).toContain('B');
      expect(graph.nodes.get('B')?.dependents).toContain('A');
    });
  });

  describe('Service Metadata', () => {
    test('should store and retrieve service metadata', () => {
      const metadata = {
        name: 'TestService',
        version: '1.0.0',
        description: 'A test service',
      };
      
      container.register('Service', () => ({}), { metadata });
      
      expect(container.getServiceMetadata('Service')).toEqual(metadata);
    });
  });

  describe('Lifecycle States', () => {
    test('should track service lifecycle state', async () => {
      container.register('Service', () => ({ name: 'test' }));
      
      expect(container.getServiceLifecycleState('Service')).toBe(LifecycleState.REGISTERED);
      
      await container.resolve('Service');
      
      expect(container.getServiceLifecycleState('Service')).toBe(LifecycleState.INITIALIZED);
    });

    test('should set error state on failure', async () => {
      container.register('Service', () => {
        throw new Error('Test error');
      });
      
      await expect(container.resolve('Service')).rejects.toThrow();
      
      expect(container.getServiceLifecycleState('Service')).toBe(LifecycleState.ERROR);
    });
  });

  describe('Container Management', () => {
    test('should list all registered services', () => {
      container.register('Service1', () => ({}));
      container.register('Service2', () => ({}));
      container.register('Service3', () => ({}));
      
      const services = container.listRegisteredServices();
      
      expect(services).toContain('Service1');
      expect(services).toContain('Service2');
      expect(services).toContain('Service3');
      expect(services).toHaveLength(3);
    });

    test('should reset container', async () => {
      container.register('Service', () => ({}));
      await container.resolve('Service');
      
      container.reset();
      
      expect(container.has('Service')).toBe(false);
      expect(container.listRegisteredServices()).toHaveLength(0);
    });

    test('should destroy all services', async () => {
      let destroyed = false;
      
      container.register('Service', () => ({}), {
        lifecycle: {
          beforeDestroy: async () => { destroyed = true; },
        },
      });
      
      await container.resolve('Service');
      await container.destroy();
      
      expect(destroyed).toBe(true);
    });
  });
});
import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ServiceProvider } from '../../src/container/ServiceProvider';
import { MockLoggerService } from '../mocks/LoggerService.mock';
import { MockConfigService } from '../mocks/ConfigService.mock';
import { MockFileSystemService } from '../mocks/FileSystemService.mock';
import { MockStateManagerService } from '../mocks/StateManagerService.mock';
import { MockWorkflowEngineService } from '../mocks/WorkflowEngineService.mock';

describe('ServiceProvider', () => {
  let provider: ServiceProvider;

  beforeEach(() => {
    provider = new ServiceProvider({
      environment: 'test',
    });
  });

  afterEach(async () => {
    await provider.destroy();
  });

  describe('Service Registration', () => {
    test('should register logger service', async () => {
      provider.registerLogger(MockLoggerService as any);
      const logger = await provider.getLogger();
      
      expect(logger).toBeInstanceOf(MockLoggerService);
    });

    test('should register config service', async () => {
      provider.registerConfigService(MockConfigService as any);
      const config = await provider.getConfigService();
      
      expect(config).toBeInstanceOf(MockConfigService);
    });

    test('should register file system service', async () => {
      provider.registerFileSystemService(MockFileSystemService as any);
      const fs = await provider.getFileSystemService();
      
      expect(fs).toBeInstanceOf(MockFileSystemService);
    });

    test('should register state manager service', async () => {
      provider.registerLogger(MockLoggerService as any);
      provider.registerFileSystemService(MockFileSystemService as any);
      provider.registerStateManager(MockStateManagerService as any, {
        dependencies: ['ILogger', 'IFileSystemService'],
      });
      
      const stateManager = await provider.getStateManager();
      expect(stateManager).toBeInstanceOf(MockStateManagerService);
    });

    test('should register workflow engine service', async () => {
      provider.registerLogger(MockLoggerService as any);
      provider.registerFileSystemService(MockFileSystemService as any);
      provider.registerStateManager(MockStateManagerService as any, {
        dependencies: ['ILogger', 'IFileSystemService'],
      });
      provider.registerWorkflowEngine(MockWorkflowEngineService as any, {
        dependencies: ['IStateManager'],
      });
      
      const engine = await provider.getWorkflowEngine();
      expect(engine).toBeInstanceOf(MockWorkflowEngineService);
    });

    test('should register custom service', async () => {
      class CustomService {
        name = 'custom';
      }
      
      provider.register('CustomService', CustomService);
      const service = await provider.get<CustomService>('CustomService');
      
      expect(service).toBeInstanceOf(CustomService);
      expect(service.name).toBe('custom');
    });
  });

  describe('Environment Configuration', () => {
    test('should configure for development', () => {
      const devProvider = ServiceProvider.createForDevelopment();
      expect(devProvider['config'].environment).toBe('development');
      expect(devProvider['config'].enableDebug).toBe(true);
      
      devProvider.destroy();
    });

    test('should configure for test', () => {
      const testProvider = ServiceProvider.createForTest();
      expect(testProvider['config'].environment).toBe('test');
      expect(testProvider['config'].enableDebug).toBe(false);
      
      testProvider.destroy();
    });

    test('should configure for production', () => {
      const prodProvider = ServiceProvider.createForProduction();
      expect(prodProvider['config'].environment).toBe('production');
      expect(prodProvider['config'].enableDebug).toBe(false);
      
      prodProvider.destroy();
    });

    test('should switch environments', () => {
      provider.configureForEnvironment('production');
      expect(provider['config'].environment).toBe('production');
      
      provider.configureForEnvironment('development');
      expect(provider['config'].environment).toBe('development');
    });
  });

  describe('Feature Flags', () => {
    test('should check feature flag status', () => {
      provider.setFeatureFlag('TEST_FEATURE', true);
      expect(provider.isFeatureEnabled('TEST_FEATURE')).toBe(true);
      
      provider.setFeatureFlag('TEST_FEATURE', false);
      expect(provider.isFeatureEnabled('TEST_FEATURE')).toBe(false);
    });

    test('should initialize with feature flags', () => {
      const flagProvider = new ServiceProvider({
        featureFlags: {
          FEATURE_A: true,
          FEATURE_B: false,
        },
      });
      
      expect(flagProvider.isFeatureEnabled('FEATURE_A')).toBe(true);
      expect(flagProvider.isFeatureEnabled('FEATURE_B')).toBe(false);
      expect(flagProvider.isFeatureEnabled('FEATURE_C')).toBe(false);
      
      flagProvider.destroy();
    });
  });

  describe('Container Management', () => {
    test('should get underlying container', () => {
      const container = provider.getContainer();
      expect(container).toBeDefined();
      expect(container.constructor.name).toBe('Container');
    });

    test('should list registered services', () => {
      provider.registerLogger(MockLoggerService as any);
      provider.registerConfigService(MockConfigService as any);
      
      const services = provider.listRegisteredServices();
      expect(services).toContain('ILogger');
      expect(services).toContain('IConfigService');
    });

    test('should get service bindings', () => {
      provider.registerLogger(MockLoggerService as any);
      const bindings = provider.getServiceBindings();
      
      expect(bindings.has('ILogger')).toBe(true);
      expect(bindings.get('ILogger')).toBe(MockLoggerService as any);
    });

    test('should get dependency graph', () => {
      provider.registerLogger(MockLoggerService as any);
      provider.registerConfigService(MockConfigService as any, {
        dependencies: ['ILogger'],
      });
      
      const graph = provider.getDependencyGraph();
      expect(graph.nodes.has('ILogger')).toBe(true);
      expect(graph.nodes.has('IConfigService')).toBe(true);
    });
  });

  describe('Service Resolution with Dependencies', () => {
    test('should resolve services with correct dependencies', async () => {
      // Set up all services with proper dependencies
      provider.registerLogger(MockLoggerService as any);
      provider.registerFileSystemService(MockFileSystemService as any);
      provider.registerConfigService(MockConfigService as any, {
        dependencies: ['ILogger', 'IFileSystemService'],
      });
      
      const config = await provider.getConfigService();
      expect(config).toBeInstanceOf(MockConfigService);
    });

    test('should maintain singleton instances', async () => {
      provider.registerLogger(MockLoggerService as any, { singleton: true });
      
      const logger1 = await provider.getLogger();
      const logger2 = await provider.getLogger();
      
      expect(logger1).toBe(logger2);
    });
  });

  describe('Cleanup', () => {
    test('should destroy services', async () => {
      provider.registerLogger(MockLoggerService as any);
      await provider.getLogger();
      
      await provider.destroy();
      
      // After destroy, container should be empty
      expect(provider.listRegisteredServices()).toHaveLength(0);
    });

    test('should reset provider', async () => {
      provider.registerLogger(MockLoggerService as any);
      provider.setFeatureFlag('TEST', true);
      
      provider.reset();
      
      expect(provider.listRegisteredServices()).toHaveLength(0);
      expect(provider.isFeatureEnabled('TEST')).toBe(false);
    });
  });
});
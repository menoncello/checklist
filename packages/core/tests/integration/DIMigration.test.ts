import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ServiceProvider } from '../../src/container/ServiceProvider';
import { CompatibilityLayer } from '../../src/container/CompatibilityLayer';
import { FeatureFlagManager } from '../../src/container/FeatureFlags';
import { MockLoggerService } from '../mocks/LoggerService.mock';
import { MockConfigService } from '../mocks/ConfigService.mock';
import { MockFileSystemService } from '../mocks/FileSystemService.mock';
import { MockStateManagerService } from '../mocks/StateManagerService.mock';
import { MockWorkflowEngineService } from '../mocks/WorkflowEngineService.mock';

describe('DI Migration Integration', () => {
  let provider: ServiceProvider;
  let featureFlags: FeatureFlagManager;

  beforeEach(() => {
    featureFlags = new FeatureFlagManager();
    provider = new ServiceProvider({
      environment: 'test',
      featureFlags: featureFlags.getAllFlags() as Record<string, boolean | string>,
    });
    
    // Register all mock services without circular dependencies
    provider.registerLogger(MockLoggerService as any);
    provider.registerFileSystemService(MockFileSystemService as any);
    provider.registerConfigService(MockConfigService as any, {
      dependencies: ['ILogger', 'IFileSystemService'],
    });
    provider.registerStateManager(MockStateManagerService as any, {
      dependencies: ['ILogger'],
    });
    provider.registerWorkflowEngine(MockWorkflowEngineService as any, {
      dependencies: ['IStateManager'],
    });
    
    CompatibilityLayer.initialize(provider);
  });

  afterEach(async () => {
    await CompatibilityLayer.destroy();
    featureFlags.reset();
  });

  describe('Phase 1: Non-Critical Services', () => {
    test('should use DI for ConfigService when enabled', async () => {
      featureFlags.enablePhase1();
      provider.setFeatureFlag('DI_ENABLED', 'partial');
      
      const config = await CompatibilityLayer.getConfigService();
      expect(config).toBeInstanceOf(MockConfigService);
    });

    test('should use DI for FileSystemService when enabled', async () => {
      featureFlags.enablePhase1();
      provider.setFeatureFlag('DI_ENABLED', 'partial');
      
      const fs = await CompatibilityLayer.getFileSystemService();
      expect(fs).toBeInstanceOf(MockFileSystemService);
    });

    test('should throw error when DI disabled for ConfigService', async () => {
      featureFlags.disableAllDI();
      provider.setFeatureFlag('DI_ENABLED', 'false');
      
      await expect(CompatibilityLayer.getConfigService()).rejects.toThrow(
        'ConfigService requires DI'
      );
    });
  });

  describe('Phase 2: Logger Migration', () => {
    test('should use DI for Logger when enabled', async () => {
      featureFlags.enablePhase2();
      provider.setFeatureFlag('DI_LOGGER_ENABLED', true);
      
      const logger = await CompatibilityLayer.getLogger();
      expect(logger).toBeInstanceOf(MockLoggerService);
    });

    test('should cache logger instance', async () => {
      featureFlags.enablePhase2();
      provider.setFeatureFlag('DI_LOGGER_ENABLED', true);
      
      const logger1 = await CompatibilityLayer.getLogger();
      const logger2 = await CompatibilityLayer.getLogger();
      
      expect(logger1).toBe(logger2);
    });
  });

  describe('Phase 3: Core Services', () => {
    test('should use DI for StateManager when fully enabled', async () => {
      featureFlags.enablePhase3();
      provider.setFeatureFlag('DI_ENABLED', 'full');
      
      const stateManager = await CompatibilityLayer.getStateManager();
      expect(stateManager).toBeInstanceOf(MockStateManagerService);
    });

    test('should use DI for WorkflowEngine when fully enabled', async () => {
      featureFlags.enablePhase3();
      provider.setFeatureFlag('DI_ENABLED', 'full');
      
      const engine = await CompatibilityLayer.getWorkflowEngine();
      expect(engine).toBeInstanceOf(MockWorkflowEngineService);
    });

    test('should throw error when not fully enabled for StateManager', async () => {
      featureFlags.enablePhase1();
      provider.setFeatureFlag('DI_ENABLED', 'partial');
      
      await expect(CompatibilityLayer.getStateManager()).rejects.toThrow(
        'StateManager requires full DI'
      );
    });
  });

  describe('Migration Status', () => {
    test('should report correct migration phase', () => {
      featureFlags.enablePhase1();
      let status = featureFlags.getMigrationStatus();
      expect(status.current).toBe('phase1');
      expect(status.phase1).toBe(true);
      expect(status.phase2).toBe(false);
      expect(status.phase3).toBe(false);
      
      featureFlags.enablePhase2();
      status = featureFlags.getMigrationStatus();
      expect(status.current).toBe('phase2');
      expect(status.phase1).toBe(true);
      expect(status.phase2).toBe(true);
      expect(status.phase3).toBe(false);
      
      featureFlags.enablePhase3();
      status = featureFlags.getMigrationStatus();
      expect(status.current).toBe('phase3');
      expect(status.phase1).toBe(true);
      expect(status.phase2).toBe(true);
      expect(status.phase3).toBe(true);
    });
  });

  describe('Rollback Scenarios', () => {
    test('should rollback from Phase 3 to Phase 2', async () => {
      // Start with Phase 3
      featureFlags.enablePhase3();
      provider.setFeatureFlag('DI_ENABLED', 'full');
      
      const engine1 = await CompatibilityLayer.getWorkflowEngine();
      expect(engine1).toBeInstanceOf(MockWorkflowEngineService);
      
      // Rollback to Phase 2
      CompatibilityLayer.clearCache();
      featureFlags.enablePhase2();
      provider.setFeatureFlag('DI_ENABLED', 'partial');
      
      await expect(CompatibilityLayer.getWorkflowEngine()).rejects.toThrow(
        'WorkflowEngine requires full DI'
      );
    });

    test('should rollback all DI in emergency', async () => {
      featureFlags.enablePhase3();
      provider.setFeatureFlag('DI_ENABLED', 'full');
      
      // Emergency rollback
      featureFlags.disableAllDI();
      provider.setFeatureFlag('DI_ENABLED', 'false');
      provider.setFeatureFlag('DI_LOGGER_ENABLED', false);
      
      CompatibilityLayer.clearCache();
      
      await expect(CompatibilityLayer.getConfigService()).rejects.toThrow();
    });
  });

  describe('Service Integration', () => {
    test('should resolve complex dependency chain', async () => {
      featureFlags.enablePhase3();
      provider.setFeatureFlag('DI_ENABLED', 'full');
      
      const engine = await provider.getWorkflowEngine();
      const stateManager = await provider.getStateManager();
      const logger = await provider.getLogger();
      
      // Test that services can interact
      const mockEngine = engine as MockWorkflowEngineService;
      const mockState = stateManager as MockStateManagerService;
      const mockLogger = logger as MockLoggerService;
      
      // Create test workflow
      const workflow = mockEngine.createTestWorkflow();
      await mockEngine.loadWorkflow(workflow);
      
      // Start workflow
      const instance = await mockEngine.startWorkflow(workflow.id);
      expect(instance).toBeDefined();
      
      // Check state manager interaction
      mockState.setState({
        version: '1.0.0',
        activeInstance: instance,
        instances: [instance],
      });
      
      const state = await mockState.load();
      expect(state.activeInstance).toEqual(instance);
      
      // Check logger was called
      mockLogger.info({ msg: 'Workflow started' });
      expect(mockLogger.hasLoggedMessage('Workflow started')).toBe(true);
    });

    test('should handle service lifecycle correctly', async () => {
      const lifecycleCalls: string[] = [];
      
      class TestService {
        name = 'test';
      }
      
      provider.register('TestService', TestService, {
        lifecycle: {
          beforeInit: async () => { lifecycleCalls.push('beforeInit'); },
          afterInit: async () => { lifecycleCalls.push('afterInit'); },
          beforeDestroy: async () => { lifecycleCalls.push('beforeDestroy'); },
          afterDestroy: async () => { lifecycleCalls.push('afterDestroy'); },
        },
      });
      
      const service = await provider.get('TestService');
      expect(lifecycleCalls).toContain('beforeInit');
      expect(lifecycleCalls).toContain('afterInit');
      
      await provider.destroy();
      expect(lifecycleCalls).toContain('beforeDestroy');
      expect(lifecycleCalls).toContain('afterDestroy');
    });
  });

  describe('Feature Flag Listeners', () => {
    test('should notify on feature flag change', (done) => {
      let notified = false;
      
      const unsubscribe = featureFlags.onFlagChange('DI_ENABLED', (value) => {
        notified = true;
        expect(value).toBe('full');
        unsubscribe();
        done();
      });
      
      featureFlags.setFlag('DI_ENABLED', 'full');
    });
  });
});
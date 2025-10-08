import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { MockConfigService } from './ConfigService.mock';
import type { AppConfig, ServiceConfig } from '../../src/interfaces/IConfigService';

describe('MockConfigService', () => {
  let mockConfigService: MockConfigService;
  let defaultConfig: AppConfig;

  beforeEach(() => {
    mockConfigService = new MockConfigService();

    defaultConfig = {
      appName: 'test-app',
      version: '1.0.0',
      environment: 'test',
      debug: false,
      featureFlags: {},
      services: {},
      metadata: {},
    };
  });

  afterEach(() => {
    mockConfigService.clearHistory();
    mock.restore();
  });

  describe('initialization and basic state', () => {
    test('should initialize with default config', () => {
      const config = mockConfigService.getConfig();

      expect(config.appName).toBe('test-app');
      expect(config.version).toBe('1.0.0');
      expect(config.environment).toBe('test');
      expect(config.debug).toBe(false);
    });

    test('should track method calls', () => {
      mockConfigService.get('appName');
      mockConfigService.set('debug', true);

      expect(mockConfigService.wasCalled('get')).toBe(true);
      expect(mockConfigService.wasCalled('set')).toBe(true);
      expect(mockConfigService.getCallCount('get')).toBe(1);
      expect(mockConfigService.getCallCount('set')).toBe(1);
    });

    test('should clear history', () => {
      mockConfigService.get('appName');
      mockConfigService.clearHistory();

      expect(mockConfigService.wasCalled('get')).toBe(false);
      expect(mockConfigService.getCallCount('get')).toBe(0);
      expect(mockConfigService.loadHistory).toEqual([]);
      expect(mockConfigService.saveHistory).toEqual([]);
    });
  });

  describe('load functionality', () => {
    test('should load config without path', async () => {
      const config = await mockConfigService.load();

      expect(config).toEqual(defaultConfig);
      expect(mockConfigService.loadHistory).toContain('default');
      expect(mockConfigService.wasCalled('load')).toBe(true);
    });

    test('should load config with path', async () => {
      const configPath = '/test/config.json';
      const config = await mockConfigService.load(configPath);

      expect(config).toEqual(defaultConfig);
      expect(mockConfigService.loadHistory).toContain(configPath);
    });

    test('should fail load when configured', async () => {
      mockConfigService.failNextCall('load');

      await expect(mockConfigService.load()).rejects.toThrow('Mock error: load failed');
      expect(mockConfigService.shouldFailNext).toBeNull();
    });

    test('should track multiple load calls', async () => {
      await mockConfigService.load('/path1');
      await mockConfigService.load('/path2');
      await mockConfigService.load();

      expect(mockConfigService.loadHistory).toEqual(['/path1', '/path2', 'default']);
      expect(mockConfigService.getCallCount('load')).toBe(3);
    });
  });

  describe('save functionality', () => {
    test('should save config without path', async () => {
      const newConfig: AppConfig = {
        ...defaultConfig,
        appName: 'new-app',
        debug: true,
      };

      await mockConfigService.save(newConfig);

      expect(mockConfigService.saveHistory).toHaveLength(1);
      expect(mockConfigService.saveHistory[0]).toEqual(newConfig);
      expect(mockConfigService.getConfig()).toEqual(newConfig);
    });

    test('should save config with path', async () => {
      const newConfig: AppConfig = {
        ...defaultConfig,
        version: '2.0.0',
      };
      const configPath = '/test/config.json';

      await mockConfigService.save(newConfig, configPath);

      expect(mockConfigService.saveHistory).toHaveLength(1);
      expect(mockConfigService.saveHistory[0]).toEqual(newConfig);
      expect(mockConfigService.wasCalled('save')).toBe(true);
    });

    test('should fail save when configured', async () => {
      const newConfig = { ...defaultConfig };
      mockConfigService.failNextCall('save');

      await expect(mockConfigService.save(newConfig)).rejects.toThrow('Mock error: save failed');
      expect(mockConfigService.shouldFailNext).toBeNull();
    });

    test('should notify watchers on save', async () => {
      const watcher = mock(() => {});
      mockConfigService.watch(watcher);

      const newConfig = { ...defaultConfig, debug: true };
      await mockConfigService.save(newConfig);

      expect(watcher).toHaveBeenCalledWith(newConfig);
    });

    test('should preserve original config when saving copy', async () => {
      const originalConfig = mockConfigService.getConfig();
      const modifiedConfig = { ...originalConfig, debug: true };

      await mockConfigService.save(modifiedConfig);

      // Original reference should not be modified
      expect(originalConfig.debug).toBe(false);
      expect(mockConfigService.getConfig().debug).toBe(true);
    });
  });

  describe('get functionality', () => {
    test('should get top-level properties', () => {
      expect(mockConfigService.get<string>('appName')).toBe('test-app');
      expect(mockConfigService.get<string>('version')).toBe('1.0.0');
      expect(mockConfigService.get<boolean>('debug')).toBe(false);
    });

    test('should get nested properties', () => {
      mockConfigService.setConfig({
        metadata: {
          author: 'test-user',
          nested: {
            deep: 'value',
          },
        },
      });

      expect(mockConfigService.get<string>('metadata.author')).toBe('test-user');
      expect(mockConfigService.get<string>('metadata.nested.deep')).toBe('value');
    });

    test('should return undefined for non-existent properties', () => {
      expect(mockConfigService.get('nonExistent')).toBeUndefined();
      expect(mockConfigService.get('metadata.nonExistent')).toBeUndefined();
      expect(mockConfigService.get('metadata.nested.nonExistent')).toBeUndefined();
    });

    test('should handle property access on null/undefined values', () => {
      mockConfigService.setConfig({
        metadata: {
          nullValue: null,
          undefinedValue: undefined,
        },
      });

      expect(mockConfigService.get('metadata.nullValue.property')).toBeUndefined();
      expect(mockConfigService.get('metadata.undefinedValue.property')).toBeUndefined();
    });

    test('should handle property access on non-object values', () => {
      mockConfigService.setConfig({
        metadata: {
          stringValue: 'string',
          numberValue: 42,
        },
      });

      expect(mockConfigService.get('metadata.stringValue.property')).toBeUndefined();
      expect(mockConfigService.get('metadata.numberValue.property')).toBeUndefined();
    });

    test('should return typed values', () => {
      mockConfigService.setConfig({
        metadata: {
          stringVal: 'string',
          numberVal: 42,
          boolVal: true,
          objectVal: { nested: 'value' },
        },
      });

      expect(mockConfigService.get<string>('metadata.stringVal')).toBe('string');
      expect(mockConfigService.get<number>('metadata.numberVal')).toBe(42);
      expect(mockConfigService.get<boolean>('metadata.boolVal')).toBe(true);
      expect(mockConfigService.get<object>('metadata.objectVal')).toEqual({ nested: 'value' });
    });
  });

  describe('set functionality', () => {
    test('should set top-level properties', () => {
      mockConfigService.set('debug', true);
      mockConfigService.set('appName', 'new-app');

      expect(mockConfigService.get<boolean>('debug')).toBe(true);
      expect(mockConfigService.get<string>('appName')).toBe('new-app');
    });

    test('should set nested properties', () => {
      mockConfigService.set('metadata.author', 'test-user');
      mockConfigService.set('metadata.nested.deep', 'deep-value');

      expect(mockConfigService.get<string>('metadata.author')).toBe('test-user');
      expect(mockConfigService.get<string>('metadata.nested.deep')).toBe('deep-value');
    });

    test('should create intermediate objects when setting nested properties', () => {
      mockConfigService.set('newSection.subsection.value', 'test');

      expect(mockConfigService.get<string>('newSection.subsection.value')).toBe('test');
      expect(typeof mockConfigService.get('newSection')).toBe('object');
      expect(typeof mockConfigService.get('newSection.subsection')).toBe('object');
    });

    test('should overwrite non-object values when creating nested path', () => {
      mockConfigService.set('metadata', 'string-value');
      mockConfigService.set('metadata.nested.value', 'new-value');

      expect(mockConfigService.get<string>('metadata.nested.value')).toBe('new-value');
      expect(typeof mockConfigService.get('metadata')).toBe('object');
    });

    test('should notify watchers on set', () => {
      const watcher = mock(() => {});
      mockConfigService.watch(watcher);

      mockConfigService.set('debug', true);

      expect(watcher).toHaveBeenCalledWith(
        expect.objectContaining({ debug: true })
      );
    });

    test('should handle setting various data types', () => {
      mockConfigService.set('string', 'value');
      mockConfigService.set('number', 42);
      mockConfigService.set('boolean', true);
      mockConfigService.set('array', [1, 2, 3]);
      mockConfigService.set('object', { nested: 'value' });
      mockConfigService.set('null', null);
      mockConfigService.set('undefined', undefined);

      expect(mockConfigService.get<string>('string')).toBe('value');
      expect(mockConfigService.get<number>('number')).toBe(42);
      expect(mockConfigService.get<boolean>('boolean')).toBe(true);
      expect(mockConfigService.get<number[]>('array')).toEqual([1, 2, 3]);
      expect(mockConfigService.get<object>('object')).toEqual({ nested: 'value' });
      expect(mockConfigService.get('null')).toBeNull();
      expect(mockConfigService.get('undefined')).toBeUndefined();
    });
  });

  describe('has functionality', () => {
    test('should check existence of top-level properties', () => {
      expect(mockConfigService.has('appName')).toBe(true);
      expect(mockConfigService.has('nonExistent')).toBe(false);
    });

    test('should check existence of nested properties', () => {
      mockConfigService.set('metadata.author', 'test-user');

      expect(mockConfigService.has('metadata.author')).toBe(true);
      expect(mockConfigService.has('metadata.nonExistent')).toBe(false);
    });

    test('should return false for properties with undefined values', () => {
      mockConfigService.set('undefinedValue', undefined);

      expect(mockConfigService.has('undefinedValue')).toBe(false);
    });

    test('should return true for properties with null values', () => {
      mockConfigService.set('nullValue', null);

      expect(mockConfigService.has('nullValue')).toBe(true);
    });
  });

  describe('merge functionality', () => {
    test('should merge top-level properties', () => {
      const partial: Partial<AppConfig> = {
        debug: true,
        version: '2.0.0',
      };

      mockConfigService.merge(partial);

      const config = mockConfigService.getConfig();
      expect(config.debug).toBe(true);
      expect(config.version).toBe('2.0.0');
      expect(config.appName).toBe('test-app'); // Should preserve existing
    });

    test('should merge services configuration', () => {
      const serviceConfig: ServiceConfig = {
        enabled: true,
        config: { host: 'localhost' },
        priority: 1,
      };

      mockConfigService.merge({
        services: {
          database: serviceConfig,
        },
      });

      expect(mockConfigService.getServiceConfig('database')).toEqual(serviceConfig);
    });

    test('should merge feature flags', () => {
      mockConfigService.merge({
        featureFlags: {
          newFeature: true,
          experimentalFeature: false,
        },
      });

      expect(mockConfigService.isFeatureEnabled('newFeature')).toBe(true);
      expect(mockConfigService.isFeatureEnabled('experimentalFeature')).toBe(false);
    });

    test('should merge metadata', () => {
      mockConfigService.merge({
        metadata: {
          author: 'test-user',
          timestamp: Date.now(),
        },
      });

      expect(mockConfigService.get<string>('metadata.author')).toBe('test-user');
      expect(mockConfigService.get<number>('metadata.timestamp')).toBeTypeOf('number');
    });

    test('should preserve existing nested properties when merging', () => {
      // Set initial nested data
      mockConfigService.setServiceConfig('service1', { enabled: true, priority: 1 });
      mockConfigService.setFeatureFlag('flag1', true);
      mockConfigService.set('metadata.original', 'value');

      // Merge new data
      mockConfigService.merge({
        services: {
          service2: { enabled: false },
        },
        featureFlags: {
          flag2: false,
        },
        metadata: {
          added: 'new-value',
        },
      });

      // Check that original data is preserved
      expect(mockConfigService.getServiceConfig('service1')).toEqual({ enabled: true, priority: 1 });
      expect(mockConfigService.isFeatureEnabled('flag1')).toBe(true);
      expect(mockConfigService.get<string>('metadata.original')).toBe('value');

      // Check that new data is added
      expect(mockConfigService.getServiceConfig('service2')).toEqual({ enabled: false });
      expect(mockConfigService.isFeatureEnabled('flag2')).toBe(false);
      expect(mockConfigService.get<string>('metadata.added')).toBe('new-value');
    });

    test('should notify watchers on merge', () => {
      const watcher = mock(() => {});
      mockConfigService.watch(watcher);

      mockConfigService.merge({ debug: true });

      expect(watcher).toHaveBeenCalledWith(
        expect.objectContaining({ debug: true })
      );
    });
  });

  describe('validation functionality', () => {
    test('should validate valid config', () => {
      const validConfig: AppConfig = {
        appName: 'test',
        version: '1.0.0',
        environment: 'test',
        debug: false,
        featureFlags: {},
        services: {},
        metadata: {},
      };

      expect(mockConfigService.validate(validConfig)).toBe(true);
    });

    test('should reject null config', () => {
      expect(mockConfigService.validate(null as any)).toBe(false);
    });

    test('should reject non-object config', () => {
      expect(mockConfigService.validate('string' as any)).toBe(false);
      expect(mockConfigService.validate(42 as any)).toBe(false);
      expect(mockConfigService.validate([] as any)).toBe(false);
    });

    test('should reject config missing required fields', () => {
      expect(mockConfigService.validate({} as any)).toBe(false);
      expect(mockConfigService.validate({ appName: 'test' } as any)).toBe(false);
      expect(mockConfigService.validate({ appName: 'test', version: '1.0.0' } as any)).toBe(false);
    });

    test('should fail validation when configured', () => {
      const validConfig: AppConfig = {
        appName: 'test',
        version: '1.0.0',
        environment: 'test',
        debug: false,
        featureFlags: {},
        services: {},
        metadata: {},
      };

      mockConfigService.failNextCall('validate');

      expect(mockConfigService.validate(validConfig)).toBe(false);
      expect(mockConfigService.shouldFailNext).toBeNull();
    });
  });

  describe('environment functionality', () => {
    test('should get current environment', () => {
      expect(mockConfigService.getEnvironment()).toBe('test');
    });

    test('should get updated environment after config change', () => {
      mockConfigService.setConfig({ environment: 'production' });

      expect(mockConfigService.getEnvironment()).toBe('production');
    });

    test('should handle all valid environments', () => {
      const environments: Array<'development' | 'test' | 'production'> = [
        'development',
        'test',
        'production',
      ];

      for (const env of environments) {
        mockConfigService.setConfig({ environment: env });
        expect(mockConfigService.getEnvironment()).toBe(env);
      }
    });
  });

  describe('feature flags functionality', () => {
    test('should check feature flags', () => {
      mockConfigService.setFeatureFlag('enabled-feature', true);
      mockConfigService.setFeatureFlag('disabled-feature', false);

      expect(mockConfigService.isFeatureEnabled('enabled-feature')).toBe(true);
      expect(mockConfigService.isFeatureEnabled('disabled-feature')).toBe(false);
    });

    test('should return false for non-existent feature flags', () => {
      expect(mockConfigService.isFeatureEnabled('non-existent')).toBe(false);
    });

    test('should handle non-boolean feature flag values', () => {
      mockConfigService.setConfig({
        featureFlags: {
          stringFlag: 'enabled',
          numberFlag: 'disabled', // Must be string or boolean
          objectFlag: 'enabled', // Must be string or boolean
        },
      });

      expect(mockConfigService.isFeatureEnabled('stringFlag')).toBe(false);
      expect(mockConfigService.isFeatureEnabled('numberFlag')).toBe(false);
      expect(mockConfigService.isFeatureEnabled('objectFlag')).toBe(false);
    });

    test('should handle missing featureFlags object', () => {
      mockConfigService.setConfig({ featureFlags: undefined });

      expect(mockConfigService.isFeatureEnabled('any-feature')).toBe(false);
    });
  });

  describe('service configuration functionality', () => {
    test('should get service configuration', () => {
      const serviceConfig: ServiceConfig = {
        enabled: true,
        config: { host: 'localhost', port: 3000 },
        dependencies: ['database'],
        priority: 10,
      };

      mockConfigService.setServiceConfig('api', serviceConfig);

      expect(mockConfigService.getServiceConfig('api')).toEqual(serviceConfig);
    });

    test('should return undefined for non-existent service', () => {
      expect(mockConfigService.getServiceConfig('non-existent')).toBeUndefined();
    });

    test('should handle missing services object', () => {
      mockConfigService.setConfig({ services: undefined });

      expect(mockConfigService.getServiceConfig('any-service')).toBeUndefined();
    });

    test('should set service configuration', () => {
      const serviceConfig: ServiceConfig = {
        enabled: false,
        config: { timeout: 5000 },
      };

      mockConfigService.setServiceConfig('timeout-service', serviceConfig);

      expect(mockConfigService.getServiceConfig('timeout-service')).toEqual(serviceConfig);
      expect(mockConfigService.getConfig().services?.['timeout-service']).toEqual(serviceConfig);
    });

    test('should initialize services object if it does not exist', () => {
      mockConfigService.setConfig({ services: undefined });

      const serviceConfig: ServiceConfig = { enabled: true };
      mockConfigService.setServiceConfig('new-service', serviceConfig);

      expect(mockConfigService.getServiceConfig('new-service')).toEqual(serviceConfig);
    });
  });

  describe('reload functionality', () => {
    test('should reload successfully', async () => {
      const watcher = mock(() => {});
      mockConfigService.watch(watcher);

      await mockConfigService.reload();

      expect(mockConfigService.wasCalled('reload')).toBe(true);
      expect(watcher).toHaveBeenCalled();
    });

    test('should fail reload when configured', async () => {
      mockConfigService.failNextCall('reload');

      await expect(mockConfigService.reload()).rejects.toThrow('Mock error: reload failed');
      expect(mockConfigService.shouldFailNext).toBeNull();
    });
  });

  describe('watcher functionality', () => {
    test('should add and notify watchers', () => {
      const watcher1 = mock(() => {});
      const watcher2 = mock(() => {});

      mockConfigService.watch(watcher1);
      mockConfigService.watch(watcher2);

      mockConfigService.set('debug', true);

      expect(watcher1).toHaveBeenCalledWith(
        expect.objectContaining({ debug: true })
      );
      expect(watcher2).toHaveBeenCalledWith(
        expect.objectContaining({ debug: true })
      );
      expect(mockConfigService.getWatcherCount()).toBe(2);
    });

    test('should remove watchers', () => {
      const watcher1 = mock(() => {});
      const watcher2 = mock(() => {});

      mockConfigService.watch(watcher1);
      mockConfigService.watch(watcher2);
      mockConfigService.unwatch(watcher1);

      mockConfigService.set('debug', true);

      expect(watcher1).not.toHaveBeenCalled();
      expect(watcher2).toHaveBeenCalled();
      expect(mockConfigService.getWatcherCount()).toBe(1);
    });

    test('should handle watcher errors gracefully', () => {
      const errorWatcher = mock(() => {
        throw new Error('Watcher error');
      });
      const normalWatcher = mock(() => {});

      mockConfigService.watch(errorWatcher);
      mockConfigService.watch(normalWatcher);

      // Should not throw error
      expect(() => mockConfigService.set('debug', true)).not.toThrow();

      expect(errorWatcher).toHaveBeenCalled();
      expect(normalWatcher).toHaveBeenCalled();
    });

    test('should trigger watchers manually', () => {
      const watcher = mock(() => {});
      mockConfigService.watch(watcher);

      mockConfigService.triggerWatchers();

      expect(watcher).toHaveBeenCalledWith(mockConfigService.getConfig());
    });

    test('should provide immutable config copies to watchers', () => {
      let receivedConfig: AppConfig | null = null;
      const watcher = (config: AppConfig) => {
        receivedConfig = config;
      };

      mockConfigService.watch(watcher);
      mockConfigService.set('debug', true);

      expect(receivedConfig).not.toBeNull();
      expect(receivedConfig).not.toBe(mockConfigService.getConfig()); // Should be different reference

      // Modifying received config should not affect the original
      if (receivedConfig) {
        (receivedConfig as AppConfig).appName = 'modified';
        expect(mockConfigService.get<string>('appName')).toBe('test-app');
      }
    });
  });

  describe('test utility functions', () => {
    test('should set config with setConfig', () => {
      const newConfig: Partial<AppConfig> = {
        appName: 'new-app',
        debug: true,
        metadata: { test: 'value' },
      };

      mockConfigService.setConfig(newConfig);

      const config = mockConfigService.getConfig();
      expect(config.appName).toBe('new-app');
      expect(config.debug).toBe(true);
      expect(config.metadata?.test).toBe('value');
    });

    test('should get immutable config copy with getConfig', () => {
      const config1 = mockConfigService.getConfig();
      const config2 = mockConfigService.getConfig();

      expect(config1).toEqual(config2);
      expect(config1).not.toBe(config2); // Should be different references

      config1.appName = 'modified';
      expect(config2.appName).toBe('test-app');
      expect(mockConfigService.get<string>('appName')).toBe('test-app');
    });

    test('should set feature flags with setFeatureFlag', () => {
      mockConfigService.setFeatureFlag('newFeature', true);

      expect(mockConfigService.isFeatureEnabled('newFeature')).toBe(true);
      expect(mockConfigService.get<boolean>('featureFlags.newFeature')).toBe(true);
    });

    test('should initialize featureFlags if it does not exist', () => {
      mockConfigService.setConfig({ featureFlags: undefined });
      mockConfigService.setFeatureFlag('testFeature', true);

      expect(mockConfigService.isFeatureEnabled('testFeature')).toBe(true);
    });

    test('should track call count accurately', () => {
      mockConfigService.get('appName');
      mockConfigService.get('version');
      mockConfigService.get('debug');

      expect(mockConfigService.getCallCount('get')).toBe(3);
      expect(mockConfigService.getCallCount('set')).toBe(0);
    });

    test('should handle calls to methods that were never called', () => {
      expect(mockConfigService.wasCalled('unknownMethod')).toBe(false);
      expect(mockConfigService.getCallCount('unknownMethod')).toBe(0);
    });

    test('should track method call arguments', () => {
      mockConfigService.get('appName');
      mockConfigService.set('debug', true);

      const getCalls = mockConfigService.methodCalls.get('get');
      const setCalls = mockConfigService.methodCalls.get('set');

      expect(getCalls).toEqual([['appName']]);
      expect(setCalls).toEqual([['debug', true]]);
    });
  });

  describe('edge cases and error handling', () => {
    test('should handle empty key in get/set/has operations', () => {
      expect(mockConfigService.get('')).toBeUndefined();
      expect(mockConfigService.has('')).toBe(false);

      mockConfigService.set('', 'value');
      expect(mockConfigService.get<string>('')).toBe('value');
    });

    test('should handle single character keys', () => {
      mockConfigService.set('a', 'value');

      expect(mockConfigService.get<string>('a')).toBe('value');
      expect(mockConfigService.has('a')).toBe(true);
    });

    test('should handle keys with special characters', () => {
      mockConfigService.set('key-with-dashes', 'value1');
      mockConfigService.set('key_with_underscores', 'value2');
      mockConfigService.set('key with spaces', 'value3');

      expect(mockConfigService.get<string>('key-with-dashes')).toBe('value1');
      expect(mockConfigService.get<string>('key_with_underscores')).toBe('value2');
      expect(mockConfigService.get<string>('key with spaces')).toBe('value3');
    });

    test('should handle deeply nested key paths', () => {
      const deepPath = 'level1.level2.level3.level4.level5';
      mockConfigService.set(deepPath, 'deep-value');

      expect(mockConfigService.get<string>(deepPath)).toBe('deep-value');
      expect(mockConfigService.has(deepPath)).toBe(true);
    });

    test('should handle multiple failure flags correctly', async () => {
      mockConfigService.failNextCall('load');
      mockConfigService.failNextCall('save'); // Should override

      expect(mockConfigService.shouldFailNext).toBe('save');

      // First method should succeed
      expect(async () => await mockConfigService.load()).not.toThrow();

      // Second method should fail
      await expect(mockConfigService.save(defaultConfig)).rejects.toThrow();
    });

    test('should handle concurrent watcher notifications', () => {
      const results: string[] = [];
      const watcher1 = () => results.push('watcher1');
      const watcher2 = () => results.push('watcher2');
      const watcher3 = () => results.push('watcher3');

      mockConfigService.watch(watcher1);
      mockConfigService.watch(watcher2);
      mockConfigService.watch(watcher3);

      mockConfigService.set('test', 'value');

      expect(results).toEqual(['watcher1', 'watcher2', 'watcher3']);
    });
  });
});
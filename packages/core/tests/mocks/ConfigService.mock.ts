import type {
  IConfigService,
  AppConfig,
  ServiceConfig,
} from '../../src/interfaces/IConfigService';

export class MockConfigService implements IConfigService {
  private config: AppConfig = {
    appName: 'test-app',
    version: '1.0.0',
    environment: 'test',
    debug: false,
    featureFlags: {},
    services: {},
    metadata: {},
  };

  private watchers: Set<(config: AppConfig) => void> = new Set();

  // Spy tracking
  public methodCalls: Map<string, unknown[]> = new Map();
  public shouldFailNext: string | null = null;
  public loadHistory: string[] = [];
  public saveHistory: AppConfig[] = [];

  async load(configPath?: string): Promise<AppConfig> {
    this.trackCall('load', configPath);
    this.loadHistory.push(configPath ?? 'default');

    if (this.shouldFailNext === 'load') {
      this.shouldFailNext = null;
      throw new Error('Mock error: load failed');
    }

    return { ...this.config };
  }

  async save(config: AppConfig, configPath?: string): Promise<void> {
    this.trackCall('save', config, configPath);
    this.saveHistory.push({ ...config });

    if (this.shouldFailNext === 'save') {
      this.shouldFailNext = null;
      throw new Error('Mock error: save failed');
    }

    this.config = { ...config };
    this.notifyWatchers();
  }

  get<T = unknown>(key: string): T | undefined {
    this.trackCall('get', key);

    const keys = key.split('.');
    let current: unknown = this.config;

    for (const k of keys) {
      if (
        current !== null &&
        current !== undefined &&
        typeof current === 'object' &&
        k in current
      ) {
        current = (current as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }

    return current as T;
  }

  set(key: string, value: unknown): void {
    this.trackCall('set', key, value);

    const keys = key.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<
      string,
      unknown
    >;

    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (!(k in current) || typeof current[k] !== 'object') {
        current[k] = {};
      }
      current = current[k] as Record<string, unknown>;
    }

    current[keys[keys.length - 1]] = value;
    this.notifyWatchers();
  }

  has(key: string): boolean {
    this.trackCall('has', key);
    return this.get(key) !== undefined;
  }

  merge(partial: Partial<AppConfig>): void {
    this.trackCall('merge', partial);

    this.config = {
      ...this.config,
      ...partial,
      services: {
        ...this.config.services,
        ...partial.services,
      },
      featureFlags: {
        ...this.config.featureFlags,
        ...partial.featureFlags,
      },
      metadata: {
        ...this.config.metadata,
        ...partial.metadata,
      },
    };

    this.notifyWatchers();
  }

  validate(config: AppConfig): boolean {
    this.trackCall('validate', config);

    if (this.shouldFailNext === 'validate') {
      this.shouldFailNext = null;
      return false;
    }

    return (
      config !== null &&
      typeof config === 'object' &&
      'appName' in config &&
      'version' in config &&
      'environment' in config
    );
  }

  getEnvironment(): 'development' | 'test' | 'production' {
    this.trackCall('getEnvironment');
    return this.config.environment;
  }

  isFeatureEnabled(feature: string): boolean {
    this.trackCall('isFeatureEnabled', feature);
    const value = this.config.featureFlags?.[feature];
    return typeof value === 'boolean' ? value : false;
  }

  getServiceConfig(serviceName: string): ServiceConfig | undefined {
    this.trackCall('getServiceConfig', serviceName);
    return this.config.services?.[serviceName];
  }

  async reload(): Promise<void> {
    this.trackCall('reload');

    if (this.shouldFailNext === 'reload') {
      this.shouldFailNext = null;
      throw new Error('Mock error: reload failed');
    }

    // Simulate reload by notifying watchers
    this.notifyWatchers();
  }

  watch(onChange: (config: AppConfig) => void): void {
    this.trackCall('watch');
    this.watchers.add(onChange);
  }

  unwatch(onChange: (config: AppConfig) => void): void {
    this.trackCall('unwatch');
    this.watchers.delete(onChange);
  }

  // Test utilities
  setConfig(config: Partial<AppConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  getConfig(): AppConfig {
    return { ...this.config };
  }

  setFeatureFlag(feature: string, enabled: boolean): void {
    this.config.featureFlags ??= {};
    this.config.featureFlags[feature] = enabled;
  }

  setServiceConfig(serviceName: string, config: ServiceConfig): void {
    this.config.services ??= {};
    this.config.services[serviceName] = config;
  }

  failNextCall(methodName: string): void {
    this.shouldFailNext = methodName;
  }

  clearHistory(): void {
    this.methodCalls.clear();
    this.loadHistory = [];
    this.saveHistory = [];
  }

  getCallCount(methodName: string): number {
    return this.methodCalls.get(methodName)?.length ?? 0;
  }

  wasCalled(methodName: string): boolean {
    return this.getCallCount(methodName) > 0;
  }

  getWatcherCount(): number {
    return this.watchers.size;
  }

  triggerWatchers(): void {
    this.notifyWatchers();
  }

  private trackCall(methodName: string, ...args: unknown[]): void {
    if (!this.methodCalls.has(methodName)) {
      this.methodCalls.set(methodName, []);
    }
    this.methodCalls.get(methodName)?.push(args);
  }

  private notifyWatchers(): void {
    for (const watcher of this.watchers) {
      try {
        watcher({ ...this.config });
      } catch (_error) {
        // Swallow errors in test watchers
      }
    }
  }
}

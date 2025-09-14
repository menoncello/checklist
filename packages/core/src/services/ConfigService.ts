import * as path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type {
  IConfigService,
  AppConfig,
  ServiceConfig,
} from '../interfaces/IConfigService';
import type { IFileSystemService } from '../interfaces/IFileSystemService';
import type { Logger } from '../utils/logger';
import { BaseService, ServiceConfig as BaseServiceConfig } from './BaseService';

export interface ConfigServiceConfig extends BaseServiceConfig {
  configPath?: string;
  watchInterval?: number;
  autoReload?: boolean;
}

export class ConfigService extends BaseService implements IConfigService {
  private appConfig: AppConfig | null = null;
  private configPath: string = '.checklist/config.yaml';
  private fileSystemService: IFileSystemService;
  private watchers: Set<(config: AppConfig) => void> = new Set();
  private watcherCleanup?: () => void;

  constructor(
    config: ConfigServiceConfig,
    logger: Logger,
    fileSystemService: IFileSystemService
  ) {
    super(config, logger);
    this.fileSystemService = fileSystemService;

    if (config.configPath !== undefined && config.configPath !== '') {
      this.configPath = config.configPath;
    }
  }

  async load(configPath?: string): Promise<AppConfig> {
    try {
      const pathToLoad = configPath ?? this.configPath;
      await this.loadConfigFromPath(pathToLoad);
      this.validateLoadedConfig();
      this.setupAutoReloadIfEnabled();
      this.logConfigLoaded(pathToLoad);
      if (!this.appConfig) {
        throw new Error('Configuration not loaded');
      }
      return this.appConfig;
    } catch (error) {
      this.logConfigLoadError(error, configPath);
      throw error;
    }
  }

  private async loadConfigFromPath(pathToLoad: string): Promise<void> {
    if (await this.fileSystemService.exists(pathToLoad)) {
      const content = await this.fileSystemService.readFile(pathToLoad, {
        encoding: 'utf8',
      });
      this.appConfig = yamlLoad(content) as AppConfig;
    } else {
      this.appConfig = this.createDefaultConfig();
      await this.save(this.appConfig, pathToLoad);
    }
  }

  private validateLoadedConfig(): void {
    if (!this.appConfig || !this.validate(this.appConfig)) {
      throw new Error('Config validation failed');
    }
  }

  private setupAutoReloadIfEnabled(): void {
    const serviceConfig = this.config as ConfigServiceConfig;
    if (serviceConfig.autoReload === true) {
      this.setupFileWatcher();
    }
  }

  private logConfigLoaded(pathToLoad: string): void {
    this.logger.info({
      msg: 'Configuration loaded',
      configPath: pathToLoad,
      environment: this.appConfig?.environment ?? 'unknown',
    });
  }

  private logConfigLoadError(error: unknown, configPath?: string): void {
    this.logger.error({
      msg: 'Failed to load configuration',
      error: (error as Error).message,
      configPath: configPath ?? this.configPath,
    });
  }

  async save(config: AppConfig, configPath?: string): Promise<void> {
    try {
      if (!this.validate(config)) {
        throw new Error('Config validation failed before save');
      }

      const pathToSave = configPath ?? this.configPath;
      const dir = path.dirname(pathToSave);

      await this.fileSystemService.ensureDirectory(dir);

      const yamlContent = yamlDump(config, { indent: 2 });
      await this.fileSystemService.writeFile(pathToSave, yamlContent);

      this.appConfig = config;

      this.logger.debug({
        msg: 'Configuration saved',
        configPath: pathToSave,
      });

      // Notify watchers
      this.notifyWatchers(config);
    } catch (error) {
      this.logger.error({
        msg: 'Failed to save configuration',
        error: (error as Error).message,
        configPath: configPath ?? this.configPath,
      });
      throw error;
    }
  }

  get<T = unknown>(key: string): T | undefined {
    if (!this.appConfig) {
      return undefined;
    }

    const keys = key.split('.');
    let current: unknown = this.appConfig as unknown;

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
    if (!this.appConfig) {
      throw new Error('Configuration not loaded');
    }

    const keys = key.split('.');
    let current: Record<string, unknown> = this.appConfig as unknown as Record<
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

    this.logger.debug({
      msg: 'Configuration value set',
      key,
      value,
    });
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  merge(partial: Partial<AppConfig>): void {
    if (!this.appConfig) {
      throw new Error('Configuration not loaded');
    }

    this.appConfig = {
      ...this.appConfig,
      ...partial,
      services: {
        ...this.appConfig.services,
        ...partial.services,
      },
      featureFlags: {
        ...this.appConfig.featureFlags,
        ...partial.featureFlags,
      },
      metadata: {
        ...this.appConfig.metadata,
        ...partial.metadata,
      },
    };

    this.logger.debug({
      msg: 'Configuration merged',
      partial,
    });

    // Notify watchers
    this.notifyWatchers(this.appConfig);
  }

  validate(config: AppConfig): boolean {
    try {
      return (
        this.validateRequiredFields(config) &&
        this.validateOptionalFields(config)
      );
    } catch {
      return false;
    }
  }

  private validateRequiredFields(config: AppConfig): boolean {
    if (!config.appName || typeof config.appName !== 'string') {
      return false;
    }

    if (!config.version || typeof config.version !== 'string') {
      return false;
    }

    const validEnvironments = ['development', 'test', 'production'] as const;
    if (!validEnvironments.includes(config.environment)) {
      return false;
    }

    return typeof config.debug === 'boolean';
  }

  private validateOptionalFields(config: AppConfig): boolean {
    if (config.services !== undefined && typeof config.services !== 'object') {
      return false;
    }

    if (config.featureFlags !== undefined && typeof config.featureFlags !== 'object') {
      return false;
    }

    return true;
  }

  getEnvironment(): 'development' | 'test' | 'production' {
    if (!this.appConfig) {
      throw new Error('Configuration not loaded');
    }
    return this.appConfig.environment;
  }

  isFeatureEnabled(feature: string): boolean {
    if (!this.appConfig?.featureFlags) {
      return false;
    }
    const value = this.appConfig.featureFlags[feature];
    return typeof value === 'boolean' ? value : false;
  }

  getServiceConfig(serviceName: string): ServiceConfig | undefined {
    if (!this.appConfig?.services) {
      return undefined;
    }
    return this.appConfig.services[serviceName];
  }

  async reload(): Promise<void> {
    try {
      await this.load(this.configPath);

      this.logger.info({ msg: 'Configuration reloaded' });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to reload configuration',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  watch(onChange: (config: AppConfig) => void): void {
    this.watchers.add(onChange);

    this.logger.debug({
      msg: 'Configuration watcher added',
      totalWatchers: this.watchers.size,
    });
  }

  unwatch(onChange: (config: AppConfig) => void): void {
    this.watchers.delete(onChange);

    this.logger.debug({
      msg: 'Configuration watcher removed',
      totalWatchers: this.watchers.size,
    });
  }

  protected async onInitialize(): Promise<void> {
    await this.load();
  }

  protected async onShutdown(): Promise<void> {
    if (this.watcherCleanup) {
      this.watcherCleanup();
      this.watcherCleanup = undefined;
    }
    this.watchers.clear();
  }

  private createDefaultConfig(): AppConfig {
    return {
      appName: 'checklist',
      version: '1.0.0',
      environment: 'development',
      debug: false,
      workingDirectory: '.checklist',
      featureFlags: {
        DI_ENABLED: 'partial',
        DI_LOGGER_ENABLED: false,
      },
      services: {},
      metadata: {
        createdAt: new Date().toISOString(),
      },
    };
  }

  private setupFileWatcher(): void {
    if (this.watcherCleanup) {
      this.watcherCleanup();
    }

    try {
      this.watcherCleanup = this.fileSystemService.watch(
        this.configPath,
        async (event) => {
          if (event === 'change') {
            this.logger.debug({ msg: 'Configuration file changed, reloading' });
            await this.reload();
          }
        },
        { persistent: true }
      );
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to set up configuration file watcher',
        error: (error as Error).message,
      });
    }
  }

  private notifyWatchers(config: AppConfig): void {
    for (const watcher of this.watchers) {
      try {
        watcher(config);
      } catch (error) {
        this.logger.error({
          msg: 'Error in configuration watcher',
          error: (error as Error).message,
        });
      }
    }
  }
}

import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type {
  IConfigService,
  AppConfig,
  ServiceConfig,
} from '../interfaces/IConfigService';
import type { IFileSystemService } from '../interfaces/IFileSystemService';
import type { Logger } from '../utils/logger';
import { BaseService, ServiceConfig as BaseServiceConfig } from './BaseService';
import { ConfigDefaults } from './ConfigDefaults';
import { ConfigValidator } from './ConfigValidator';
import { ConfigWatcher } from './ConfigWatcher';

export interface ConfigServiceConfig extends BaseServiceConfig {
  configPath?: string;
  watchInterval?: number;
  autoReload?: boolean;
}

export class ConfigService extends BaseService implements IConfigService {
  private appConfig: AppConfig | null = null;
  private configPath: string = '.checklist/config.yaml';
  private fileSystemService: IFileSystemService;
  private validator: ConfigValidator;
  private watcher: ConfigWatcher;
  private configWatchers: Set<(config: AppConfig) => void> = new Set();

  constructor(
    config: ConfigServiceConfig,
    logger: Logger,
    fileSystemService: IFileSystemService
  ) {
    super(config, logger);
    this.fileSystemService = fileSystemService;
    this.validator = new ConfigValidator(logger);
    this.watcher = new ConfigWatcher(fileSystemService, logger);

    if (config.configPath !== undefined && config.configPath !== '') {
      this.configPath = config.configPath;
    }
  }

  async load(configPath?: string): Promise<AppConfig> {
    try {
      const pathToLoad = configPath ?? this.configPath;
      await this.loadConfigFromPath(pathToLoad);

      if (!this.appConfig) {
        throw new Error('Configuration not loaded');
      }

      if (!this.validator.validate(this.appConfig)) {
        throw new Error('Configuration validation failed');
      }

      this.setupAutoReloadIfEnabled();
      this.logConfigLoaded(pathToLoad);

      return this.appConfig;
    } catch (error) {
      this.logConfigLoadError(error, configPath);
      this.appConfig = ConfigDefaults.createDefault();
      return this.appConfig;
    }
  }

  private async loadConfigFromPath(pathToLoad: string): Promise<void> {
    const exists = await this.fileSystemService.exists(pathToLoad);

    if (!exists) {
      this.logger.info({
        msg: 'Config file not found, creating default',
        path: pathToLoad,
      });
      this.appConfig = ConfigDefaults.createDefault();
      await this.save(this.appConfig, pathToLoad);
    } else {
      const configContent = await this.fileSystemService.readFile(pathToLoad);
      this.appConfig = yamlLoad(configContent) as AppConfig;
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
      path: pathToLoad,
      config: this.appConfig,
    });
  }

  private logConfigLoadError(error: unknown, configPath?: string): void {
    this.logger.error({
      msg: 'Failed to load configuration',
      path: configPath ?? this.configPath,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  async save(config: AppConfig, configPath?: string): Promise<void> {
    try {
      const pathToSave = configPath ?? this.configPath;

      if (!this.validator.validate(config)) {
        throw new Error('Invalid configuration');
      }

      const configYaml = yamlDump(config, { indent: 2, lineWidth: 120 });
      await this.fileSystemService.writeFile(pathToSave, configYaml);

      this.appConfig = config;
      this.notifyWatchers(config);

      this.logger.info({
        msg: 'Configuration saved',
        path: pathToSave,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to save configuration',
        path: configPath ?? this.configPath,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  get<T = unknown>(key: string): T | undefined {
    if (!this.appConfig) return undefined;

    const keys = key.split('.');
    let value: unknown = this.appConfig;

    for (const k of keys) {
      if (value != null && typeof value === 'object' && k in value) {
        value = (value as Record<string, unknown>)[k];
      } else {
        return undefined;
      }
    }

    return value as T;
  }

  set(key: string, value: unknown): void {
    if (!this.appConfig) {
      throw new Error('Configuration not loaded');
    }

    const keys = key.split('.');
    const lastKey = keys.pop();
    if (lastKey == null || lastKey === '') return;

    let target: Record<string, unknown> = this.appConfig as unknown as Record<
      string,
      unknown
    >;

    for (const k of keys) {
      if (!(k in target) || typeof target[k] !== 'object') {
        target[k] = {};
      }
      target = target[k] as Record<string, unknown>;
    }

    target[lastKey] = value;
    this.notifyWatchers(this.appConfig);
  }

  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  merge(partial: Partial<AppConfig>): void {
    if (!this.appConfig) {
      throw new Error('Configuration not loaded');
    }

    this.appConfig = { ...this.appConfig, ...partial };
    this.notifyWatchers(this.appConfig);
  }

  validate(config?: AppConfig): boolean {
    const configToValidate = config ?? this.appConfig;

    if (!configToValidate) {
      this.logger.error({ msg: 'No configuration to validate' });
      return false;
    }

    return this.validator.validate(configToValidate);
  }

  reset(): void {
    this.appConfig = ConfigDefaults.createDefault();
    this.notifyWatchers(this.appConfig);

    this.logger.info({ msg: 'Configuration reset to defaults' });
  }

  getDefault(): AppConfig {
    return ConfigDefaults.createDefault();
  }

  watch(callback: (config: AppConfig) => void): void {
    this.configWatchers.add(callback);
  }

  unwatch(callback: (config: AppConfig) => void): void {
    this.configWatchers.delete(callback);
  }

  getEnvironment(): 'development' | 'test' | 'production' {
    return this.appConfig?.environment ?? 'development';
  }

  isFeatureEnabled(feature: string): boolean {
    if (!this.appConfig?.featureFlags) return false;
    const flag = this.appConfig.featureFlags[feature];
    return flag === true || flag === 'true' || flag === 'enabled';
  }

  getServiceConfig(serviceName: string): ServiceConfig | undefined {
    if (!this.appConfig?.services) return undefined;
    return this.appConfig.services[serviceName];
  }

  async reload(): Promise<void> {
    this.logger.info({ msg: 'Reloading configuration' });

    try {
      const previousConfig = this.appConfig;
      await this.load();

      if (JSON.stringify(previousConfig) !== JSON.stringify(this.appConfig)) {
        this.logger.info({ msg: 'Configuration changed after reload' });
        if (this.appConfig) {
          this.notifyWatchers(this.appConfig);
        }
      } else {
        this.logger.debug({ msg: 'Configuration unchanged after reload' });
      }
    } catch (error) {
      this.logger.error({
        msg: 'Failed to reload configuration',
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  }

  getService(serviceName: keyof AppConfig['services']): ServiceConfig | null {
    if (!this.appConfig?.services) return null;
    return this.appConfig.services[serviceName] ?? null;
  }

  setService(
    serviceName: keyof AppConfig['services'],
    config: ServiceConfig
  ): void {
    if (!this.appConfig) {
      throw new Error('Configuration not loaded');
    }

    this.appConfig.services ??= {};

    this.appConfig.services[serviceName] = config;
    this.notifyWatchers(this.appConfig);
  }

  protected async onInitialize(): Promise<void> {
    await this.load();
  }

  protected async onShutdown(): Promise<void> {
    this.watcher.stopWatch();
    this.configWatchers.clear();

    if (this.appConfig) {
      await this.save(this.appConfig);
    }
  }

  private setupFileWatcher(): void {
    this.watcher
      .setupWatch(this.configPath, async (content) => {
        try {
          const newConfig = yamlLoad(content) as AppConfig;

          if (this.validator.validate(newConfig)) {
            this.appConfig = newConfig;
            this.notifyWatchers(newConfig);

            this.logger.info({
              msg: 'Configuration auto-reloaded',
              path: this.configPath,
            });
          }
        } catch (error) {
          this.logger.error({
            msg: 'Failed to auto-reload configuration',
            error: error instanceof Error ? error.message : String(error),
          });
        }
      })
      .catch((error) => {
        this.logger.error({
          msg: 'Failed to setup file watcher',
          error: error instanceof Error ? error.message : String(error),
        });
      });
  }

  private notifyWatchers(config: AppConfig): void {
    this.configWatchers.forEach((watcher) => {
      try {
        watcher(config);
      } catch (error) {
        this.logger.error({
          msg: 'Error in config watcher callback',
          error: error instanceof Error ? error.message : String(error),
        });
      }
    });
  }
}

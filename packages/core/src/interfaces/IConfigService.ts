export interface AppConfig {
  appName: string;
  version: string;
  environment: 'development' | 'test' | 'production';
  debug: boolean;
  workingDirectory?: string;
  featureFlags?: Record<string, boolean | string>;
  services?: Record<string, ServiceConfig>;
  metadata?: Record<string, unknown>;
}

export interface ServiceConfig {
  enabled: boolean;
  config?: Record<string, unknown>;
  dependencies?: string[];
  priority?: number;
}

export interface IConfigService {
  load(configPath?: string): Promise<AppConfig>;
  save(config: AppConfig, configPath?: string): Promise<void>;
  get<T = unknown>(key: string): T | undefined;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  merge(partial: Partial<AppConfig>): void;
  validate(config: AppConfig): boolean;
  getEnvironment(): 'development' | 'test' | 'production';
  isFeatureEnabled(feature: string): boolean;
  getServiceConfig(serviceName: string): ServiceConfig | undefined;
  reload(): Promise<void>;
  watch(onChange: (config: AppConfig) => void): void;
  unwatch(onChange: (config: AppConfig) => void): void;
}

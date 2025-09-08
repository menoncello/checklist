import type { Logger } from '../utils/logger';

export interface ServiceConfig {
  name: string;
  version?: string;
  [key: string]: unknown;
}

export abstract class BaseService {
  protected logger: Logger;
  protected config: ServiceConfig;

  constructor(config: ServiceConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }

  async initialize(): Promise<void> {
    this.logger.debug({
      msg: `Initializing ${this.constructor.name}`,
      config: this.config,
    });
    await this.onInitialize();
    this.logger.info({
      msg: `${this.constructor.name} initialized successfully`,
    });
  }

  async shutdown(): Promise<void> {
    this.logger.debug({
      msg: `Shutting down ${this.constructor.name}`,
    });
    await this.onShutdown();
    this.logger.info({
      msg: `${this.constructor.name} shut down successfully`,
    });
  }

  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;

  protected getChildLogger(namespace: string): Logger {
    return this.logger.child({
      service: this.config.name,
      namespace,
    });
  }
}

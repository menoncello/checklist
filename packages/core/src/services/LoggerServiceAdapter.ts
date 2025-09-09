import type {
  ILogger,
  LogContext,
  ChildLoggerOptions,
} from '../interfaces/ILogger';
import { LoggerService } from '../utils/logger';

/**
 * Adapter to make the existing LoggerService compatible with ILogger interface
 * This preserves backward compatibility while enabling dependency injection
 */
export class LoggerServiceAdapter implements ILogger {
  private static instance: LoggerServiceAdapter | null = null;
  private logger: ILogger;

  private constructor(private loggerService: LoggerService) {
    this.logger = loggerService.createLogger('DI');
  }

  /**
   * Create adapter from existing singleton (backward compatibility)
   */
  static fromSingleton(): LoggerServiceAdapter {
    LoggerServiceAdapter.instance ??= new LoggerServiceAdapter(
      LoggerService.getInstance()
    );
    return LoggerServiceAdapter.instance;
  }

  /**
   * Create new adapter instance (for DI)
   */
  static create(loggerService: LoggerService): LoggerServiceAdapter {
    return new LoggerServiceAdapter(loggerService);
  }

  debug(context: LogContext): void {
    this.logger.debug(context);
  }

  info(context: LogContext): void {
    this.logger.info(context);
  }

  warn(context: LogContext): void {
    this.logger.warn(context);
  }

  error(context: LogContext): void {
    this.logger.error(context);
  }

  fatal(context: LogContext): void {
    this.logger.fatal(context);
  }

  child(
    bindings: Record<string, unknown>,
    options?: ChildLoggerOptions
  ): ILogger {
    const childLogger = this.logger.child(bindings, options);
    return {
      debug: (context: LogContext) => childLogger.debug(context),
      info: (context: LogContext) => childLogger.info(context),
      warn: (context: LogContext) => childLogger.warn(context),
      error: (context: LogContext) => childLogger.error(context),
      fatal: (context: LogContext) => childLogger.fatal(context),
      child: (b: Record<string, unknown>, o?: ChildLoggerOptions) =>
        this.child(b, o), // Recursive for nested children
    };
  }

  /**
   * Get the underlying LoggerService (for migration purposes)
   */
  getLoggerService(): LoggerService {
    return this.loggerService;
  }
}

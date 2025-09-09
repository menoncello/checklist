import { mkdirSync } from 'fs';
import { join } from 'path';
import pino, {
  Logger as PinoLogger,
  LoggerOptions,
  ChildLoggerOptions,
  TransportTargetOptions,
} from 'pino';

export interface LogContext {
  msg: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(context: LogContext): void;
  info(context: LogContext): void;
  warn(context: LogContext): void;
  error(context: LogContext): void;
  fatal(context: LogContext): void;
  child(
    bindings: Record<string, unknown>,
    options?: ChildLoggerOptions
  ): Logger;
}

export interface LoggerConfig {
  level?: string;
  prettyPrint?: boolean;
  enableFileLogging?: boolean;
  enableRotation?: boolean;
  logDirectory?: string;
  maxFileSize?: string;
  maxFiles?: number;
  maxAge?: string;
  externalTransports?: Array<{
    target: string;
    options?: Record<string, unknown>;
    level?: string;
  }>;
}

class PinoLoggerWrapper implements Logger {
  constructor(private pinoLogger: PinoLogger) {}

  debug(context: LogContext): void {
    this.pinoLogger.debug(context);
  }

  info(context: LogContext): void {
    this.pinoLogger.info(context);
  }

  warn(context: LogContext): void {
    this.pinoLogger.warn(context);
  }

  error(context: LogContext): void {
    this.pinoLogger.error(context);
  }

  fatal(context: LogContext): void {
    this.pinoLogger.fatal(context);
  }

  child(
    bindings: Record<string, unknown>,
    options?: ChildLoggerOptions
  ): Logger {
    return new PinoLoggerWrapper(this.pinoLogger.child(bindings, options));
  }
}

export class LoggerService {
  private static instance: LoggerService;
  private defaultLogger: Logger;
  private config: LoggerConfig;

  private constructor(config: LoggerConfig = {}) {
    this.config = {
      level: Bun.env.LOG_LEVEL ?? 'info',
      prettyPrint: Bun.env.NODE_ENV === 'development',
      enableFileLogging: Bun.env.ENABLE_FILE_LOGGING === 'true',
      enableRotation: Bun.env.ENABLE_LOG_ROTATION === 'true',
      logDirectory: Bun.env.LOG_DIRECTORY ?? '.logs',
      maxFileSize: Bun.env.LOG_MAX_FILE_SIZE ?? '10M',
      maxFiles: parseInt(Bun.env.LOG_MAX_FILES ?? '7', 10),
      maxAge: Bun.env.LOG_MAX_AGE ?? '7d',
      ...config,
    };

    this.defaultLogger = this.createPinoLogger();
  }

  static getInstance(config?: LoggerConfig): LoggerService {
    LoggerService.instance ??= new LoggerService(config);
    return LoggerService.instance;
  }

  private createPinoLogger(): Logger {
    // In test environment, return a silent logger to avoid log output
    if (Bun.env.NODE_ENV === 'test' && this.config.enableFileLogging !== true) {
      const silentOptions: LoggerOptions = {
        level: 'silent',
        base: null,
      };
      const pinoLogger = pino(silentOptions);
      return new PinoLoggerWrapper(pinoLogger);
    }

    // Ensure log directories exist if file logging is enabled
    if (this.config.enableFileLogging === true) {
      const logDirectory = this.config.logDirectory ?? '.logs';
      try {
        mkdirSync(join(logDirectory, 'info'), { recursive: true });
        mkdirSync(join(logDirectory, 'error'), { recursive: true });
        if (Bun.env.NODE_ENV === 'development') {
          mkdirSync(join(logDirectory, 'debug'), { recursive: true });
        }
      } catch (_error) {
        // If directory creation fails, disable file logging silently
        this.config.enableFileLogging = false;
        // Bootstrap error - can't log because logger isn't created yet
        // Will be logged once logger is available
      }
    }

    const options: LoggerOptions = {
      level: this.config.level ?? 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        pid: process.pid,
        hostname: undefined,
      },
    };

    // Configure transports
    const transports: TransportTargetOptions<Record<string, unknown>>[] = [];

    // Development pretty print transport
    if (
      this.config.prettyPrint === true &&
      Bun.env.NODE_ENV === 'development'
    ) {
      transports.push({
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      });
    }

    // File logging with rotation
    if (this.config.enableFileLogging === true) {
      const logDirectory = this.config.logDirectory ?? '.logs';

      // Info level logs
      transports.push({
        target: 'pino-roll',
        options: {
          file: join(logDirectory, 'info', 'app.log'),
          size: this.config.maxFileSize,
          limit: {
            count: this.config.maxFiles,
          },
          frequency: 'daily',
        },
        level: 'info',
      });

      // Error level logs
      transports.push({
        target: 'pino-roll',
        options: {
          file: join(logDirectory, 'error', 'error.log'),
          size: this.config.maxFileSize,
          limit: {
            count: this.config.maxFiles,
          },
          frequency: 'daily',
        },
        level: 'error',
      });

      // Debug logs (development only)
      if (Bun.env.NODE_ENV === 'development') {
        transports.push({
          target: 'pino-roll',
          options: {
            file: join(logDirectory, 'debug', 'debug.log'),
            size: this.config.maxFileSize,
            limit: {
              count: this.config.maxFiles,
            },
            frequency: 'daily',
          },
          level: 'debug',
        });
      }
    }

    // Add external transports (for 3rd party services)
    if (
      this.config.externalTransports &&
      this.config.externalTransports.length > 0
    ) {
      for (const transport of this.config.externalTransports) {
        try {
          transports.push({
            target: transport.target,
            options: transport.options ?? {},
            level: transport.level ?? this.config.level,
          });
        } catch (_error) {
          // External transport failed to load - skip it silently
          // Can't log error because logger isn't created yet
        }
      }
    }

    // Use transports if configured, otherwise use standard output
    if (transports.length > 0) {
      options.transport = {
        targets: transports,
      };
    }

    const pinoLogger = pino(options);
    return new PinoLoggerWrapper(pinoLogger);
  }

  createLogger(namespace: string): Logger {
    const startTime = performance.now();
    const logger = this.defaultLogger.child({
      module: namespace,
      traceId: crypto.randomUUID(),
    });

    // Ensure performance requirement (<5ms)
    const duration = performance.now() - startTime;
    if (duration > 5) {
      logger.warn({
        msg: 'Logger creation exceeded performance threshold',
        duration,
        threshold: 5,
      });
    }

    return logger;
  }
}

/**
 * Factory function to create a logger instance with proper namespace
 * @param namespace - The namespace for the logger (e.g., 'checklist:workflow:engine')
 * @returns A configured Logger instance
 */
export function createLogger(namespace: string): Logger {
  return LoggerService.getInstance().createLogger(namespace);
}

/**
 * Initialize the logger service with custom configuration
 * @param config - Optional logger configuration
 */
export function initializeLogger(config?: LoggerConfig): void {
  LoggerService.getInstance(config);
}

/**
 * Export Pino types for external use
 */
export type { PinoLogger, LoggerOptions, ChildLoggerOptions };

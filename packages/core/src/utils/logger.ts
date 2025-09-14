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
    if (this.isTestEnvironment()) {
      return this.createSilentLogger();
    }

    this.ensureLogDirectories();
    const options = this.createLoggerOptions();
    const transports = this.configureTransports();

    const pinoLogger =
      transports.length > 0
        ? pino(options, pino.transport({ targets: transports }))
        : pino(options);

    return new PinoLoggerWrapper(pinoLogger);
  }

  private isTestEnvironment(): boolean {
    return (
      Bun.env.NODE_ENV === 'test' && this.config.enableFileLogging !== true
    );
  }

  private createSilentLogger(): Logger {
    const silentOptions: LoggerOptions = {
      level: 'silent',
      base: null,
    };
    const pinoLogger = pino(silentOptions);
    return new PinoLoggerWrapper(pinoLogger);
  }

  private ensureLogDirectories(): void {
    if (this.config.enableFileLogging !== true) return;

    const logDirectory = this.config.logDirectory ?? '.logs';
    try {
      mkdirSync(join(logDirectory, 'info'), { recursive: true });
      mkdirSync(join(logDirectory, 'error'), { recursive: true });
      if (Bun.env.NODE_ENV === 'development') {
        mkdirSync(join(logDirectory, 'debug'), { recursive: true });
      }
    } catch (_error) {
      this.config.enableFileLogging = false;
    }
  }

  private createLoggerOptions(): LoggerOptions {
    return {
      level: this.config.level ?? 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        pid: process.pid,
        hostname: undefined,
      },
    };
  }

  private configureTransports(): TransportTargetOptions<
    Record<string, unknown>
  >[] {
    const transports: TransportTargetOptions<Record<string, unknown>>[] = [];

    this.addPrettyPrintTransport(transports);
    this.addFileTransports(transports);
    this.addExternalTransports(transports);

    return transports;
  }

  private addPrettyPrintTransport(
    transports: TransportTargetOptions<Record<string, unknown>>[]
  ): void {
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
  }

  private addFileTransports(
    transports: TransportTargetOptions<Record<string, unknown>>[]
  ): void {
    if (this.config.enableFileLogging !== true) return;

    const logDirectory = this.config.logDirectory ?? '.logs';
    const fileOptions = {
      size: this.config.maxFileSize,
      limit: { count: this.config.maxFiles },
      frequency: 'daily',
    };

    transports.push(
      {
        target: 'pino-roll',
        options: {
          file: join(logDirectory, 'info', 'app.log'),
          ...fileOptions,
        },
        level: 'info',
      },
      {
        target: 'pino-roll',
        options: {
          file: join(logDirectory, 'error', 'error.log'),
          ...fileOptions,
        },
        level: 'error',
      }
    );

    if (Bun.env.NODE_ENV === 'development') {
      transports.push({
        target: 'pino-roll',
        options: {
          file: join(logDirectory, 'debug', 'debug.log'),
          ...fileOptions,
        },
        level: 'debug',
      });
    }
  }

  private addExternalTransports(
    transports: TransportTargetOptions<Record<string, unknown>>[]
  ): void {
    if (
      !this.config.externalTransports ||
      this.config.externalTransports.length === 0
    )
      return;

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

import { mkdirSync } from 'fs';
import { join } from 'path';
import pino from 'pino';
import type { LoggerOptions, TransportTargetOptions } from 'pino';

export interface LoggerConfig {
  level?: string;
  enableFileLogging?: boolean;
  logDirectory?: string;
  prettyPrint?: boolean;
  maxFileSize?: string;
  maxFiles?: number;
}

export class LoggerConfigFactory {
  static createOptions(config: LoggerConfig): LoggerOptions {
    // CRITICAL: Use silent logger during tests to prevent any output
    if (Bun.env.NODE_ENV === 'test' && config.enableFileLogging !== true) {
      return {
        level: 'silent',
        base: null,
      };
    }

    return {
      level: config.level ?? 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      base: {
        pid: process.pid,
        hostname: undefined,
      },
    };
  }

  static createSilentOptions(): LoggerOptions {
    return {
      level: 'silent',
      base: null,
    };
  }

  static ensureLogDirectories(config: LoggerConfig): boolean {
    if (config.enableFileLogging !== true) {
      return false;
    }

    const logDirectory = config.logDirectory ?? '.logs';

    try {
      mkdirSync(join(logDirectory, 'info'), { recursive: true });
      mkdirSync(join(logDirectory, 'error'), { recursive: true });

      if (Bun.env.NODE_ENV === 'development') {
        mkdirSync(join(logDirectory, 'debug'), { recursive: true });
      }

      return true;
    } catch (_error) {
      return false;
    }
  }

  static createTransports(
    config: LoggerConfig
  ): TransportTargetOptions<Record<string, unknown>>[] {
    const transports: TransportTargetOptions<Record<string, unknown>>[] = [];

    if (this.shouldUsePrettyPrint(config)) {
      transports.push(this.createPrettyTransport());
    }

    if (config.enableFileLogging === true) {
      const logDirectory = config.logDirectory ?? '.logs';
      transports.push(...this.createFileTransports(logDirectory, config));
    }

    return transports;
  }

  private static shouldUsePrettyPrint(config: LoggerConfig): boolean {
    return config.prettyPrint === true && Bun.env.NODE_ENV === 'development';
  }

  private static createPrettyTransport(): TransportTargetOptions<
    Record<string, unknown>
  > {
    return {
      target: 'pino-pretty',
      options: {
        colorize: true,
        translateTime: 'SYS:standard',
        ignore: 'pid,hostname',
      },
    };
  }

  private static createFileTransports(
    logDirectory: string,
    config: LoggerConfig
  ): TransportTargetOptions<Record<string, unknown>>[] {
    const transports: TransportTargetOptions<Record<string, unknown>>[] = [];

    transports.push(this.createInfoTransport(logDirectory, config));
    transports.push(this.createErrorTransport(logDirectory, config));

    if (Bun.env.NODE_ENV === 'development') {
      transports.push(this.createDebugTransport(logDirectory, config));
    }

    return transports;
  }

  private static createInfoTransport(
    logDirectory: string,
    config: LoggerConfig
  ): TransportTargetOptions<Record<string, unknown>> {
    return {
      level: 'info',
      target: 'pino-roll',
      options: {
        file: join(logDirectory, 'info', 'app.log'),
        size: config.maxFileSize ?? '10m',
        frequency: 'daily',
        limit: { count: config.maxFiles ?? 7 },
        mkdir: true,
      },
    };
  }

  private static createErrorTransport(
    logDirectory: string,
    config: LoggerConfig
  ): TransportTargetOptions<Record<string, unknown>> {
    return {
      level: 'error',
      target: 'pino-roll',
      options: {
        file: join(logDirectory, 'error', 'error.log'),
        size: config.maxFileSize ?? '10m',
        frequency: 'daily',
        limit: { count: config.maxFiles ?? 30 },
        mkdir: true,
      },
    };
  }

  private static createDebugTransport(
    logDirectory: string,
    config: LoggerConfig
  ): TransportTargetOptions<Record<string, unknown>> {
    return {
      level: 'debug',
      target: 'pino-roll',
      options: {
        file: join(logDirectory, 'debug', 'debug.log'),
        size: config.maxFileSize ?? '10m',
        frequency: 'daily',
        limit: { count: config.maxFiles ?? 3 },
        mkdir: true,
      },
    };
  }
}

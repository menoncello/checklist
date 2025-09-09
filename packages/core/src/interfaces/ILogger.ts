export interface LogContext {
  msg: string;
  [key: string]: unknown;
}

export interface ChildLoggerOptions {
  level?: string;
  serializers?: Record<string, (value: unknown) => unknown>;
  [key: string]: unknown;
}

export interface ILogger {
  debug(context: LogContext): void;
  info(context: LogContext): void;
  warn(context: LogContext): void;
  error(context: LogContext): void;
  fatal(context: LogContext): void;
  child(
    bindings: Record<string, unknown>,
    options?: ChildLoggerOptions
  ): ILogger;
}

export interface ILoggerConfig {
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

import { createLogger } from '@checklist/core/utils/logger';

import { DataSanitizer } from './DataSanitizer';
import { SlowOperationFormatter } from './helpers/SlowOperationFormatter';
import {
  OperationStats,
  SlowOperationStats,
} from './helpers/SlowOperationStats';

const logger = createLogger('checklist:tui:slow-operation-detector');

export interface SlowOperationReport {
  id: string;
  name: string;
  duration: number;
  threshold: number;
  stackTrace: string;
  timestamp: number;
  context?: Record<string, unknown>;
}

export interface SlowOperationConfig {
  defaultThreshold: number;
  captureStackTrace: boolean;
  maxReports: number;
  contextDepth: number;
}

export class SlowOperationDetector {
  private config: SlowOperationConfig;
  private reports: SlowOperationReport[] = [];
  private operations = new Map<
    string,
    { start: number; name: string; threshold: number }
  >();
  private eventHandlers = new Map<string, Set<Function>>();
  private wrapperCounter = 0;
  private dataSanitizer: DataSanitizer;

  constructor(config?: Partial<SlowOperationConfig>) {
    this.config = {
      defaultThreshold: 50, // 50ms default
      captureStackTrace: true,
      maxReports: 100,
      contextDepth: 10,
      ...config,
    };

    this.dataSanitizer = new DataSanitizer({
      enabled: true,
      sanitizeStackTraces: true,
      sanitizeMetadata: true,
    });

    logger.info({
      msg: 'Slow operation detector initialized',
      config: this.config,
    });
  }

  startOperation(name: string, threshold?: number): string {
    const id = `op-${Date.now()}-${this.wrapperCounter++}`;

    this.operations.set(id, {
      start: performance.now(),
      name,
      threshold: threshold ?? this.config.defaultThreshold,
    });

    return id;
  }

  endOperation(
    id: string,
    context?: Record<string, unknown>
  ): SlowOperationReport | null {
    const operation = this.operations.get(id);

    if (operation == null) {
      this.logUnknownOperation(id);
      return null;
    }

    const duration = performance.now() - operation.start;
    this.operations.delete(id);

    if (duration > operation.threshold) {
      return this.handleSlowOperation(operation, duration, id, context);
    }

    return null;
  }

  private logUnknownOperation(id: string): void {
    logger.warn({
      msg: 'Attempted to end unknown operation',
      id,
    });
  }

  private handleSlowOperation(
    operation: { name: string; threshold: number },
    duration: number,
    id: string,
    context?: Record<string, unknown>
  ): SlowOperationReport {
    const reportData = {
      id,
      name: operation.name,
      duration,
      threshold: operation.threshold,
      context,
    };

    const report = this.createReport(reportData);
    this.recordReport(report);
    this.emit('slowOperation', report);
    this.logSlowOperation(operation.name, duration, operation.threshold);

    return report;
  }

  private logSlowOperation(
    name: string,
    duration: number,
    threshold: number
  ): void {
    logger.warn({
      msg: 'Slow operation detected',
      name,
      duration: `${duration.toFixed(2)}ms`,
      threshold: `${threshold}ms`,
    });
  }

  wrapFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    threshold?: number
  ): T {
    return this.createWrappedFunction(fn, name, threshold);
  }

  private createWrappedFunction<T extends (...args: unknown[]) => unknown>(
    fn: T,
    name: string,
    threshold?: number
  ): T {
    const detector = this;

    return ((...args: unknown[]) => {
      const id = detector.startOperation(name, threshold);

      try {
        const result = fn(...args);

        if (result instanceof Promise) {
          return this.handleAsyncResult(result, id);
        }

        return this.handleSyncResult(result, id, args);
      } catch (error) {
        detector.endOperation(id, { error: true, errorMessage: String(error) });
        throw error;
      }
    }) as T;
  }

  private handleAsyncResult<T>(result: Promise<T>, id: string): Promise<T> {
    return result.finally(() => {
      this.endOperation(id, { async: true });
    });
  }

  private handleSyncResult<T>(result: T, id: string, args: unknown[]): T {
    this.endOperation(id, { sync: true, args: args.slice(0, 3) });
    return result;
  }

  async measureAsync<T>(
    operation: () => Promise<T>,
    name: string,
    threshold?: number
  ): Promise<T> {
    const id = this.startOperation(name, threshold);

    try {
      const result = await operation();
      this.endOperation(id, { async: true });
      return result;
    } catch (error) {
      this.endOperation(id, { error: true, errorMessage: String(error) });
      throw error;
    }
  }

  measure<T>(operation: () => T, name: string, threshold?: number): T {
    const id = this.startOperation(name, threshold);

    try {
      const result = operation();
      this.endOperation(id, { sync: true });
      return result;
    } catch (error) {
      this.endOperation(id, { error: true, errorMessage: String(error) });
      throw error;
    }
  }

  private createReport(data: {
    id: string;
    name: string;
    duration: number;
    threshold: number;
    context?: Record<string, unknown>;
  }): SlowOperationReport {
    const stackTrace = this.config.captureStackTrace
      ? this.dataSanitizer.sanitizeStackTrace(this.captureStackTrace())
      : '';

    const sanitizedContext = data.context
      ? this.dataSanitizer.sanitizeMetadata(data.context)
      : undefined;

    return {
      id: data.id,
      name: data.name,
      duration: data.duration,
      threshold: data.threshold,
      stackTrace,
      timestamp: Date.now(),
      context: sanitizedContext,
    };
  }

  private captureStackTrace(): string {
    const error = new Error();
    const stack = error.stack;

    if (stack == null || stack === '') {
      return '';
    }

    return this.filterStackTrace(stack);
  }

  private filterStackTrace(stack: string): string {
    const lines = stack.split('\n');
    const filtered = lines.filter(this.shouldIncludeStackLine);
    return filtered.slice(0, this.config.contextDepth).join('\n');
  }

  private shouldIncludeStackLine = (line: string): boolean => {
    return (
      !line.includes('SlowOperationDetector') &&
      !line.includes('at async') &&
      !line.includes('at Promise')
    );
  };

  private recordReport(report: SlowOperationReport): void {
    this.reports.push(report);

    // Keep reports buffer from growing too large
    if (this.reports.length > this.config.maxReports) {
      this.reports.shift();
    }
  }

  getReports(since?: number): SlowOperationReport[] {
    if (since == null) {
      return [...this.reports];
    }

    return this.reports.filter((r) => r.timestamp >= since);
  }

  getSlowestOperations(count: number = 10): SlowOperationReport[] {
    return SlowOperationStats.getSlowestOperations(this.reports, count);
  }

  getOperationStats(name?: string): OperationStats {
    return SlowOperationStats.getOperationStats(this.reports, name);
  }

  clearReports(): void {
    this.reports = [];
    this.emit('reportsCleared');
  }

  updateConfig(newConfig: Partial<SlowOperationConfig>): void {
    this.config = { ...this.config, ...newConfig };

    logger.info({
      msg: 'Slow operation detector config updated',
      config: this.config,
    });

    this.emit('configUpdated', this.config);
  }

  getConfig(): SlowOperationConfig {
    return { ...this.config };
  }

  formatReport(report: SlowOperationReport): string {
    return SlowOperationFormatter.formatReport(report);
  }

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          logger.error({
            msg: 'Error in slow operation detector event handler',
            event,
            error,
          });
        }
      });
    }
  }
}

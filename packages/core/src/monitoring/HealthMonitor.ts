import { existsSync, statSync } from 'fs';
import { join } from 'path';
import { createLogger, type Logger } from '../utils/logger';

export interface HealthCheckResult {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  duration?: number;
  metadata?: Record<string, unknown>;
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheckResult[];
  timestamp: Date;
  uptime: number;
}

export interface LoggerHealthMetrics {
  performanceOk: boolean;
  averageLogTime: number;
  rotationStatus: 'active' | 'inactive' | 'error';
  errorRate: number;
  logFileSize?: number;
  diskSpaceAvailable?: boolean;
}

export class HealthMonitor {
  private logger: Logger;
  private startTime: Date;
  private logMetrics: {
    totalLogs: number;
    totalTime: number;
    errorCount: number;
    lastHourErrors: number[];
  };
  private checks: Map<string, () => Promise<HealthCheckResult>>;

  constructor(logger?: Logger) {
    this.logger = logger ?? createLogger('checklist:health:monitor');
    this.startTime = new Date();
    this.logMetrics = {
      totalLogs: 0,
      totalTime: 0,
      errorCount: 0,
      lastHourErrors: [],
    };
    this.checks = new Map();
    this.registerDefaultChecks();
  }

  private registerDefaultChecks(): void {
    // Logger performance check
    this.registerCheck('logger-performance', async () => {
      const avgTime =
        this.logMetrics.totalLogs > 0
          ? this.logMetrics.totalTime / this.logMetrics.totalLogs
          : 0;

      const performanceOk = avgTime < 5; // <5ms requirement

      return {
        name: 'logger-performance',
        status: performanceOk ? 'healthy' : 'degraded',
        message: `Average log time: ${avgTime.toFixed(2)}ms`,
        duration: avgTime,
        metadata: {
          totalLogs: this.logMetrics.totalLogs,
          threshold: 5,
        },
      };
    });

    // Log rotation check
    this.registerCheck('log-rotation', async () => {
      const logDir = '.logs';

      try {
        if (!existsSync(logDir)) {
          return {
            name: 'log-rotation',
            status: 'unhealthy',
            message: 'Log directory does not exist',
          };
        }

        const infoLogPath = join(logDir, 'info', 'app.log');
        if (existsSync(infoLogPath)) {
          const stats = statSync(infoLogPath);
          const sizeInMB = stats.size / (1024 * 1024);

          // Check if rotation is working (file should not exceed 10MB)
          if (sizeInMB > 10) {
            return {
              name: 'log-rotation',
              status: 'degraded',
              message: `Log file size exceeds rotation threshold: ${sizeInMB.toFixed(2)}MB`,
              metadata: { sizeInMB, threshold: 10 },
            };
          }
        }

        return {
          name: 'log-rotation',
          status: 'healthy',
          message: 'Log rotation is functioning normally',
        };
      } catch (error) {
        return {
          name: 'log-rotation',
          status: 'unhealthy',
          message: `Log rotation check failed: ${error}`,
        };
      }
    });

    // Error rate check
    this.registerCheck('error-rate', async () => {
      // Clean up old error timestamps (older than 1 hour)
      const oneHourAgo = Date.now() - 3600000;
      this.logMetrics.lastHourErrors = this.logMetrics.lastHourErrors.filter(
        (timestamp) => timestamp > oneHourAgo
      );

      const errorRate = this.logMetrics.lastHourErrors.length;
      let status: 'healthy' | 'degraded' | 'unhealthy';

      if (errorRate < 10) {
        status = 'healthy';
      } else if (errorRate < 50) {
        status = 'degraded';
      } else {
        status = 'unhealthy';
      }

      return {
        name: 'error-rate',
        status,
        message: `${errorRate} errors in the last hour`,
        metadata: {
          errorRate,
          totalErrors: this.logMetrics.errorCount,
        },
      };
    });
  }

  /**
   * Register a custom health check
   */
  registerCheck(name: string, check: () => Promise<HealthCheckResult>): void {
    this.checks.set(name, check);
    this.logger.debug({
      msg: 'Health check registered',
      checkName: name,
    });
  }

  /**
   * Track a log operation for performance metrics
   */
  trackLogOperation(duration: number, isError: boolean = false): void {
    this.logMetrics.totalLogs++;
    this.logMetrics.totalTime += duration;

    if (isError) {
      this.logMetrics.errorCount++;
      this.logMetrics.lastHourErrors.push(Date.now());
    }

    // Log warning if single operation exceeds threshold
    if (duration > 5) {
      this.logger.warn({
        msg: 'Log operation exceeded performance threshold',
        duration,
        threshold: 5,
      });
    }
  }

  /**
   * Get logger health metrics
   */
  async getLoggerMetrics(): Promise<LoggerHealthMetrics> {
    const avgTime =
      this.logMetrics.totalLogs > 0
        ? this.logMetrics.totalTime / this.logMetrics.totalLogs
        : 0;

    // Clean up old error timestamps
    const oneHourAgo = Date.now() - 3600000;
    this.logMetrics.lastHourErrors = this.logMetrics.lastHourErrors.filter(
      (timestamp) => timestamp > oneHourAgo
    );

    const logDir = '.logs';
    let rotationStatus: 'active' | 'inactive' | 'error' = 'inactive';
    let logFileSize: number | undefined;

    try {
      if (existsSync(logDir)) {
        const infoLogPath = join(logDir, 'info', 'app.log');
        if (existsSync(infoLogPath)) {
          const stats = statSync(infoLogPath);
          logFileSize = stats.size;
          rotationStatus = logFileSize < 10 * 1024 * 1024 ? 'active' : 'error';
        }
      }
    } catch (error) {
      rotationStatus = 'error';
      this.logger.error({
        msg: 'Failed to check log rotation status',
        error,
      });
    }

    return {
      performanceOk: avgTime < 5,
      averageLogTime: avgTime,
      rotationStatus,
      errorRate: this.logMetrics.lastHourErrors.length,
      logFileSize,
      diskSpaceAvailable: true, // Would need platform-specific implementation
    };
  }

  /**
   * Run all health checks and return overall status
   */
  async checkHealth(): Promise<HealthStatus> {
    const startTime = performance.now();
    const results: HealthCheckResult[] = [];

    this.logger.debug({ msg: 'Running health checks' });

    for (const [name, check] of this.checks) {
      try {
        const checkStart = performance.now();
        const result = await check();
        result.duration = performance.now() - checkStart;
        results.push(result);

        this.logger.debug({
          msg: 'Health check completed',
          checkName: name,
          status: result.status,
          duration: result.duration,
        });
      } catch (error) {
        results.push({
          name,
          status: 'unhealthy',
          message: `Check failed: ${error}`,
        });

        this.logger.error({
          msg: 'Health check failed',
          checkName: name,
          error,
        });
      }
    }

    // Determine overall status
    const hasUnhealthy = results.some((r) => r.status === 'unhealthy');
    const hasDegraded = results.some((r) => r.status === 'degraded');

    let overallStatus: 'healthy' | 'degraded' | 'unhealthy';
    if (hasUnhealthy) {
      overallStatus = 'unhealthy';
    } else if (hasDegraded) {
      overallStatus = 'degraded';
    } else {
      overallStatus = 'healthy';
    }

    const duration = performance.now() - startTime;
    const uptime = Date.now() - this.startTime.getTime();

    this.logger.info({
      msg: 'Health check completed',
      status: overallStatus,
      checksRun: results.length,
      duration,
    });

    return {
      status: overallStatus,
      checks: results,
      timestamp: new Date(),
      uptime,
    };
  }
}

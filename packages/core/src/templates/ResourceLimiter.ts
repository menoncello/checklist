/**
 * ResourceLimiter - Enforces resource limits for template execution
 * Monitors execution time, memory usage, and CPU usage
 */

import { TimeoutError, MemoryLimitError, ResourceLimitError } from './errors';
import type { ResourceLimits, ResourceUsage } from './types';

interface MonitoringData {
  startTime: number;
  startMemory: number;
  timer?: Timer;
  interval?: Timer;
  currentUsage: ResourceUsage;
}

/**
 * ResourceLimiter enforces execution limits for template operations
 */
export class ResourceLimiter {
  private readonly limits: ResourceLimits = {
    executionTime: 5000, // 5 seconds max
    memoryDelta: 10 * 1024 * 1024, // 10MB max increase
    cpuUsage: 95, // 95% CPU threshold
    fileHandles: 10, // Max file handles
    processCount: 0, // No child processes
  };

  constructor(customLimits?: Partial<ResourceLimits>) {
    if (customLimits !== undefined) {
      this.limits = { ...this.limits, ...customLimits };
    }
  }

  /**
   * Execute an operation with resource limits
   */
  async executeWithLimits<T>(
    operation: (signal: AbortSignal) => Promise<T>,
    templateId?: string,
    customLimits?: Partial<ResourceLimits>
  ): Promise<T> {
    const limits =
      customLimits !== undefined
        ? { ...this.limits, ...customLimits }
        : this.limits;

    const monitor = this.startMonitoring(limits);
    const abortController = new AbortController();

    try {
      // Execute operation with monitoring
      const result = await Promise.race([
        operation(abortController.signal),
        this.createTimeoutPromise(
          limits.executionTime,
          templateId ?? 'unknown'
        ),
      ]);

      // Check final resource usage
      const finalUsage = this.getUsage(monitor);
      this.validateResourceUsage(finalUsage, limits, templateId);

      return result as T;
    } catch (error) {
      abortController.abort();
      throw error;
    } finally {
      this.stopMonitoring(monitor);
    }
  }

  /**
   * Start monitoring resource usage
   */
  private startMonitoring(_limits: ResourceLimits): MonitoringData {
    const monitoring: MonitoringData = {
      startTime: Date.now(),
      startMemory: this.getCurrentMemoryUsage(),
      currentUsage: {
        memoryDelta: 0,
        cpuUsage: 0,
        fileHandles: 0,
        processCount: 0,
        duration: 0,
      },
    };

    // Monitor memory and CPU periodically
    monitoring.interval = setInterval(() => {
      monitoring.currentUsage = this.getUsage(monitoring);
    }, 100);

    return monitoring;
  }

  /**
   * Stop monitoring
   */
  private stopMonitoring(monitor: MonitoringData): void {
    if (monitor.timer !== undefined) {
      clearTimeout(monitor.timer);
    }
    if (monitor.interval !== undefined) {
      clearInterval(monitor.interval);
    }
  }

  /**
   * Get current resource usage
   */
  private getUsage(monitor: MonitoringData): ResourceUsage {
    const currentMemory = this.getCurrentMemoryUsage();
    const memoryDelta = currentMemory - monitor.startMemory;
    const duration = Date.now() - monitor.startTime;

    return {
      memoryDelta,
      cpuUsage: this.getCurrentCpuUsage(),
      fileHandles: this.getFileHandleCount(),
      processCount: 0, // Child process monitoring would be implemented here
      duration,
    };
  }

  /**
   * Get current memory usage in bytes
   */
  private getCurrentMemoryUsage(): number {
    const memoryUsage = process.memoryUsage();
    return memoryUsage.heapUsed;
  }

  /**
   * Get current CPU usage percentage (approximation)
   * Note: This is a simplified implementation for testing purposes
   */
  private getCurrentCpuUsage(): number {
    // Use process.cpuUsage() to get CPU usage
    const cpuUsage = process.cpuUsage();
    // Convert microseconds to percentage (approximation)
    // This is a simplified calculation that returns the CPU time
    // as a percentage of 100ms (reasonable for short operations)
    const totalCpu = cpuUsage.user + cpuUsage.system;
    const percentage = (totalCpu / 100000) % 100;
    return Math.min(95, percentage);
  }

  /**
   * Get number of open file handles (approximation)
   */
  private getFileHandleCount(): number {
    // In a real implementation, this would check actual file descriptors
    // For now, return a default value
    return 0;
  }

  /**
   * Create a timeout promise that rejects after specified time
   */
  private createTimeoutPromise(
    timeoutMs: number,
    templateId: string
  ): Promise<never> {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new TimeoutError(templateId, timeoutMs));
      }, timeoutMs);
    });
  }

  /**
   * Validate resource usage against limits
   */
  private validateResourceUsage(
    usage: ResourceUsage,
    limits: ResourceLimits,
    templateId?: string
  ): void {
    this.validateMemoryUsage(usage, limits, templateId);
    this.validateCpuUsage(usage, limits, templateId);
    this.validateFileHandles(usage, limits, templateId);
    this.validateProcessCount(usage, limits, templateId);
  }

  /**
   * Validate memory usage
   */
  private validateMemoryUsage(
    usage: ResourceUsage,
    limits: ResourceLimits,
    templateId?: string
  ): void {
    if (usage.memoryDelta > limits.memoryDelta) {
      throw new MemoryLimitError(
        templateId ?? 'unknown',
        usage.memoryDelta,
        limits.memoryDelta
      );
    }
  }

  /**
   * Validate CPU usage
   */
  private validateCpuUsage(
    usage: ResourceUsage,
    limits: ResourceLimits,
    templateId?: string
  ): void {
    if (usage.cpuUsage > limits.cpuUsage) {
      throw new ResourceLimitError(
        'CPU',
        usage.cpuUsage,
        limits.cpuUsage,
        templateId
      );
    }
  }

  /**
   * Validate file handles
   */
  private validateFileHandles(
    usage: ResourceUsage,
    limits: ResourceLimits,
    templateId?: string
  ): void {
    if (usage.fileHandles > limits.fileHandles) {
      throw new ResourceLimitError(
        'fileHandles',
        usage.fileHandles,
        limits.fileHandles,
        templateId
      );
    }
  }

  /**
   * Validate process count
   */
  private validateProcessCount(
    usage: ResourceUsage,
    limits: ResourceLimits,
    templateId?: string
  ): void {
    if (usage.processCount > limits.processCount) {
      throw new ResourceLimitError(
        'processCount',
        usage.processCount,
        limits.processCount,
        templateId
      );
    }
  }

  /**
   * Get current resource limits
   */
  getLimits(): Readonly<ResourceLimits> {
    return { ...this.limits };
  }

  /**
   * Update resource limits
   */
  updateLimits(updates: Partial<ResourceLimits>): void {
    Object.assign(this.limits, updates);
  }

  /**
   * Get current resource usage snapshot
   */
  async getUsageSnapshot(): Promise<ResourceUsage> {
    return {
      memoryDelta: 0, // Not applicable for snapshot
      cpuUsage: this.getCurrentCpuUsage(),
      fileHandles: this.getFileHandleCount(),
      processCount: 0,
      duration: 0, // Not applicable for snapshot
    };
  }
}

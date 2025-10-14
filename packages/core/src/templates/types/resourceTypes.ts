/**
 * Resource and sandbox types for safe execution
 * Types related to resource limits and sandbox execution
 */

/**
 * Resource usage limits
 */
export interface ResourceLimits {
  executionTime: number;
  memoryDelta: number;
  cpuUsage: number;
  fileHandles: number;
  processCount: number;
}

/**
 * Resource usage monitoring
 */
export interface ResourceUsage {
  memoryDelta: number;
  cpuUsage: number;
  fileHandles: number;
  processCount: number;
  duration: number;
}

/**
 * Sandbox execution context
 */
export interface SandboxContext {
  variables: Record<string, unknown>;
  console: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  Math: typeof Math;
  Date: {
    now: () => number;
    parse: (dateString: string) => number;
  };
  JSON: {
    parse: (text: string) => unknown;
    stringify: (value: unknown) => string;
  };
}

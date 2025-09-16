import type { IPerformanceMonitor } from '../interfaces/IPerformanceMonitor';
import { getGlobalPerformanceMonitor } from './PerformanceMonitor';

/**
 * Performance monitoring decorator options
 */
export interface TimedOptions {
  /** Performance budget in milliseconds */
  budgetMs?: number;
  /** Budget violation severity */
  severity?: 'warning' | 'critical';
  /** Custom operation name (defaults to method name) */
  operationName?: string;
  /** Whether to include class name in operation name */
  includeClassName?: boolean;
  /** Performance monitor instance (defaults to global) */
  monitor?: IPerformanceMonitor;
}

/**
 * Decorator to automatically measure method performance
 *
 * @example
 * ```typescript
 * class WorkflowEngine {
 *   @Timed({ budgetMs: 100, severity: 'critical' })
 *   async loadTemplate(path: string): Promise<Template> {
 *     // Implementation
 *   }
 *
 *   @Timed({ budgetMs: 50 })
 *   async saveState(): Promise<void> {
 *     // Implementation
 *   }
 * }
 * ```
 */
export function Timed(options: TimedOptions = {}) {
  return function (
    target: unknown,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor | void {
    if (descriptor?.value === undefined || descriptor?.value === null) {
      return;
    }

    const methodInfo = extractMethodInfo(target, propertyKey, options);
    const originalMethod = descriptor.value;

    descriptor.value = createTimedWrapper(
      originalMethod,
      methodInfo.operationName,
      options
    );

    return descriptor;
  };
}

function extractMethodInfo(
  target: unknown,
  propertyKey: string | symbol,
  options: TimedOptions
): { operationName: string } {
  const className = (target as { constructor: { name: string } }).constructor
    .name;

  const operationName =
    options.operationName ??
    (options.includeClassName !== false
      ? `${className}.${String(propertyKey)}`
      : String(propertyKey));

  return { operationName };
}

function createTimedWrapper<T extends (...args: unknown[]) => unknown>(
  originalMethod: T,
  operationName: string,
  options: TimedOptions
): T {
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const monitor = options.monitor ?? getGlobalPerformanceMonitor();

    if (monitor?.isEnabled() !== true) {
      return originalMethod.apply(this, args) as ReturnType<T>;
    }

    const timer = setupPerformanceMonitoring(monitor, operationName, options);

    try {
      const result = originalMethod.apply(this, args) as ReturnType<T>;
      return handleMethodResult(result, timer);
    } catch (error) {
      timer();
      throw error;
    }
  } as T;
}

function setupPerformanceMonitoring(
  monitor: IPerformanceMonitor,
  operationName: string,
  options: TimedOptions
): () => void {
  if (typeof options.budgetMs === 'number') {
    monitor.setBudget(operationName, options.budgetMs, options.severity);
  }

  return monitor.startTimer(operationName);
}

function handleMethodResult<T>(result: T, timer: () => void): T {
  if (isPromise(result)) {
    return (result as unknown as Promise<unknown>).finally(() => timer()) as T;
  }

  timer();
  return result;
}

function isPromise(value: unknown): boolean {
  return (
    value !== null &&
    value !== undefined &&
    typeof (value as { then?: unknown }).then === 'function'
  );
}

/**
 * Class decorator to automatically apply @Timed to all methods
 *
 * @example
 * ```typescript
 * @TimedClass({ budgetMs: 100 })
 * class WorkflowEngine {
 *   async loadTemplate(): Promise<void> {} // Automatically timed
 *   async saveState(): Promise<void> {}    // Automatically timed
 * }
 * ```
 */
export function TimedClass(defaultOptions: TimedOptions = {}) {
  return function <T extends new (...args: unknown[]) => unknown>(
    constructor: T
  ): T {
    const prototype = constructor.prototype;
    const methodNames = Object.getOwnPropertyNames(prototype).filter(
      (name) => name !== 'constructor' && typeof prototype[name] === 'function'
    );

    methodNames.forEach((methodName) => {
      const descriptor = Object.getOwnPropertyDescriptor(prototype, methodName);
      if (
        descriptor?.value !== undefined &&
        typeof descriptor.value === 'function'
      ) {
        const timedDecorator = Timed({
          ...defaultOptions,
          includeClassName: true,
        });

        const result = timedDecorator(prototype, methodName, descriptor);
        if (result) {
          Object.defineProperty(prototype, methodName, result);
        }
      }
    });

    return constructor;
  };
}

/**
 * Utility function for manual performance timing
 *
 * @example
 * ```typescript
 * await withTiming('database-query', async () => {
 *   return await db.query('SELECT * FROM users');
 * }, { budgetMs: 200 });
 * ```
 */
export async function withTiming<T>(
  operationName: string,
  operation: () => T | Promise<T>,
  options: Omit<TimedOptions, 'operationName'> = {}
): Promise<T> {
  const monitor = options.monitor ?? getGlobalPerformanceMonitor();

  if (monitor?.isEnabled() !== true) {
    return await Promise.resolve(operation());
  }

  if (typeof options.budgetMs === 'number') {
    monitor.setBudget(operationName, options.budgetMs, options.severity);
  }

  const timer = monitor.startTimer(operationName);

  try {
    const result = await Promise.resolve(operation());
    return result;
  } finally {
    timer();
  }
}

/**
 * Function version of timing decorator for standalone functions
 *
 * @example
 * ```typescript
 * const timedParseTemplate = createTimedFunction(
 *   'template-parsing',
 *   parseTemplate,
 *   { budgetMs: 100 }
 * );
 * ```
 */
export function createTimedFunction<T extends (...args: unknown[]) => unknown>(
  operationName: string,
  fn: T,
  options: Omit<TimedOptions, 'operationName'> = {}
): T {
  return ((...args: unknown[]) => {
    const monitor = options.monitor ?? getGlobalPerformanceMonitor();

    if (monitor?.isEnabled() !== true) {
      return fn(...args);
    }

    const timer = setupPerformanceMonitoring(monitor, operationName, {
      ...options,
      operationName,
    });

    try {
      const result = fn(...args);
      return handleMethodResult(result, timer);
    } catch (error) {
      timer();
      throw error;
    }
  }) as T;
}

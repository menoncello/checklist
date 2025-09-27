import {
  handleProfileResult,
  createProfileResult,
  type ProfileContext,
  setPerformanceMonitor,
  getProfileResults,
  clearProfileResults,
  getProfileStats,
} from './ProfileHandler';

export interface ProfileOptions {
  name?: string;
  threshold?: number;
  enableStack?: boolean;
  logToConsole?: boolean;
  track?: boolean;
}

export interface ProfileResult {
  name: string;
  duration: number;
  timestamp: number;
  args?: unknown[];
  result?: unknown;
  stack?: string;
}

export function profile(options: ProfileOptions = {}) {
  return function <_T extends (...args: unknown[]) => unknown>(
    target: unknown,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ): PropertyDescriptor {
    const originalMethod = descriptor.value;
    const profileName = getProfileName(options, target, propertyKey);
    const threshold = getThreshold(options);

    descriptor.value = createProfiledMethod(
      originalMethod,
      profileName,
      options,
      threshold
    );

    return descriptor;
  };
}

function getProfileName(
  options: ProfileOptions,
  target: unknown,
  propertyKey: string
): string {
  if (
    options.name !== undefined &&
    options.name !== null &&
    options.name !== ''
  ) {
    return options.name;
  }
  const constructorName =
    (target as { constructor?: { name?: string } }).constructor?.name ??
    'Unknown';
  return `${constructorName}.${propertyKey}`;
}

function getThreshold(options: ProfileOptions): number {
  return options.threshold ?? 10; // 10ms default
}

function createProfiledMethod<T extends (...args: unknown[]) => unknown>(
  originalMethod: T,
  profileName: string,
  options: ProfileOptions,
  threshold: number
): T {
  return function (this: unknown, ...args: Parameters<T>): ReturnType<T> {
    const context = createContext(profileName, options, threshold, args);

    try {
      const result = originalMethod.apply(this, args);

      if (result instanceof Promise) {
        return handleAsyncResult(result, context) as ReturnType<T>;
      } else {
        return handleSyncResult(result, context) as ReturnType<T>;
      }
    } catch (error) {
      handleError(context);
      throw error;
    }
  } as T;
}

function createContext(
  profileName: string,
  options: ProfileOptions,
  threshold: number,
  args: unknown[]
): ProfileContext {
  return {
    profileName,
    startTime: performance.now(),
    startStack: options.enableStack === true ? new Error().stack : undefined,
    options,
    threshold,
    args,
  };
}

function handleAsyncResult(
  result: Promise<unknown>,
  context: ProfileContext
): Promise<unknown> {
  return result
    .then((asyncResult) => {
      const profileResult = createProfileResult(context, asyncResult);
      handleProfileResult(profileResult, context.options, context.threshold);
      return asyncResult;
    })
    .catch((error) => {
      const profileResult = createProfileResult(context, undefined);
      handleProfileResult(profileResult, context.options, context.threshold);
      throw error;
    });
}

function handleSyncResult(result: unknown, context: ProfileContext): unknown {
  const profileResult = createProfileResult(context, result);
  handleProfileResult(profileResult, context.options, context.threshold);
  return result;
}

function handleError(context: ProfileContext): void {
  const profileResult = createProfileResult(context, undefined);
  handleProfileResult(profileResult, context.options, context.threshold);
}

// Re-export from ProfileHandler
export {
  setPerformanceMonitor,
  getProfileResults,
  clearProfileResults,
  getProfileStats,
};

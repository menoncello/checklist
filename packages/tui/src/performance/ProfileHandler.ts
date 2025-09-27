import { PerformanceMonitor } from './PerformanceMonitor';
import type { ProfileOptions, ProfileResult } from './ProfileDecorator';

const profileResults: ProfileResult[] = [];
let performanceMonitor: PerformanceMonitor | null = null;

export function setPerformanceMonitor(monitor: PerformanceMonitor): void {
  performanceMonitor = monitor;
}

export interface ProfileContext {
  profileName: string;
  startTime: number;
  startStack: string | undefined;
  options: ProfileOptions;
  threshold: number;
  args: unknown[];
}

export function handleProfileResult(
  result: ProfileResult,
  options: ProfileOptions,
  threshold: number
): void {
  storeProfileResult(result);
  logProfileResult(result, options, threshold);
  reportToPerformanceMonitor(result, threshold);
}

function storeProfileResult(result: ProfileResult): void {
  profileResults.push(result);
  if (profileResults.length > 1000) {
    profileResults.shift();
  }
}

function logProfileResult(
  result: ProfileResult,
  options: ProfileOptions,
  threshold: number
): void {
  const shouldLog =
    result.duration >= threshold || options.logToConsole === true;
  if (!shouldLog) return;

  console.log(`[Profile] ${result.name}: ${result.duration.toFixed(2)}ms`);
  logStackTrace(result, threshold);
}

function logStackTrace(result: ProfileResult, threshold: number): void {
  const hasStack = result.stack !== undefined && result.stack !== null;
  const isSlowEnough = result.duration >= threshold * 2;

  if (hasStack && isSlowEnough) {
    console.log(`[Profile] Stack trace:\n${result.stack}`);
  }
}

function reportToPerformanceMonitor(
  result: ProfileResult,
  threshold: number
): void {
  if (!performanceMonitor) return;

  performanceMonitor.recordMetricValue(
    'method_duration',
    result.duration,
    { unit: 'ms' },
    { name: result.name, timestamp: result.timestamp }
  );

  if (result.duration >= threshold) {
    performanceMonitor.recordMetricValue(
      'slow_operation',
      result.duration,
      { unit: 'ms' },
      { name: result.name, stack: result.stack }
    );
  }
}

export function createProfileResult(
  context: ProfileContext,
  result: unknown
): ProfileResult {
  return {
    name: context.profileName,
    duration: performance.now() - context.startTime,
    timestamp: context.startTime,
    args: context.options.track === true ? context.args : undefined,
    result: context.options.track === true ? result : undefined,
    stack: context.startStack,
  };
}

export function getProfileResults(): ProfileResult[] {
  return [...profileResults];
}

export function clearProfileResults(): void {
  profileResults.length = 0;
}

export function getProfileStats(): {
  totalCalls: number;
  averageDuration: number;
  maxDuration: number;
  minDuration: number;
  slowOperations: ProfileResult[];
} {
  if (profileResults.length === 0) {
    return {
      totalCalls: 0,
      averageDuration: 0,
      maxDuration: 0,
      minDuration: 0,
      slowOperations: [],
    };
  }

  const durations = profileResults.map((r) => r.duration);
  const slowOperations = profileResults.filter((r) => r.duration >= 50);

  return {
    totalCalls: profileResults.length,
    averageDuration: durations.reduce((a, b) => a + b, 0) / durations.length,
    maxDuration: Math.max(...durations),
    minDuration: Math.min(...durations),
    slowOperations,
  };
}

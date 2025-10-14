/**
 * Retry helper with exponential backoff for Git operations
 */

import { createLogger } from '../../utils/logger';
import { RepositorySecurityError } from './RepositoryUrlValidator';

const logger = createLogger('checklist:templates:retry-helper');

/**
 * Check if error matches authentication patterns
 */
function isAuthenticationError(errorMessage: string): boolean {
  return (
    errorMessage.includes('authentication') ||
    errorMessage.includes('permission denied') ||
    errorMessage.includes('access denied') ||
    errorMessage.includes('401') ||
    errorMessage.includes('403')
  );
}

/**
 * Check if error matches not found patterns
 */
function isNotFoundError(errorMessage: string): boolean {
  return (
    errorMessage.includes('not found') ||
    errorMessage.includes('404') ||
    errorMessage.includes('does not exist')
  );
}

/**
 * Check if error matches invalid request patterns
 */
function isInvalidRequestError(errorMessage: string): boolean {
  return errorMessage.includes('invalid') || errorMessage.includes('malformed');
}

/**
 * Determine if error is non-transient (should not retry)
 */
export function isNonTransientError(error: unknown): boolean {
  if (error instanceof RepositorySecurityError) {
    return true;
  }

  const errorMessage = (error as Error).message.toLowerCase();

  return (
    isAuthenticationError(errorMessage) ||
    isNotFoundError(errorMessage) ||
    isInvalidRequestError(errorMessage)
  );
}

/**
 * Calculate exponential backoff delay
 */
export function calculateBackoffDelay(
  attempt: number,
  baseDelay: number
): number {
  return baseDelay * Math.pow(2, attempt);
}

/**
 * Wait for specified delay
 */
export async function waitFor(delayMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

/**
 * Log retry attempt
 */
export function logRetryAttempt(
  attempt: number,
  maxAttempts: number,
  error: Error,
  delay: number
): void {
  logger.warn({
    msg: 'Clone attempt failed, retrying with backoff',
    attempt: attempt + 1,
    maxAttempts,
    delayMs: delay,
    error: error.message,
  });
}

/**
 * Log non-transient error
 */
export function logNonTransientError(attempt: number, error: Error): void {
  logger.error({
    msg: 'Non-transient error detected, not retrying',
    error: error.message,
    attempt: attempt + 1,
  });
}

/**
 * Log final failure after all retries
 */
export function logFinalFailure(maxAttempts: number, error: Error): void {
  logger.error({
    msg: 'All retry attempts failed',
    attempts: maxAttempts,
    error: error.message,
  });
}

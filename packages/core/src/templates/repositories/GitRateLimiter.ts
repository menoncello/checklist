/**
 * Rate limiting for Git clone operations
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('checklist:templates:git-rate-limiter');

/**
 * Rate limiter for Git clone operations
 * Tracks clone attempts per user and enforces limits
 */
export class GitRateLimiter {
  private static readonly cloneAttempts = new Map<string, number[]>();

  constructor(private readonly maxClonesPerMinute: number) {}

  /**
   * Check if rate limit is exceeded
   * @throws Error if rate limit exceeded
   */
  check(): void {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    const userId = 'default';

    const attempts = GitRateLimiter.cloneAttempts.get(userId) ?? [];
    const recentAttempts = attempts.filter((time) => time > oneMinuteAgo);

    if (recentAttempts.length >= this.maxClonesPerMinute) {
      logger.error({
        msg: 'Rate limit exceeded',
        attempts: recentAttempts.length,
        limit: this.maxClonesPerMinute,
      });
      throw new Error(
        `Rate limit exceeded: ${this.maxClonesPerMinute} clones per minute. Please try again later.`
      );
    }
  }

  /**
   * Record successful clone attempt
   */
  record(): void {
    const now = Date.now();
    const userId = 'default';
    const attempts = GitRateLimiter.cloneAttempts.get(userId) ?? [];
    attempts.push(now);

    const oneMinuteAgo = now - 60000;
    const recentAttempts = attempts.filter((time) => time > oneMinuteAgo);
    GitRateLimiter.cloneAttempts.set(userId, recentAttempts);
  }
}

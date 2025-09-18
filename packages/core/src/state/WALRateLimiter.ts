import { createLogger } from '../utils/logger';

const logger = createLogger('checklist:wal:rate-limiter');

/**
 * Rate limiter for WAL operations
 */
export class WALRateLimiter {
  private lastWriteTime = 0;
  private writeCount = 0;
  private readonly rateWindow = 1000; // 1 second window
  private readonly maxWritesPerWindow =
    process.env.NODE_ENV === 'test' ? 10000 : 100; // Higher limit for tests

  /**
   * Check if write is allowed based on rate limits
   */
  canWrite(): boolean {
    const now = Date.now();
    const timeSinceLastWrite = now - this.lastWriteTime;

    // Reset window if expired
    if (timeSinceLastWrite >= this.rateWindow) {
      this.writeCount = 0;
      this.lastWriteTime = now;
    }

    // Check rate limit
    if (this.writeCount >= this.maxWritesPerWindow) {
      logger.warn({
        msg: 'WAL rate limit exceeded',
        writeCount: this.writeCount,
        window: this.rateWindow,
      });
      return false;
    }

    return true;
  }

  /**
   * Record a write operation
   */
  recordWrite(): void {
    this.writeCount++;
  }

  /**
   * Get current write stats
   */
  getStats(): { writeCount: number; lastWriteTime: number } {
    return {
      writeCount: this.writeCount,
      lastWriteTime: this.lastWriteTime,
    };
  }

  /**
   * Reset rate limiter
   */
  reset(): void {
    this.writeCount = 0;
    this.lastWriteTime = 0;
  }
}

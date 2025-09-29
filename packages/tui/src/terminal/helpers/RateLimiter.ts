/**
 * Rate Limiter for Terminal Capability Detection Queries
 * Prevents flooding terminal with too many queries
 */

export interface RateLimiterOptions {
  maxQueries: number;
  windowMs: number;
  blockDurationMs?: number;
}

export class RateLimiter {
  private queries: number[] = [];
  private blocked = false;
  private blockUntil = 0;

  constructor(
    private options: RateLimiterOptions = {
      maxQueries: 10,
      windowMs: 1000,
      blockDurationMs: 5000,
    }
  ) {}

  /**
   * Check if a query is allowed
   */
  public canQuery(): boolean {
    const now = Date.now();

    // Check if currently blocked
    if (this.blocked && now < this.blockUntil) {
      return false;
    }

    // Unblock if block period has expired
    if (this.blocked && now >= this.blockUntil) {
      this.blocked = false;
      this.queries = [];
    }

    // Remove queries outside the time window
    this.queries = this.queries.filter(
      (timestamp) => now - timestamp < this.options.windowMs
    );

    // Check if limit exceeded
    if (this.queries.length >= this.options.maxQueries) {
      this.block();
      return false;
    }

    return true;
  }

  /**
   * Record a query
   */
  public recordQuery(): void {
    if (!this.canQuery()) {
      throw new Error('Rate limit exceeded for capability queries');
    }

    this.queries.push(Date.now());
  }

  /**
   * Block queries for a period
   */
  private block(): void {
    this.blocked = true;
    this.blockUntil = Date.now() + (this.options.blockDurationMs ?? 5000);
  }

  /**
   * Reset the rate limiter
   */
  public reset(): void {
    this.queries = [];
    this.blocked = false;
    this.blockUntil = 0;
  }

  /**
   * Get current status
   */
  public getStatus(): {
    queriesInWindow: number;
    isBlocked: boolean;
    timeUntilReset: number;
  } {
    const now = Date.now();

    // Clean old queries
    this.queries = this.queries.filter(
      (timestamp) => now - timestamp < this.options.windowMs
    );

    return {
      queriesInWindow: this.queries.length,
      isBlocked: this.blocked && now < this.blockUntil,
      timeUntilReset: this.blocked ? Math.max(0, this.blockUntil - now) : 0,
    };
  }

  /**
   * Update options
   */
  public updateOptions(options: Partial<RateLimiterOptions>): void {
    this.options = { ...this.options, ...options };
  }
}

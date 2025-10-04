import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:shutdown-timers');

export class ShutdownTimers {
  private timeoutTimer: Timer | null = null;
  private forceKillTimer: Timer | null = null;

  public startTimeoutTimer(timeout: number, onTimeout: () => void): void {
    this.timeoutTimer = globalThis.setTimeout(() => {
      logger.warn({ msg: 'Shutdown timeout reached' });
      onTimeout();
    }, timeout);
  }

  public startForceKillTimer(
    forceKillDelay: number,
    onForceKill: () => void
  ): void {
    this.forceKillTimer = globalThis.setTimeout(() => {
      logger.warn({ msg: 'Force kill timeout reached' });
      onForceKill();
    }, forceKillDelay);
  }

  public clearTimers(): void {
    if (this.timeoutTimer) {
      globalThis.clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }

    if (this.forceKillTimer) {
      globalThis.clearTimeout(this.forceKillTimer);
      this.forceKillTimer = null;
    }

    logger.debug({ msg: 'Shutdown timers cleared' });
  }

  public isTimeoutActive(): boolean {
    return this.timeoutTimer !== null;
  }

  public isForceKillActive(): boolean {
    return this.forceKillTimer !== null;
  }
}

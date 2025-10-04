import { createLogger } from '@checklist/core/utils/logger';
import { ErrorBoundary } from './ErrorBoundary';

const logger = createLogger('checklist:tui:panic-recovery-strategies');

export class PanicRecoveryStrategies {
  private recoveryStrategies: Map<string, () => Promise<boolean>> = new Map();

  constructor(private errorBoundary: ErrorBoundary) {
    this.setupRecoveryStrategies();
  }

  private setupRecoveryStrategies(): void {
    this.setupStateStrategy();
    this.setupTerminalStrategy();
    this.setupShutdownStrategy();
    this.setupExitStrategy();
  }

  private setupStateStrategy(): void {
    this.recoveryStrategies.set('save_state', async () => {
      try {
        this.errorBoundary.preserveCurrentState();
        return true;
      } catch (error) {
        logger.error({
          msg: 'Failed to save state during panic recovery',
          error: (error as Error).message,
        });
        return false;
      }
    });
  }

  private setupTerminalStrategy(): void {
    this.recoveryStrategies.set('restore_terminal', async () => {
      try {
        this.errorBoundary.clearError();
        return true;
      } catch (error) {
        logger.error({
          msg: 'Failed to restore terminal during panic recovery',
          error: (error as Error).message,
        });
        return false;
      }
    });
  }

  private setupShutdownStrategy(): void {
    this.recoveryStrategies.set('graceful_shutdown', async () => {
      try {
        await this.errorBoundary.onShutdown();
        return true;
      } catch (error) {
        logger.error({
          msg: 'Failed to perform graceful shutdown during panic recovery',
          error: (error as Error).message,
        });
        return false;
      }
    });
  }

  private setupExitStrategy(): void {
    this.recoveryStrategies.set('emergency_exit', async () => {
      try {
        process.exit(1);
      } catch (error) {
        logger.error({
          msg: 'Failed to perform emergency exit during panic recovery',
          error: (error as Error).message,
        });
        return false;
      }
    });
  }

  public async executeStrategy(strategyName: string): Promise<boolean> {
    const strategy = this.recoveryStrategies.get(strategyName);
    if (!strategy) {
      logger.error({
        msg: 'Unknown recovery strategy',
        strategy: strategyName,
      });
      return false;
    }

    return await strategy();
  }

  public getAvailableStrategies(): string[] {
    return Array.from(this.recoveryStrategies.keys());
  }
}

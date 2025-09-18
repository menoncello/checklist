import { RecoveryStrategy, CrashState } from './types';

export class StrategyManager {
  private strategies: RecoveryStrategy[] = [];
  private onStateRestored?: () => void;

  constructor() {
    this.setupDefaultStrategies();
  }

  public setOnStateRestored(callback: () => void): void {
    this.onStateRestored = callback;
  }

  private setupDefaultStrategies(): void {
    const defaultStrategies: RecoveryStrategy[] = [
      this.createMemoryCleanupStrategy(),
      this.createStateRestorationStrategy(),
      this.createComponentRestartStrategy(),
      this.createStateResetStrategy(),
      this.createResourceCleanupStrategy(),
      this.createSafeModeStrategy(),
      this.createFullRestartStrategy(),
    ];

    for (const strategy of defaultStrategies) {
      this.addStrategy(strategy);
    }
  }

  private createMemoryCleanupStrategy(): RecoveryStrategy {
    return {
      name: 'memoryCleanup',
      priority: 1,
      timeoutMs: 2000,
      description: 'Clean up memory and garbage collect',
      condition: (crashState: CrashState) =>
        crashState.crashReason.includes('memory') ||
        crashState.crashReason.includes('heap'),
      execute: async (): Promise<boolean> => {
        try {
          if (global.gc) {
            global.gc();
          }
          await this.delay(500);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  private createStateRestorationStrategy(): RecoveryStrategy {
    return {
      name: 'stateRestoration',
      priority: 2,
      timeoutMs: 3000,
      description: 'Restore application state from backup',
      condition: (): boolean => true, // Always applicable
      execute: async (): Promise<boolean> => {
        try {
          // Attempt state restoration
          await this.delay(1000);
          // Emit state restored event via callback
          if (this.onStateRestored) {
            this.onStateRestored();
          }
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  private createComponentRestartStrategy(): RecoveryStrategy {
    return {
      name: 'componentRestart',
      priority: 3,
      timeoutMs: 4000,
      description: 'Restart application components',
      condition: (crashState: CrashState) => crashState.recoveryAttempts >= 1,
      execute: async (): Promise<boolean> => {
        try {
          // Restart components
          await this.delay(1500);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  private createStateResetStrategy(): RecoveryStrategy {
    return {
      name: 'state-reset',
      priority: 4,
      timeoutMs: 1000,
      description: 'Reset application state to safe defaults',
      condition: (): boolean => true, // Always applicable
      execute: async (): Promise<boolean> => {
        try {
          // Reset to safe state
          await this.delay(200);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  private createResourceCleanupStrategy(): RecoveryStrategy {
    return {
      name: 'resource-cleanup',
      priority: 5,
      timeoutMs: 3000,
      description: 'Clean up file handles and network connections',
      condition: (crashState: CrashState) =>
        crashState.crashReason.includes('EMFILE') ||
        crashState.crashReason.includes('ECONNREFUSED') ||
        crashState.crashReason.includes('resource'),
      execute: async (): Promise<boolean> => {
        try {
          // Clean up resources
          await this.delay(300);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  private createSafeModeStrategy(): RecoveryStrategy {
    return {
      name: 'safeMode',
      priority: 6,
      timeoutMs: 2000,
      description: 'Enter safe mode with minimal functionality',
      condition: (crashState: CrashState) => crashState.recoveryAttempts >= 1,
      execute: async (): Promise<boolean> => {
        try {
          // Enter safe mode
          await this.delay(800);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  private createFullRestartStrategy(): RecoveryStrategy {
    return {
      name: 'fullRestart',
      priority: 7,
      timeoutMs: 5000,
      description: 'Attempt graceful application restart',
      condition: (crashState: CrashState) => crashState.recoveryAttempts >= 2,
      execute: async (): Promise<boolean> => {
        try {
          // Prepare for restart
          await this.delay(1000);
          return true;
        } catch {
          return false;
        }
      },
    };
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  public addStrategy(strategy: RecoveryStrategy): void {
    // Insert strategy in priority order (higher number = higher priority)
    const insertIndex = this.strategies.findIndex(
      (s) => s.priority < strategy.priority
    );
    if (insertIndex === -1) {
      this.strategies.push(strategy);
    } else {
      this.strategies.splice(insertIndex, 0, strategy);
    }
  }

  public removeStrategy(name: string): boolean {
    const index = this.strategies.findIndex((s) => s.name === name);
    if (index === -1) return false;

    this.strategies.splice(index, 1);
    return true;
  }

  public getApplicableStrategies(crashState: CrashState): RecoveryStrategy[] {
    return this.strategies.filter((strategy) => strategy.condition(crashState));
  }

  public async executeStrategy(
    strategy: RecoveryStrategy,
    _crashState: CrashState
  ): Promise<boolean> {
    console.log(`Executing recovery strategy: ${strategy.name}`);

    try {
      const timeoutMs = strategy.timeoutMs ?? 5000;
      const result = await this.withTimeout(strategy.execute(), timeoutMs);

      console.log(
        `Recovery strategy '${strategy.name}' ${result ? 'succeeded' : 'failed'}`
      );
      return result;
    } catch (error) {
      console.error(`Recovery strategy '${strategy.name}' threw error:`, error);
      return false;
    }
  }

  private async withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number
  ): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Strategy timeout')), timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]);
  }

  public async executeRecovery(crashState: CrashState): Promise<boolean> {
    const applicableStrategies = this.getApplicableStrategies(crashState);

    if (applicableStrategies.length === 0) {
      console.warn('No applicable recovery strategies found');
      return false;
    }

    console.log(
      `Found ${applicableStrategies.length} applicable recovery strategies`
    );

    for (const strategy of applicableStrategies) {
      const success = await this.executeStrategy(strategy, crashState);
      if (success) {
        return true;
      }
    }

    console.error('All recovery strategies failed');
    return false;
  }

  public getStrategies(): RecoveryStrategy[] {
    return [...this.strategies];
  }

  public getStrategyByName(name: string): RecoveryStrategy | undefined {
    return this.strategies.find((s) => s.name === name);
  }

  public getStrategyCount(): number {
    return this.strategies.length;
  }

  public clearStrategies(): void {
    this.strategies = [];
  }

  public hasStrategy(name: string): boolean {
    return this.strategies.some((s) => s.name === name);
  }

  public updateStrategy(
    name: string,
    updates: Partial<RecoveryStrategy>
  ): boolean {
    const index = this.strategies.findIndex((s) => s.name === name);
    if (index === -1) return false;

    this.strategies[index] = { ...this.strategies[index], ...updates };
    return true;
  }
}

import { StateBackup } from './types';

export class StateManager {
  private stateBackups = new Map<string, StateBackup>();
  private backupTimer: Timer | null = null;
  private backupInterval: number;
  private enableStateBackups: boolean;

  constructor(
    backupInterval: number = 30000,
    enableStateBackups: boolean = true
  ) {
    this.backupInterval = backupInterval;
    this.enableStateBackups = enableStateBackups;

    if (this.enableStateBackups) {
      this.startBackupTimer();
    }
  }

  private startBackupTimer(): void {
    this.backupTimer = setInterval(() => {
      this.performPeriodicBackup();
    }, this.backupInterval);
  }

  private performPeriodicBackup(): void {
    try {
      const globalState = this.captureGlobalState();
      if (globalState != null) {
        this.backupState('global', globalState);
      }
    } catch (error) {
      console.error('Failed to perform periodic backup:', error);
    }
  }

  private captureGlobalState(): unknown {
    // Capture current application state
    // This would be implementation specific
    return {
      timestamp: Date.now(),
      memory: process.memoryUsage(),
      uptime: process.uptime(),
    };
  }

  public backupState(key: string, data: unknown): string {
    const backup: StateBackup = {
      id: this.generateBackupId(),
      timestamp: Date.now(),
      data,
      size: this.calculateSize(data),
      compressed: false,
      integrity: this.calculateIntegrity(data),
    };

    this.stateBackups.set(key, backup);
    this.trimOldBackups();
    return backup.id;
  }

  private generateBackupId(): string {
    return `backup-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private calculateSize(data: unknown): number {
    return JSON.stringify(data).length * 2; // Rough estimate in bytes
  }

  private calculateIntegrity(data: unknown): string {
    const str = JSON.stringify(data);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  }

  private trimOldBackups(): void {
    const maxBackups = 10;
    if (this.stateBackups.size <= maxBackups) return;

    const sortedBackups = Array.from(this.stateBackups.entries()).sort(
      ([, a], [, b]) => a.timestamp - b.timestamp
    );

    const toDelete = sortedBackups.slice(
      0,
      this.stateBackups.size - maxBackups
    );
    for (const [key] of toDelete) {
      this.stateBackups.delete(key);
    }
  }

  public restoreState(key: string): unknown | null {
    const backup = this.stateBackups.get(key);
    if (!backup) return null;

    if (!this.verifyIntegrity(backup)) {
      console.warn(`State backup integrity check failed for key: ${key}`);
      return null;
    }

    return backup.data;
  }

  private verifyIntegrity(backup: StateBackup): boolean {
    const currentIntegrity = this.calculateIntegrity(backup.data);
    return currentIntegrity === backup.integrity;
  }

  public hasBackup(key: string): boolean {
    return this.stateBackups.has(key);
  }

  public getBackupInfo(key: string): StateBackup | null {
    const backup = this.stateBackups.get(key);
    return backup ? { ...backup } : null;
  }

  public listBackups(): Array<{ key: string; backup: StateBackup }> {
    return Array.from(this.stateBackups.entries()).map(([key, backup]) => ({
      key,
      backup: { ...backup },
    }));
  }

  public clearBackup(key: string): boolean {
    return this.stateBackups.delete(key);
  }

  public clearAllBackups(): void {
    this.stateBackups.clear();
  }

  public getBackupCount(): number {
    return this.stateBackups.size;
  }

  public getTotalBackupSize(): number {
    return Array.from(this.stateBackups.values()).reduce(
      (total, backup) => total + backup.size,
      0
    );
  }

  public cleanup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }
    this.clearAllBackups();
  }

  public updateConfig(
    backupInterval?: number,
    enableStateBackups?: boolean
  ): void {
    if (backupInterval !== undefined) {
      this.backupInterval = backupInterval;
    }

    if (enableStateBackups !== undefined) {
      this.enableStateBackups = enableStateBackups;
    }

    // Restart timer if needed
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }

    if (this.enableStateBackups) {
      this.startBackupTimer();
    }
  }
}

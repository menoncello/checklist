import { ShutdownTask, ShutdownConfig } from './types';

export class ShutdownTasks {
  private config: ShutdownConfig;
  private tasks: ShutdownTask[] = [];

  constructor(config: ShutdownConfig) {
    this.config = config;
  }

  public setupDefaultTasks(): void {
    this.addStateTask();
    this.addConnectionTask();
    this.addTimerTask();
    this.addTempCleanupTask();
    this.addFinalCleanupTask();
  }

  private addStateTask(): void {
    this.addTask({
      id: 'save-state',
      name: 'Save Application State',
      priority: 100,
      timeout: 5000,
      execute: async () => {
        if (this.config.saveState) {
          await this.saveApplicationState();
        }
      },
      critical: true,
    });
  }

  private addConnectionTask(): void {
    this.addTask({
      id: 'close-connections',
      name: 'Close Database Connections',
      priority: 90,
      timeout: 10000,
      execute: async () => {
        await this.closeDatabaseConnections();
      },
    });
  }

  private addTimerTask(): void {
    this.addTask({
      id: 'stop-timers',
      name: 'Stop Timers and Intervals',
      priority: 80,
      timeout: 2000,
      execute: async () => {
        await this.stopTimersAndIntervals();
      },
    });
  }

  private addTempCleanupTask(): void {
    this.addTask({
      id: 'cleanup-temp',
      name: 'Cleanup Temporary Resources',
      priority: 70,
      timeout: 3000,
      execute: async () => {
        await this.cleanupTemporaryResources();
      },
    });
  }

  private addFinalCleanupTask(): void {
    this.addTask({
      id: 'final-cleanup',
      name: 'Final Cleanup',
      priority: 10,
      timeout: 1000,
      execute: async () => {
        await this.performFinalCleanup();
      },
    });
  }

  public addTask(task: ShutdownTask): void {
    this.tasks.push(task);
    this.tasks.sort((a, b) => b.priority - a.priority);
  }

  public removeTask(id: string): boolean {
    const index = this.tasks.findIndex((task) => task.id === id);
    if (index !== -1) {
      this.tasks.splice(index, 1);
      return true;
    }
    return false;
  }

  public getTasks(): ShutdownTask[] {
    return [...this.tasks];
  }

  public getTaskById(id: string): ShutdownTask | undefined {
    return this.tasks.find((task) => task.id === id);
  }

  public clear(): void {
    this.tasks.length = 0;
  }

  // Default task implementations
  private async saveApplicationState(): Promise<void> {
    // This would save actual application state
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async closeDatabaseConnections(): Promise<void> {
    // This would close actual database connections
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  private async stopTimersAndIntervals(): Promise<void> {
    // This would stop actual timers and intervals
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  private async cleanupTemporaryResources(): Promise<void> {
    // This would clean up temporary files, caches, etc.
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  private async performFinalCleanup(): Promise<void> {
    // This would perform final cleanup tasks
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
}

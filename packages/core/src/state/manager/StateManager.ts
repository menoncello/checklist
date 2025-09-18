import { createLogger } from '../../utils/logger';
import { BackupManager } from '../BackupManager';
import { ConcurrencyManager } from '../ConcurrencyManager';
import { DirectoryManager } from '../DirectoryManager';
import { TransactionCoordinator } from '../TransactionCoordinator';
import { MigrationRegistry } from '../migrations/MigrationRegistry';
import { MigrationRunner } from '../migrations/MigrationRunner';
import { migrations } from '../migrations/scripts';
import { BackupInfo } from '../migrations/types';
import { ChecklistState } from '../types';
import { StateValidator } from '../validation';
import { MigrationManager } from './MigrationManager';
import { StateInitializer } from './StateInitializer';
import { StateLoader } from './StateLoader';
import { StateSaver } from './StateSaver';

export class StateManager {
  private initializer!: StateInitializer;
  private loader!: StateLoader;
  private saver!: StateSaver;
  private migrationManager!: MigrationManager;
  private currentState?: ChecklistState;
  private logger = createLogger('checklist:state:manager');
  private isRecovering = false;

  constructor(baseDir: string = '.checklist') {
    const deps = this.initializeDependencies(baseDir);
    this.initializeManagers(deps);
  }

  private initializeDependencies(baseDir: string) {
    const directoryManager = new DirectoryManager(baseDir);
    const validator = new StateValidator();
    const backupManager = new BackupManager(directoryManager.getBackupPath());
    const migrationRunner = this.createMigrationRunner(
      directoryManager,
      backupManager
    );

    return {
      directoryManager,
      concurrencyManager: new ConcurrencyManager(
        directoryManager.getLockPath()
      ),
      transactionCoordinator: new TransactionCoordinator(
        directoryManager.getLogPath()
      ),
      validator,
      backupManager,
      migrationRunner,
    };
  }

  private initializeManagers(
    deps: ReturnType<typeof this.initializeDependencies>
  ): void {
    this.initializer = new StateInitializer(
      deps.directoryManager,
      deps.validator,
      deps.migrationRunner
    );
    this.loader = new StateLoader(
      deps.directoryManager,
      deps.validator,
      deps.migrationRunner
    );
    this.saver = new StateSaver(deps);
    this.migrationManager = new MigrationManager(
      deps.directoryManager,
      deps.migrationRunner,
      deps.backupManager
    );
  }

  private createMigrationRunner(
    directoryManager: DirectoryManager,
    _backupManager: BackupManager
  ): MigrationRunner {
    const registry = new MigrationRegistry();
    migrations.forEach((m) => registry.registerMigration(m));
    return new MigrationRunner(registry, directoryManager.getBackupPath());
  }

  // State lifecycle methods
  async initializeState(): Promise<ChecklistState> {
    this.currentState = await this.initializer.initializeState();
    return this.currentState;
  }

  async loadState(): Promise<ChecklistState> {
    this.currentState = await this.loader.loadState();
    return this.currentState;
  }

  async saveState(state: ChecklistState): Promise<void> {
    await this.saver.saveState(state);
    this.currentState = state;
  }

  async archiveState(): Promise<void> {
    await this.saver.archiveState();
    this.currentState = undefined;
  }

  // Migration methods
  async checkMigrationStatus(): Promise<{
    currentVersion: string;
    latestVersion: string;
    targetVersion: string;
    needsMigration: boolean;
    availableMigrations: string[];
    migrationPath: string[];
  }> {
    return await this.migrationManager.checkMigrationStatus();
  }

  async listBackups(): Promise<BackupInfo[]> {
    return await this.migrationManager.listBackups();
  }

  async restoreFromBackup(backupPath: string): Promise<void> {
    this.isRecovering = true;
    try {
      await this.migrationManager.restoreFromBackup(backupPath);
      this.currentState = await this.loadState();
    } finally {
      this.isRecovering = false;
    }
  }

  // Import/Export methods
  async exportState(): Promise<string> {
    this.currentState ??= await this.loadState();
    return await this.saver.exportState(this.currentState);
  }

  async importState(yamlContent: string): Promise<ChecklistState> {
    const state = await this.loader.importState(yamlContent);
    await this.saveState(state);
    return state;
  }

  // Utility methods
  getCurrentState(): ChecklistState | undefined {
    return this.currentState;
  }

  isRecoveringState(): boolean {
    return this.isRecovering;
  }

  async cleanup(): Promise<void> {
    this.logger.info({ msg: 'Cleaning up state manager resources' });
    this.currentState = undefined;
  }
}

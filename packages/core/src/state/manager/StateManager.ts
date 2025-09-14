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
  private initializer: StateInitializer;
  private loader: StateLoader;
  private saver: StateSaver;
  private migrationManager: MigrationManager;
  private currentState?: ChecklistState;
  private logger = createLogger('checklist:state:manager');
  private isRecovering = false;

  constructor(baseDir: string = '.checklist') {
    // Initialize core dependencies
    const directoryManager = new DirectoryManager(baseDir);
    const concurrencyManager = new ConcurrencyManager(
      directoryManager.getLockPath()
    );
    const transactionCoordinator = new TransactionCoordinator(
      directoryManager.getLogPath()
    );
    const validator = new StateValidator();
    const backupManager = new BackupManager(directoryManager.getBackupPath());

    // Initialize migration system
    const migrationRunner = this.createMigrationRunner(
      directoryManager,
      backupManager
    );

    // Initialize specialized managers
    this.initializer = new StateInitializer(
      directoryManager,
      validator,
      migrationRunner
    );
    this.loader = new StateLoader(directoryManager, validator, migrationRunner);
    this.saver = new StateSaver({
      directoryManager,
      concurrencyManager,
      transactionCoordinator,
      validator,
      backupManager,
    });
    this.migrationManager = new MigrationManager(
      directoryManager,
      migrationRunner,
      backupManager
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

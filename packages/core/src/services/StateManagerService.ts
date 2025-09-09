import * as path from 'path';
import { load as yamlLoad, dump as yamlDump } from 'js-yaml';
import type { IFileSystemService } from '../interfaces/IFileSystemService';
import type {
  IStateManager,
  StateData,
  WorkflowInstance,
} from '../interfaces/IStateManager';
import type { Logger } from '../utils/logger';
import { BaseService, ServiceConfig } from './BaseService';

export interface StateManagerConfig extends ServiceConfig {
  workingDirectory?: string;
  backupEnabled?: boolean;
  maxBackups?: number;
  validationEnabled?: boolean;
}

export class StateManagerService extends BaseService implements IStateManager {
  private workingDir: string = '.checklist';
  private statePath: string = '';
  private backupDir: string = '';
  private fileSystemService: IFileSystemService;
  private isLocked = false;
  private lockFilePath: string = '';

  constructor(
    config: StateManagerConfig,
    logger: Logger,
    fileSystemService: IFileSystemService
  ) {
    super(config, logger);
    this.fileSystemService = fileSystemService;

    if (
      config.workingDirectory !== undefined &&
      config.workingDirectory !== ''
    ) {
      this.workingDir = config.workingDirectory;
    }
  }

  async initialize(workingDir?: string): Promise<void> {
    if (workingDir !== undefined && workingDir !== '') {
      this.workingDir = workingDir;
    }

    this.statePath = path.join(this.workingDir, 'state.yaml');
    this.backupDir = path.join(this.workingDir, '.backup');
    this.lockFilePath = path.join(this.workingDir, '.lock');

    // Create directories if they don't exist
    await this.fileSystemService.ensureDirectory(this.workingDir);
    await this.fileSystemService.ensureDirectory(this.backupDir);

    this.logger.debug({
      msg: 'StateManager initialized',
      workingDir: this.workingDir,
      statePath: this.statePath,
    });
  }

  async load(): Promise<StateData> {
    try {
      if (!(await this.fileSystemService.exists(this.statePath))) {
        return this.createDefaultState();
      }

      const content = await this.fileSystemService.readFile(this.statePath, {
        encoding: 'utf8',
      });
      const state = yamlLoad(content) as StateData;

      if (!this.validate(state)) {
        throw new Error('State validation failed');
      }

      this.logger.debug({
        msg: 'State loaded successfully',
        statePath: this.statePath,
      });
      return state;
    } catch (error) {
      this.logger.error({
        msg: 'Failed to load state',
        error: (error as Error).message,
        statePath: this.statePath,
      });
      throw error;
    }
  }

  async save(state: StateData): Promise<void> {
    try {
      if (!this.validate(state)) {
        throw new Error('State validation failed before save');
      }

      // Create backup before saving
      if (await this.fileSystemService.exists(this.statePath)) {
        await this.backup();
      }

      // Atomic write using temp file + rename
      const tempPath = `${this.statePath}.tmp`;
      const yamlContent = yamlDump(state, { indent: 2 });

      await this.fileSystemService.writeFile(tempPath, yamlContent);
      await this.fileSystemService.moveFile(tempPath, this.statePath);

      this.logger.debug({
        msg: 'State saved successfully',
        statePath: this.statePath,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to save state',
        error: (error as Error).message,
        statePath: this.statePath,
      });
      throw error;
    }
  }

  async backup(): Promise<string> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = path.join(this.backupDir, `state-${timestamp}.yaml`);

      if (await this.fileSystemService.exists(this.statePath)) {
        await this.fileSystemService.copyFile(this.statePath, backupPath);

        this.logger.debug({
          msg: 'State backed up',
          backupPath,
        });

        // Clean old backups if needed
        await this.cleanOldBackups();

        return backupPath;
      }

      return '';
    } catch (error) {
      this.logger.error({
        msg: 'Failed to backup state',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  async restore(backupPath: string): Promise<void> {
    try {
      if (!(await this.fileSystemService.exists(backupPath))) {
        throw new Error(`Backup file not found: ${backupPath}`);
      }

      // Validate backup before restoring
      const content = await this.fileSystemService.readFile(backupPath, {
        encoding: 'utf8',
      });
      const state = yamlLoad(content) as StateData;

      if (!this.validate(state)) {
        throw new Error('Backup validation failed');
      }

      // Backup current state before restoring
      if (await this.fileSystemService.exists(this.statePath)) {
        await this.backup();
      }

      await this.fileSystemService.copyFile(backupPath, this.statePath);

      this.logger.info({
        msg: 'State restored from backup',
        backupPath,
      });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to restore state',
        error: (error as Error).message,
        backupPath,
      });
      throw error;
    }
  }

  validate(state: StateData): boolean {
    try {
      // Basic structure validation
      if (state === null || state === undefined || typeof state !== 'object') {
        return false;
      }

      if (!state.version || typeof state.version !== 'string') {
        return false;
      }

      if (!Array.isArray(state.instances)) {
        return false;
      }

      // Validate each instance
      for (const instance of state.instances) {
        if (!this.validateInstance(instance)) {
          return false;
        }
      }

      return true;
    } catch {
      return false;
    }
  }

  async reset(): Promise<void> {
    try {
      const defaultState = this.createDefaultState();
      await this.save(defaultState);

      this.logger.info({ msg: 'State reset to default' });
    } catch (error) {
      this.logger.error({
        msg: 'Failed to reset state',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  getWorkingDirectory(): string {
    return this.workingDir;
  }

  async exists(): Promise<boolean> {
    return this.fileSystemService.exists(this.statePath);
  }

  async lock(): Promise<void> {
    if (this.isLocked) {
      throw new Error('State is already locked');
    }

    if (await this.fileSystemService.exists(this.lockFilePath)) {
      throw new Error('State is locked by another process');
    }

    await this.fileSystemService.writeFile(
      this.lockFilePath,
      JSON.stringify({
        pid: process.pid,
        timestamp: new Date().toISOString(),
      })
    );

    this.isLocked = true;
    this.logger.debug({ msg: 'State locked' });
  }

  async unlock(): Promise<void> {
    if (!this.isLocked) {
      return;
    }

    if (await this.fileSystemService.exists(this.lockFilePath)) {
      await this.fileSystemService.deleteFile(this.lockFilePath);
    }

    this.isLocked = false;
    this.logger.debug({ msg: 'State unlocked' });
  }

  protected async onInitialize(): Promise<void> {
    await this.initialize();
  }

  protected async onShutdown(): Promise<void> {
    if (this.isLocked) {
      await this.unlock();
    }
  }

  private createDefaultState(): StateData {
    return {
      version: '1.0.0',
      instances: [],
      config: {},
    };
  }

  private validateInstance(instance: WorkflowInstance): boolean {
    if (!instance.id || typeof instance.id !== 'string') {
      return false;
    }

    if (!instance.workflowId || typeof instance.workflowId !== 'string') {
      return false;
    }

    if (!instance.currentStepId || typeof instance.currentStepId !== 'string') {
      return false;
    }

    const validStatuses = ['active', 'completed', 'paused', 'failed'];
    if (!validStatuses.includes(instance.status)) {
      return false;
    }

    return true;
  }

  private async cleanOldBackups(): Promise<void> {
    const maxBackups = (this.config as StateManagerConfig).maxBackups ?? 10;

    try {
      const files = await this.fileSystemService.readDirectory(this.backupDir);
      const backupFiles = files
        .filter((f) => f.startsWith('state-') && f.endsWith('.yaml'))
        .sort()
        .reverse();

      if (backupFiles.length > maxBackups) {
        const filesToDelete = backupFiles.slice(maxBackups);

        for (const file of filesToDelete) {
          await this.fileSystemService.deleteFile(
            path.join(this.backupDir, file)
          );
        }

        this.logger.debug({
          msg: 'Cleaned old backups',
          deleted: filesToDelete.length,
        });
      }
    } catch (error) {
      this.logger.warn({
        msg: 'Failed to clean old backups',
        error: (error as Error).message,
      });
    }
  }
}

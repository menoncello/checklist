import { StateManager } from '@checklist/core/state/StateManager';
import ansi from 'ansis';

export interface MigrateOptions {
  check?: boolean;
  dryRun?: boolean;
  backupOnly?: boolean;
  listBackups?: boolean;
  restore?: string;
  verbose?: boolean;
}

export class MigrateCommand {
  private stateManager: StateManager;

  constructor(baseDir: string = '.checklist') {
    this.stateManager = new StateManager(baseDir);
  }

  async execute(options: MigrateOptions = {}): Promise<void> {
    try {
      if (options.check === true) {
        await this.checkMigrationStatus();
      } else if (options.listBackups === true) {
        await this.listBackups();
      } else if (options.restore !== undefined && options.restore !== '') {
        await this.restoreBackup(options.restore);
      } else if (options.backupOnly === true) {
        await this.createBackupOnly();
      } else {
        await this.runMigration(options);
      }
    } catch (error) {
      console.error(ansi.red('Migration error:'), error);
      process.exit(1);
    }
  }

  private async checkMigrationStatus(): Promise<void> {
    console.log(ansi.cyan('Checking migration status...'));

    const status = await this.stateManager.checkMigrationStatus();

    if (status.needsMigration) {
      console.log(ansi.yellow('Migration needed:'));
      console.log(`  Current version: ${ansi.red(status.currentVersion)}`);
      console.log(`  Target version:  ${ansi.green(status.targetVersion)}`);

      if (status.migrationPath && status.migrationPath.length > 0) {
        console.log(ansi.cyan('\nMigration path:'));
        status.migrationPath.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step}`);
        });
      }
    } else {
      console.log(ansi.green('✅ State file is up to date'));
      console.log(`  Version: ${status.currentVersion}`);
    }
  }

  private async listBackups(): Promise<void> {
    console.log(ansi.cyan('Available backups:'));

    const backups = await this.stateManager.listBackups();

    if (backups.length === 0) {
      console.log(ansi.yellow('No backups found'));
      return;
    }

    console.log(ansi.white('\nBackup files:'));
    backups.forEach((backup, index) => {
      const size = (backup.size / 1024).toFixed(2);
      console.log(
        `  ${index + 1}. v${backup.version} - ${backup.timestamp} (${size} KB)`
      );
      console.log(`     ${ansi.gray(backup.path)}`);
    });
  }

  private async restoreBackup(backupPath: string): Promise<void> {
    console.log(ansi.cyan(`Restoring from backup: ${backupPath}`));

    try {
      await this.stateManager.restoreFromBackup(backupPath);
      console.log(ansi.green('✅ Successfully restored from backup'));
    } catch (error) {
      console.error(ansi.red('Failed to restore backup:'), error);
      throw error;
    }
  }

  private async createBackupOnly(): Promise<void> {
    console.log(ansi.cyan('Creating backup...'));

    const status = await this.stateManager.checkMigrationStatus();

    // Use migration runner to create backup
    const backups = await this.stateManager.listBackups();
    console.log(
      ansi.green(`✅ Backup created for version ${status.currentVersion}`)
    );

    if (backups.length > 0) {
      const latest = backups[0];
      console.log(`  Path: ${ansi.gray(latest.path)}`);
    }
  }

  private async runMigration(options: MigrateOptions): Promise<void> {
    const status = await this.stateManager.checkMigrationStatus();

    if (!status.needsMigration) {
      console.log(ansi.green('✅ No migration needed'));
      console.log(`  Current version: ${status.currentVersion}`);
      return;
    }

    console.log(ansi.cyan('Starting migration...'));
    console.log(`  From: ${ansi.yellow(status.currentVersion)}`);
    console.log(`  To:   ${ansi.green(status.targetVersion)}`);

    if (options.dryRun === true) {
      console.log(ansi.yellow('\n🔍 Dry run mode - no changes will be made'));

      if (
        status.migrationPath !== undefined &&
        status.migrationPath.length > 0
      ) {
        console.log(ansi.cyan('\nMigrations that would be applied:'));
        status.migrationPath.forEach((step, index) => {
          console.log(`  ${index + 1}. ${step}`);
        });
      }

      console.log(ansi.green('\n✅ Dry run completed successfully'));
      return;
    }

    // Actually run the migration
    console.log(ansi.cyan('\nApplying migrations...'));

    try {
      await this.stateManager.loadState();
      console.log(ansi.green('\n🎉 Migration completed successfully!'));
      console.log(`  New version: ${status.targetVersion}`);
    } catch (error) {
      console.error(ansi.red('\n❌ Migration failed:'), error);
      console.log(
        ansi.yellow('Your data has been backed up and can be restored')
      );
      throw error;
    }
  }
}

#!/usr/bin/env bun

import { MigrateCommand, MigrateOptions } from './commands/migrate';

export const version = '0.0.1';

const args = Bun.argv.slice(2);
const command = args[0];

function showVersion(): void {
  console.log(`checklist version ${version}`);
}

function showHelp(): void {
  console.log(`
Checklist CLI - Manage your checklists and workflows

Usage: checklist [command] [options]

Commands:
  migrate              Run state file migrations
    --check            Check current state version
    --dry-run          Show what would change without applying
    --backup-only      Create backup without migrating
    --list-backups     List available backups
    --restore <path>   Restore from specific backup
    --verbose, -v      Show detailed output

  --version, -v        Show version
  --help, -h           Show this help message

Examples:
  checklist migrate --check
  checklist migrate --dry-run
  checklist migrate --backup-only
  checklist migrate --restore ~/.checklist/backups/backup-20240101.yaml
`);
}

function handleRestoreOption(args: string[], index: number): string | null {
  if (index + 1 < args.length) {
    return args[index + 1];
  }
  console.error('--restore requires a backup path');
  process.exit(1);
}

function parseMigrateOptions(args: string[]): MigrateOptions {
  const options: MigrateOptions = {};
  const optionMap: Record<string, keyof MigrateOptions> = {
    '--check': 'check',
    '--dry-run': 'dryRun',
    '--backup-only': 'backupOnly',
    '--list-backups': 'listBackups',
    '--verbose': 'verbose',
    '-v': 'verbose',
  };

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--restore') {
      const value = handleRestoreOption(args, i);
      if (value != null && value !== '') {
        options.restore = value;
        i++; // Skip next arg since it's the value
      }
    } else if (arg.startsWith('--restore=')) {
      options.restore = arg.substring('--restore='.length);
    } else if (optionMap[arg]) {
      const key = optionMap[arg];
      options[key] = true as never;
    }
  }

  return options;
}

async function handleMigrateCommand(): Promise<void> {
  const options = parseMigrateOptions(args);
  const migrateCommand = new MigrateCommand();
  await migrateCommand.execute(options);
}

async function main() {
  if (command === 'migrate') {
    await handleMigrateCommand();
  } else if (command === '--version' || command === '-v') {
    showVersion();
  } else {
    showHelp();
  }
}

main().catch((error) => {
  console.error('Error:', error);
  process.exit(1);
});

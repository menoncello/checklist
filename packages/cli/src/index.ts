#!/usr/bin/env bun

import { MigrateCommand, MigrateOptions } from './commands/migrate';

const args = Bun.argv.slice(2);
const command = args[0];

async function main() {
  switch (command) {
    case 'migrate': {
      const options: MigrateOptions = {};
      
      for (let i = 1; i < args.length; i++) {
        const arg = args[i];
        
        switch (arg) {
          case '--check':
            options.check = true;
            break;
          case '--dry-run':
            options.dryRun = true;
            break;
          case '--backup-only':
            options.backupOnly = true;
            break;
          case '--list-backups':
            options.listBackups = true;
            break;
          case '--restore':
            if (i + 1 < args.length) {
              options.restore = args[++i];
            } else {
              console.error('--restore requires a backup path');
              process.exit(1);
            }
            break;
          case '--verbose':
          case '-v':
            options.verbose = true;
            break;
          default:
            if (arg.startsWith('--restore=')) {
              options.restore = arg.substring('--restore='.length);
            }
            break;
        }
      }
      
      const migrateCommand = new MigrateCommand();
      await migrateCommand.execute(options);
      break;
    }
    
    case '--version':
    case '-v':
      console.log('checklist version 1.0.0');
      break;
      
    case '--help':
    case '-h':
    default:
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
  checklist migrate
  checklist migrate --list-backups
  checklist migrate --restore backup-v0.1.0-2024-01-15.yaml
`);
      break;
  }
}

main().catch(error => {
  console.error('Error:', error);
  process.exit(1);
});

export const version = '0.0.1';
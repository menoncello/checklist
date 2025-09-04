# Story 1.6b: Schema Migration System

## Story
**As a** user,  
**I want** automatic state file migration when updating the tool,  
**So that** my checklists continue working across versions.

## Priority
**HIGH** - Must be complete before first release

## Acceptance Criteria

### Migration Framework
1. ✅ Schema version embedded in state files
2. ✅ Automatic backup before migration
3. ✅ Migration scripts run on version mismatch
4. ✅ Rollback capability if migration fails
5. ✅ User notification of migration status

### Version Detection
1. ✅ Detect state file version on load
2. ✅ Compare with current application version
3. ✅ Determine migration path if needed
4. ✅ Handle missing version info (assume v0)
5. ✅ Support skipping versions in migration path

## Technical Implementation

### Migration Registry
```typescript
interface Migration {
  fromVersion: string;
  toVersion: string;
  description: string;
  up: (state: any) => any;
  down: (state: any) => any;
  validate?: (state: any) => boolean;
}

class MigrationRegistry {
  private migrations: Migration[] = [
    {
      fromVersion: '0.0.0',
      toVersion: '0.1.0',
      description: 'Initial schema with basic fields',
      up: (state) => ({
        version: '0.1.0',
        checklists: state.checklists || [],
        settings: state.settings || {},
        metadata: {
          created: state.created || new Date().toISOString(),
          modified: new Date().toISOString()
        }
      }),
      down: (state) => {
        const { version, metadata, ...rest } = state;
        return rest;
      }
    },
    {
      fromVersion: '0.1.0',
      toVersion: '0.2.0',
      description: 'Add template support and variables',
      up: (state) => ({
        ...state,
        version: '0.2.0',
        templates: [],
        variables: {},
        metadata: {
          ...state.metadata,
          modified: new Date().toISOString()
        }
      }),
      down: (state) => {
        const { templates, variables, ...rest } = state;
        return { ...rest, version: '0.1.0' };
      },
      validate: (state) => {
        return Array.isArray(state.templates) && 
               typeof state.variables === 'object';
      }
    }
  ];
  
  findPath(from: string, to: string): Migration[] {
    // Implementation of Dijkstra's algorithm for shortest path
    const path: Migration[] = [];
    let current = from;
    
    while (current !== to) {
      const next = this.migrations.find(m => m.fromVersion === current);
      if (!next) throw new Error(`No migration path from ${from} to ${to}`);
      path.push(next);
      current = next.toVersion;
    }
    
    return path;
  }
}
```

### Migration Runner
```typescript
class MigrationRunner {
  private registry = new MigrationRegistry();
  private backupDir = '.checklist/backups';
  
  async migrate(statePath: string): Promise<void> {
    // Load current state
    const currentState = await this.loadState(statePath);
    const currentVersion = currentState.version || '0.0.0';
    const targetVersion = APP_VERSION;
    
    if (currentVersion === targetVersion) {
      console.log('✅ State file is up to date');
      return;
    }
    
    // Create backup
    await this.createBackup(statePath, currentVersion);
    
    // Find migration path
    const migrations = this.registry.findPath(currentVersion, targetVersion);
    
    if (migrations.length === 0) {
      console.log('✅ No migrations needed');
      return;
    }
    
    // Show migration plan
    console.log(`📦 Migrating from v${currentVersion} to v${targetVersion}`);
    console.log(`📋 ${migrations.length} migration(s) to apply:`);
    migrations.forEach(m => {
      console.log(`  • v${m.fromVersion} → v${m.toVersion}: ${m.description}`);
    });
    
    // Apply migrations
    let state = currentState;
    for (const migration of migrations) {
      console.log(`⏳ Applying migration to v${migration.toVersion}...`);
      
      try {
        state = migration.up(state);
        
        // Validate if validator exists
        if (migration.validate && !migration.validate(state)) {
          throw new Error('Migration validation failed');
        }
        
        // Save intermediate state
        await this.saveState(statePath, state);
        console.log(`✅ Migrated to v${migration.toVersion}`);
        
      } catch (error) {
        console.error(`❌ Migration failed: ${error.message}`);
        await this.rollback(statePath, currentVersion);
        throw error;
      }
    }
    
    console.log(`🎉 Successfully migrated to v${targetVersion}`);
  }
  
  async createBackup(statePath: string, version: string): Promise<string> {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupName = `backup-v${version}-${timestamp}.yaml`;
    const backupPath = path.join(this.backupDir, backupName);
    
    // Ensure backup directory exists
    await fs.mkdir(this.backupDir, { recursive: true });
    
    // Copy state file to backup
    await fs.copyFile(statePath, backupPath);
    
    console.log(`💾 Backup created: ${backupPath}`);
    return backupPath;
  }
  
  async rollback(statePath: string, version: string): Promise<void> {
    // Find most recent backup for version
    const backups = await fs.readdir(this.backupDir);
    const versionBackups = backups
      .filter(f => f.includes(`v${version}`))
      .sort()
      .reverse();
    
    if (versionBackups.length === 0) {
      throw new Error(`No backup found for v${version}`);
    }
    
    const backupPath = path.join(this.backupDir, versionBackups[0]);
    await fs.copyFile(backupPath, statePath);
    
    console.log(`↩️ Rolled back to v${version} from ${backupPath}`);
  }
}
```

### Schema Versioning
```typescript
interface StateSchema {
  version: string;
  checklists: Checklist[];
  templates?: Template[];
  variables?: Record<string, Variable>;
  settings: Settings;
  metadata: {
    created: string;
    modified: string;
    lastMigration?: string;
  };
}

// Version detection utility
async function detectVersion(state: any): string {
  if (state.version) return state.version;
  
  // Heuristics for detecting version from structure
  if (state.templates && state.variables) return '0.2.0';
  if (state.metadata) return '0.1.0';
  if (state.checklists) return '0.0.0';
  
  return '0.0.0'; // Unknown structure, assume oldest
}
```

### CLI Integration
```bash
# Check current state version
checklist migrate --check

# Perform migration (automatic on normal run)
checklist migrate

# Create backup without migrating
checklist migrate --backup-only

# List available backups
checklist migrate --list-backups

# Restore from specific backup
checklist migrate --restore=backup-v0.1.0-2024-01-15.yaml

# Dry run migration (show what would change)
checklist migrate --dry-run
```

## Technical Tasks

### Phase 1: Core Migration System
- [ ] Design state schema versioning format
- [ ] Implement Migration and MigrationRegistry classes
- [ ] Create MigrationRunner with path finding
- [ ] Add backup and restore functionality
- [ ] Build version detection heuristics

### Phase 2: Migration Scripts
- [ ] Write migration from v0.0.0 to v0.1.0
- [ ] Write migration from v0.1.0 to v0.2.0
- [ ] Add validation functions for each version
- [ ] Create rollback scripts
- [ ] Test migration paths

### Phase 3: User Experience
- [ ] Add migration progress indicators
- [ ] Implement dry-run mode
- [ ] Create backup management commands
- [ ] Add migration history tracking
- [ ] Build automatic migration on startup

## Definition of Done
- [ ] Migration from v0 to v1 schema tested
- [ ] Backup verification works
- [ ] Rollback mechanism tested
- [ ] User sees clear migration messages
- [ ] Performance <500ms for typical migration
- [ ] All migration paths have tests
- [ ] Documentation includes migration guide

## Time Estimate
**2-3 days** including testing all migration paths

## Dependencies
- Complete after Story 1.6a (State Transactions)
- Before any public release

## Risk Factors
- 🟡 Complex migration paths with multiple versions
- 🟡 Large state files may be slow to migrate
- 🟢 Well-established patterns from database migrations

## Notes for Developers
- Keep migrations idempotent where possible
- Always validate state after migration
- Consider compression for old backups
- Document breaking changes clearly
- Test with real-world state files from beta users
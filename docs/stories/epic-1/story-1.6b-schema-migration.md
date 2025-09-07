# Story 1.6b: Schema Migration System

## Status

**Approved**

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
          modified: new Date().toISOString(),
        },
      }),
      down: (state) => {
        const { version, metadata, ...rest } = state;
        return rest;
      },
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
          modified: new Date().toISOString(),
        },
      }),
      down: (state) => {
        const { templates, variables, ...rest } = state;
        return { ...rest, version: '0.1.0' };
      },
      validate: (state) => {
        return Array.isArray(state.templates) && typeof state.variables === 'object';
      },
    },
  ];

  findPath(from: string, to: string): Migration[] {
    // Implementation of Dijkstra's algorithm for shortest path
    const path: Migration[] = [];
    let current = from;

    while (current !== to) {
      const next = this.migrations.find((m) => m.fromVersion === current);
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
    migrations.forEach((m) => {
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
      .filter((f) => f.includes(`v${version}`))
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

## Tasks / Subtasks

### Phase 1: Core Migration System

- [ ] Create migration infrastructure directory structure (AC: 1)
  - [ ] Create `/packages/core/src/state/migrations/` directory
  - [ ] Create `/packages/core/src/state/migrations/scripts/` directory
  - [ ] Create `/packages/core/tests/state/migrations/` test directory

- [ ] Implement Migration interface and types (AC: 1)
  - [ ] Create `types.ts` with Migration, MigrationOptions interfaces
  - [ ] Define version comparison utilities
  - [ ] Add migration validation types

- [ ] Implement MigrationRegistry class (AC: 1, 5)
  - [ ] Create `MigrationRegistry.ts` with migration storage
  - [ ] Implement `findPath()` using Dijkstra's algorithm
  - [ ] Add `registerMigration()` method
  - [ ] Write unit tests for path finding

- [ ] Create MigrationRunner class (AC: 1, 2, 3, 4)
  - [ ] Implement `migrate()` method with transaction support
  - [ ] Add `createBackup()` using Bun.write() to `.checklist/.backup/`
  - [ ] Implement `rollback()` for failed migrations
  - [ ] Add progress event emitter for UI updates
  - [ ] Write integration tests with mock state files

- [ ] Build version detection system (AC: 4)
  - [ ] Create `detectVersion()` with heuristics
  - [ ] Handle missing version fields (assume v0.0.0)
  - [ ] Add schema structure analysis
  - [ ] Write unit tests for various state formats

### Phase 2: Migration Scripts

- [ ] Create v0.0.0 to v0.1.0 migration (AC: 1)
  - [ ] Write `v0_0_0_to_v0_1_0.ts` migration script
  - [ ] Add metadata fields (created, modified)
  - [ ] Implement up() and down() functions
  - [ ] Add validation function
  - [ ] Write unit tests

- [ ] Create v0.1.0 to v0.2.0 migration (AC: 1)
  - [ ] Write `v0_1_0_to_v0_2_0.ts` migration script  
  - [ ] Add templates and variables support
  - [ ] Implement up() and down() functions
  - [ ] Add validation using Ajv
  - [ ] Write unit tests

- [ ] Create v0.2.0 to v1.0.0 migration (AC: 1)
  - [ ] Write `v0_2_0_to_v1_0_0.ts` migration script
  - [ ] Add commandResults to completedSteps
  - [ ] Add recovery and conflicts sections
  - [ ] Implement validation
  - [ ] Write unit tests

- [ ] Test complete migration paths (AC: 3, 5)
  - [ ] Test v0.0.0 → v1.0.0 full path
  - [ ] Test partial paths with version skipping
  - [ ] Test rollback scenarios
  - [ ] Performance benchmark with 1MB+ files

### Phase 3: User Experience Integration

- [ ] Integrate with StateManager (AC: 3, 5)
  - [ ] Modify `loadState()` to check version
  - [ ] Auto-trigger migration on version mismatch
  - [ ] Add migration status to state loading
  - [ ] Write integration tests

- [ ] Add CLI commands (AC: 5)
  - [ ] Implement `checklist migrate --check`
  - [ ] Implement `checklist migrate --dry-run`
  - [ ] Implement `checklist migrate --backup-only`
  - [ ] Implement `checklist migrate --restore`
  - [ ] Add command tests

- [ ] Implement progress indicators (AC: 5)
  - [ ] Add migration progress events
  - [ ] Create console progress bar
  - [ ] Show current migration step
  - [ ] Display time estimates

- [ ] Add backup management (AC: 2, 4)
  - [ ] Implement `--list-backups` command
  - [ ] Add backup rotation (keep last 10)
  - [ ] Implement backup compression for old files
  - [ ] Write backup/restore tests

- [ ] Create migration history tracking (AC: 1)
  - [ ] Update state.yaml migrations array
  - [ ] Track applied migrations with timestamps
  - [ ] Add migration audit log
  - [ ] Write history tracking tests

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

## Dev Notes

### Previous Story Insights (from Story 1.6a WAL Implementation)

- **WAL Implementation Completed**: WriteAheadLog class with atomic operations at `/packages/core/src/state/WriteAheadLog.ts`
- **TransactionCoordinator Enhanced**: Now supports WAL integration at `/packages/core/src/state/TransactionCoordinator.ts` 
- **State Manager Foundation**: StateManager class already exists at `/packages/core/src/state/StateManager.ts`
- **Existing Test Patterns**: See `/packages/core/tests/state/WriteAheadLog.test.ts` for Bun test patterns
- **Performance Baseline**: WAL operations complete in <1ms for small operations, ~260ms for large recoveries
- **Security Measures**: Path validation and rate limiting already implemented in WAL

### State File Schema Requirements

[Source: architecture/database-schema-complete-with-all-enhancements.md#state-file-schema]

**Current Schema Version**: 1.0.0

**State File Structure** (`.checklist/state.yaml`):
```yaml
schemaVersion: '1.0.0'
migrations:  # Track applied migrations
  - from: '0.9.0'
    to: '1.0.0'
    applied: '2025-01-01T00:00:00Z'
    changes:
      - 'Added commandResults to completedSteps'
version: '1.0.0'
checksum: 'sha256:abc123...'
lastModified: '2025-01-01T10:00:00Z'
```

**Required State File Fields**:
- `schemaVersion`: Version of the schema structure
- `migrations`: Array tracking all applied migrations
- `version`: Current state file version
- `checksum`: SHA256 hash for integrity validation
- `activeInstance`: Current checklist execution state
- `recovery`: Recovery information from corruptions
- `conflicts`: Concurrent modification tracking

### File System Structure

[Source: architecture/database-schema-complete-with-all-enhancements.md#file-structure]

```
.checklist/
├── state.yaml          # Main state file with migrations
├── config.yaml         # User configuration  
├── history.yaml        # Execution history
├── .backup/
│   ├── manifest.yaml   # Backup metadata
│   └── state.yaml.*    # Backup files
```

### Implementation Location

[Source: architecture/backend-architecture-complete-with-all-services.md]

- **Migration Classes**: Create in `/packages/core/src/state/migrations/`
- **MigrationRegistry**: `/packages/core/src/state/migrations/MigrationRegistry.ts`
- **MigrationRunner**: `/packages/core/src/state/migrations/MigrationRunner.ts`
- **Migration Scripts**: `/packages/core/src/state/migrations/scripts/`
- **Tests**: `/packages/core/tests/state/migrations/`

### Technology Stack Requirements

[Source: architecture/tech-stack.md]

- **File Operations**: Use `Bun.file()` and `Bun.write()` for 10x faster I/O
- **YAML Parsing**: Use `js-yaml 4.1.x` for state file handling
- **Schema Validation**: Use `Ajv 8.12.x` for JSON schema validation
- **Process Management**: Use `Bun.spawn()` for any CLI operations

### Coding Standards

[Source: architecture/coding-standards.md#bun-specific-performance-standards]

```typescript
// ALWAYS use Bun.file() for file operations
const file = Bun.file(path);
const content = await file.text();

// ALWAYS use Bun.write() for file writes  
await Bun.write(path, content);

// Use atomic writes for state files
// Write to temp file first, then rename
```

### Testing Requirements

[Source: architecture/testing-strategy-complete-with-all-testing-utilities.md]

- **Test Location**: `/packages/core/tests/state/migrations/`
- **Test Framework**: Bun Test (built-in)
- **Coverage Target**: >90% for critical paths
- **Performance Tests**: Use Tinybench for benchmarking
- **Test Patterns**:
  - Unit tests for each migration script
  - Integration tests for migration paths
  - Performance benchmarks for large state files
  - Corruption recovery tests

### Integration Points

- **StateManager**: Hook into existing `loadState()` method to trigger migrations
- **TransactionCoordinator**: Use for atomic migration operations
- **WriteAheadLog**: Consider WAL for migration rollback safety
- **WorkflowEngine**: Ensure migrations don't break active workflows

### Performance Constraints

[Source: architecture/backend-architecture-complete-with-all-services.md]

- Migration operations must complete in <500ms for typical files
- Use streaming for large state files (>10MB)
- Implement progress indicators for long migrations
- Cache migration results to avoid re-running

### Security Considerations

- Validate all state files before migration (prevent injection)
- Use checksums to verify integrity pre/post migration
- Implement file locking during migration operations
- Sanitize file paths to prevent directory traversal

## Notes for Developers

- Keep migrations idempotent where possible
- Always validate state after migration
- Consider compression for old backups
- Document breaking changes clearly
- Test with real-world state files from beta users
- Follow existing patterns from WAL implementation for file operations
- Use TransactionCoordinator for atomic operations
- Ensure backward compatibility for at least 3 major versions

# Story 1.4: State Management Implementation

## Story
**As a** developer,  
**I want** a robust YAML-based state management system,  
**so that** workflow progress persists between sessions and is human-readable.

## Acceptance Criteria

### State Manager Implementation
```typescript
export class StateManager {
  private readonly stateDir = '.checklist';
  private state: WorkflowState;
  
  async initialize(projectPath: string): Promise<void> {
    this.projectPath = projectPath;
    await this.ensureDirectoryStructure();
    await this.loadOrCreateState();
  }
  
  async save(): Promise<void> {
    await this.createBackup();
    await this.writeAtomic(this.state);
    await this.updateChecksum();
  }
  
  async load(): Promise<WorkflowState> {
    const state = await this.readState();
    if (!this.validateChecksum(state)) {
      return await this.recover();
    }
    return state;
  }
}
```

### Directory Structure Creation
```typescript
private async ensureDirectoryStructure(): Promise<void> {
  const dirs = [
    '.checklist',
    '.checklist/.backup',
    '.checklist/.cache'
  ];
  
  for (const dir of dirs) {
    await mkdir(join(this.projectPath, dir), { recursive: true });
  }
  
  // Create default files if not exist
  const files = {
    'state.yaml': this.defaultState(),
    'config.yaml': this.defaultConfig(),
    'history.yaml': '[]'
  };
  
  for (const [file, content] of Object.entries(files)) {
    const path = join(this.projectPath, '.checklist', file);
    if (!await exists(path)) {
      await Bun.write(path, yaml.dump(content));
    }
  }
}
```

### Atomic Write Implementation
```typescript
private async writeAtomic(state: WorkflowState): Promise<void> {
  const statePath = join(this.projectPath, '.checklist', 'state.yaml');
  const tempPath = `${statePath}.tmp.${Date.now()}`;
  
  try {
    // Write to temp file first
    await Bun.write(tempPath, yaml.dump(state));
    
    // Atomic rename
    await rename(tempPath, statePath);
  } catch (error) {
    // Clean up temp file if rename failed
    await unlink(tempPath).catch(() => {});
    throw error;
  }
}
```

### Backup System
```typescript
private async createBackup(): Promise<void> {
  const statePath = join(this.projectPath, '.checklist', 'state.yaml');
  const backupDir = join(this.projectPath, '.checklist', '.backup');
  const backupPath = join(backupDir, `state.yaml.${Date.now()}`);
  
  if (await exists(statePath)) {
    await copyFile(statePath, backupPath);
    
    // Keep only last 10 backups
    await this.pruneBackups(backupDir, 10);
  }
}

private async pruneBackups(dir: string, keep: number): Promise<void> {
  const files = await readdir(dir);
  const backups = files
    .filter(f => f.startsWith('state.yaml.'))
    .sort()
    .reverse();
  
  for (const file of backups.slice(keep)) {
    await unlink(join(dir, file));
  }
}
```

### Corruption Detection & Recovery
```typescript
private async validateChecksum(state: WorkflowState): Promise<boolean> {
  const calculated = this.calculateChecksum(state);
  return calculated === state.checksum;
}

private calculateChecksum(state: WorkflowState): string {
  const content = JSON.stringify(state, null, 2);
  return crypto.createHash('sha256').update(content).digest('hex');
}

private async recover(): Promise<WorkflowState> {
  const backupDir = join(this.projectPath, '.checklist', '.backup');
  const backups = await readdir(backupDir);
  
  // Try backups from newest to oldest
  for (const backup of backups.sort().reverse()) {
    try {
      const content = await Bun.file(join(backupDir, backup)).text();
      const state = yaml.load(content) as WorkflowState;
      
      if (this.validateChecksum(state)) {
        console.warn(`Recovered from backup: ${backup}`);
        return state;
      }
    } catch {
      // Try next backup
    }
  }
  
  // If all backups fail, create new state
  console.warn('All backups corrupted, creating new state');
  return this.defaultState();
}
```

### File Locking
```typescript
export class FileLock {
  private lockFile: string;
  private lockAcquired = false;
  
  constructor(private path: string) {
    this.lockFile = `${path}.lock`;
  }
  
  async acquire(timeout = 5000): Promise<void> {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      try {
        // Try to create lock file exclusively
        const fd = await open(this.lockFile, 'wx');
        await write(fd, `${process.pid}\n${Date.now()}`);
        await close(fd);
        
        this.lockAcquired = true;
        return;
      } catch (error) {
        if (error.code !== 'EEXIST') throw error;
        
        // Check if lock is stale
        if (await this.isStale()) {
          await this.forceRelease();
          continue;
        }
        
        // Wait and retry
        await Bun.sleep(100);
      }
    }
    
    throw new Error(`Failed to acquire lock after ${timeout}ms`);
  }
  
  async release(): Promise<void> {
    if (this.lockAcquired) {
      await unlink(this.lockFile);
      this.lockAcquired = false;
    }
  }
  
  private async isStale(maxAge = 30000): Promise<boolean> {
    try {
      const stat = await Bun.file(this.lockFile).stat();
      return Date.now() - stat.mtime.getTime() > maxAge;
    } catch {
      return true;
    }
  }
}
```

### State Migration System
```typescript
interface Migration {
  from: string;
  to: string;
  migrate: (state: any) => any;
}

const migrations: Migration[] = [
  {
    from: '0.0.1',
    to: '0.0.2',
    migrate: (state) => ({
      ...state,
      version: '0.0.2',
      newField: 'default'
    })
  }
];

private async migrateState(state: WorkflowState): Promise<WorkflowState> {
  let current = state;
  
  for (const migration of migrations) {
    if (current.version === migration.from) {
      current = migration.migrate(current);
      current.version = migration.to;
    }
  }
  
  return current;
}
```

## Schema Definitions

### State Schema (state.yaml)
```yaml
version: "1.0.0"
checksum: "sha256:..."
lastModified: "2025-01-01T10:00:00Z"
activeInstance:
  id: "uuid"
  templateId: "template-name"
  templateVersion: "1.0.0"
  status: "active"
  currentStepIndex: 0
  variables: {}
  completedSteps: []
  skippedSteps: []
  startedAt: "2025-01-01T10:00:00Z"
```

## Testing Requirements
```typescript
describe('StateManager', () => {
  test('creates directory structure', async () => {
    const sm = new StateManager();
    await sm.initialize('/tmp/test');
    
    expect(await exists('/tmp/test/.checklist')).toBe(true);
    expect(await exists('/tmp/test/.checklist/state.yaml')).toBe(true);
  });
  
  test('atomic writes prevent corruption', async () => {
    // Test concurrent writes don't corrupt
  });
  
  test('recovers from corruption', async () => {
    // Corrupt state file
    // Verify recovery from backup
  });
  
  test('file locking prevents races', async () => {
    // Test multiple processes
  });
  
  test('migrations apply correctly', async () => {
    // Test version migrations
  });
});
```

## Performance Requirements
- State save < 50ms
- State load < 50ms  
- Backup creation < 20ms
- Lock acquisition < 100ms typical

## Definition of Done
- [ ] Directory structure created automatically
- [ ] Atomic writes implemented
- [ ] Backup system working
- [ ] Corruption recovery tested
- [ ] File locking functional
- [ ] Migration system in place
- [ ] Schema validated with Ajv
- [ ] All operations < 50ms
- [ ] 100% test coverage

## Time Estimate
**2 days**

## Dependencies
- Can start after Story 1.1 (project setup)
- Required by Story 1.3 (workflow engine)

## Notes
- Use YAML for human readability
- Keep checksums for integrity
- Always backup before writes
- Handle concurrent access gracefully
- Design for forward compatibility
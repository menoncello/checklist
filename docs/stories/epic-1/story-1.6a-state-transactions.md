# Story 1.6a: State Transaction Management

## Story

**As a** developer,  
**I want** atomic state operations with rollback capability,  
**So that** checklist state remains consistent even during failures.

## Priority

**CRITICAL** - Must be complete before Story 2.1

## Acceptance Criteria

### Transaction Implementation

1. ✅ Implement write-ahead logging for state changes
2. ✅ File locking prevents concurrent modifications
3. ✅ Automatic rollback on process crash
4. ✅ State validation before commit
5. ✅ Recovery mechanism for corrupted state files

### Technical Requirements

- Maximum transaction time: 100ms
- Support for nested transactions
- Atomic rename operations for final commit
- Temporary `.checklist/.tmp/` directory for staging

### Implementation Approach

```typescript
class StateTransaction {
  private wal: WriteAheadLog;
  private lockFile: FileLock;

  async begin(): Promise<void> {
    await this.lockFile.acquire();
    await this.wal.initialize();
  }

  async write(key: string, value: any): Promise<void> {
    await this.wal.append({ op: 'write', key, value });
  }

  async commit(): Promise<void> {
    // Validate state
    const validation = await this.validateState();
    if (!validation.valid) {
      throw new StateValidationError(validation.errors);
    }

    // Write to temp file
    const tempPath = `.checklist/.tmp/${Date.now()}.yaml`;
    await Bun.write(tempPath, this.serializeState());

    // Atomic rename
    await fs.rename(tempPath, '.checklist/state.yaml');

    // Clear WAL
    await this.wal.clear();
    await this.lockFile.release();
  }

  async rollback(): Promise<void> {
    await this.wal.clear();
    await this.lockFile.release();
  }
}
```

### File Locking Strategy

```typescript
class FileLock {
  private lockPath = '.checklist/.lock';
  private lockId: string;

  async acquire(timeout = 5000): Promise<void> {
    const startTime = Date.now();
    this.lockId = crypto.randomUUID();

    while (Date.now() - startTime < timeout) {
      try {
        // Try to create lock file atomically
        await Bun.write(this.lockPath, this.lockId, {
          mode: 'wx', // Exclusive write
        });
        return;
      } catch (error) {
        // Lock exists, check if stale
        if (await this.isLockStale()) {
          await this.forceRelease();
        } else {
          await Bun.sleep(100);
        }
      }
    }
    throw new Error('Failed to acquire lock');
  }

  async release(): Promise<void> {
    const currentLock = await Bun.file(this.lockPath).text();
    if (currentLock === this.lockId) {
      await fs.unlink(this.lockPath);
    }
  }
}
```

### Write-Ahead Log Implementation

```typescript
interface WALEntry {
  timestamp: number;
  op: 'write' | 'delete';
  key: string;
  value?: any;
  previousValue?: any;
}

class WriteAheadLog {
  private walPath = '.checklist/.wal';
  private entries: WALEntry[] = [];

  async append(entry: Omit<WALEntry, 'timestamp'>): Promise<void> {
    const fullEntry = { ...entry, timestamp: Date.now() };
    this.entries.push(fullEntry);

    // Append to WAL file
    await Bun.write(this.walPath, JSON.stringify(fullEntry) + '\n', { append: true });
  }

  async replay(): Promise<void> {
    if (!(await Bun.file(this.walPath).exists())) return;

    const content = await Bun.file(this.walPath).text();
    const lines = content.split('\n').filter(Boolean);

    for (const line of lines) {
      const entry = JSON.parse(line) as WALEntry;
      await this.applyEntry(entry);
    }
  }

  async clear(): Promise<void> {
    this.entries = [];
    await fs.unlink(this.walPath).catch(() => {});
  }
}
```

## Technical Tasks

### Phase 1: Core Transaction System

- [ ] Implement FileLock class with timeout and stale detection
- [ ] Create WriteAheadLog with append and replay
- [ ] Build StateTransaction with begin/commit/rollback
- [ ] Add state validation framework
- [ ] Create atomic file operations wrapper

### Phase 2: Recovery Mechanisms

- [ ] Implement crash detection on startup
- [ ] Build WAL replay on recovery
- [ ] Add corrupted state detection
- [ ] Create state repair utilities
- [ ] Implement backup before risky operations

### Phase 3: Testing & Hardening

- [ ] Concurrent access stress tests
- [ ] Simulated crash recovery tests
- [ ] Performance benchmarks
- [ ] Edge case handling (disk full, permissions)
- [ ] Integration with existing state management

## Definition of Done

- [ ] Transaction tests pass with simulated crashes
- [ ] Concurrent access tests pass
- [ ] Recovery from corrupted state works
- [ ] Performance within 100ms for typical operations
- [ ] Documentation includes transaction guarantees
- [ ] No data loss in any failure scenario
- [ ] Clear error messages for lock conflicts

## Time Estimate

**3-4 days** including comprehensive testing

## Dependencies

- Must complete after Story 1.6 (State Management)
- Blocks Story 2.1 (Checklist Panel)

## Risk Factors

- 🟡 Platform-specific file locking behavior
- 🟡 Performance overhead of WAL
- 🟢 Well-understood patterns from database systems

## Notes for Developers

- Use Bun's built-in file operations for better performance
- Consider using SQLite as future enhancement for complex transactions
- Ensure Windows compatibility with file locking
- Add telemetry for transaction performance monitoring

# Story 1.6a: State Transaction Management

## Status

**Draft** 📝

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

## Tasks / Subtasks

### Phase 1: Core Transaction System

- [ ] **Implement FileLock class** (AC: 2)
  - [ ] Create `/packages/core/src/state/FileLock.ts`
  - [ ] Implement lock acquisition with 5s timeout (per ConcurrencyManager pattern)
  - [ ] Add stale lock detection using PID and hostname
  - [ ] Implement heartbeat mechanism for lock renewal
  - [ ] Add Windows-compatible file locking using 'wx' flag
  - [ ] Write unit tests in `/packages/core/tests/state/FileLock.test.ts`

- [ ] **Create WriteAheadLog implementation** (AC: 1, 3)
  - [ ] Create `/packages/core/src/state/WriteAheadLog.ts`
  - [ ] Implement WALEntry interface with timestamp, op, key, value fields
  - [ ] Add append() method with JSON line-delimited format
  - [ ] Implement replay() for crash recovery
  - [ ] Add clear() for successful commit cleanup
  - [ ] Create `.checklist/.wal` directory structure
  - [ ] Write unit tests with simulated crashes

- [ ] **Build StateTransaction wrapper** (AC: 1, 2, 4)
  - [ ] Create `/packages/core/src/state/StateTransaction.ts`  
  - [ ] Integrate with existing TransactionCoordinator pattern
  - [ ] Implement begin() with lock acquisition
  - [ ] Add write() operations to WAL
  - [ ] Implement commit() with validation and atomic rename
  - [ ] Add rollback() with WAL cleanup
  - [ ] Use Ajv for state validation before commit
  - [ ] Write integration tests for transaction lifecycle

- [ ] **Integrate with existing ConcurrencyManager** (AC: 2)
  - [ ] Extend ConcurrencyManager from backend architecture
  - [ ] Add state-specific lock handling
  - [ ] Implement lock timeout configuration (5000ms default)
  - [ ] Add metrics collection for lock contention

### Phase 2: Recovery Mechanisms

- [ ] **Implement crash detection** (AC: 3)
  - [ ] Check for `.checklist/.wal` existence on startup
  - [ ] Validate lock files for stale processes
  - [ ] Add startup hook in WorkflowEngine.init()
  - [ ] Log recovery attempts using debug logger

- [ ] **Build WAL replay system** (AC: 3, 5)
  - [ ] Parse line-delimited JSON from WAL file
  - [ ] Apply operations in sequence to restore state
  - [ ] Handle partial writes and corrupted entries
  - [ ] Create backup before replay in `.checklist/.backup/`
  - [ ] Write tests with corrupted WAL scenarios

- [ ] **Add state validation and repair** (AC: 4, 5)
  - [ ] Implement JSON Schema validation using Ajv
  - [ ] Detect missing required fields
  - [ ] Add checksum verification for state files
  - [ ] Create state repair utilities with safe defaults
  - [ ] Log all repair operations for audit

### Phase 3: Testing & Hardening

- [ ] **Concurrent access testing** (AC: 2)
  - [ ] Create multi-process test using Bun.spawn
  - [ ] Test 10 concurrent write attempts
  - [ ] Verify only one process acquires lock
  - [ ] Test lock release and reacquisition
  - [ ] Use FlakyTestDetector for reliability

- [ ] **Crash recovery testing** (AC: 3)
  - [ ] Simulate process kill during transaction
  - [ ] Test WAL replay on next startup
  - [ ] Verify state consistency after recovery
  - [ ] Test with multiple crash scenarios
  - [ ] Measure recovery time (<100ms requirement)

- [ ] **Performance benchmarking** (AC: Technical Requirements)
  - [ ] Use Tinybench for micro-benchmarks
  - [ ] Test transaction overhead (<100ms)
  - [ ] Measure lock acquisition time
  - [ ] Profile memory usage during transactions
  - [ ] Test with 1000 concurrent operations

- [ ] **Edge case handling**
  - [ ] Test disk full scenarios
  - [ ] Handle permission denied errors
  - [ ] Test with read-only filesystems
  - [ ] Implement circuit breaker for repeated failures
  - [ ] Add telemetry for monitoring

- [ ] **Integration with WorkflowEngine** (AC: All)
  - [ ] Update WorkflowEngine to use new TransactionCoordinator
  - [ ] Ensure backward compatibility with StateManager
  - [ ] Add transaction events to EventEmitter
  - [ ] Update existing tests for new transaction flow
  - [ ] Document transaction guarantees in API

## Definition of Done

- [ ] Transaction tests pass with simulated crashes
- [ ] Concurrent access tests pass
- [ ] Recovery from corrupted state works
- [ ] Performance within 100ms for typical operations
- [ ] Documentation includes transaction guarantees
- [ ] No data loss in any failure scenario
- [ ] Clear error messages for lock conflicts

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-07 | 1.0 | Initial story creation with architecture context | Bob (SM) |
| 2025-01-07 | 1.1 | Enhanced with full technical context from architecture docs | Bob (SM) |

## Time Estimate

**3-4 days** including comprehensive testing

## Dependencies

- Must complete after Story 1.6 (State Management)
- Blocks Story 2.1 (Checklist Panel)

## Risk Factors

- 🟡 Platform-specific file locking behavior
- 🟡 Performance overhead of WAL
- 🟢 Well-understood patterns from database systems

## Dev Notes

### Architecture Context

**Runtime & Dependencies** [Source: architecture/tech-stack.md#Core Languages & Runtime]
- **Runtime**: Bun 1.1.x with built-in TypeScript support
- **State Format**: YAML using js-yaml 4.1.x for human-readable persistence
- **Schema Validation**: Ajv 8.12.x for YAML/JSON schema validation
- **File Operations**: Use Bun.write with built-in atomic operations
- **Process Management**: Bun.spawn for child process operations

### File Structure & Location [Source: architecture/source-tree.md#packages]

**Implementation Location**: `/packages/core/src/state/`
- `TransactionCoordinator.ts` - Main transaction coordinator class
- `WriteAheadLog.ts` - WAL implementation for crash recovery  
- `FileLock.ts` - Cross-platform file locking mechanism
- `StateTransaction.ts` - Transaction wrapper with validation

**Test Location**: `/packages/core/tests/state/`
- Unit tests colocated with source files (`.test.ts`)
- Integration tests for transaction scenarios

### Existing Architecture Patterns [Source: architecture/backend-architecture-complete-with-all-services.md]

**TransactionCoordinator Pattern** (Already defined in architecture):
```typescript
// Use the TransactionCoordinator from backend architecture
export class TransactionCoordinator {
  async beginTransaction(): Promise<Transaction>
  async commit(txn: Transaction): Promise<void>  
  async rollback(txn: Transaction): Promise<void>
}
```

**ConcurrencyManager Pattern** (From architecture):
```typescript  
// Reuse ConcurrencyManager for lock management
export class ConcurrencyManager {
  async acquireLock(resource: string, options: LockOptions): Promise<LockToken>
  async releaseLock(token: LockToken): Promise<void>
}
```

### Coding Standards [Source: architecture/coding-standards.md]

**ESLint Rules to Follow**:
- `@typescript-eslint/no-explicit-any`: warn (avoid any types)
- `@typescript-eslint/strict-boolean-expressions`: error (explicit boolean checks)
- `no-console`: warn (use debug logger instead)
- Use `Bun.env` instead of `process.env` for environment variables
- Maximum line width: 80 characters (Prettier)

### Error Handling Patterns [Source: architecture/error-handling-strategy-complete-with-all-patterns.md]

**Circuit Breaker**: Implement circuit breaker for lock acquisition:
- Threshold: 5 failures before opening circuit
- Timeout: 60 seconds before retry
- Half-open state for gradual recovery

**Error Correlation**: Use ErrorCorrelator for detecting patterns:
- Detect repeated lock timeouts
- Identify error storms during high concurrency
- Generate smart recovery suggestions

### Testing Requirements [Source: architecture/testing-strategy-complete-with-all-testing-utilities.md]

**Test Utilities**:
- Use `TestDataFactory.createTestWorkspace()` for isolated test environments
- Implement `FlakyTestDetector` for concurrent access tests
- Required test coverage: 90% for critical paths

**Test Scenarios**:
1. Concurrent write attempts (use multiple Bun.spawn processes)
2. Crash recovery simulation (kill process mid-transaction)
3. Lock timeout and retry behavior
4. WAL replay after unexpected termination
5. State validation failures and rollback

### Performance Requirements

- Maximum transaction time: 100ms (from acceptance criteria)
- File operations must complete in <50ms [Source: architecture/backend-architecture]
- Use Bun's native file operations for performance
- Implement benchmarks using Tinybench 2.5.x [Source: architecture/tech-stack.md]

### Integration Notes

**WorkflowEngine Integration** (From Story 1.6):
- TransactionCoordinator is already referenced in WorkflowEngine
- Ensure compatibility with existing StateManager from Story 1.5
- Event emission for transaction state changes

### Security Considerations

- Lock files in `.checklist/.locks/` directory (not `.tmp/`)
- Use crypto.randomUUID() for lock IDs
- Validate all file paths to prevent directory traversal
- Never log sensitive state data

## Notes for Developers

- Use Bun's built-in file operations for better performance
- Consider using SQLite as future enhancement for complex transactions
- Ensure Windows compatibility with file locking
- Add telemetry for transaction performance monitoring

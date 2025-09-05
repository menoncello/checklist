# Story 1.0: Database/State Store Setup

## Status

**Draft**

## Story

**As a** developer,  
**I want** a robust local state management system with file-based persistence,  
**so that** workflow state is preserved, recoverable, and handles concurrent access safely.

## Priority

**CRITICAL** - Must be completed before any state-dependent features

## Acceptance Criteria

### State Store Architecture

1. Design file-based state schema (YAML/JSON)
2. Implement atomic write operations with file locking
3. Create state directory structure (`.checklist/`)
4. Define state file naming conventions
5. Establish backup and recovery mechanisms

### Concurrency & Safety

6. Implement file locking to prevent concurrent access issues
7. Add transaction log for state changes
8. Create rollback mechanisms for failed operations
9. Handle corrupted state file recovery
10. Validate state integrity on load

### Core State Operations

11. State initialization (`init` command foundation)
12. State loading and validation
13. Atomic state updates
14. State migration utilities
15. State cleanup and archival

## Tasks / Subtasks

### Task 1: Create State Directory Structure (AC: 3, 4)

- [ ] Create `.checklist/` directory initialization logic
  - [ ] Implement directory creation in `packages/core/src/state/DirectoryManager.ts`
  - [ ] Create subdirectories: `backups/`, `.locks/`, `.cache/`, `logs/`
  - [ ] Set appropriate file permissions (0755 for dirs, 0644 for files)
- [ ] Define directory structure constants
  - [ ] Create `packages/core/src/state/constants.ts` with path definitions
  - [ ] Export STATE_DIR, BACKUP_DIR, LOCK_DIR, etc.
- [ ] Write unit tests for directory creation
  - [ ] Test directory creation in `packages/core/src/state/DirectoryManager.test.ts`
  - [ ] Test permission settings
  - [ ] Test cleanup on failure

### Task 2: Implement State Schema and Validation (AC: 1, 10)

- [ ] Define TypeScript interfaces for state models
  - [ ] Create `packages/core/src/state/types.ts` with ChecklistState interface
  - [ ] Define ActiveInstance, CompletedStep, Recovery, Conflicts interfaces
  - [ ] Add schema version constants
- [ ] Implement YAML state schema with Ajv validation
  - [ ] Create `packages/core/src/state/schemas/state.schema.json`
  - [ ] Define JSON Schema for state.yaml structure
  - [ ] Include checksum and version fields
- [ ] Create state validation utilities
  - [ ] Implement `validateStateSchema()` using Ajv
  - [ ] Add checksum verification using SHA256
  - [ ] Create `StateCorruptedError` class for invalid states
- [ ] Write schema validation tests
  - [ ] Test valid state files pass validation
  - [ ] Test corrupted states are detected
  - [ ] Test migration from older schema versions

### Task 3: Build File Locking Mechanism (AC: 2, 6)

- [ ] Implement ConcurrencyManager class
  - [ ] Create `packages/core/src/state/ConcurrencyManager.ts`
  - [ ] Use exclusive file creation for lock acquisition
  - [ ] Add timeout handling (default 5000ms) and retry logic (100ms intervals)
- [ ] Create enhanced lock file structure
  - [ ] Include lockId (UUID), pid, hostname, user metadata
  - [ ] Add acquiredAt, expiresAt, renewedAt timestamps
  - [ ] Track waiting processes array
- [ ] Implement heartbeat system for lock renewal
  - [ ] Create automatic lock renewal before expiration
  - [ ] Handle stale lock detection and cleanup
  - [ ] Add graceful shutdown to release locks
- [ ] Write concurrency tests
  - [ ] Test exclusive lock acquisition
  - [ ] Test timeout and retry behavior
  - [ ] Test stale lock cleanup

### Task 4: Develop Transaction Coordinator (AC: 7, 8)

- [ ] Create TransactionCoordinator class
  - [ ] Implement in `packages/core/src/state/TransactionCoordinator.ts`
  - [ ] Create transaction structure with id, startedAt, operations, snapshot
  - [ ] Track status: 'active' | 'committed' | 'rolled-back'
- [ ] Implement transaction operations
  - [ ] Create snapshot before transaction begins
  - [ ] Validate and apply changes atomically
  - [ ] Handle rollback on failure
- [ ] Add transaction logging to audit.log
  - [ ] Log transaction start, operations, commit/rollback
  - [ ] Include stackTrace for debugging
  - [ ] Implement log rotation to prevent unbounded growth
- [ ] Write transaction tests
  - [ ] Test successful commit flow
  - [ ] Test rollback on error
  - [ ] Test concurrent transaction handling

### Task 5: Implement StateManager Core Operations (AC: 11-15)

- [ ] Create StateManager class
  - [ ] Implement in `packages/core/src/state/StateManager.ts`
  - [ ] Use Bun.file() and Bun.write() for performance
  - [ ] Integrate ConcurrencyManager and TransactionCoordinator
- [ ] Implement state initialization
  - [ ] Create `initializeState()` method
  - [ ] Generate initial state.yaml with defaults
  - [ ] Create manifest.yaml for backup tracking
- [ ] Build state loading and validation
  - [ ] Implement `loadState()` with js-yaml
  - [ ] Validate schema and checksum on load
  - [ ] Handle migration from older versions
- [ ] Create atomic state updates
  - [ ] Implement `saveState()` with temp file + rename strategy
  - [ ] Calculate and update checksum
  - [ ] Update lastModified timestamp
- [ ] Add state cleanup and archival
  - [ ] Implement `archiveState()` for completed workflows
  - [ ] Create cleanup policy for old backups
  - [ ] Add state export functionality

### Task 6: Build Backup and Recovery System (AC: 5, 9)

- [ ] Implement backup rotation strategy
  - [ ] Create `BackupManager` class in `packages/core/src/state/BackupManager.ts`
  - [ ] Maintain 3 rolling backups by default
  - [ ] Track backups in manifest.yaml
- [ ] Create recovery mechanisms
  - [ ] Implement `recoverFromBackup()` method
  - [ ] Add corruption detection with checksums
  - [ ] Create recovery decision logic
- [ ] Add recovery tracking
  - [ ] Track recovery attempts in state.yaml recovery section
  - [ ] Log corruption type and recovery method
  - [ ] Flag any data loss during recovery
- [ ] Write recovery tests
  - [ ] Test backup creation and rotation
  - [ ] Test recovery from corrupted state
  - [ ] Test recovery with data preservation

## Dev Notes

### Previous Story Context

**Story 0.0 Completion Notes:**

- Project structure established with `/packages/core`, `/packages/cli`, `/packages/tui`, `/packages/shared`
- TypeScript strict mode configured, ESLint and Prettier working
- Bun test runner (Vitest) configured and operational
- Pre-commit hooks with secrets scanning implemented
  [Source: Story 0.0 Dev Agent Record]

### Architecture References

#### State Management Tools

- **YAML Processing**: js-yaml 4.1.x for human-readable state persistence [Source: architecture/tech-stack.md#State & Data]
- **Schema Validation**: Ajv 8.12.x for state file integrity validation [Source: architecture/tech-stack.md#State & Data]
- **File Watching**: Bun.watch() built-in for change detection [Source: architecture/tech-stack.md#State & Data]

#### State File Schema (Enhanced)

```yaml
# Location: .checklist/state.yaml
schemaVersion: '1.0.0'  # Version with migration support
checksum: 'sha256:...'  # Integrity validation

activeInstance:
  id: 'uuid-v4'         # Unique instance identifier
  templateId: 'template-id'
  templateVersion: '1.0.0'
  projectPath: '/absolute/path'
  status: 'active' | 'paused' | 'completed' | 'failed'
  currentStepId: 'step-id'
  startedAt: 'ISO-8601'
  lastModifiedAt: 'ISO-8601'
  completedAt: 'ISO-8601' # optional

completedSteps:
  - stepId: 'step-1'
    completedAt: 'ISO-8601'
    executionTime: 1234  # milliseconds
    result: 'success' | 'failure' | 'skipped'
    commandResults: []   # Array of command execution results

recovery:
  lastCorruption: 'ISO-8601'
  corruptionType: 'checksum_mismatch' | 'schema_invalid' | 'parse_error'
  recoveryMethod: 'backup' | 'reset' | 'manual'
  dataLoss: false

conflicts:
  detected: 'ISO-8601'
  resolution: 'local' | 'remote' | 'merge'
```

[Source: architecture/database-schema.md#State File Schema]

#### Directory Structure

```
.checklist/
├── state.yaml          # Main state file
├── config.yaml         # User configuration
├── history.yaml        # Execution history
├── metrics.yaml        # Performance metrics
├── audit.log          # Security audit log
├── .lock              # Active lock file
├── .cache/
│   └── templates.yaml  # Template cache
├── .locks/            # Lock files directory
└── .backup/
    ├── manifest.yaml   # Backup metadata
    └── state.yaml.*    # Backup files
```

[Source: architecture/database-schema.md#File Structure]

#### Lock File Schema

```yaml
# .checklist/.lock
version: '1.0.0'
lockId: 'uuid'          # Unique lock identifier
metadata:
  pid: 12345           # Process ID
  ppid: 12344          # Parent process ID
  hostname: 'machine'
  user: 'username'
timing:
  acquiredAt: 'ISO-8601'
  expiresAt: 'ISO-8601'   # Lock expiration
  renewedAt: 'ISO-8601'   # Last renewal
operation:
  type: 'read' | 'write' | 'delete'
  stackTrace: 'stack'     # For debugging
concurrency:
  waitingProcesses:
    - pid: 12346
      since: 'ISO-8601'
```

[Source: architecture/database-schema.md#Enhanced Lock File Schema]

#### Concurrency Patterns

- **Lock Directory**: `.checklist/.locks` for all lock files
- **Lock Timeout**: Default 5000ms with 100ms retry interval
- **Exclusive Creation**: Use file creation with O_EXCL flag for atomicity
- **Heartbeat System**: Automatic renewal before expiration
- **Stale Detection**: Check if lock PID still exists
  [Source: architecture/backend-architecture.md#Concurrency Manager]

#### Transaction Coordinator Pattern

```typescript
interface Transaction {
  id: string; // UUID
  startedAt: Date;
  operations: Operation[];
  snapshot: ChecklistState; // Pre-transaction state
  status: 'active' | 'committed' | 'rolled-back';
}
```

- **Snapshot Before Changes**: Always create state snapshot
- **Atomic Commits**: Validate all operations before applying
- **Rollback on Failure**: Restore from snapshot on error
  [Source: architecture/backend-architecture.md#Transaction Coordinator]

#### File Operations Standards

- **Use Bun APIs**: `Bun.file()` and `Bun.write()` for 10x performance
- **Atomic Writes**: Write to temp file, then rename for atomicity
- **Path Handling**: Use Node.js `path` module for cross-platform compatibility
- **Error Handling**: Always wrap file ops in try-catch with specific error types
  [Source: architecture/coding-standards.md#Bun-Specific Performance]

#### State Management Patterns

- **Immutable Updates**: Use spread operator for state modifications
- **Deep Copying**: Use `structuredClone()` for deep copies
- **Validation Required**: Always validate after loading state
- **Error Types**: Use `StateCorruptedError` for invalid states
  [Source: architecture/coding-standards.md#State Management Standards]

#### Async Operation Standards

- **AbortController**: Required for all cancellable operations
- **Timeout Handling**: Set reasonable timeouts for file operations
- **Parallel Operations**: Use `Promise.all()` for concurrent ops
- **Error Context**: Include operation context in error messages
  [Source: architecture/coding-standards.md#Async Pattern Standards]

### File Locations for Implementation

- **State Manager**: `packages/core/src/state/StateManager.ts`
- **Concurrency**: `packages/core/src/state/ConcurrencyManager.ts`
- **Transactions**: `packages/core/src/state/TransactionCoordinator.ts`
- **Backup Manager**: `packages/core/src/state/BackupManager.ts`
- **Directory Manager**: `packages/core/src/state/DirectoryManager.ts`
- **Types**: `packages/core/src/state/types.ts`
- **Schemas**: `packages/core/src/state/schemas/state.schema.json`
- **Constants**: `packages/core/src/state/constants.ts`
- **Errors**: `packages/core/src/state/errors.ts`

## Testing

### Testing Standards

[Source: architecture/testing-strategy.md]

1. **Test File Locations**:
   - Unit tests: `*.test.ts` colocated with source files
   - Integration tests: `*.spec.ts` in `__tests__` directories
   - All state tests in `packages/core/src/state/*.test.ts`

2. **State Testing Requirements**:
   - Use TestDataFactory for creating test workspaces
   - Create temporary `.checklist/` directories for testing
   - Always cleanup temp directories after tests
   - Mock file system operations where appropriate

3. **Performance Thresholds**:
   - State initialization: < 1000ms
   - State load/save: < 50ms
   - Lock acquisition: < 100ms
   - All operations must complete in < 10ms (excluding I/O)

4. **Concurrency Testing**:
   - Test with 100+ concurrent operations
   - Verify exclusive lock acquisition
   - Test timeout and retry mechanisms
   - Validate stale lock cleanup

5. **Coverage Requirements**:
   - Minimum 80% code coverage
   - 100% coverage for critical paths (lock, transaction, recovery)
   - Edge cases must be tested (corruption, conflicts, migrations)

### Test Scenarios to Cover

1. **Directory Creation**:
   - Fresh initialization
   - Existing directory handling
   - Permission errors
   - Cleanup on failure

2. **State Validation**:
   - Valid state files
   - Corrupted checksums
   - Invalid schema
   - Version migrations

3. **Concurrency**:
   - Exclusive lock acquisition
   - Lock timeout and retry
   - Stale lock cleanup
   - Multiple waiting processes

4. **Transactions**:
   - Successful commits
   - Rollback on error
   - Concurrent transactions
   - Snapshot integrity

5. **Recovery**:
   - Backup creation and rotation
   - Recovery from corruption
   - Data preservation
   - Recovery tracking

## Definition of Done

- [ ] All 15 acceptance criteria implemented and tested
- [ ] State manager with file locking operational
- [ ] Backup and recovery mechanisms working
- [ ] Transaction logging to audit.log functional
- [ ] State validation passes all test cases
- [ ] Concurrent access testing completed (100+ operations)
- [ ] Test coverage > 80% with 100% on critical paths
- [ ] Performance benchmarks met (< 50ms for operations)
- [ ] Cross-platform compatibility verified (Windows/macOS/Linux)
- [ ] Documentation comments in all public APIs
- [ ] Integration tests with real file system pass
- [ ] Manual testing checklist completed

## Dependencies

- **Depends on**: Story 0.0 (Environment Setup) - COMPLETED ✅
- **Blocks**:
  - Story 1.3 (Core Workflow Engine) - Needs state persistence
  - Story 1.4 (State Management Implementation) - Extends this foundation
  - All future stories requiring state persistence

## Potential Blockers & Solutions

| Blocker                           | Solution                                         |
| --------------------------------- | ------------------------------------------------ |
| File system permissions           | Graceful fallback to user directory with warning |
| Lock file conflicts               | Implement stale lock detection and cleanup       |
| State corruption                  | Automatic recovery from backups                  |
| Cross-platform paths              | Use Node.js path module for normalization        |
| Concurrent access race conditions | Exclusive file creation with O_EXCL flag         |
| Large state files                 | Implement incremental updates and compression    |
| Schema version conflicts          | Migration system with backward compatibility     |

## Time Estimate

**8-10 hours** for complete implementation including testing

## Change Log

| Date       | Version | Description                                           | Author   |
| ---------- | ------- | ----------------------------------------------------- | -------- |
| 2025-09-05 | 1.0     | Initial story creation from epic                      | SM       |
| 2025-09-05 | 2.0     | Enhanced with architecture context and detailed tasks | Bob (SM) |

## QA Results

### Risk Profile Assessment - 2025-09-05

**Risk Score: 23/100** (High Risk - Requires significant mitigation)

#### Risk Distribution

- **Critical Risks: 3**
  - DATA-001: State file corruption during concurrent writes (Score: 9)
  - SEC-001: Sensitive data exposure in state files (Score: 9)
  - DATA-002: Recovery failure from corrupted state (Score: 9)
- **High Risks: 4** (Lock contention, cross-platform issues, monitoring gaps, schema migration)
- **Medium Risks: 5** (Large files, Bun API stability, transaction rollback, access control, backup retention)
- **Low Risks: 3** (User complexity, permissions, audit log rotation)

#### Critical Mitigations Required

1. **Exclusive file locking** with O_EXCL flag for concurrent access safety
2. **Secrets detection** before state persistence to prevent credential exposure
3. **Comprehensive backup/recovery** with checksum validation and 3-tier rotation
4. **Cross-platform testing** for Windows/macOS/Linux file system compatibility
5. **Transaction coordinator** with snapshot and rollback capabilities

#### Testing Priorities

- **Priority 1**: Concurrent write stress testing (100+ processes), corruption recovery, security scanning
- **Priority 2**: Cross-platform compatibility, performance under load, schema migration
- **Priority 3**: Backup rotation, permission handling, large file performance

#### Full Assessment

Risk profile: docs/qa/assessments/1.0-database-state-setup-risk-20250905.md

### Test Design - 2025-09-05

**Test Coverage: 48 scenarios** designed for comprehensive validation

#### Test Distribution

- **Unit Tests: 28 (58%)** - Core logic validation
- **Integration Tests: 14 (29%)** - File system and concurrency
- **E2E Tests: 6 (13%)** - Critical user paths
- **Priority: P0: 18, P1: 16, P2: 14**

#### Key Test Scenarios

- **Concurrency Testing**: 100+ concurrent process stress tests
- **Corruption Recovery**: Multiple corruption type scenarios
- **Cross-Platform**: Windows/macOS/Linux compatibility matrix
- **Performance Validation**: All operations under target thresholds
- **Schema Migration**: Version upgrade testing

#### Performance Targets

- State initialization: < 1000ms
- State load/save: < 50ms
- Lock acquisition: < 100ms
- All pure operations: < 10ms

#### Full Test Design

Test design matrix: docs/qa/assessments/1.0-database-state-setup-test-design-20250905.md

## Dev Agent Record

_This section will be populated by the development agent during implementation_

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List

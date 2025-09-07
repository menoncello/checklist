# Story 1.5: State Management Implementation

## Status

Draft

## Story

**As a** developer,  
**I want** a robust YAML-based state management system,  
**so that** workflow progress persists between sessions and is human-readable.

## Acceptance Criteria

1. State manager creates `.checklist/` directory structure automatically
2. YAML state files with schema: `state.yaml`, `config.yaml`, `history.yaml`
3. Atomic writes using temp file + rename strategy
4. Automatic backup before modifications in `.checklist/.backup/`
5. State corruption detection using checksums
6. JSON Schema validation ensures integrity
7. File locking prevents concurrent modification
8. Migration system for state file version updates
9. All operations complete in <50ms

## Tasks / Subtasks

- [ ] Create StateManager class structure (AC: 1, 2)
  - [ ] Define StateManager class in `/packages/core/src/state/StateManager.ts`
  - [ ] Implement WorkflowState interface with proper types
  - [ ] Set up dependency injection for Logger and Config services
- [ ] Implement directory structure creation (AC: 1)
  - [ ] Create `ensureDirectoryStructure()` method
  - [ ] Create `.checklist`, `.checklist/.backup`, `.checklist/.cache` directories
  - [ ] Generate default YAML files if not existing
- [ ] Implement atomic write operations (AC: 3)
  - [ ] Create `writeAtomic()` method using temp file strategy
  - [ ] Use Bun.write with temp file then rename for atomicity
  - [ ] Handle cleanup of temp files on error
- [ ] Implement backup system (AC: 4)
  - [ ] Create `createBackup()` method before any write operation
  - [ ] Implement `pruneBackups()` to maintain only last 10 backups
  - [ ] Add timestamp to backup filenames
- [ ] Add corruption detection (AC: 5)
  - [ ] Implement `calculateChecksum()` using SHA256
  - [ ] Add `validateChecksum()` method for state validation
  - [ ] Create `recover()` method to restore from backup on corruption
- [ ] Integrate JSON Schema validation (AC: 6)
  - [ ] Define WorkflowState schema using Ajv
  - [ ] Add schema validation in load/save operations
  - [ ] Create schema migration system for version updates
- [ ] Implement file locking mechanism (AC: 7)
  - [ ] Create FileLock class with acquire/release methods
  - [ ] Implement lock timeout and stale lock detection
  - [ ] Add process ID and hostname to lock files
- [ ] Create migration system (AC: 8)
  - [ ] Define Migration interface with from/to versions
  - [ ] Implement `migrateState()` method for version updates
  - [ ] Create migration registry for tracking migrations
- [ ] Performance optimization (AC: 9)
  - [ ] Ensure all operations complete within 50ms
  - [ ] Add performance monitoring with debug logger
  - [ ] Optimize YAML parsing/serialization
- [ ] Write comprehensive unit tests
  - [ ] Test directory structure creation
  - [ ] Test atomic writes and concurrent access
  - [ ] Test corruption recovery scenarios
  - [ ] Test file locking with multiple processes
  - [ ] Test migration system with version changes
  - [ ] Test performance requirements (<50ms)

## Dev Notes

### File Locations
- **StateManager Implementation**: `/packages/core/src/state/StateManager.ts` [Source: architecture/source-tree.md]
- **FileLock Implementation**: `/packages/core/src/state/FileLock.ts` [Source: architecture/source-tree.md]
- **Test Files**: `/packages/core/tests/state/StateManager.test.ts` [Source: architecture/source-tree.md]

### Technical Stack
- **Runtime**: Bun 1.1.x for file operations and built-in performance [Source: architecture/tech-stack.md]
- **YAML Processing**: js-yaml 4.1.x for YAML serialization/deserialization [Source: architecture/tech-stack.md]
- **Schema Validation**: Ajv 8.12.x for JSON Schema validation [Source: architecture/tech-stack.md]
- **Logging**: Debug 4.3.x with namespaces for development logging [Source: architecture/tech-stack.md]

### Data Models
```typescript
interface WorkflowState {
  version: string;
  checksum: string;
  lastModified: Date;
  activeInstance?: {
    id: string;
    templateId: string;
    templateVersion: string;
    status: 'active' | 'paused' | 'completed';
    currentStepIndex: number;
    variables: Record<string, any>;
    completedSteps: string[];
    skippedSteps: string[];
    startedAt: Date;
  };
}
```
[Source: Derived from architecture/data-models-with-multi-script-support.md and epic requirements]

### Architecture Patterns
- **Base Service Pattern**: Extend BaseService class with proper lifecycle methods [Source: architecture/backend-architecture-complete-with-all-services.md#BaseService]
- **Dependency Injection**: Use Container for service dependencies [Source: architecture/backend-architecture-complete-with-all-services.md#Container]
- **Concurrency Control**: Implement using ConcurrencyManager patterns [Source: architecture/backend-architecture-complete-with-all-services.md#ConcurrencyManager]

### State File Paths
- **Main State**: `.checklist/state.yaml`
- **Config**: `.checklist/config.yaml`
- **History**: `.checklist/history.yaml`
- **Backups**: `.checklist/.backup/state.yaml.{timestamp}`
- **Lock Files**: `.checklist/.locks/{resource}.lock`

### Coding Standards
- Use TypeScript strict mode with all ESLint rules enforced [Source: architecture/coding-standards.md]
- Follow Prettier formatting with 80 character line limit [Source: architecture/coding-standards.md]
- Use Bun.env instead of process.env for environment variables [Source: architecture/coding-standards.md]
- Avoid console.log - use debug logger instead [Source: architecture/coding-standards.md]

### Testing Requirements
- **Test Framework**: Bun Test (built-in test runner) [Source: architecture/tech-stack.md]
- **Test Data Factory**: Use TestDataFactory.createTestWorkspace() for isolated test environments [Source: architecture/testing-strategy-complete-with-all-testing-utilities.md#TestDataFactory]
- **Coverage Target**: 100% test coverage required [Source: Epic AC]
- **Performance Testing**: Use Tinybench for <50ms validation [Source: architecture/tech-stack.md]
- **Test Location**: Tests colocated with source as `.test.ts` files [Source: architecture/source-tree.md]

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|---------|
| 2025-01-06 | 1.0 | Initial story draft created | Scrum Master |

## Dev Agent Record

### Agent Model Used
_To be populated by dev agent_

### Debug Log References
_To be populated by dev agent_

### Completion Notes List
_To be populated by dev agent_

### File List
_To be populated by dev agent_

## QA Results
_To be populated by QA agent_
# Story 1.0: Database/State Store Setup

## Story
**As a** developer,  
**I want** a robust local state management system with file-based persistence,  
**so that** workflow state is preserved, recoverable, and handles concurrent access safely.

## Priority
**CRITICAL** - Must be completed before any state-dependent features

## Acceptance Criteria

### State Store Architecture
1. ✅ Design file-based state schema (YAML/JSON)
2. ✅ Implement atomic write operations with file locking
3. ✅ Create state directory structure (`.checklist/`)
4. ✅ Define state file naming conventions
5. ✅ Establish backup and recovery mechanisms

### Concurrency & Safety
1. ✅ Implement file locking to prevent concurrent access issues
2. ✅ Add transaction log for state changes
3. ✅ Create rollback mechanisms for failed operations
4. ✅ Handle corrupted state file recovery
5. ✅ Validate state integrity on load

### Core State Operations
1. ✅ State initialization (`init` command foundation)
2. ✅ State loading and validation
3. ✅ Atomic state updates
4. ✅ State migration utilities
5. ✅ State cleanup and archival

## Technical Implementation

### State Schema Definition
```yaml
# .checklist/state.yml
version: "1.0"
project:
  name: "project-name"
  template: "bmad-default"
  created: "2025-09-04T10:00:00Z"
  
workflow:
  current_step: 1
  total_steps: 15
  completed_steps: []
  variables:
    project_name: "MyProject"
    version: "1.0.0"
  
metadata:
  last_updated: "2025-09-04T10:00:00Z"
  backup_count: 3
  checksum: "abc123..."
```

### Core State Manager
```typescript
// packages/core/src/state/StateManager.ts
export class StateManager {
  private lockFile: string;
  private stateFile: string;
  private backupDir: string;
  
  async initializeState(projectPath: string): Promise<void>
  async loadState(): Promise<ChecklistState>
  async saveState(state: ChecklistState): Promise<void>
  async acquireLock(): Promise<void>
  async releaseLock(): Promise<void>
  async createBackup(): Promise<void>
  async recoverFromBackup(): Promise<ChecklistState>
  async validateStateIntegrity(): Promise<boolean>
}
```

### File Locking Implementation
```bash
# Create lock mechanism
mkdir -p packages/core/src/state
cat > packages/core/src/state/FileLock.ts << 'EOF'
export class FileLock {
  private lockPath: string;
  private timeout: number = 5000;
  
  async acquire(): Promise<boolean>
  async release(): Promise<void>
  async waitForRelease(): Promise<void>
  isLocked(): boolean
}
EOF
```

### Directory Structure Setup
```bash
# State directory structure
.checklist/
├── state.yml          # Current workflow state
├── backups/           # Automatic backups
│   ├── state.backup.1.yml
│   ├── state.backup.2.yml
│   └── state.backup.3.yml
├── locks/             # File locking
│   └── state.lock
├── logs/              # Transaction logs
│   └── transactions.log
└── templates/         # Local templates
    └── custom.yml
```

### Transaction Logging
```typescript
// packages/core/src/state/TransactionLog.ts
interface Transaction {
  id: string;
  timestamp: string;
  operation: 'init' | 'update' | 'complete' | 'reset';
  before: Partial<ChecklistState>;
  after: Partial<ChecklistState>;
}

export class TransactionLog {
  async logTransaction(transaction: Transaction): Promise<void>
  async getTransactionHistory(): Promise<Transaction[]>
  async rollbackToTransaction(id: string): Promise<void>
}
```

## Definition of Done
- [ ] State manager implemented with file locking
- [ ] Backup and recovery mechanisms working
- [ ] Transaction logging operational
- [ ] State validation passes all test cases
- [ ] Concurrent access testing completed
- [ ] Documentation for state schema created
- [ ] Integration tests with file system pass

## Dependencies
- **Depends on**: Story 1.1 (Project Setup)
- **Blocks**: Story 1.4 (Workflow Engine), Story 1.6 (State Management)

## Risk Mitigation
- **File Corruption**: Automatic checksums and backup rotation
- **Concurrent Access**: File locking with timeout mechanisms
- **Performance**: Lazy loading and incremental updates
- **Platform Compatibility**: Path normalization for Windows/Unix
# Story 2.4: State Operations Interface

## Overview

Create the user interface for state management operations, allowing users to save, load, manipulate, and inspect checklist state through intuitive commands and visualizations.

## Story Details

- **Epic**: 2 - User Interface & Interaction
- **Type**: Feature
- **Priority**: High
- **Estimated Effort**: 2 days
- **Dependencies**: [2.1, 1.4]

## Description

Implement comprehensive UI for all state management operations including saving/loading named states, viewing state history, performing undo/redo operations, and exporting state for sharing or backup purposes.

## Acceptance Criteria

- [ ] Save current state with custom names
- [ ] Load previously saved states
- [ ] List all available saved states with metadata
- [ ] Show diff between states
- [ ] Undo/redo operations with history visualization
- [ ] Export state to file (YAML/JSON)
- [ ] Import state from file
- [ ] State branching (save variants)
- [ ] Auto-save functionality with intervals
- [ ] State compression for large checklists
- [ ] Conflict resolution for concurrent edits

## Technical Requirements

### State Operations Interface

```typescript
interface StateOperationsUI {
  // Basic Operations
  saveState(name?: string): Promise<void>;
  loadState(name: string): Promise<void>;
  listStates(): StateInfo[];
  deleteState(name: string): Promise<void>;

  // History Operations
  undo(): void;
  redo(): void;
  getHistory(): HistoryEntry[];
  jumpToHistoryPoint(index: number): void;

  // Import/Export
  exportState(format: 'yaml' | 'json'): string;
  importState(data: string, format: 'yaml' | 'json'): Promise<void>;

  // Advanced
  diffStates(state1: string, state2: string): StateDiff;
  mergeStates(states: string[]): State;
  createBranch(baseName: string, branchName: string): void;
}

interface StateInfo {
  name: string;
  created: Date;
  modified: Date;
  size: number;
  checksum: string;
  metadata: {
    totalItems: number;
    completedItems: number;
    templateName: string;
    templateVersion: string;
  };
}
```

### UI Components

#### State Management Screen

```
┌─────────────────────────────────────┐
│ State Management                    │
├─────────────────────────────────────┤
│ Current State: project-sprint-2     │
│ Modified: 2 minutes ago             │
│ Progress: 45% (12/27 items)         │
├─────────────────────────────────────┤
│ Saved States:                       │
│ > project-sprint-1    3 days ago    │
│   project-sprint-2    current       │
│   backup-20240104     1 week ago    │
├─────────────────────────────────────┤
│ [s]ave [l]oad [d]iff e[x]port [?]   │
└─────────────────────────────────────┘
```

#### State Diff View

```
State Diff: sprint-1 → sprint-2
─────────────────────────────────
+ Task 1.2.3: Completed
- Task 1.2.4: Pending
~ Task 1.3.1: Pending → Active
+ Variable: deploymentTarget = "prod"

Summary: 3 completed, 2 modified, 1 added
```

#### History Browser

```
History (newest first):
─────────────────────────
[5] Current state
[4] ← Mark task 2.3 complete (2m ago)
[3] ← Update variable: env (5m ago)
[2] ← Mark task 2.2 complete (10m ago)
[1] ← Load template: sprint (1h ago)
[0] Initial state

Press number to jump to state, [u]ndo, [r]edo
```

### Auto-save Configuration

```yaml
autosave:
  enabled: true
  interval: 300 # seconds
  maxAutoSaves: 10
  strategy: rotating # or incremental
  beforeMajorOperations: true
```

## Implementation Notes

- Use YAML as primary format (human-readable)
- Implement state compression for large files
- Use checksums to detect changes
- Atomic write operations to prevent corruption
- Keep state files in `.checklist/states/` directory
- Implement file locking for concurrent access

## Testing Requirements

- [ ] Unit tests for all state operations
- [ ] Integration tests for file I/O
- [ ] Concurrency tests for simultaneous access
- [ ] Corruption recovery tests
- [ ] Large state performance tests
- [ ] Import/export format validation

## Error Handling

- Graceful handling of corrupted state files
- Clear messages for version mismatches
- Automatic backup before risky operations
- Recovery suggestions for common issues

## Definition of Done

- [ ] All state operations implemented
- [ ] UI components working smoothly
- [ ] Auto-save functioning reliably
- [ ] Import/export working for both formats
- [ ] History navigation functional
- [ ] Diff visualization clear
- [ ] Tests passing with >85% coverage
- [ ] Performance: State operations <100ms

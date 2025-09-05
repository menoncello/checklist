# Epic 4: Intelligence & Safety

**Goal:** Implement intelligent command handling with safety checks, clear differentiation between command types, and seamless shell integration.

## Story 4.1: Command Differentiation System

**As a** user,  
**I want** clear distinction between command types,  
**so that** I never execute commands incorrectly.

**Acceptance Criteria:**

1. [Claude] prefix with cyan color
2. [$] prefix with green color for Bash
3. Auto-detection from template metadata
4. Manual override possible
5. Different background colors in TUI
6. Warning for inappropriate copy
7. Preview shows target destination
8. Status bar indicates command type

## Story 4.2: Command Safety Validation ✨ NEW

**As a** user,  
**I want** dangerous commands detected and confirmed,  
**so that** I don't accidentally damage my system.

**Acceptance Criteria:**

1. Dangerous commands identified (rm -rf, DROP TABLE, etc.)
2. Confirmation required for dangerous operations
3. Dry-run mode for testing commands
4. Command allowlist/blocklist configuration
5. Sudo commands specially marked
6. Irreversible operations warned
7. Safety level configurable
8. Audit log of dangerous command execution

## Story 4.3: Clipboard Integration with Fallbacks

**As a** user,  
**I want** reliable clipboard operations,  
**so that** I can copy commands regardless of environment.

**Acceptance Criteria:**

1. 'c' copies to system clipboard
2. Success toast notification
3. Multi-line commands preserved
4. Variables resolved before copy
5. Multiple fallback methods
6. Copy history maintained (last 10)
7. Manual selection fallback
8. Clipboard preview available

## Story 4.4: Command Preview with Validation

**As a** user,  
**I want** to preview resolved commands,  
**so that** I know exactly what will execute.

**Acceptance Criteria:**

1. Preview shows substituted variables
2. Syntax highlighting applied
3. Multi-line formatting preserved
4. 'p' toggles preview panel
5. Real-time update on variable change
6. Dangerous commands highlighted red
7. Simulation mode shows expected output
8. Edit capability in preview

## Story 4.5: Auto-loading Shell Integration

**As a** user,  
**I want** automatic status on directory entry,  
**so that** I always know my workflow state.

**Acceptance Criteria:**

1. Shell scripts for bash/zsh/fish
2. Detects `.checklist/` presence
3. Shows brief status automatically
4. Configurable enable/disable
5. <50ms performance impact
6. Works with all navigation commands
7. Respects quiet mode
8. Safe uninstall script provided

## Story 4.6: Command History Recording ✨ SPLIT

**As a** user,  
**I want** a record of executed commands,  
**so that** I can track what was done.

**Acceptance Criteria:**

1. History saves last 500 commands
2. Timestamp and result for each
3. Persists in history.yaml
4. Searchable by content/type
5. Export to markdown/JSON
6. Rotation prevents huge files
7. Privacy mode excludes sensitive
8. Efficient storage format

## Story 4.7: History Replay and Undo ✨ SPLIT

**As a** user,  
**I want** to replay and undo commands,  
**so that** I can correct mistakes easily.

**Acceptance Criteria:**

1. 'r' replays from history
2. Undo last command action
3. Redo capability
4. Replay with modifications
5. Bulk replay multiple commands
6. Safe replay (re-validates)
7. Undo history preserved
8. Conflict resolution for parallel changes

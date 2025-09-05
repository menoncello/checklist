# Epic 2: TUI Core with Performance

**Goal:** Build the complete TUI interface with core checklist functionality, ensuring high performance and terminal compatibility from the start.

## Story 2.1: Checklist Panel with Virtual Scrolling

**As a** user,  
**I want** a performant checklist panel that handles large workflows,  
**so that** I can navigate efficiently regardless of workflow size.

**Acceptance Criteria:**

1. ChecklistPanel displays with status indicators (✓, ▶, ○)
2. Virtual scrolling renders only visible items
3. Smooth scrolling with arrow keys and j/k vim bindings
4. Current item highlighted with inverse colors
5. Scroll indicators when list exceeds visible area
6. Items truncate with ellipsis when too long
7. Header shows "Step X of Y" progress
8. Performance: smooth scrolling with 10,000 items
9. Memory usage stays constant regardless of list size

## Story 2.2: Detail Panel with Markdown Support

**As a** user,  
**I want** detailed step information with formatted text,  
**so that** I can understand complex instructions clearly.

**Acceptance Criteria:**

1. Detail panel displays current step prominently
2. Markdown rendering for bold, italic, code blocks
3. Commands shown with Claude/Bash indicators
4. Variables highlighted in different color
5. Panel updates immediately on selection change
6. Long content scrollable with maintained formatting
7. Copy instruction at bottom of panel
8. Syntax highlighting for code blocks
9. Links displayed (but not clickable in TUI)

## Story 2.3: Core Navigation Commands

**As a** user,  
**I want** intuitive keyboard commands for workflow navigation,  
**so that** I can progress efficiently through my checklist.

**Acceptance Criteria:**

1. 'n'/Enter advances to next step
2. 'd' marks done and auto-advances
3. 's' skips with confirmation
4. 'b' goes back to previous step
5. 'r' resets to beginning
6. 'l' toggles list view
7. '?' shows help overlay
8. 'q' quits with unsaved check
9. Visual feedback for all actions
10. Command queueing prevents race conditions

## Story 2.4: Performance Monitoring System ✨ NEW

**As a** developer,  
**I want** built-in performance monitoring,  
**so that** we can ensure the app stays fast as features are added.

**Acceptance Criteria:**

1. Performance metrics collected: render time, memory, CPU
2. Debug mode shows metrics overlay
3. Slow operations logged with stack traces
4. Memory leak detection for long-running sessions
5. Performance regression tests in CI
6. Metrics exported to file for analysis
7. Alerts when performance budgets exceeded
8. Profiling helpers for development

## Story 2.5: TUI Application Shell

**As a** developer,  
**I want** a robust main application loop,  
**so that** all components work together reliably.

**Acceptance Criteria:**

1. Application starts with version splash
2. Split-pane layout with configurable ratios
3. Input router handles focus correctly
4. Terminal properly initialized/restored
5. Graceful shutdown saves state
6. Resize handling reflows layout
7. Error boundary prevents crashes
8. Panic recovery with error reporting

## Story 2.6: Terminal Compatibility Suite ✨ NEW

**As a** user,  
**I want** the TUI to work across different terminals,  
**so that** I can use my preferred terminal emulator.

**Acceptance Criteria:**

1. Compatibility tested: Terminal.app, iTerm2, Alacritty, Windows Terminal
2. Feature detection for colors, Unicode, mouse support
3. Graceful degradation for limited terminals
4. ASCII-only mode for compatibility
5. Monochrome mode for no-color terminals
6. Minimum terminal size enforcement (80x24)
7. Warning messages for unsupported features
8. Compatibility matrix documented

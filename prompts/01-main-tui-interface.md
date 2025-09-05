# AI UI Prompt: Main TUI Interface (Split-Pane Layout)

## High-Level Goal

Create a terminal-based user interface (TUI) with a split-pane layout for the BMad Checklist Manager that provides efficient checklist execution through keyboard-only navigation. The interface should feel like a modern terminal application (similar to lazygit, k9s, or htop) with immediate visual feedback and developer-friendly aesthetics.

## Detailed Step-by-Step Instructions

1. **Create the main application shell structure:**
   - Build a full-screen terminal application that takes over the entire terminal viewport
   - Use ANSI escape codes for terminal control (no external TUI framework dependencies)
   - Implement a split-pane layout with 40% width for the left panel (checklist) and 60% for the right panel (details)
   - Add a thin status bar at the bottom (1 line) showing keyboard shortcuts and sync status
   - Include a header bar (1 line) showing "BMad Checklist Manager" with current checklist name

2. **Style the terminal interface:**
   - Use box-drawing characters (┌─┐│└┘├┤┬┴┼) for panel borders
   - Apply a dark theme with high contrast colors
   - Primary color: Cyan (#0969DA) for active selections
   - Success color: Green (#1F883D) for completed items
   - Warning color: Yellow (#FFA500) for skipped items
   - Error color: Red (#DA3633) for failed items
   - Use monospace font rendering throughout

3. **Implement the left checklist panel:**
   - Display a scrollable list of checklist items with status indicators
   - Show item numbers (1-9) for quick navigation
   - Use checkboxes: [ ] for pending, [✓] for complete, [✗] for failed, [⊘] for skipped
   - Highlight the current item with inverse video (swap foreground/background)
   - Show a progress indicator at the top: "Step 3 of 15 (20%)"
   - Support virtual scrolling for lists with >100 items

4. **Create the right detail panel:**
   - Display the currently selected checklist item's full details
   - Show the item title in bold at the top
   - Render markdown-formatted description with proper formatting
   - Display command blocks with syntax highlighting
   - Show [Claude] prefix for AI commands in cyan
   - Show [$] prefix for terminal commands in green
   - Include variable placeholders highlighted in yellow: ${variable_name}
   - Add a bottom section showing "Press 'c' to copy command | 'd' to mark done | 'n' for next"

5. **Add keyboard navigation:**
   - j/k or ↑/↓: Navigate up/down in the checklist
   - Enter or d: Mark current item as done
   - n: Move to next incomplete item
   - b: Go back to previous item
   - Space: Toggle current item completion
   - c: Copy current command to clipboard
   - /: Enter search mode
   - ?: Toggle help overlay
   - q or Ctrl+C: Quit application
   - Tab: Switch focus between panels
   - 1-9: Quick jump to numbered items

6. **Implement responsive layout:**
   - Detect terminal resize events (SIGWINCH)
   - Minimum terminal size: 80 columns × 24 lines
   - Below 100 columns: Hide detail panel, show list only
   - Below 80 columns: Show compact mode with current item only
   - Gracefully handle terminal sizes and reflow content

7. **Add status indicators and feedback:**
   - Show spinner animation (⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏) for items being processed
   - Flash green briefly when item marked complete
   - Display sync status in bottom-right: "✓ Saved" or "⟳ Syncing..."
   - Show current time elapsed on active item
   - Display total checklist completion percentage in header

## Code Examples, Data Structures & Constraints

```typescript
// Terminal dimensions and layout structure
interface Layout {
  terminal: { width: number; height: number };
  panels: {
    header: { height: 1 };
    checklist: { width: '40%'; x: 0; y: 1 };
    details: { width: '60%'; x: '40%'; y: 1 };
    statusBar: { height: 1; y: 'bottom' };
  };
}

// Checklist item structure
interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  command?: {
    type: 'claude' | 'bash';
    text: string;
    variables?: Record<string, string>;
  };
  status: 'pending' | 'in-progress' | 'completed' | 'failed' | 'skipped';
  duration?: number;
}

// Color scheme using ANSI codes
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  inverse: '\x1b[7m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
};

// Box drawing characters for UI
const boxChars = {
  topLeft: '┌',
  topRight: '┐',
  bottomLeft: '└',
  bottomRight: '┘',
  horizontal: '─',
  vertical: '│',
  cross: '┼',
  teeLeft: '├',
  teeRight: '┤',
};
```

**IMPORTANT CONSTRAINTS:**

- DO NOT use external UI frameworks like React, Vue, or Angular
- DO NOT require mouse interaction - keyboard only
- DO NOT use smooth animations - use instant terminal updates
- DO NOT exceed 50ms response time for any interaction
- DO NOT clear entire screen on updates - use differential rendering
- MUST work in standard terminal emulators (Terminal.app, iTerm2, Windows Terminal)
- MUST support NO_COLOR environment variable for monochrome output
- MUST handle Unicode gracefully with ASCII fallbacks

## Strict Scope

You should ONLY create:

- The main TUI application shell with split-pane layout
- The checklist panel with item navigation
- The detail panel with markdown rendering
- Keyboard input handling and navigation
- Terminal resize handling

You should NOT create:

- Web interface or GUI components
- Database or backend logic
- File system operations
- Network requests
- Template parsing logic
- State persistence

## Mobile-First Terminal Approach

Since this is a terminal application, we follow a "narrow-first" approach:

**60-79 columns (narrow terminal):**

- Single column layout
- Show only current item with progress
- Minimal borders, maximum content
- Number keys for quick navigation

**80-99 columns (standard terminal):**

- List view with abbreviated details
- Current item expanded
- Basic status indicators

**100-119 columns (comfortable width):**

- Split pane with 40/60 ratio
- Full checklist visible
- Detailed view panel

**120+ columns (wide terminal):**

- Additional metadata columns
- Extended keyboard hints
- Side-by-side command preview

## Expected Output Format

The final implementation should render like this in a terminal:

````
┌─ BMad Checklist Manager - Deploy Checklist (7/15 - 46%) ─────────────────┐
│ Checklist Items            │ Current Task Details                        │
├────────────────────────────┼─────────────────────────────────────────────┤
│ ✓ 1. Initialize project    │ **Run test suite**                          │
│ ✓ 2. Install dependencies  │                                              │
│ ✓ 3. Configure environment │ Execute all unit and integration tests to   │
│ ✓ 4. Build application     │ ensure code quality before deployment.      │
│ ✓ 5. Run linting           │                                              │
│ ✓ 6. Type checking         │ Command:                                     │
│ ▶ 7. Run test suite        │ ```bash                                      │
│ ○ 8. Generate docs         │ $ npm run test:all                          │
│ ○ 9. Build Docker image    │ ```                                         │
│ ○ 10. Push to registry     │                                              │
│ ○ 11. Deploy to staging    │ Expected duration: ~2 minutes                │
│ ○ 12. Run smoke tests      │ Variables: None                              │
│ ○ 13. Deploy to production │                                              │
│ ○ 14. Verify deployment    │ ─────────────────────────────────────────   │
│ ○ 15. Send notifications   │ Press 'c' to copy │ 'd' to done │ 'n' next  │
└────────────────────────────┴─────────────────────────────────────────────┘
[j/k] Navigate [d] Done [n] Next [c] Copy [/] Search [?] Help [q] Quit  ✓ Saved
````

Remember: This is a terminal application that should feel native to developers who use CLI tools daily. Prioritize efficiency, keyboard shortcuts, and clear visual hierarchy over fancy graphics or animations.

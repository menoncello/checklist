# AI UI Prompt: Help Overlay

## High-Level Goal
Create a context-sensitive help overlay that displays keyboard shortcuts, command descriptions, and usage tips relevant to the current screen. The overlay should feel like a native terminal help screen (similar to vim, less, or htop help) with organized sections and quick navigation.

## Detailed Step-by-Step Instructions

1. **Build the overlay rendering system:**
   - Create full-screen overlay that covers the entire terminal
   - Use single-line box characters (┌─┐│└┘) for clean appearance
   - Add semi-transparent effect by dimming background content
   - Center the help content with maximum 80 columns width
   - Show "Help - Press ? or ESC to close" in header
   - Support scrolling if content exceeds terminal height
   - Implement quick jump to sections with number keys (1-9)

2. **Create the multi-column layout:**
   - Organize shortcuts in logical column groups:
     ```
     ┌─────────────────────── Keyboard Shortcuts ───────────────────────┐
     │ Navigation          │ Actions            │ Commands             │
     │ ─────────────────  │ ────────────────  │ ─────────────────   │
     │ j/↓   Next item    │ d    Mark done    │ :w   Save state     │
     │ k/↑   Previous     │ Space Toggle      │ :q   Quit           │
     │ g     First item   │ n    Next task    │ :r   Reload         │
     │ G     Last item    │ b    Go back      │ :e   Edit           │
     └────────────────────────────────────────────────────────────────────┘
     ```
   - Use consistent spacing and alignment
   - Show key combination in monospace
   - Add description with proper padding
   - Highlight important shortcuts in bold

3. **Implement context-aware help content:**
   - Detect current mode/screen and show relevant help:
     - Main view: navigation, execution commands
     - Edit mode: editing shortcuts, save/cancel
     - Variable editor: type-specific commands
     - Search mode: search operators, filters
   - Show mode indicator at top: "Help for: Main View"
   - Gray out unavailable commands in current context
   - Add "Context: Viewing checklist item 7 of 15"

4. **Add command reference section:**
   - Display available commands with descriptions:
     ```
     ╔═══════════════════ Command Reference ══════════════════╗
     ║ Command     │ Description              │ Example      ║
     ║─────────────────────────────────────────────────────────║
     ║ :next [n]   │ Skip n items forward    │ :next 3     ║
     ║ :back [n]   │ Go back n items         │ :back       ║
     ║ :goto <n>   │ Jump to item number     │ :goto 15    ║
     ║ :search     │ Search in checklist     │ :search api ║
     ║ :set        │ Set variable value      │ :set ENV=prod║
     ║ :export     │ Export checklist        │ :export yaml║
     ║ :help <cmd> │ Get help for command    │ :help set   ║
     ╚══════════════════════════════════════════════════════════╝
     ```
   - Support filtering with "/" to search commands
   - Show command syntax with optional/required params
   - Include examples for complex commands

5. **Create the tips and hints section:**
   - Show rotating tips relevant to user's current action:
     ```
     💡 Pro Tips:
     • Use number keys 1-9 for quick navigation to items
     • Press 'v' to edit variables without leaving checklist
     • Combine commands: ":goto 10 | :done" marks item 10 complete
     • Use Tab to auto-complete commands and variable names
     • Press '.' to repeat last command
     ```
   - Highlight newly discovered features
   - Show productivity hints based on usage patterns
   - Include workflow optimization suggestions

6. **Add legend for symbols and indicators:**
   - Explain all visual indicators used in the UI:
     ```
     Symbol Legend:
     ┌──────────────────────────────────┐
     │ [ ] Pending task                 │
     │ [✓] Completed task              │
     │ [✗] Failed task                 │
     │ [⊘] Skipped task                │
     │ [⟳] In progress                 │
     │ ▶   Current selection           │
     │ 🔴  Dangerous command           │
     │ 🟡  Warning/Caution             │
     │ 🟢  Safe operation              │
     │ 📎  Has attachment              │
     │ 🔒  Locked/Read-only            │
     └──────────────────────────────────┘
     ```

7. **Implement interactive help features:**
   - Support drill-down help with 'h' on any item
   - Show command preview when hovering over shortcut
   - Interactive tutorial mode with 't'
   - Practice area for trying commands safely
   - Link to documentation with 'D'
   - Copy example commands with 'c'

## Code Examples, Data Structures & Constraints

```typescript
// Help content structure
interface HelpContent {
  mode: 'main' | 'edit' | 'search' | 'variables' | 'command';
  sections: Array<{
    title: string;
    columns?: Array<{
      header: string;
      items: Array<{
        key: string;
        description: string;
        available: boolean;
        category?: 'navigation' | 'action' | 'command';
      }>;
    }>;
    content?: string;  // For single-column sections
  }>;
  tips: string[];
  context: {
    screen: string;
    state: string;
    available_commands: string[];
  };
}

// Keyboard shortcut registry
const shortcuts = {
  global: [
    { key: '?', desc: 'Toggle help', category: 'help' },
    { key: 'q', desc: 'Quit application', category: 'system' },
    { key: ':', desc: 'Command mode', category: 'command' },
    { key: '/', desc: 'Search mode', category: 'search' },
  ],
  navigation: [
    { key: 'j/↓', desc: 'Move down', category: 'navigation' },
    { key: 'k/↑', desc: 'Move up', category: 'navigation' },
    { key: 'h/←', desc: 'Go back/left', category: 'navigation' },
    { key: 'l/→', desc: 'Go forward/right', category: 'navigation' },
    { key: 'g', desc: 'Go to first', category: 'navigation' },
    { key: 'G', desc: 'Go to last', category: 'navigation' },
    { key: '{n}G', desc: 'Go to line n', category: 'navigation' },
    { key: 'zz', desc: 'Center current', category: 'navigation' },
  ],
  actions: [
    { key: 'd', desc: 'Mark done', category: 'action' },
    { key: 'u', desc: 'Mark undone', category: 'action' },
    { key: 's', desc: 'Skip item', category: 'action' },
    { key: 'n', desc: 'Next incomplete', category: 'action' },
    { key: 'N', desc: 'Previous incomplete', category: 'action' },
    { key: 'r', desc: 'Reload/Refresh', category: 'action' },
    { key: 'c', desc: 'Copy command', category: 'action' },
    { key: 'e', desc: 'Edit item', category: 'action' },
  ],
  vim_commands: [
    { cmd: ':w', desc: 'Save checklist state' },
    { cmd: ':q', desc: 'Quit (will prompt if unsaved)' },
    { cmd: ':wq', desc: 'Save and quit' },
    { cmd: ':q!', desc: 'Force quit without saving' },
    { cmd: ':e', desc: 'Reload checklist' },
    { cmd: ':%s/old/new/g', desc: 'Replace all occurrences' },
    { cmd: ':set', desc: 'Set variable value' },
    { cmd: ':help', desc: 'Show this help' },
  ]
};

// Help layout calculator
function calculateHelpLayout(
  termWidth: number,
  termHeight: number
): { columns: number; width: number; height: number } {
  const maxWidth = Math.min(termWidth - 4, 100);
  const maxHeight = termHeight - 4;
  const columns = termWidth >= 100 ? 3 : termWidth >= 60 ? 2 : 1;
  
  return {
    columns,
    width: maxWidth,
    height: maxHeight
  };
}

// Context detection
function detectContext(): HelpContext {
  return {
    mode: getCurrentMode(),
    screen: getCurrentScreen(),
    itemIndex: getSelectedItemIndex(),
    totalItems: getTotalItems(),
    hasUnsavedChanges: checkUnsavedChanges(),
    availableActions: getAvailableActions(),
  };
}
```

**IMPORTANT CONSTRAINTS:**
- MUST be readable in 80x24 minimum terminal
- MUST organize shortcuts logically by function
- DO NOT overwhelm with too much information
- Support pagination for long help content
- Maintain consistent key naming (Ctrl vs ⌃)
- Group related commands together
- Use color sparingly for emphasis
- Cache rendered help for performance

## Strict Scope

You should ONLY create:
- Help overlay with keyboard shortcuts
- Context-sensitive help content
- Command reference documentation
- Symbol and indicator legend
- Tips and productivity hints
- Navigation within help

You should NOT create:
- Interactive tutorials
- External documentation
- Video/animation content
- Network requests for help
- Help content editing
- User preference storage

## Visual Examples

**Main Help Overlay:**
```
┌────────────────────── BMad Checklist Help ──────────────────── ? to close ┐
│                                                                             │
│ NAVIGATION                 ACTIONS                   CHECKLIST             │
│ ═══════════════           ═══════════════          ═══════════════        │
│ j/↓     Move down         d      Mark done         n    Next task         │
│ k/↑     Move up           Space  Toggle item       b    Previous task     │
│ h/←     Panel left        s      Skip item         r    Reset checklist   │
│ l/→     Panel right       u      Undo last         R    Restart from beginning│
│ g       First item        c      Copy command                             │
│ G       Last item         e      Edit variables                           │
│ {n}G    Go to item n      v      View details                            │
│ /       Search            p      Preview command                          │
│ Tab     Switch panels     Enter  Execute/Confirm                          │
│                                                                             │
│ COMMAND MODE (:)          VIEW CONTROLS            QUICK JUMPS            │
│ ═══════════════          ═══════════════          ═══════════════        │
│ :w      Save state       zo     Expand group      1-9   Jump to item     │
│ :q      Quit             zc     Collapse group    0     Jump to item 10  │
│ :wq     Save & quit      za     Toggle group      gg    First item       │
│ :q!     Force quit       zR     Expand all        G     Last item        │
│ :e      Reload           zM     Collapse all      ''    Last position    │
│ :set    Set variable     H      Top of screen     `.    Last change      │
│ :goto   Jump to item     M      Middle screen                            │
│ :help   This screen      L      Bottom screen                            │
│                                                                             │
│ ──────────────────────────────────────────────────────────────────────    │
│ 💡 Tips: Use '.' to repeat last command • Press Tab for auto-complete     │
│         Type ':set<Tab>' to see all variables • 'u' undoes last action   │
└──────────────────────────────────────────────────────────────────────────  ┘
 Page 1/2  [Space] Next page  [b] Previous  [1-9] Jump to section  [ESC] Close
```

**Context-Sensitive Help (Edit Mode):**
```
┌──────────────── Variable Editor Help ────────────────┐
│ Currently editing: PROJECT_NAME (string)             │
│                                                       │
│ TEXT EDITING              NAVIGATION                 │
│ ════════════             ═══════════                │
│ Backspace  Delete char   ←/→   Move cursor          │
│ Ctrl+W     Delete word   Home  Start of line        │
│ Ctrl+U     Clear line    End   End of line         │
│ Ctrl+K     Delete to end Tab   Next field          │
│ Ctrl+A     Select all    S-Tab Previous field      │
│                                                       │
│ ACTIONS                                              │
│ ═══════════                                         │
│ Enter      Save changes                             │
│ Escape     Cancel (discard changes)                 │
│ Ctrl+S     Save all variables                       │
│ Ctrl+Z     Undo last change                        │
│ Ctrl+Y     Redo                                    │
│                                                       │
│ Validation: Must match pattern ^[a-z][a-z0-9-]*$   │
│ Current: "my-app" → New: "my-awesome-app" ✓        │
└───────────────────────────────────────────────────────┘
```

**Command Reference Section:**
```
┌─────────────── Command Reference ────────────────┐
│ Format: :<command> [options] [arguments]        │
│                                                   │
│ NAVIGATION COMMANDS                              │
│ ═══════════════════════════════════════         │
│ :next [n]      Skip n items (default: 1)        │
│ :back [n]      Go back n items                  │
│ :goto <n>      Jump to specific item            │
│ :first         Go to first item                 │
│ :last          Go to last item                  │
│                                                   │
│ STATE COMMANDS                                   │
│ ═══════════════════════════════════════         │
│ :done [n]      Mark item n as done              │
│ :undone [n]    Mark item n as not done          │
│ :skip [n]      Skip item n                      │
│ :reset         Reset all progress               │
│ :clear         Clear completed items            │
│                                                   │
│ VARIABLE COMMANDS                                │
│ ═══════════════════════════════════════         │
│ :set VAR=val   Set variable value              │
│ :unset VAR     Remove variable                 │
│ :vars          List all variables              │
│ :env           Import environment vars          │
│                                                   │
│ Type ':help <command>' for detailed help        │
└───────────────────────────────────────────────────┘
```

**Symbol Legend:**
```
┌──────────── Symbol & Status Legend ────────────┐
│ TASK STATUS          INDICATORS                │
│ ════════════        ═══════════                │
│ [ ]  Pending        ▶  Current item           │
│ [✓]  Completed      ⟳  Processing             │
│ [✗]  Failed         ⏸  Paused                 │
│ [⊘]  Skipped        🔒 Locked/Read-only       │
│ [?]  Optional       📎 Has attachments        │
│ [!]  Required       💬 Has comments           │
│                                                 │
│ SEVERITY LEVELS     COMMAND TYPES             │
│ ════════════       ═══════════                │
│ 🟢  Safe           [Claude] AI Command        │
│ 🟡  Caution        [$] Terminal Command       │
│ 🔴  Dangerous      [>] Output/Result          │
│                                                 │
│ SPECIAL KEYS                                   │
│ ════════════                                   │
│ ⌃  Control    ⌥  Option    ⌘  Command        │
│ ⇧  Shift      ⏎  Enter     ⎋  Escape         │
│ ⇥  Tab        ␣  Space     ⌫  Backspace      │
└──────────────────────────────────────────────────┘
```

Remember: The help overlay is users' primary learning tool. Clear organization, contextual relevance, and quick access to information are essential for helping users master the interface efficiently.
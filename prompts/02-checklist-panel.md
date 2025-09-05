# AI UI Prompt: Checklist Panel with Virtual Scrolling

## High-Level Goal

Create a high-performance checklist panel component that can handle thousands of items efficiently through virtual scrolling, while maintaining smooth keyboard navigation and instant visual feedback. This panel serves as the primary navigation interface for the BMad Checklist Manager.

## Detailed Step-by-Step Instructions

1. **Build the virtual scrolling engine:**
   - Implement a viewport that only renders visible items plus a buffer of 5 items above/below
   - Calculate visible item count based on terminal height (account for borders and headers)
   - Track scroll position and selected item index separately
   - Maintain a virtual list of all items in memory but only render what's visible
   - Update render window as user scrolls, ensuring selected item stays visible

2. **Create the checklist item renderer:**
   - Format each item with consistent spacing and alignment
   - Display item number (1-999+) right-aligned in 4-character field
   - Show status indicator after number: [ ] pending, [✓] complete, [✗] failed, [⊘] skipped, [⟳] in-progress
   - Truncate item title to fit available width with ellipsis (...)
   - Apply color coding: gray for pending, green for complete, red for failed, yellow for skipped, cyan for in-progress
   - Highlight selected item with inverse video (ANSI SGR 7)

3. **Implement scroll indicators:**
   - Show scroll position indicator on the right edge using block characters
   - Display "▲" at top when items exist above viewport
   - Display "▼" at bottom when items exist below viewport
   - Show proportional scroll thumb using "█" character
   - Update scroll bar height based on visible items ratio
   - Add item count in header: "Items (showing 10-20 of 150)"

4. **Add keyboard navigation with smooth scrolling:**
   - j/↓: Move selection down one item, scroll if needed
   - k/↑: Move selection up one item, scroll if needed
   - Ctrl+d/PageDown: Scroll down half page
   - Ctrl+u/PageUp: Scroll up half page
   - g/Home: Jump to first item
   - G/End: Jump to last item
   - {number}G: Jump to specific item number
   - /: Enter search mode with incremental filtering
   - n/N: Jump to next/previous search match
   - zz: Center current item in viewport

5. **Optimize rendering performance:**
   - Batch terminal writes to avoid flicker
   - Use ANSI cursor positioning to update only changed lines
   - Cache rendered strings for static items
   - Debounce rapid navigation (10ms) to prevent overwhelming terminal
   - Pre-calculate item positions and only re-render on change
   - Implement dirty tracking to avoid unnecessary redraws

6. **Create item grouping and nesting:**
   - Support nested items with indentation (2 spaces per level)
   - Display group headers with different styling (bold, underlined)
   - Show expand/collapse indicators for groups: [▶] collapsed, [▼] expanded
   - Allow Space key to toggle group expansion
   - Maintain expansion state during scrolling
   - Count only visible items for scroll calculations

7. **Add visual enhancements:**
   - Show progress bar at panel top: "Progress: [████████░░░░] 67%"
   - Display execution time for current item: "⏱ 00:45"
   - Add subtle separators between sections using "─" character
   - Show item badges for special states: "⚠" for warnings, "ⓘ" for info
   - Pulse current executing item using alternating colors (200ms interval)

## Code Examples, Data Structures & Constraints

```typescript
// Virtual scrolling state
interface VirtualScroller {
  items: ChecklistItem[]; // Full item list
  viewportHeight: number; // Visible lines for items
  scrollOffset: number; // First visible item index
  selectedIndex: number; // Currently selected item
  visibleRange: {
    start: number;
    end: number;
  };
}

// Rendering optimization
class ChecklistRenderer {
  private renderCache = new Map<string, string>();
  private dirtyItems = new Set<number>();

  renderItem(item: ChecklistItem, index: number, width: number): string {
    const cacheKey = `${item.id}-${item.status}-${width}`;
    if (!this.dirtyItems.has(index) && this.renderCache.has(cacheKey)) {
      return this.renderCache.get(cacheKey);
    }

    const rendered = this.formatItem(item, index, width);
    this.renderCache.set(cacheKey, rendered);
    this.dirtyItems.delete(index);
    return rendered;
  }
}

// Item formatting with proper spacing
function formatItem(item: ChecklistItem, index: number, width: number): string {
  const number = String(index + 1).padStart(3, ' ');
  const status = getStatusIcon(item.status);
  const indent = '  '.repeat(item.depth || 0);
  const maxTitleWidth = width - number.length - status.length - indent.length - 6;
  const title = truncate(item.title, maxTitleWidth);

  return `${number}. ${status} ${indent}${title}`;
}

// Status indicators
const statusIcons = {
  pending: '[ ]',
  'in-progress': '[⟳]',
  completed: '[✓]',
  failed: '[✗]',
  skipped: '[⊘]',
  blocked: '[⚠]',
};

// Performance constraints
const RENDER_BUFFER = 5; // Items to render outside viewport
const DEBOUNCE_MS = 10; // Navigation debounce
const MAX_VISIBLE = 50; // Max items to render at once
const CACHE_SIZE = 1000; // Max cached render strings
```

**IMPORTANT CONSTRAINTS:**

- MUST handle 10,000+ items without performance degradation
- MUST maintain 60fps scrolling (16ms per frame maximum)
- MUST keep memory usage under 50MB even with large lists
- DO NOT re-render entire list on each update
- DO NOT block UI thread during scrolling
- ONLY render items within viewport + buffer
- Cache aggressively but respect memory limits
- Use fixed-width fonts for alignment

## Strict Scope

You should ONLY create:

- The virtual scrolling mechanism
- Item rendering with status indicators
- Keyboard navigation handlers
- Scroll position indicators
- Performance optimizations for large lists

You should NOT create:

- The detail panel or other UI components
- File system operations
- State management logic
- Network requests
- Command execution logic

## Responsive Terminal Behavior

**Narrow terminals (60-79 cols):**

```
Items (7/15)
─────────────
  3. [✓] Config
▶ 4. [ ] Build
  5. [ ] Test
─────────────
[j/k] Nav
```

**Standard terminals (80-99 cols):**

```
Checklist Items (showing 5-10 of 15)
─────────────────────────────────────
  5. [✓] Install dependencies      ▲
  6. [✓] Configure environment     ║
▶ 7. [⟳] Build application          ▓
  8. [ ] Run tests                 ║
  9. [ ] Generate documentation    ▼
─────────────────────────────────────
```

**Wide terminals (100+ cols):**

```
Checklist Items - Deploy Process (showing 5-15 of 45)
──────────────────────────────────────────────────────────────────
  5. [✓] Install dependencies                    ✓ 00:12         ▲
  6. [✓] Configure environment variables         ✓ 00:05         ║
  7. [✓] Setup database connections              ✓ 00:08         ║
  8. [▼] Build Steps                                              ▓
  9.   [✓] Compile TypeScript                    ✓ 00:45         ║
 10.   [✓] Bundle assets                         ✓ 00:23         ║
▶11.   [⟳] Optimize images                       ⏱ 01:32         ║
 12.   [ ] Generate source maps                                   ║
 13. [ ] Run test suite                                          ║
 14. [ ] Deploy to staging                                       ▼
──────────────────────────────────────────────────────────────────
Progress: [████████░░░░░░░░] 55% | 11/20 completed
```

## Expected Rendering Output

The component should produce clean, aligned output like:

```
  1. [✓] Initialize repository               ✓ 00:02
  2. [✓] Install dependencies                ✓ 00:45
  3. [✓] Configure environment               ✓ 00:03
  4. [✓] Setup pre-commit hooks              ✓ 00:01
  5. [▼] Backend Development
  6.   [✓] Create database schema            ✓ 00:12
  7.   [✓] Implement API endpoints           ✓ 02:30
  8.   [⟳] Write unit tests                  ⏱ 00:45
  9.   [ ] Setup authentication
 10.   [ ] Add data validation
 11. [▶] Frontend Development
 12. [ ] Testing & QA
 13. [ ] Deployment
```

With selected item highlighted:

```
  7.   [✓] Implement API endpoints           ✓ 02:30
█ 8.   [⟳] Write unit tests                  ⏱ 00:45 █ (inverse video)
  9.   [ ] Setup authentication
```

## Performance Testing Checklist

The implementation should pass these benchmarks:

- [ ] Render 10,000 items list in <50ms initial load
- [ ] Scroll through 1000 items smoothly without stutter
- [ ] Navigate with j/k at 30 keystrokes/second without lag
- [ ] Memory usage stays under 30MB with 10,000 items
- [ ] Search through 5000 items with instant results
- [ ] Expand/collapse 100 groups in <100ms

Remember: This panel is the primary interface users will interact with hundreds of times per day. Every millisecond of lag compounds into frustration. Optimize relentlessly.

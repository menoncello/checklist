# Story 2.3: Progress Visualization

## Overview

Create comprehensive progress visualization system that displays checklist completion status, current location in workflow, and provides clear visual feedback on task states.

## Story Details

- **Epic**: 2 - User Interface & Interaction
- **Type**: Feature
- **Priority**: High
- **Estimated Effort**: 1 day
- **Dependencies**: [2.2, 1.4]

## Description

Implement visual progress indicators that help users understand their position in the workflow, what's been completed, what's active, and what remains. The visualization should be terminal-responsive and work across different display modes.

## Acceptance Criteria

- [ ] Show overall completion percentage (e.g., "45% Complete")
- [ ] Display progress bar with visual representation
- [ ] Show current location in workflow hierarchy
- [ ] Color-coded status indicators:
  - Gray: Pending/Not started
  - Yellow: Active/In progress
  - Green: Completed
  - Red: Blocked/Failed
  - Blue: Skipped
- [ ] Terminal width responsive layout (60-120+ columns)
- [ ] Compact and detailed view modes
- [ ] Show time estimates and elapsed time
- [ ] Display task counts (5 of 12 completed)
- [ ] Support for nested checklist progress

## Technical Requirements

### Visual Components

```typescript
interface ProgressVisualization {
  // Overall progress
  totalItems: number;
  completedItems: number;
  activeItems: number;
  blockedItems: number;

  // Current context
  currentPath: string[]; // ["Epic 1", "Story 1.2", "Task 3"]
  currentItem: ChecklistItem;

  // Display modes
  mode: 'compact' | 'detailed' | 'minimal';

  // Rendering
  render(width: number): string;
}
```

### Progress Bar Styles

```
Compact Mode (< 80 cols):
[████████░░░░░░░] 45% (5/12)

Detailed Mode (>= 80 cols):
Epic 1 > Story 1.2 > Setup
[████████████░░░░░░░░░░░░] 45% Complete
✓ 5 completed · 2 active · 5 remaining · 0 blocked

Minimal Mode (< 60 cols):
45% [5/12]
```

### Status Indicators

```
✓ Completed task
◉ Active task
○ Pending task
✗ Blocked task
⊘ Skipped task
⟳ Repeating task
```

### Implementation Notes

- Use Unicode box-drawing characters with ASCII fallback
- Implement responsive breakpoints (60, 80, 120 columns)
- Cache rendered output to avoid recalculation
- Support NO_COLOR environment variable
- Provide plain text alternative for CI environments

## Testing Requirements

- [ ] Unit tests for progress calculations
- [ ] Visual tests for different terminal widths
- [ ] Test color and no-color modes
- [ ] Verify Unicode and ASCII fallbacks
- [ ] Test with various completion states
- [ ] Performance tests with large checklists

## Accessibility Considerations

- Screen reader friendly output in minimal mode
- High contrast color choices
- Option for symbols instead of colors only
- Clear textual descriptions alongside visual elements

## Definition of Done

- [ ] All visualization modes implemented
- [ ] Responsive to terminal width
- [ ] Color coding working with fallbacks
- [ ] Progress calculations accurate
- [ ] Nested checklist support
- [ ] Tests passing with >90% coverage
- [ ] Performance: Render <10ms
- [ ] Documentation includes examples

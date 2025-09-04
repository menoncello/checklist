# AI UI Prompt: History View

## High-Level Goal
Create a comprehensive history view that displays a timeline of all checklist activities, executed commands, state changes, and completion metrics. The view should feel like a git log or shell history with powerful filtering, search capabilities, and the ability to replay or undo actions.

## Detailed Step-by-Step Instructions

1. **Build the timeline visualization:**
   - Create a vertical timeline with chronological entries:
     ```
     ─── 2024-03-14 ──────────────────────────────
     10:45:23  ✓  Completed "Initialize project"      2.3s
     10:45:26  $  Executed: npm install              45.2s
     10:45:71  ⟳  Started "Configure environment"     
     10:46:15  📝 Variable changed: ENV = production
     10:46:18  ✓  Completed "Configure environment"   47s
     10:46:20  ⊘  Skipped "Run tests" (manual override)
     ```
   - Use connecting lines to show continuity: │ ├ └
   - Color-code by event type: green=complete, blue=command, yellow=skip
   - Show duration for completed items
   - Display relative timestamps (2m ago, yesterday, last week)

2. **Implement the event type system:**
   - Track different event categories:
     - **Task events**: started, completed, failed, skipped, retried
     - **Command events**: executed, copied, previewed
     - **State events**: variable changed, checklist saved, restored
     - **Navigation events**: jumped to item, searched, filtered
     - **Error events**: validation failed, command error, timeout
   - Show appropriate icon for each type:
     ```
     ✓ Complete  ✗ Failed  ⊘ Skip  ⟳ Start  $ Command
     📝 Edit     💾 Save    ↶ Undo  ⚠ Error  🔍 Search
     ```

3. **Create the detail expansion view:**
   - Allow expanding entries to see full details:
     ```
     ▼ 10:45:26  $  Executed: npm install              45.2s
       ├─ Command: npm install --save-dev @types/node
       ├─ Directory: /home/user/project
       ├─ Exit code: 0
       ├─ Packages installed: 847
       └─ Output: (327 lines) [Press 'o' to view]
     ```
   - Show command input/output
   - Display state snapshots before/after
   - Include error messages and stack traces
   - Link to affected checklist items

4. **Add filtering and search capabilities:**
   - Implement filter bar with quick toggles:
     ```
     Filters: [✓] Complete [✓] Commands [ ] Skipped [ ] Errors
     Date: [Today ▼] Type: [All ▼] User: [Me ▼]
     Search: [npm install             ] 🔍
     ```
   - Support complex filters:
     - By date range: today, yesterday, last week, custom
     - By event type: completions, commands, errors
     - By duration: tasks > 1min, failed commands
     - By pattern: regex search in commands/output
   - Save common filters as presets

5. **Implement statistics dashboard:**
   - Show summary metrics at top:
     ```
     ╔═══════════════ Session Statistics ═══════════════╗
     ║ Total Time: 2h 34m │ Items: 45/60 (75%)         ║
     ║ Commands: 23       │ Errors: 2                  ║
     ║ Avg Task Time: 3.2m│ Velocity: 18 items/hour    ║
     ╚═══════════════════════════════════════════════════╝
     ```
   - Display completion rate graph using ASCII:
     ```
     Progress: ▁▂▃▅▅▆▇█ 75%
     Velocity: ▃▁▅▇▆▄▂▆ ~18/hr
     ```
   - Track productivity metrics
   - Show time distribution by task type

6. **Create replay and undo functionality:**
   - Add action buttons for each entry:
     - [R] Replay: Re-execute command safely
     - [U] Undo: Revert state change
     - [C] Copy: Copy command to clipboard
     - [G] Goto: Jump to item in checklist
   - Show confirmation for dangerous operations
   - Preview changes before applying
   - Maintain undo stack with limit

7. **Add export and sharing features:**
   - Export history in multiple formats:
     ```
     Export History:
     ├─ [1] Markdown report
     ├─ [2] JSON (full data)
     ├─ [3] CSV (summary)
     ├─ [4] Shell script (commands only)
     └─ [5] Checklist replay file
     ```
   - Generate shareable session summaries
   - Create command scripts from history
   - Export metrics for analysis

## Code Examples, Data Structures & Constraints

```typescript
// History event structure
interface HistoryEvent {
  id: string;
  timestamp: Date;
  type: 'task' | 'command' | 'state' | 'navigation' | 'error';
  subtype: string;  // 'completed', 'executed', 'changed', etc.
  item?: {
    id: string;
    title: string;
    index: number;
  };
  duration?: number;  // milliseconds
  details: {
    command?: {
      text: string;
      type: 'claude' | 'bash';
      exitCode?: number;
      output?: string;
    };
    state?: {
      before: any;
      after: any;
      variable?: string;
    };
    error?: {
      message: string;
      stack?: string;
      code?: string;
    };
  };
  user?: string;
  session: string;
  reversible: boolean;
}

// Filter configuration
interface HistoryFilter {
  dateRange?: {
    from: Date;
    to: Date;
  };
  types?: string[];
  search?: string;
  minDuration?: number;
  hasErrors?: boolean;
  user?: string;
  session?: string;
}

// Statistics calculation
class HistoryStats {
  calculate(events: HistoryEvent[]): Statistics {
    return {
      totalTime: this.sumDurations(events),
      completionRate: this.getCompletionRate(events),
      averageTaskTime: this.getAverageTime(events, 'task'),
      commandCount: this.countByType(events, 'command'),
      errorCount: this.countErrors(events),
      velocity: this.calculateVelocity(events),
      timeDistribution: this.getTimeDistribution(events),
    };
  }
  
  generateGraph(data: number[], width: number): string {
    const max = Math.max(...data);
    const blocks = '▁▂▃▄▅▆▇█';
    return data.map(v => {
      const index = Math.floor((v / max) * (blocks.length - 1));
      return blocks[index];
    }).join('');
  }
}

// Replay system
class CommandReplay {
  async replay(event: HistoryEvent): Promise<ReplayResult> {
    // Validate command is safe to replay
    if (this.isDangerous(event.details.command?.text)) {
      return { 
        success: false, 
        error: 'Command requires confirmation',
        requiresConfirmation: true
      };
    }
    
    // Create sandbox environment
    const sandbox = this.createSandbox(event);
    
    // Execute in dry-run mode first
    const dryRun = await sandbox.dryRun(event.details.command);
    
    if (dryRun.safe) {
      return sandbox.execute(event.details.command);
    }
    
    return { success: false, error: 'Unsafe to replay' };
  }
}
```

**IMPORTANT CONSTRAINTS:**
- MUST handle thousands of history entries efficiently
- MUST store history persistently between sessions
- DO NOT store sensitive information (passwords, keys)
- Implement pagination for large histories
- Cache filtered results for performance
- Limit output storage to prevent bloat
- Support real-time updates as events occur
- Maintain history file size limits with rotation

## Strict Scope

You should ONLY create:
- History timeline visualization
- Event filtering and search
- Statistics dashboard
- Entry detail expansion
- Replay/undo interface
- Export functionality

You should NOT create:
- Actual command execution
- State modification logic
- File system operations
- Network sync features
- User authentication
- History editing capabilities

## Visual Examples

**Main History View:**
```
╔═════════════════════ History - Last 24 Hours ═════════════════════╗
║ Stats: 45/60 complete │ 2h 34m │ 23 commands │ 2 errors         ║
╠════════════════════════════════════════════════════════════════════╣
║ ─── Today, March 14, 2024 ────────────────────────────────────    ║
║                                                                    ║
║ 14:32:18  ✓  Completed "Deploy to staging"              3m 45s   ║
║ 14:28:33  $  kubectl apply -f staging.yaml              12s      ║
║ 14:28:21  $  docker push myapp:v1.2.3                   3m 12s   ║
║ 14:25:09  ✓  Completed "Run tests"                      8m 23s   ║
║ 14:16:46  $  npm test                                   8m 20s   ║
║ 14:16:30  📝 Changed: ENVIRONMENT = staging                       ║
║           │                                                        ║
║ 14:15:45  ⊘  Skipped "Generate docs" (manual)                    ║
║ 14:15:30  ✓  Completed "Build application"              2m 15s   ║
║ 14:13:15  $  npm run build                              2m 10s   ║
║           │                                                        ║
║ ─── Earlier ───────────────────────────────────────────────────   ║
║ 13:45:00  ✓  Session started                                     ║
║                                                                    ║
║ Showing 10 of 127 events  [n] Next  [p] Previous  [/] Search    ║
╚═════════════════════════════════════════════════════════════════════╝
[f] Filter  [s] Stats  [e] Export  [r] Replay  [?] Help  [q] Back
```

**Expanded Entry Detail:**
```
╔════════════════ Event Details ═════════════════╗
║ Time: 14:28:33 (4 minutes ago)                ║
║ Type: Command Execution                        ║
║                                                 ║
║ Command:                                        ║
║ $ kubectl apply -f staging.yaml                ║
║                                                 ║
║ Context:                                        ║
║ ├─ Directory: /home/user/k8s-configs          ║
║ ├─ Checklist: "Deploy to Staging"             ║
║ ├─ Item #23: "Apply Kubernetes manifests"     ║
║ └─ Duration: 12 seconds                        ║
║                                                 ║
║ Result: ✓ Success (exit code: 0)              ║
║                                                 ║
║ Output: (12 lines)                             ║
║ ┌──────────────────────────────────────┐      ║
║ │ deployment.apps/myapp created        │      ║
║ │ service/myapp-service created        │      ║
║ │ ingress.networking/myapp created     │      ║
║ │ configmap/myapp-config created       │      ║
║ └──────────────────────────────────────┘      ║
║                                                 ║
║ Actions:                                        ║
║ [r] Replay  [c] Copy  [o] Full output         ║
╚══════════════════════════════════════════════════╝
```

**Statistics Dashboard:**
```
╔═══════════════════ Session Statistics ══════════════════════╗
║                                                              ║
║ Overview                    Performance                     ║
║ ─────────────────          ──────────────────              ║
║ Started: 09:30 AM          Velocity: 18 items/hour         ║
║ Duration: 5h 23m            Avg Task: 3.2 minutes          ║
║ Progress: 45/60 (75%)       Commands: 1.4 per item         ║
║                                                              ║
║ Completion Timeline                                          ║
║ 09:00 ▁▁▂▃▃▄▅▅▆▆▇▇█████ 14:30                            ║
║       0%              75%                                   ║
║                                                              ║
║ Time Distribution          Command Types                    ║
║ ─────────────────         ─────────────                   ║
║ Setup      ████░ 25%      Bash    ████████░ 78%          ║
║ Build      ██████ 35%     Claude  ██░░░░░░░ 18%          ║
║ Test       ███░░ 20%      Docker  █░░░░░░░░ 4%           ║
║ Deploy     ███░░ 20%                                       ║
║                                                              ║
║ Recent Errors (2)                                           ║
║ 13:22 - Test suite failed (retry succeeded)                ║
║ 11:45 - Docker build timeout (resolved)                    ║
╚══════════════════════════════════════════════════════════════╝
[e] Export Report  [d] Detailed Metrics  [ESC] Back
```

**Filter Interface:**
```
╔═══════════ Filter History ════════════╗
║ Quick Filters:                        ║
║ [✓] Completed  [ ] Failed            ║
║ [✓] Commands   [ ] Skipped           ║
║ [ ] Errors     [✓] State changes     ║
║                                       ║
║ Date Range:                           ║
║ ○ Today                              ║
║ ● Last 24 hours                      ║
║ ○ Last 7 days                        ║
║ ○ Custom: [____] to [____]          ║
║                                       ║
║ Search:                               ║
║ [npm                         ] 🔍    ║
║                                       ║
║ Duration:                             ║
║ ○ All                                ║
║ ○ > 1 minute                         ║
║ ○ > 5 minutes                        ║
║                                       ║
║ Sort by:                              ║
║ ● Time (newest first)                ║
║ ○ Duration (longest first)           ║
║ ○ Type                               ║
║                                       ║
║ 42 events match current filters      ║
║                                       ║
║ [a] Apply  [r] Reset  [s] Save       ║
╚═══════════════════════════════════════════╝
```

Remember: The history view is both a debugging tool and a productivity tracker. Clear timeline visualization, powerful filtering, and the ability to learn from past sessions are essential for improving workflow efficiency.
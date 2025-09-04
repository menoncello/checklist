# AI UI Prompt: Progress Dashboard

## High-Level Goal
Create a comprehensive progress dashboard that provides an at-a-glance overview of all active checklists, productivity metrics, team activity, and upcoming tasks. The dashboard should feel like a terminal-based monitoring tool (similar to htop, gotop, or k9s) with real-time updates and actionable insights.

## Detailed Step-by-Step Instructions

1. **Build the multi-widget dashboard layout:**
   - Create a grid layout with resizable widgets:
     ```
     ╔════════════════ BMAD Progress Dashboard ═══════════════════╗
     ║ ┌─── Active Checklists ────┐ ┌─── Today's Progress ────┐ ║
     ║ │ 3 active • 2 paused      │ │ ████████░░ 82% (14/17)  │ ║
     ║ └────────────────────────────┘ └──────────────────────────┘ ║
     ║ ┌─── Recent Activity ───────────────────────────────────┐ ║
     ║ │ Timeline of recent completions and actions            │ ║
     ║ └─────────────────────────────────────────────────────────┘ ║
     ```
   - Support different layout presets: Overview, Focus, Team
   - Allow widget collapse/expand with +/-
   - Remember user's preferred layout
   - Auto-arrange based on terminal size

2. **Create the active checklists widget:**
   - Display all active checklists with progress bars:
     ```
     ┌─── Active Checklists (3) ────────────────────────────┐
     │ Deploy to Production                                  │
     │ ████████████░░░░░░░ 65% │ 13/20 │ ETA: 45m         │
     │ Currently: Running integration tests                  │
     │                                                        │
     │ API Documentation                                     │
     │ ██████░░░░░░░░░░░░░ 30% │ 6/20 │ ETA: 2h          │
     │ Currently: Writing endpoint descriptions             │
     │                                                        │
     │ Security Audit                     ⏸ PAUSED         │
     │ ████████████████░░░ 85% │ 17/20 │ Resume?          │
     │ Paused at: Review security headers                   │
     └───────────────────────────────────────────────────────┘
     ```
   - Show real-time progress updates
   - Display current task for each checklist
   - Calculate and show ETA based on velocity
   - Quick actions: Resume, Pause, Switch to

3. **Implement the productivity metrics widget:**
   - Show key performance indicators:
     ```
     ┌─── Productivity Metrics ──────────────────────────────┐
     │ Today          This Week        This Month           │
     │ ━━━━━━━━━━    ━━━━━━━━━━━     ━━━━━━━━━━━         │
     │ Tasks: 14/17   Tasks: 67/80     Tasks: 234/300      │
     │ Time: 4h 23m   Time: 18h 45m    Time: 72h 12m       │
     │ Velocity: 3.2/h Velocity: 3.6/h  Velocity: 3.2/h     │
     │                                                        │
     │ Completion Trend (Last 7 days):                      │
     │ Mon ████░░░░ 45%                                    │
     │ Tue ████████ 89%                                    │
     │ Wed ██████░░ 67%                                    │
     │ Thu █████████ 92%                                   │
     │ Fri ███████░ 78% ← Today                           │
     │                                                        │
     │ Peak Hours: 9-11 AM, 2-4 PM                         │
     └───────────────────────────────────────────────────────┘
     ```
   - Track completion rates over time
   - Show velocity trends with sparklines
   - Identify productive patterns
   - Compare to historical averages

4. **Add the upcoming tasks widget:**
   - Preview next tasks across all checklists:
     ```
     ┌─── Upcoming Tasks ────────────────────────────────────┐
     │ Next 5 tasks:                                         │
     │                                                        │
     │ 1. [Deploy] Run smoke tests               ~5 min     │
     │    After: Integration tests complete                  │
     │                                                        │
     │ 2. [API Docs] Add authentication section  ~15 min    │
     │    Ready now                                          │
     │                                                        │
     │ 3. [Deploy] Update load balancer          ~10 min    │
     │    Blocked: Waiting for smoke tests                   │
     │                                                        │
     │ 4. [Security] Configure CSP headers       ~20 min    │
     │    Ready when resumed                                 │
     │                                                        │
     │ 5. [API Docs] Generate OpenAPI spec       ~8 min     │
     │    Ready now                                          │
     │                                                        │
     │ [Space] Start next available  [1-5] Jump to task    │
     └───────────────────────────────────────────────────────┘
     ```
   - Show task dependencies and blockers
   - Estimate time for each task
   - Indicate which tasks are ready now
   - Quick start for available tasks

5. **Create the activity timeline widget:**
   - Show recent events in chronological order:
     ```
     ┌─── Activity Timeline ─────────────────────────────────┐
     │ 14:32 ✓ Completed "Build Docker image" (2m 15s)     │
     │ 14:28 $ Executed: docker build -t app:latest        │
     │ 14:25 ⊘ Skipped "Generate docs" (manual override)   │
     │ 14:20 ✓ Completed "Run unit tests" (5m 43s)        │
     │ 14:14 🔄 Switched to "Deploy to Production"          │
     │ 14:10 ⏸ Paused "Security Audit"                     │
     │ 14:05 ✓ Completed "Code review" (12m)               │
     │ 13:53 📝 Updated variable: ENV=production            │
     │                                                        │
     │ [h] Full history  [f] Filter  [↓] Load more         │
     └───────────────────────────────────────────────────────┘
     ```
   - Auto-update with new events
   - Color-code by event type
   - Show time since event
   - Link to full history view

6. **Implement the focus mode widget:**
   - Detailed view of current task:
     ```
     ┌─── Current Focus ─────────────────────────────────────┐
     │ Checklist: Deploy to Production                       │
     │ Step 14 of 20: Running integration tests             │
     │                                                        │
     │ ⟳ In Progress: 3m 45s                                │
     │ ████████████████████░░░░░░░░░ 68%                   │
     │                                                        │
     │ Command executing:                                    │
     │ $ npm run test:integration                           │
     │                                                        │
     │ Output (last 3 lines):                               │
     │ ✓ API endpoints (23 passed)                          │
     │ ✓ Database operations (15 passed)                    │
     │ ⟳ Authentication flow (running...)                   │
     │                                                        │
     │ Next: Deploy to staging server                       │
     │ [p] Pause  [s] Skip  [v] View full output          │
     └───────────────────────────────────────────────────────┘
     ```
   - Show real-time command output
   - Display progress within current task
   - Preview next task
   - Quick actions for current task

7. **Add the quick actions panel:**
   - Provide fast access to common operations:
     ```
     ┌─── Quick Actions ─────────────────────────────────────┐
     │ [n] New checklist from template                      │
     │ [s] Switch active checklist                          │
     │ [r] Resume paused checklist                          │
     │ [h] View history                                      │
     │ [t] Browse templates                                  │
     │ [v] Edit variables                                    │
     │ [:] Command mode                                      │
     │ [?] Help                                              │
     └───────────────────────────────────────────────────────┘
     ```

## Code Examples, Data Structures & Constraints

```typescript
// Dashboard widget configuration
interface DashboardWidget {
  id: string;
  type: 'checklist' | 'metrics' | 'timeline' | 'upcoming' | 'focus';
  position: { x: number; y: number };
  size: { width: number; height: number };
  collapsed: boolean;
  refreshInterval?: number;  // milliseconds
  data?: any;
}

// Dashboard state
interface DashboardState {
  layout: 'overview' | 'focus' | 'team' | 'custom';
  widgets: DashboardWidget[];
  activeChecklists: Array<{
    id: string;
    name: string;
    progress: number;
    totalSteps: number;
    currentStep: string;
    status: 'active' | 'paused' | 'blocked';
    eta?: number;  // minutes
  }>;
  metrics: {
    today: MetricSnapshot;
    week: MetricSnapshot;
    month: MetricSnapshot;
    trends: number[];  // completion percentages
  };
  activity: ActivityEvent[];
}

interface MetricSnapshot {
  tasksCompleted: number;
  tasksTotal: number;
  timeSpent: number;  // minutes
  velocity: number;   // tasks per hour
  peakHours: string[];
}

// Progress calculation
class ProgressCalculator {
  calculateETA(
    completed: number,
    total: number,
    velocity: number
  ): number {
    const remaining = total - completed;
    return Math.ceil(remaining / velocity * 60);  // minutes
  }
  
  generateSparkline(data: number[], width: number): string {
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min;
    const blocks = ' ▁▂▃▄▅▆▇█';
    
    return data.map(value => {
      const normalized = (value - min) / range;
      const index = Math.floor(normalized * (blocks.length - 1));
      return blocks[index];
    }).join('');
  }
  
  formatDuration(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  }
}

// Real-time updates
class DashboardUpdater {
  private updateInterval = 1000;  // 1 second
  private widgets = new Map<string, DashboardWidget>();
  
  startUpdates() {
    setInterval(() => {
      this.updateProgress();
      this.updateMetrics();
      this.updateTimeline();
    }, this.updateInterval);
  }
  
  updateProgress() {
    // Fetch latest progress from state
    // Update progress bars and ETAs
    // Refresh current task descriptions
  }
}

// Layout manager
class LayoutManager {
  calculateGrid(
    termWidth: number,
    termHeight: number,
    layout: string
  ): WidgetLayout {
    switch(layout) {
      case 'overview':
        return {
          columns: termWidth >= 120 ? 3 : 2,
          rows: Math.floor(termHeight / 15),
          widgets: this.arrangeOverview(termWidth, termHeight)
        };
      case 'focus':
        return {
          columns: 1,
          rows: 2,
          widgets: this.arrangeFocus(termWidth, termHeight)
        };
      default:
        return this.customLayout(termWidth, termHeight);
    }
  }
}
```

**IMPORTANT CONSTRAINTS:**
- MUST update in real-time without flicker
- MUST handle multiple active checklists
- DO NOT block UI during updates
- Refresh rates: 1s for progress, 5s for metrics
- Cache calculated values for performance
- Limit timeline to last 50 events
- Support terminal resize gracefully
- Maintain <50ms render time

## Strict Scope

You should ONLY create:
- Dashboard layout with widgets
- Progress tracking displays
- Productivity metrics visualization
- Activity timeline
- Quick navigation panel
- Real-time update system

You should NOT create:
- Checklist execution logic
- Data persistence layer
- Network synchronization
- Team collaboration features
- Report generation
- Export functionality

## Visual Examples

**Full Dashboard View:**
```
╔═══════════════════ BMAD Progress Dashboard ════════════════════╗
║ Friday, March 14, 2024 │ 14:45 │ 3 Active │ 14/17 Today      ║
╠═════════════════════════════════════════════════════════════════╣
║ ┌─── Active Checklists ────────┐ ┌─── Today's Progress ────┐ ║
║ │ Deploy to Production     65% │ │ ████████████░░░ 82%     │ ║
║ │ ████████████░░░░░░ 13/20    │ │ 14 of 17 tasks          │ ║
║ │ ⟳ Running tests...           │ │ 4h 23m worked           │ ║
║ │                               │ │ Velocity: 3.2 tasks/hr  │ ║
║ │ API Documentation        30% │ │                         │ ║
║ │ ██████░░░░░░░░░░░░ 6/20     │ │ Trend: ▃▅▇█▆ Rising     │ ║
║ │ ✓ Ready to continue          │ └──────────────────────────┘ ║
║ │                               │ ┌─── Quick Stats ─────────┐ ║
║ │ Security Audit      ⏸ 85%    │ │ Week:  67/80 (84%)      │ ║
║ │ ████████████████░░ 17/20     │ │ Month: 234/300 (78%)    │ ║
║ │ Paused 10m ago                │ │ Best:  Tuesday (92%)    │ ║
║ └────────────────────────────────┘ └──────────────────────────┘ ║
║ ┌─── Recent Activity ─────────────────────────────────────────┐ ║
║ │ 14:45 ✓ Integration test passed                   just now │ ║
║ │ 14:43 $ npm run test:integration                    2m ago │ ║
║ │ 14:40 ✓ Completed "Build Docker image"              5m ago │ ║
║ │ 14:38 📝 Updated ENV=production                      7m ago │ ║
║ │ 14:35 🔄 Switched to "Deploy" checklist             10m ago │ ║
║ └────────────────────────────────────────────────────────────────┘ ║
║ ┌─── Upcoming Tasks ──────────────────────────────────────────┐ ║
║ │ 1. [Deploy] Smoke tests              Ready in ~2m    5 min │ ║
║ │ 2. [Docs] Auth section               Ready now      15 min │ ║
║ │ 3. [Deploy] Update load balancer     After #1       10 min │ ║
║ └────────────────────────────────────────────────────────────────┘ ║
╚═════════════════════════════════════════════════════════════════╣
 [1-3] Select checklist  [Space] Continue  [Tab] Switch widget
```

**Focus Mode Dashboard:**
```
╔════════════════════ Focus Mode ═══════════════════════╗
║ Deploy to Production - Step 14/20                     ║
╠═════════════════════════════════════════════════════════╣
║ Current Task: Running Integration Tests               ║
║ ──────────────────────────────────────────────────    ║
║ Started: 14:43 (2m 35s ago)                          ║
║ Estimated: ~5 minutes total                           ║
║                                                        ║
║ Progress:                                              ║
║ ████████████████████████░░░░░░░░░░ 68%              ║
║                                                        ║
║ Test Results:                                         ║
║ ✓ API Endpoints................ 23/23 passed         ║
║ ✓ Database Operations.......... 15/15 passed         ║
║ ⟳ Authentication Flow.......... 8/12 running         ║
║ ○ Payment Processing........... pending              ║
║ ○ Email Notifications.......... pending              ║
║                                                        ║
║ Console Output:                                       ║
║ ┌───────────────────────────────────────────────┐   ║
║ │ Testing auth flow: OAuth2...                  │   ║
║ │ ✓ Token generation                            │   ║
║ │ ✓ Token validation                            │   ║
║ │ ⟳ Refresh token flow...                      │   ║
║ └───────────────────────────────────────────────┘   ║
║                                                        ║
║ Next Task: Deploy to staging server                   ║
║ Command: kubectl apply -f staging.yaml                ║
║                                                        ║
║ [p] Pause  [s] Skip  [a] Abort  [l] Logs            ║
╚═══════════════════════════════════════════════════════════╝
```

**Productivity Metrics Widget:**
```
┌─── Productivity Analysis ─────────────────────────────┐
│ Performance Overview                                  │
│ ────────────────────                                 │
│ Today:    ████████████████░░░░ 82% (14/17)         │
│ This Week: ███████████████░░░░░ 84% (67/80)        │
│ This Month: ██████████████░░░░░░ 78% (234/300)      │
│                                                        │
│ Daily Completion Trend:                              │
│   100% ┤                    ╭╮                       │
│    90% ┤  ╭─╮              ╭╯╰╮                     │
│    80% ┤ ╭╯ ╰╮            ╱   ╰─ ← Today           │
│    70% ┤╱    ╰──╮    ╭───╯                         │
│    60% ┤        ╰────╯                              │
│    50% └────────────────────────────────            │
│        Mon  Tue  Wed  Thu  Fri                       │
│                                                        │
│ Velocity by Hour:                                    │
│ 9am  ████████ 4.2/hr   Peak productivity            │
│ 10am ███████░ 3.8/hr                                │
│ 11am ██████░░ 3.2/hr                                │
│ 12pm ███░░░░░ 1.5/hr   Lunch break                  │
│ 1pm  ████░░░░ 2.1/hr                                │
│ 2pm  ████████ 4.0/hr   Peak productivity            │
│ 3pm  ███████░ 3.5/hr                                │
│ 4pm  █████░░░ 2.8/hr                                │
│                                                        │
│ Insights:                                            │
│ • Best performance: 9-11 AM and 2-4 PM              │
│ • 15% above weekly average today                     │
│ • Consider breaks after 2-hour sessions              │
└───────────────────────────────────────────────────────┘
```

Remember: The progress dashboard is the command center for productivity. Real-time updates, actionable insights, and quick navigation are essential for maintaining momentum across multiple checklists.
# Story 4.6: Error Recovery System

## Story

**As a** user,  
**I want** automatic recovery from errors and crashes,  
**So that** I don't lose progress on my checklists.

## Priority

**HIGH** - Essential for reliability and user trust

## Acceptance Criteria

### Recovery Features

1. ✅ Auto-save every 30 seconds during active session
2. ✅ Crash recovery on next launch
3. ✅ Partial state restoration for incomplete items
4. ✅ Clear user communication about recovery status
5. ✅ Manual recovery commands available
6. ✅ Recovery history with timestamps

### Error Handling

1. ✅ Graceful degradation for non-critical errors
2. ✅ Error context preserved for debugging
3. ✅ User-friendly error messages
4. ✅ Automatic error reporting (opt-in)
5. ✅ Recovery suggestions provided

## Technical Implementation

### Recovery Manager

```typescript
interface RecoveryPoint {
  id: string;
  timestamp: string;
  type: 'auto' | 'manual' | 'crash';
  state: ChecklistState;
  context: {
    activeSection?: string;
    activeItem?: number;
    unsavedChanges?: any[];
  };
  metadata: {
    version: string;
    platform: string;
    sessionId: string;
  };
}

class RecoveryManager {
  private autosaveTimer?: Timer;
  private recoveryDir = '.checklist/.recovery';
  private currentSession: string;
  private isDirty = false;

  async initialize(): Promise<void> {
    this.currentSession = crypto.randomUUID();
    await fs.mkdir(this.recoveryDir, { recursive: true });

    // Check for crash recovery
    await this.checkForCrashRecovery();

    // Start autosave
    this.startAutosave();

    // Register shutdown handlers
    this.registerShutdownHandlers();
  }

  private startAutosave(): void {
    this.autosaveTimer = setInterval(async () => {
      if (this.isDirty) {
        await this.createRecoveryPoint('auto');
        this.isDirty = false;
      }
    }, 30000); // 30 seconds
  }

  markDirty(): void {
    this.isDirty = true;
  }

  async createRecoveryPoint(
    type: RecoveryPoint['type'],
    context?: RecoveryPoint['context']
  ): Promise<string> {
    const point: RecoveryPoint = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      type,
      state: await this.getCurrentState(),
      context: context || (await this.captureContext()),
      metadata: {
        version: APP_VERSION,
        platform: process.platform,
        sessionId: this.currentSession,
      },
    };

    const filename = `${point.timestamp.replace(/[:.]/g, '-')}-${type}.json`;
    const filepath = path.join(this.recoveryDir, filename);

    await Bun.write(filepath, JSON.stringify(point, null, 2));

    // Clean old recovery points
    await this.cleanOldRecoveryPoints();

    return point.id;
  }

  async checkForCrashRecovery(): Promise<boolean> {
    const lastSession = await this.getLastSession();

    if (!lastSession) return false;

    // Check if last session ended cleanly
    const cleanShutdown = await this.wasCleanShutdown(lastSession);

    if (!cleanShutdown) {
      const recovery = await this.findLatestRecoveryPoint(lastSession);

      if (recovery) {
        const shouldRecover = await this.promptRecovery(recovery);

        if (shouldRecover) {
          await this.restoreFromPoint(recovery);
          return true;
        }
      }
    }

    return false;
  }

  private async promptRecovery(point: RecoveryPoint): Promise<boolean> {
    const timeAgo = this.getRelativeTime(point.timestamp);
    const itemsCount = point.state.checklists.reduce((sum, c) => sum + c.items.length, 0);

    console.log('\n🔄 Recovery Available');
    console.log(`Found unsaved work from ${timeAgo}`);
    console.log(`• ${point.state.checklists.length} checklist(s)`);
    console.log(`• ${itemsCount} total items`);

    if (point.context?.activeSection) {
      console.log(`• Last active: ${point.context.activeSection}`);
    }

    const response = await prompt({
      type: 'select',
      message: 'What would you like to do?',
      choices: [
        { title: 'Recover work', value: 'recover' },
        { title: 'Start fresh', value: 'fresh' },
        { title: 'View details', value: 'details' },
      ],
    });

    if (response === 'details') {
      await this.showRecoveryDetails(point);
      return this.promptRecovery(point); // Re-prompt
    }

    return response === 'recover';
  }

  async restoreFromPoint(point: RecoveryPoint): Promise<void> {
    // Backup current state before restoring
    await this.createRecoveryPoint('manual', {
      reason: 'Pre-restoration backup',
    });

    // Restore state
    await this.setState(point.state);

    // Restore context if available
    if (point.context) {
      await this.restoreContext(point.context);
    }

    console.log('✅ Successfully restored from recovery point');

    // Log recovery for analytics
    await this.logRecovery(point);
  }

  private async cleanOldRecoveryPoints(): Promise<void> {
    const files = await fs.readdir(this.recoveryDir);
    const points = await Promise.all(
      files.map(async (f) => ({
        file: f,
        stat: await fs.stat(path.join(this.recoveryDir, f)),
      }))
    );

    // Keep last 10 auto-saves and all manual/crash points from last 7 days
    const sorted = points.sort((a, b) => b.stat.mtime.getTime() - a.stat.mtime.getTime());

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 7);

    let autoSaveCount = 0;
    for (const point of sorted) {
      const isAutoSave = point.file.includes('-auto.json');
      const isOld = point.stat.mtime < cutoffDate;

      if (isAutoSave) {
        autoSaveCount++;
        if (autoSaveCount > 10) {
          await fs.unlink(path.join(this.recoveryDir, point.file));
        }
      } else if (isOld) {
        await fs.unlink(path.join(this.recoveryDir, point.file));
      }
    }
  }
}
```

### Error Handler

```typescript
class ErrorHandler {
  private errorLog = '.checklist/.errors';
  private maxErrors = 100;

  async handleError(error: Error, context?: any): Promise<void> {
    const errorRecord = {
      id: crypto.randomUUID(),
      timestamp: new Date().toISOString(),
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
      },
      context,
      handled: false,
    };

    // Log to file
    await this.logError(errorRecord);

    // Determine severity
    const severity = this.determineSeverity(error);

    // Handle based on severity
    switch (severity) {
      case 'critical':
        await this.handleCriticalError(error);
        break;
      case 'high':
        await this.handleHighError(error);
        break;
      case 'medium':
        await this.handleMediumError(error);
        break;
      case 'low':
        await this.handleLowError(error);
        break;
    }

    // Offer recovery if applicable
    if (this.isRecoverable(error)) {
      await this.offerRecovery(error);
    }
  }

  private determineSeverity(error: Error): 'critical' | 'high' | 'medium' | 'low' {
    if (error.name === 'StateCorruptionError') return 'critical';
    if (error.name === 'FileSystemError') return 'high';
    if (error.name === 'ValidationError') return 'medium';
    return 'low';
  }

  private async handleCriticalError(error: Error): Promise<void> {
    // Save emergency recovery point
    await recoveryManager.createRecoveryPoint('crash', {
      error: error.message,
    });

    // Show error to user
    console.error('\n❌ Critical Error Occurred');
    console.error('Your work has been saved for recovery.');
    console.error(`Error: ${error.message}`);

    // Exit gracefully
    process.exit(1);
  }

  private isRecoverable(error: Error): boolean {
    const recoverableErrors = ['EACCES', 'ENOENT', 'EPERM', 'ValidationError'];

    return recoverableErrors.some((e) => error.message.includes(e) || error.name === e);
  }

  private async offerRecovery(error: Error): Promise<void> {
    const suggestions = this.getRecoverySuggestions(error);

    if (suggestions.length === 0) return;

    console.log('\n💡 Recovery Suggestions:');
    suggestions.forEach((s, i) => {
      console.log(`${i + 1}. ${s}`);
    });

    const response = await prompt({
      type: 'select',
      message: 'Would you like to:',
      choices: [
        { title: 'Try suggested fix', value: 'fix' },
        { title: 'Restore from backup', value: 'restore' },
        { title: 'Continue anyway', value: 'continue' },
        { title: 'Exit', value: 'exit' },
      ],
    });

    switch (response) {
      case 'fix':
        await this.applySuggestedFix(error, suggestions[0]);
        break;
      case 'restore':
        await recoveryManager.restoreFromLatest();
        break;
      case 'continue':
        // Mark error as handled
        break;
      case 'exit':
        process.exit(0);
    }
  }
}
```

### CLI Recovery Commands

```bash
# Check for crash recovery
checklist recover

# Show recovery history
checklist recover --list
┌─────────────────────────────┬──────┬─────────────┐
│ Timestamp                   │ Type │ Items       │
├─────────────────────────────┼──────┼─────────────┤
│ 2024-01-15T10:30:00Z       │ auto │ 25 items    │
│ 2024-01-15T10:15:00Z       │ auto │ 23 items    │
│ 2024-01-15T10:00:00Z       │ crash│ 20 items    │
└─────────────────────────────┴──────┴─────────────┘

# Restore from specific point
checklist recover --from=2024-01-15T10:30:00Z

# Create manual recovery point
checklist recover --save "Before major changes"

# Clean recovery data
checklist recover --clean

# Show recovery details
checklist recover --details 2024-01-15T10:30:00Z
```

### Crash Detection

```typescript
class CrashDetector {
  private lockFile = '.checklist/.lock';
  private pidFile = '.checklist/.pid';

  async detectPreviousCrash(): Promise<boolean> {
    // Check for stale lock file
    if (await this.hasStateLock()) {
      const pid = await this.getLastPid();

      // Check if process is still running
      if (pid && !this.isProcessRunning(pid)) {
        return true; // Found crashed session
      }
    }

    return false;
  }

  private isProcessRunning(pid: number): boolean {
    try {
      process.kill(pid, 0);
      return true;
    } catch {
      return false;
    }
  }

  async createLock(): Promise<void> {
    await Bun.write(this.lockFile, Date.now().toString());
    await Bun.write(this.pidFile, process.pid.toString());
  }

  async releaseLock(): Promise<void> {
    await fs.unlink(this.lockFile).catch(() => {});
    await fs.unlink(this.pidFile).catch(() => {});
  }
}
```

## Technical Tasks

### Phase 1: Core Recovery System

- [ ] Implement RecoveryManager with auto-save
- [ ] Build recovery point creation and storage
- [ ] Create crash detection mechanism
- [ ] Add recovery prompt UI
- [ ] Implement state restoration

### Phase 2: Error Handling

- [ ] Build ErrorHandler with severity levels
- [ ] Create error logging system
- [ ] Implement recovery suggestions
- [ ] Add graceful degradation
- [ ] Build error reporting (opt-in)

### Phase 3: CLI Integration

- [ ] Add recovery CLI commands
- [ ] Create recovery history view
- [ ] Implement manual save points
- [ ] Add recovery cleanup tools
- [ ] Build recovery analytics

### Phase 4: Testing & Hardening

- [ ] Test crash recovery with kill -9
- [ ] Verify auto-save performance
- [ ] Test recovery across versions
- [ ] Validate error handling paths
- [ ] Load test with many recovery points

## Definition of Done

- [ ] Auto-save works during active sessions
- [ ] Crash recovery tested with kill -9
- [ ] Recovery prompt appears on next launch
- [ ] Manual recovery commands work
- [ ] Recovery preserves all user progress
- [ ] Performance impact <1% CPU
- [ ] Error messages are user-friendly
- [ ] Recovery success rate >95%

## Time Estimate

**3-4 days** including comprehensive testing

## Dependencies

- Complete after Story 1.6a (State Transactions)
- Before final release (Epic 4)

## Risk Factors

- 🟡 Platform-specific process detection
- 🟡 Recovery file size growth
- 🟢 Well-established patterns from other tools
- 🟢 Can leverage Bun's performance for minimal overhead

## Notes for Developers

- Test on all platforms (macOS, Linux, Windows)
- Consider compression for old recovery points
- Ensure recovery doesn't create infinite loops
- Add metrics for recovery success rate
- Consider cloud backup for premium version

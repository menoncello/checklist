# Database Schema (Complete with All Enhancements)

## File Structure

```
.checklist/
├── state.yaml          # Main state file with migrations
├── config.yaml         # User configuration
├── history.yaml        # Execution history
├── metrics.yaml        # Performance metrics
├── plugins.yaml        # Plugin state
├── audit.log          # Security audit log
├── .lock              # Active lock file (enhanced)
├── .cache/
│   └── templates.yaml  # Template cache
└── .backup/
    ├── manifest.yaml   # Backup metadata
    └── state.yaml.*    # Backup files
```

## State File Schema (state.yaml) - Enhanced

```yaml
schemaVersion: '1.0.0'
migrations:
  - from: '0.9.0'
    to: '1.0.0'
    applied: '2025-01-01T00:00:00Z'
    changes:
      - 'Added commandResults to completedSteps'
version: '1.0.0'
checksum: 'sha256:abc123...'
lastModified: '2025-01-01T10:00:00Z'

activeInstance:
  id: 'uuid-v4'
  templateId: 'bmad-deploy-checklist'
  templateVersion: '2.1.0'
  projectPath: '/Users/dev/projects/myapp'
  status: 'active'
  currentStepId: 'step-3'
  startedAt: '2025-01-01T09:00:00Z'
  updatedAt: '2025-01-01T10:00:00Z'
  variables:
    projectName: 'MyApp'
    environment: 'production'
  completedSteps:
    - stepId: 'step-1'
      completedAt: '2025-01-01T09:05:00Z'
      executionTime: 1250
      result: 'success'
      commandResults:
        - commandId: 'cmd-1'
          status: 'success'
          duration: 500
          exitCode: 0

recovery:
  lastCorruption: '2025-01-01T08:00:00Z'
  corruptionType: 'incomplete_write'
  recoveryMethod: 'backup_restore'
  dataLoss: false

conflicts:
  - detectedAt: '2025-01-01T10:00:00Z'
    type: 'concurrent_modification'
    resolution: 'local'
```

## Performance Metrics Schema (metrics.yaml)

```yaml
version: '1.0.0'
sessionMetrics:
  - sessionId: 'session-uuid'
    startTime: '2025-01-01T09:00:00Z'
    operations:
      - operation: 'workflow.init'
        timestamp: '2025-01-01T09:00:00Z'
        duration: 145
        memoryUsed: 12582912
    summary:
      totalOperations: 45
      averageDuration: 234
      peakMemory: 31457280
thresholds:
  operationTimeout: 100
  memoryLimit: 52428800
```

## Enhanced Lock File Schema (.lock)

```yaml
version: '1.0.0'
lockId: 'lock-uuid'
pid: 12345
ppid: 12340
hostname: 'dev-machine.local'
user: 'john'
acquiredAt: '2025-01-01T10:00:00Z'
expiresAt: '2025-01-01T10:05:00Z'
renewedAt: '2025-01-01T10:02:00Z'
operation: 'state.update'
stackTrace:
  - 'WorkflowEngine.nextStep()'
  - 'StateManager.updateState()'
waitingProcesses:
  - pid: 12346
    since: '2025-01-01T10:00:01Z'
```

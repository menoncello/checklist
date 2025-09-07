# Story 1.6: Core Workflow Engine ✨

## Status

**Approved**

## Story

**As a** developer,  
**I want** a pure business logic engine independent of any UI,  
**so that** the core functionality can be used by TUI, CLI, or future interfaces.

## Acceptance Criteria

### Engine Implementation

```typescript
// WorkflowEngine with no UI dependencies
export class WorkflowEngine extends EventEmitter {
  private state: WorkflowState;
  private template: ChecklistTemplate;
  private stateManager: StateManager; // From Story 1.5
  private transactionCoordinator: TransactionCoordinator; // From Story 1.0

  async init(templateId: string, vars?: Variables): Promise<void> {
    // Initialize state management from Story 1.5
    this.stateManager = new StateManager();
    await this.stateManager.initialize(process.cwd());
    
    // Initialize transaction coordinator from Story 1.0
    this.transactionCoordinator = new TransactionCoordinator(this.stateManager);
    
    // Load template, initialize state
    this.template = await this.loadTemplate(templateId);
    this.state = await this.stateManager.load() || this.createInitialState();
    // NO console.log, NO UI calls
  }

  getCurrentStep(): Step | null {
    return this.state.currentStep;
  }

  async advance(): Promise<StepResult> {
    // Use transaction coordinator for atomic state updates
    return await this.transactionCoordinator.execute(async () => {
      // Move to next step
      const nextStep = this.getNextVisibleStep();
      if (!nextStep) {
        this.state.status = 'completed';
        this.emit('workflow:completed', this.generateSummary());
      } else {
        this.state.currentStep = nextStep;
        this.state.currentStepIndex++;
        this.emit('step:changed', nextStep);
      }
      
      // Persist state using StateManager
      await this.stateManager.save(this.state);
      
      return { success: true, step: nextStep };
    });
  }

  async goBack(): Promise<StepResult> {
    // Use transaction for rollback safety
    return await this.transactionCoordinator.execute(async () => {
      const previousStep = this.getPreviousVisibleStep();
      this.state.currentStep = previousStep;
      this.state.currentStepIndex--;
      
      await this.stateManager.save(this.state);
      this.emit('step:changed', previousStep);
      
      return { success: true, step: previousStep };
    });
  }

  async skip(reason?: string): Promise<StepResult> {
    // Record skip in state with transaction
    return await this.transactionCoordinator.execute(async () => {
      this.state.skippedSteps.push({
        step: this.state.currentStep,
        reason,
        timestamp: new Date()
      });
      
      const result = await this.advance();
      this.emit('step:skipped', this.state.currentStep, reason);
      
      return result;
    });
  }

  async reset(): Promise<void> {
    // Reset using StateManager's atomic operations
    await this.stateManager.reset();
    this.state = this.createInitialState();
    await this.stateManager.save(this.state);
  }
}
```

### Required Methods

1. ✅ `getCurrentStep()` - Get current position
2. ✅ `advance()` - Move forward
3. ✅ `goBack()` - Move backward
4. ✅ `skip()` - Skip with reason
5. ✅ `reset()` - Start over
6. ✅ `getProgress()` - Progress info
7. ✅ `getHistory()` - Completed steps
8. ✅ `validateStep()` - Check if step can complete

### Event System

```typescript
// Events emitted for UI to handle
engine.on('step:changed', (step: Step) => {});
engine.on('step:completed', (step: Step) => {});
engine.on('step:skipped', (step: Step, reason: string) => {});
engine.on('progress:updated', (progress: Progress) => {});
engine.on('workflow:completed', (summary: Summary) => {});
engine.on('error', (error: WorkflowError) => {});
```

### State Machine Rules

```typescript
interface WorkflowState {
  status: 'idle' | 'active' | 'paused' | 'completed' | 'failed';
  currentStepIndex: number;
  completedSteps: CompletedStep[];
  skippedSteps: SkippedStep[];
  variables: Variables;
  startedAt?: Date;
  completedAt?: Date;
  pausedAt?: Date;
}

// Valid state transitions
const transitions = {
  idle: ['active'],
  active: ['paused', 'completed', 'failed'],
  paused: ['active', 'failed'],
  completed: ['idle'],
  failed: ['idle'],
};
```

### Conditional Logic

```typescript
// Handle conditional steps
private evaluateCondition(condition: string): boolean {
  // Safe evaluation of conditions like:
  // "${platform} === 'darwin'"
  // "${hasDocker} === true"
  // "${stepCount} > 5"

  const context = this.buildContext();
  return safeEval(condition, context);
}

private getNextVisibleStep(): Step | null {
  let index = this.state.currentStepIndex + 1;

  while (index < this.template.steps.length) {
    const step = this.template.steps[index];
    if (!step.condition || this.evaluateCondition(step.condition)) {
      return step;
    }
    index++;
  }

  return null;
}
```

### Validation System

```typescript
interface StepValidation {
  type: 'command' | 'file_exists' | 'custom';
  check: string;
  errorMessage?: string;
}

async validateStep(step: Step): Promise<ValidationResult> {
  if (!step.validation) return { valid: true };

  for (const validation of step.validations) {
    const result = await this.runValidation(validation);
    if (!result.valid) {
      return {
        valid: false,
        error: validation.errorMessage || 'Validation failed'
      };
    }
  }

  return { valid: true };
}
```

### Error Handling Patterns

```typescript
// Custom error types for the workflow engine
export class WorkflowError extends Error {
  constructor(
    message: string,
    public code: string,
    public recoverable: boolean = false,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}

export class StateTransitionError extends WorkflowError {
  constructor(from: string, to: string, reason: string) {
    super(
      `Invalid state transition from ${from} to ${to}: ${reason}`,
      'STATE_TRANSITION_ERROR',
      false,
      { from, to, reason }
    );
  }
}

export class ValidationError extends WorkflowError {
  constructor(step: string, validation: string, details: string) {
    super(
      `Validation failed for step ${step}: ${details}`,
      'VALIDATION_ERROR',
      true,
      { step, validation, details }
    );
  }
}

export class ConditionEvaluationError extends WorkflowError {
  constructor(condition: string, error: Error) {
    super(
      `Failed to evaluate condition: ${condition}`,
      'CONDITION_ERROR',
      false,
      { condition, originalError: error.message }
    );
  }
}

// Error handling in the engine
class WorkflowEngine extends EventEmitter {
  private handleError(error: Error): void {
    // Classify the error
    const classified = error instanceof WorkflowError 
      ? error 
      : new WorkflowError(error.message, 'UNKNOWN_ERROR', false);

    // Emit error event for UI handling
    this.emit('error', classified);

    // Log for debugging (no console.log in production)
    this.logError(classified);

    // Attempt recovery if possible
    if (classified.recoverable) {
      this.attemptRecovery(classified);
    }
  }

  private async attemptRecovery(error: WorkflowError): Promise<void> {
    switch (error.code) {
      case 'VALIDATION_ERROR':
        // Retry validation after a delay
        await this.retryValidation(error.context);
        break;
      case 'STATE_CORRUPTION':
        // Restore from last known good state
        await this.restoreFromBackup();
        break;
      default:
        // No recovery possible
        this.state.status = 'failed';
    }
  }
}
```

### Plugin System Interface (Future Enhancement - Not Required for MVP)

**Note:** The plugin system is defined here for future extensibility but is NOT required for the MVP implementation. This interface documents the intended plugin architecture for reference but should not be implemented in this story.

```typescript
// Basic plugin interface for future extensibility (POST-MVP)
export interface WorkflowPlugin {
  name: string;
  version: string;
  
  // Lifecycle hooks
  onEngineInit?(engine: WorkflowEngine): Promise<void>;
  onEngineShutdown?(engine: WorkflowEngine): Promise<void>;
  
  // Step lifecycle hooks
  beforeStepExecute?(step: Step, context: StepContext): Promise<void>;
  afterStepExecute?(step: Step, result: StepResult): Promise<void>;
  onStepError?(step: Step, error: WorkflowError): Promise<void>;
  
  // State hooks
  beforeStateChange?(from: WorkflowState, to: WorkflowState): Promise<boolean>;
  afterStateChange?(state: WorkflowState): Promise<void>;
  
  // Validation hooks
  registerValidators?(): Map<string, StepValidator>;
  
  // Condition evaluator hooks
  registerConditionEvaluators?(): Map<string, ConditionEvaluator>;
}

export interface PluginManager {
  register(plugin: WorkflowPlugin): void;
  unregister(pluginName: string): void;
  getPlugin(name: string): WorkflowPlugin | undefined;
  executeHook<T>(
    hookName: string, 
    ...args: any[]
  ): Promise<T[]>;
}

// Usage in WorkflowEngine
export class WorkflowEngine extends EventEmitter {
  private pluginManager: PluginManager;
  
  constructor() {
    super();
    this.pluginManager = new PluginManager();
  }
  
  registerPlugin(plugin: WorkflowPlugin): void {
    this.pluginManager.register(plugin);
    plugin.onEngineInit?.(this);
  }
  
  private async executeStep(step: Step): Promise<StepResult> {
    const context = this.buildStepContext(step);
    
    // Execute beforeStepExecute hooks
    await this.pluginManager.executeHook('beforeStepExecute', step, context);
    
    try {
      const result = await this.runStep(step);
      
      // Execute afterStepExecute hooks
      await this.pluginManager.executeHook('afterStepExecute', step, result);
      
      return result;
    } catch (error) {
      // Execute onStepError hooks
      await this.pluginManager.executeHook('onStepError', step, error);
      throw error;
    }
  }
}

// Example plugin implementation
export class LoggingPlugin implements WorkflowPlugin {
  name = 'logging-plugin';
  version = '1.0.0';
  
  async beforeStepExecute(step: Step, context: StepContext): Promise<void> {
    // Log step execution start
  }
  
  async afterStepExecute(step: Step, result: StepResult): Promise<void> {
    // Log step execution result
  }
}
```

## Tasks / Subtasks

### Phase 1: Core Engine Setup
**Dependencies:** None (can start immediately)
- [ ] Create WorkflowEngine class structure in `packages/core/src/workflow/` (AC: Engine Implementation)
  - [ ] Define TypeScript interfaces for WorkflowState, Step, StepResult
  - [ ] Set up EventEmitter base class extension
  - [ ] Create engine constructor and private properties
- [ ] Implement error classes (AC: Error Handling Patterns)
  - [ ] Create WorkflowError base class in `packages/core/src/workflow/errors.ts`
  - [ ] Implement StateTransitionError class
  - [ ] Implement ValidationError class
  - [ ] Implement ConditionEvaluationError class
  - [ ] Add error codes and recovery flags

### Phase 2: State Management Implementation
**Dependencies:** Phase 1 must be complete, Story 1.0 (Database/State Store) must be complete
- [ ] Implement state machine logic (AC: State Machine Rules)
  - [ ] Create state transition validator using transition map
  - [ ] Implement state persistence methods (integrate with Story 1.5 StateManager)
  - [ ] Add state recovery mechanisms from Story 1.0
  - [ ] Integrate with TransactionCoordinator from Story 1.0 for atomic updates
  - [ ] Use ConcurrencyManager from Story 1.0 for lock management

### Phase 3: Core Navigation Methods
**Dependencies:** Phases 1 & 2 must be complete
- [ ] Implement getCurrentStep() method (AC: Required Methods #1)
- [ ] Implement advance() method with state transitions (AC: Required Methods #2)
  - [ ] Add step completion validation
  - [ ] Handle conditional step evaluation
  - [ ] Emit appropriate events
- [ ] Implement goBack() method (AC: Required Methods #3)
  - [ ] Validate backward navigation is allowed
  - [ ] Update state and history
- [ ] Implement skip() method with reason tracking (AC: Required Methods #4)
- [ ] Implement reset() method (AC: Required Methods #5)

### Phase 4: Progress and History Tracking
**Dependencies:** Phase 3 must be complete
- [ ] Implement getProgress() method (AC: Required Methods #6)
  - [ ] Calculate completion percentage
  - [ ] Track time metrics
- [ ] Implement getHistory() method (AC: Required Methods #7)
  - [ ] Maintain completed steps array
  - [ ] Track skipped steps with reasons

### Phase 5: Conditional Logic System
**Dependencies:** Phase 3 must be complete (can run parallel with Phase 4)
- [ ] Implement condition evaluation system (AC: Conditional Logic)
  - [ ] Create safe expression evaluator
  - [ ] Build context from current state and variables
  - [ ] Implement getNextVisibleStep() with condition checking

### Phase 6: Validation System
**Dependencies:** Phase 3 must be complete (can run parallel with Phases 4 & 5)
- [ ] Implement validateStep() method (AC: Required Methods #8, Validation System)
  - [ ] Create validation runner for different validation types
  - [ ] Handle command validation
  - [ ] Handle file existence validation
  - [ ] Support custom validation functions

### Phase 7: Event System Implementation
**Dependencies:** Phases 3, 4, 5, 6 must be complete
- [ ] Implement complete event system (AC: Event System)
  - [ ] Define event types and payloads
  - [ ] Implement event emission for all state changes
  - [ ] Add error event handling
  - [ ] Document all events in TypeScript types

### Phase 8: Testing Implementation
**Dependencies:** Phases 1-7 must be complete, Story 1.3 (Testing Framework Setup) must be complete
- [ ] Create comprehensive unit tests in `packages/core/tests/` (AC: Testing Requirements)
  - [ ] Test initialization with templates
  - [ ] Test step navigation (forward, backward, skip)
  - [ ] Test conditional step handling
  - [ ] Test event emission sequences
  - [ ] Test state machine transitions
  - [ ] Test validation system

### Phase 9: Performance Optimization
**Dependencies:** Phase 8 must be complete, Story 1.7 (Performance Monitoring Framework) should be integrated
- [ ] Integrate PerformanceMonitor from Story 1.7
  - [ ] Import PerformanceMonitor class: `import { PerformanceMonitor } from '../monitoring/PerformanceMonitor';`
  - [ ] Add performance tracking to WorkflowEngine constructor
  - [ ] Instrument critical methods with performance timing
- [ ] Add performance instrumentation to core methods
  ```typescript
  // Example integration in WorkflowEngine
  private performanceMonitor: PerformanceMonitor;
  
  async advance(): Promise<StepResult> {
    const stopTimer = this.performanceMonitor.startTimer('workflow.advance');
    try {
      // existing advance logic...
      return result;
    } finally {
      stopTimer(); // Automatically records duration
    }
  }
  
  async validateStep(step: Step): Promise<ValidationResult> {
    const stopTimer = this.performanceMonitor.startTimer('workflow.validateStep');
    try {
      // validation logic...
      return result;
    } finally {
      const duration = stopTimer();
      if (duration > 10) { // Alert if validation takes > 10ms
        this.performanceMonitor.recordViolation('validateStep', duration, 10);
      }
    }
  }
  ```
- [ ] Run performance benchmarks using Performance Monitoring Framework from Story 1.7
  - [ ] Establish baseline measurements with PerformanceMonitor
  - [ ] Ensure all operations < 10ms (validated against baseline)
  - [ ] Test with 10,000 step templates
  - [ ] Verify memory usage < 10MB using monitoring framework
  - [ ] Check for memory leaks over 1000 operations
  - [ ] Generate performance report using Story 1.7's reporting tools

### Phase 10: Documentation and Export
**Dependencies:** All phases must be complete
- [ ] Export TypeScript types and interfaces (AC: Definition of Done)
- [ ] Ensure zero console.log statements
- [ ] Verify no UI dependencies
- [ ] Create API documentation comments

## Testing Requirements

### Unit Tests Required

```typescript
describe('WorkflowEngine', () => {
  test('initializes with template', async () => {
    const engine = new WorkflowEngine();
    await engine.init('test-template');
    expect(engine.getCurrentStep()).toBeDefined();
  });

  test('advances through steps', async () => {
    const engine = new WorkflowEngine();
    await engine.init('test-template');

    const step1 = engine.getCurrentStep();
    await engine.advance();
    const step2 = engine.getCurrentStep();

    expect(step2).not.toBe(step1);
  });

  test('handles conditional steps', async () => {
    const engine = new WorkflowEngine();
    await engine.init('conditional-template', {
      skipOptional: true,
    });

    await engine.advance();
    // Should skip optional step
    expect(engine.getCurrentStep().id).toBe('required-step');
  });

  test('emits correct events', async () => {
    const engine = new WorkflowEngine();
    const events: string[] = [];

    engine.on('step:changed', () => events.push('changed'));
    engine.on('step:completed', () => events.push('completed'));

    await engine.init('test-template');
    await engine.advance();

    expect(events).toEqual(['changed', 'completed', 'changed']);
  });
});
```

### Performance Requirements

- All operations < 10ms (baseline established by Story 1.7 Performance Monitoring)
- Can handle 10,000 step templates
- Memory usage < 10MB for engine alone
- No memory leaks over 1000 operations
- Performance metrics tracked using PerformanceMonitor from Story 1.7

## Definition of Done

- [ ] Engine has zero UI dependencies
- [ ] All public methods implemented
- [ ] Event system working
- [ ] Conditional logic functioning
- [ ] 100% unit test coverage
- [ ] Performance benchmarks pass
- [ ] Can run headless in CI
- [ ] TypeScript types exported

## Time Estimate

**2-3 days**

## Dependencies

- None (can proceed immediately)
- Blocks: All UI implementations

## Notes

- Keep this pure - no console.log!
- Design for testability
- Consider future plugin system
- Document all events
- Make it work with both CLI and TUI

## Dev Notes

### Dependencies on Other Stories
- **Story 1.0**: Database/State Store - Use file locking and transaction mechanisms for state persistence
- **Story 1.5**: State Management - Integrate with StateManager for persistence layer
- **Story 1.3**: Testing Framework - Use established Bun test patterns

### Source Tree Context
```
packages/
├── core/
│   ├── src/
│   │   ├── workflow/
│   │   │   ├── WorkflowEngine.ts       # Main engine class
│   │   │   ├── types.ts                # TypeScript interfaces
│   │   │   ├── validators.ts           # Step validation logic
│   │   │   └── conditions.ts           # Conditional evaluation
│   │   └── index.ts                    # Package exports
│   └── tests/
│       ├── WorkflowEngine.test.ts      # Main engine tests
│       ├── validators.test.ts          # Validation tests
│       └── conditions.test.ts          # Conditional logic tests
```

### Testing Standards
- **Test Framework**: Bun Test (built-in test runner)
- **Test Location**: `packages/core/tests/`
- **Coverage Target**: 100% for core engine logic
- **Test Patterns**:
  - Use `describe()` and `test()` from Bun Test
  - Create test fixtures using TestDataFactory from architecture
  - Mock file system operations for state persistence
  - Use snapshot testing for event sequences

### Architecture Alignment
- Implements Event-Driven Architecture pattern from high-level architecture
- Pure functional core with no I/O operations (Functional Core, Imperative Shell pattern)
- Integrates with Transaction Coordinator for atomic state updates
- Follows Repository Pattern for state abstraction

### Performance Considerations
- Use Map/Set for O(1) lookups where possible
- Lazy evaluation of conditional steps
- Cache compiled condition expressions
- Minimize object allocations in hot paths

### Security Notes
- Condition evaluation must use safe sandbox (no eval())
- Variable interpolation must be sanitized
- Prevent infinite loops in step navigation

## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-07 | 1.0 | Initial story creation | Sarah (PO) |
| 2025-01-07 | 1.1 | Added missing sections for implementation readiness | Sarah (PO) |
| 2025-01-07 | 1.2 | Added explicit phase dependencies, error handling patterns, and plugin system interface | Sarah (PO) |
| 2025-01-07 | 1.3 | Fixed test locations, added concrete StateManager integration, Story 1.0/1.3/1.7 dependencies | Sarah (PO) |
| 2025-01-07 | 1.4 | Added error class creation task to Phase 1, clarified plugin system as post-MVP, added PerformanceMonitor integration examples | Sarah (PO) |

## Dev Agent Record

### Agent Model Used
_To be populated by development agent_

### Debug Log References
_To be populated during implementation_

### Completion Notes List
_To be populated during implementation_

### File List
_To be populated with actual files created/modified_

## QA Results

_To be populated by QA agent after implementation_

# Story 1.6: Core Workflow Engine ✨

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

  async init(templateId: string, vars?: Variables): Promise<void> {
    // Load template, initialize state
    // NO console.log, NO UI calls
  }

  getCurrentStep(): Step | null {
    return this.state.currentStep;
  }

  async advance(): Promise<StepResult> {
    // Move to next step, emit events
    // Pure business logic only
  }

  async goBack(): Promise<StepResult> {
    // Return to previous step
  }

  async skip(reason?: string): Promise<StepResult> {
    // Skip current step with reason
  }

  async reset(): Promise<void> {
    // Reset to beginning
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

- All operations < 10ms
- Can handle 10,000 step templates
- Memory usage < 10MB for engine alone
- No memory leaks over 1000 operations

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

import type { WorkflowInstance } from '../../src/interfaces/IStateManager';
import type {
  IWorkflowEngine,
  WorkflowDefinition,
  WorkflowStep,
  WorkflowEvent,
  WorkflowEventHandler,
} from '../../src/interfaces/IWorkflowEngine';

export class MockWorkflowEngineService implements IWorkflowEngine {
  private workflows: Map<string, WorkflowDefinition> = new Map();
  private currentInstance: WorkflowInstance | null = null;
  private currentStep: WorkflowStep | null = null;
  private status: 'idle' | 'running' | 'paused' | 'completed' | 'failed' =
    'idle';
  private eventHandlers: Map<WorkflowEvent['type'], Set<WorkflowEventHandler>> =
    new Map();

  // Spy tracking
  public emittedEvents: WorkflowEvent[] = [];
  public methodCalls: Map<string, unknown[]> = new Map();
  public shouldFailNext: string | null = null;

  async loadWorkflow(definition: WorkflowDefinition): Promise<void> {
    this.trackCall('loadWorkflow', definition);

    if (this.shouldFailNext === 'loadWorkflow') {
      this.shouldFailNext = null;
      throw new Error('Mock error: loadWorkflow failed');
    }

    this.workflows.set(definition.id, definition);
  }

  async startWorkflow(workflowId: string): Promise<WorkflowInstance> {
    this.trackCall('startWorkflow', workflowId);

    if (this.shouldFailNext === 'startWorkflow') {
      this.shouldFailNext = null;
      throw new Error('Mock error: startWorkflow failed');
    }

    const workflow = this.workflows.get(workflowId);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    this.currentInstance = {
      id: `instance-${Date.now()}`,
      workflowId,
      currentStepId: workflow.steps[0]?.id ?? 'step-1',
      startedAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      stepStates: {},
    };

    this.currentStep = workflow.steps[0] ?? null;
    this.status = 'running';

    await this.emit({
      type: 'workflow-started',
      workflowId,
      instanceId: this.currentInstance.id,
      timestamp: new Date(),
    });

    return this.currentInstance;
  }

  getCurrentStep(): WorkflowStep | null {
    this.trackCall('getCurrentStep');
    return this.currentStep;
  }

  async advance(): Promise<void> {
    this.trackCall('advance');

    if (this.shouldFailNext === 'advance') {
      this.shouldFailNext = null;
      throw new Error('Mock error: advance failed');
    }

    if (!this.currentInstance) {
      throw new Error('No active workflow');
    }

    await this.emit({
      type: 'step-completed',
      workflowId: this.currentInstance.workflowId,
      instanceId: this.currentInstance.id,
      stepId: this.currentStep?.id,
      timestamp: new Date(),
    });

    // Simulate moving to next step
    if (this.currentStep?.next !== undefined) {
      const nextStepId = Array.isArray(this.currentStep.next)
        ? this.currentStep.next[0]
        : this.currentStep.next;

      const workflow = this.workflows.get(this.currentInstance.workflowId);
      this.currentStep =
        workflow?.steps.find((s: WorkflowStep) => s.id === nextStepId) ?? null;

      if (this.currentStep) {
        this.currentInstance.currentStepId = this.currentStep.id;
      }
    } else {
      this.status = 'completed';
      this.currentInstance.status = 'completed';

      await this.emit({
        type: 'workflow-completed',
        workflowId: this.currentInstance.workflowId,
        instanceId: this.currentInstance.id,
        timestamp: new Date(),
      });
    }
  }

  async goBack(): Promise<void> {
    this.trackCall('goBack');

    if (this.shouldFailNext === 'goBack') {
      this.shouldFailNext = null;
      throw new Error('Mock error: goBack failed');
    }

    if (!this.currentInstance) {
      throw new Error('No active workflow');
    }

    // Simulate going back
    const workflow = this.workflows.get(this.currentInstance.workflowId);
    if (workflow && this.currentStep) {
      const currentIndex = workflow.steps.findIndex(
        (s: WorkflowStep) => s.id === this.currentStep?.id
      );
      if (currentIndex > 0) {
        this.currentStep = workflow.steps[currentIndex - 1];
        this.currentInstance.currentStepId = this.currentStep.id;
      }
    }
  }

  async skip(): Promise<void> {
    this.trackCall('skip');

    if (this.shouldFailNext === 'skip') {
      this.shouldFailNext = null;
      throw new Error('Mock error: skip failed');
    }

    if (this.currentStep) {
      await this.emit({
        type: 'step-skipped',
        workflowId: this.currentInstance?.workflowId ?? '',
        instanceId: this.currentInstance?.id ?? '',
        stepId: this.currentStep.id,
        timestamp: new Date(),
      });
    }

    await this.advance();
  }

  async reset(): Promise<void> {
    this.trackCall('reset');

    if (this.shouldFailNext === 'reset') {
      this.shouldFailNext = null;
      throw new Error('Mock error: reset failed');
    }

    this.currentInstance = null;
    this.currentStep = null;
    this.status = 'idle';
  }

  async pause(): Promise<void> {
    this.trackCall('pause');

    if (this.shouldFailNext === 'pause') {
      this.shouldFailNext = null;
      throw new Error('Mock error: pause failed');
    }

    this.status = 'paused';
    if (this.currentInstance) {
      this.currentInstance.status = 'paused';

      await this.emit({
        type: 'workflow-paused',
        workflowId: this.currentInstance.workflowId,
        instanceId: this.currentInstance.id,
        timestamp: new Date(),
      });
    }
  }

  async resume(): Promise<void> {
    this.trackCall('resume');

    if (this.shouldFailNext === 'resume') {
      this.shouldFailNext = null;
      throw new Error('Mock error: resume failed');
    }

    this.status = 'running';
    if (this.currentInstance) {
      this.currentInstance.status = 'active';
    }
  }

  getStatus(): 'idle' | 'running' | 'paused' | 'completed' | 'failed' {
    this.trackCall('getStatus');
    return this.status;
  }

  getInstance(): WorkflowInstance | null {
    this.trackCall('getInstance');
    return this.currentInstance;
  }

  on(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.trackCall('on', event);

    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  off(event: WorkflowEvent['type'], handler: WorkflowEventHandler): void {
    this.trackCall('off', event);

    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  async emit(event: WorkflowEvent): Promise<void> {
    this.trackCall('emit', event);
    this.emittedEvents.push(event);

    const handlers = this.eventHandlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        await handler(event);
      }
    }
  }

  // Test utilities
  setStatus(
    status: 'idle' | 'running' | 'paused' | 'completed' | 'failed'
  ): void {
    this.status = status;
  }

  setCurrentStep(step: WorkflowStep | null): void {
    this.currentStep = step;
  }

  setCurrentInstance(instance: WorkflowInstance | null): void {
    this.currentInstance = instance;
  }

  failNextCall(methodName: string): void {
    this.shouldFailNext = methodName;
  }

  clearHistory(): void {
    this.methodCalls.clear();
    this.emittedEvents = [];
    this.eventHandlers.clear();
  }

  getCallCount(methodName: string): number {
    return this.methodCalls.get(methodName)?.length ?? 0;
  }

  wasCalled(methodName: string): boolean {
    return this.getCallCount(methodName) > 0;
  }

  getEmittedEvents(type?: WorkflowEvent['type']): WorkflowEvent[] {
    if (type) {
      return this.emittedEvents.filter((e) => e.type === type);
    }
    return this.emittedEvents;
  }

  // Helper to create test workflow
  createTestWorkflow(id: string = 'test-workflow'): WorkflowDefinition {
    return {
      id,
      name: 'Test Workflow',
      version: '1.0.0',
      steps: [
        {
          id: 'step-1',
          name: 'First Step',
          type: 'task',
          next: 'step-2',
        },
        {
          id: 'step-2',
          name: 'Second Step',
          type: 'task',
          next: 'step-3',
        },
        {
          id: 'step-3',
          name: 'Final Step',
          type: 'task',
        },
      ],
    };
  }

  private trackCall(methodName: string, ...args: unknown[]): void {
    if (!this.methodCalls.has(methodName)) {
      this.methodCalls.set(methodName, []);
    }
    this.methodCalls.get(methodName)?.push(args);
  }
}

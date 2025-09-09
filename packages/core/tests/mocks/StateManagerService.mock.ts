import type {
  IStateManager,
  StateData,
  WorkflowInstance,
} from '../../src/interfaces/IStateManager';

export class MockStateManagerService implements IStateManager {
  private state: StateData = {
    version: '1.0.0',
    instances: [],
    config: {},
  };

  private workingDir: string = '.checklist-test';
  private locked: boolean = false;
  private backups: Map<string, StateData> = new Map();

  // Spy tracking
  public methodCalls: Map<string, number> = new Map();
  public saveCallHistory: StateData[] = [];
  public loadCallHistory: Date[] = [];
  public shouldFailNext: string | null = null;

  async initialize(workingDir?: string): Promise<void> {
    this.trackCall('initialize');
    if (this.shouldFailNext === 'initialize') {
      this.shouldFailNext = null;
      throw new Error('Mock error: initialize failed');
    }

    if (workingDir !== undefined && workingDir !== '') {
      this.workingDir = workingDir;
    }
  }

  async load(): Promise<StateData> {
    this.trackCall('load');
    this.loadCallHistory.push(new Date());

    if (this.shouldFailNext === 'load') {
      this.shouldFailNext = null;
      throw new Error('Mock error: load failed');
    }

    return { ...this.state };
  }

  async save(state: StateData): Promise<void> {
    this.trackCall('save');
    this.saveCallHistory.push({ ...state });

    if (this.shouldFailNext === 'save') {
      this.shouldFailNext = null;
      throw new Error('Mock error: save failed');
    }

    this.state = { ...state };
  }

  async backup(): Promise<string> {
    this.trackCall('backup');

    if (this.shouldFailNext === 'backup') {
      this.shouldFailNext = null;
      throw new Error('Mock error: backup failed');
    }

    const backupId = `backup-${Date.now()}`;
    this.backups.set(backupId, { ...this.state });
    return backupId;
  }

  async restore(backupPath: string): Promise<void> {
    this.trackCall('restore');

    if (this.shouldFailNext === 'restore') {
      this.shouldFailNext = null;
      throw new Error('Mock error: restore failed');
    }

    const backup = this.backups.get(backupPath);
    if (!backup) {
      throw new Error(`Backup not found: ${backupPath}`);
    }

    this.state = { ...backup };
  }

  validate(state: StateData): boolean {
    this.trackCall('validate');

    if (this.shouldFailNext === 'validate') {
      this.shouldFailNext = null;
      return false;
    }

    return (
      state !== null &&
      typeof state === 'object' &&
      'version' in state &&
      'instances' in state
    );
  }

  async reset(): Promise<void> {
    this.trackCall('reset');

    if (this.shouldFailNext === 'reset') {
      this.shouldFailNext = null;
      throw new Error('Mock error: reset failed');
    }

    this.state = {
      version: '1.0.0',
      instances: [],
      config: {},
    };
  }

  getWorkingDirectory(): string {
    this.trackCall('getWorkingDirectory');
    return this.workingDir;
  }

  async exists(): Promise<boolean> {
    this.trackCall('exists');
    return true;
  }

  async lock(): Promise<void> {
    this.trackCall('lock');

    if (this.shouldFailNext === 'lock') {
      this.shouldFailNext = null;
      throw new Error('Mock error: lock failed');
    }

    if (this.locked) {
      throw new Error('State is already locked');
    }

    this.locked = true;
  }

  async unlock(): Promise<void> {
    this.trackCall('unlock');

    if (this.shouldFailNext === 'unlock') {
      this.shouldFailNext = null;
      throw new Error('Mock error: unlock failed');
    }

    this.locked = false;
  }

  // Test utilities
  setState(state: StateData): void {
    this.state = { ...state };
  }

  getState(): StateData {
    return { ...this.state };
  }

  isLocked(): boolean {
    return this.locked;
  }

  failNextCall(methodName: string): void {
    this.shouldFailNext = methodName;
  }

  clearHistory(): void {
    this.methodCalls.clear();
    this.saveCallHistory = [];
    this.loadCallHistory = [];
    this.backups.clear();
  }

  getCallCount(methodName: string): number {
    return this.methodCalls.get(methodName) ?? 0;
  }

  wasCalled(methodName: string): boolean {
    return this.getCallCount(methodName) > 0;
  }

  // Helper to create test instances
  createTestInstance(id: string = 'test-instance'): WorkflowInstance {
    return {
      id,
      workflowId: 'test-workflow',
      currentStepId: 'step-1',
      startedAt: new Date(),
      updatedAt: new Date(),
      status: 'active',
      stepStates: {
        'step-1': {
          stepId: 'step-1',
          status: 'pending',
        },
      },
    };
  }

  private trackCall(methodName: string): void {
    const count = this.methodCalls.get(methodName) ?? 0;
    this.methodCalls.set(methodName, count + 1);
  }
}

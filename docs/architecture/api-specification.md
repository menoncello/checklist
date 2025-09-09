# API Specification (Complete with All Refinements)

## Core API Structure

```typescript
export interface CoreAPI {
  // Core functionality
  workflow: WorkflowAPI;
  template: TemplateAPI;
  state: StateAPI;
  executor: ExecutorAPI;
  monitor: MonitorAPI;

  // Additional APIs (Refinements)
  test: TestAPI;
  cli: CLIAPI;
  tui: TUIAPI;
  plugin: PluginAPI;
  recovery: RecoveryAPI;

  // Version and compatibility
  version: string;
  checkCompatibility(version: string): boolean;
}
```

## Workflow API (Enhanced)

```typescript
export interface WorkflowAPI {
  // Initialization
  init(templateId: string, variables?: Record<string, any>): Promise<ChecklistInstance>;
  loadFromDirectory(path: string): Promise<ChecklistInstance | null>;

  // Navigation
  getCurrentStep(): Step | null;
  nextStep(): Promise<StepResult>;
  previousStep(): Promise<StepResult>;
  goToStep(stepId: string): Promise<StepResult>;
  skipCurrentStep(reason?: string): Promise<StepResult>;

  // Execution
  markStepComplete(notes?: string): Promise<StepResult>;
  executeCurrentStep(): Promise<StepExecutionResult>;
  pauseExecution(): Promise<void>;
  resumeExecution(): Promise<void>;
  resetWorkflow(): Promise<void>;

  // Input/Output (Refinement)
  provideInput(input: any): Promise<void>;
  provideConfirmation(confirmed: boolean): Promise<void>;
  cancelInputRequest(): Promise<void>;
  getOutputStream(): ReadableStream<OutputEvent>;

  // Status
  getStatus(): WorkflowStatus;
  getProgress(): ProgressInfo;
  getHistory(): CompletedStep[];
}
```

## Test API (New Refinement)

```typescript
export interface TestAPI {
  // Test mode operations
  enableTestMode(): void;
  disableTestMode(): void;
  mockFileSystem(files: Record<string, string>): void;
  mockTerminal(config: TerminalConfig): void;

  // Test execution
  runHeadless(commands: string[]): Promise<TestResult>;
  simulateKeypress(key: string): void;
  simulateUserInput(input: string): void;

  // Assertions helpers
  getLastOutput(): string;
  getCurrentState(): WorkflowState;
  getTerminalBuffer(): string[][];

  // Mutation testing support
  injectFault(fault: FaultType): void;
  resetFaults(): void;
}
```

## Plugin API (New Refinement)

```typescript
export interface PluginAPI {
  // Plugin lifecycle
  registerPlugin(plugin: Plugin): void;
  unregisterPlugin(pluginId: string): void;
  listPlugins(): PluginInfo[];

  // Hook system
  registerHook(event: string, handler: HookHandler): void;
  triggerHook(event: string, data: any): Promise<void>;

  // Extension points
  addCommand(command: CustomCommand): void;
  addTemplateProcessor(processor: TemplateProcessor): void;
  addValidator(validator: Validator): void;
}
```

## Recovery API (New Refinement)

```typescript
export interface RecoveryAPI {
  // Error recovery
  attemptRecovery(error: ChecklistError): Promise<RecoveryResult>;
  suggestFixes(error: ChecklistError): Fix[];
  applyFix(fix: Fix): Promise<void>;

  // State recovery
  detectCorruption(): CorruptionReport;
  repairCorruption(report: CorruptionReport): Promise<void>;
  mergeConflicts(local: WorkflowState, remote: WorkflowState): WorkflowState;

  // Rollback
  createSavepoint(): string;
  rollbackToSavepoint(savepointId: string): Promise<void>;
}
```

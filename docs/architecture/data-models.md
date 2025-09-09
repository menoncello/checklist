# Data Models (With Multi-Script Support)

## ChecklistTemplate

```typescript
interface ChecklistTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  variables: Variable[];
  steps: Step[];
  metadata: TemplateMetadata;
}

interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: any;
  description: string;
  validation?: string;
}
```

## Step (Enhanced with Multi-Command Support)

```typescript
interface Step {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'confirmation' | 'input' | 'automated' | 'multi-command';
  commands: Command[];
  condition?: string;
  dependencies: string[];
  validation?: StepValidation;
  executionMode: 'sequential' | 'parallel';
  continueOnError?: boolean;
}

interface Command {
  id: string;
  type: 'claude' | 'bash' | 'internal';
  content: string;
  dangerous: boolean;
  requiresConfirmation: boolean;
  condition?: string;
  timeout?: number;
  retryCount?: number;
  successCriteria?: SuccessCriteria;
}
```

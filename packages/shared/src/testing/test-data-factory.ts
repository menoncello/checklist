import { randomUUID } from 'crypto';
import type {
  ChecklistTemplate,
  ChecklistStep,
  WorkflowState,
  WorkflowInstance,
} from '../types';

export class TestDataFactory {
  private idCounter = 0;

  private generateId(prefix: string = 'test'): string {
    return `${prefix}-${++this.idCounter}-${randomUUID().slice(0, 8)}`;
  }

  createTemplate(
    overrides: Partial<ChecklistTemplate> = {}
  ): ChecklistTemplate {
    return {
      id: this.generateId('template'),
      name: 'Test Template',
      description: 'A template for testing',
      version: '1.0.0',
      author: 'test@example.com',
      tags: ['test'],
      steps: [],
      metadata: {
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      ...overrides,
    };
  }

  createStep(overrides: Partial<ChecklistStep> = {}): ChecklistStep {
    return {
      id: this.generateId('step'),
      title: 'Test Step',
      description: 'A step for testing',
      type: 'task',
      required: true,
      estimatedTime: 60,
      dependencies: [],
      validation: undefined,
      metadata: {},
      ...overrides,
    };
  }

  createWorkflowState(overrides: Partial<WorkflowState> = {}): WorkflowState {
    return {
      version: '1.0.0',
      instances: [],
      activeInstanceId: null,
      metadata: {
        lastModified: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      },
      ...overrides,
    };
  }

  createWorkflowInstance(
    overrides: Partial<WorkflowInstance> = {}
  ): WorkflowInstance {
    return {
      id: this.generateId('instance'),
      templateId: this.generateId('template'),
      name: 'Test Instance',
      status: 'active',
      progress: {
        completed: 0,
        total: 0,
        percentage: 0,
      },
      steps: [],
      startedAt: new Date().toISOString(),
      completedAt: null,
      metadata: {},
      ...overrides,
    };
  }

  templateToYaml(template: ChecklistTemplate): string {
    const yaml = [
      `id: ${template.id}`,
      `name: ${template.name}`,
      `description: ${template.description}`,
      `version: ${template.version}`,
      `author: ${template.author}`,
      `tags:`,
      ...template.tags.map((tag) => `  - ${tag}`),
      `steps:`,
      ...template.steps.map((step) => this.stepToYaml(step, 2)),
    ].join('\n');

    return yaml;
  }

  private stepToYaml(step: ChecklistStep, indent: number): string[] {
    const spaces = ' '.repeat(indent);
    const lines = [
      `${spaces}- id: ${step.id}`,
      `${spaces}  title: ${step.title}`,
      `${spaces}  description: ${step.description}`,
      `${spaces}  type: ${step.type}`,
      `${spaces}  required: ${step.required}`,
    ];

    if (step.dependencies !== undefined && step.dependencies.length > 0) {
      lines.push(`${spaces}  dependencies:`);
      step.dependencies.forEach((dep) => {
        lines.push(`${spaces}    - ${dep}`);
      });
    }

    return lines;
  }

  createCircularTemplate(): string {
    return `
id: circular-template
name: Circular Template
version: 1.0.0
steps:
  - id: step-1
    title: Step 1
    dependencies:
      - step-3
  - id: step-2
    title: Step 2
    dependencies:
      - step-1
  - id: step-3
    title: Step 3
    dependencies:
      - step-2
`;
  }

  createLargeTemplate(stepCount: number = 100): ChecklistTemplate {
    const steps: ChecklistStep[] = [];
    for (let i = 0; i < stepCount; i++) {
      steps.push(
        this.createStep({
          id: `step-${i}`,
          title: `Step ${i}`,
          dependencies: i > 0 ? [`step-${i - 1}`] : [],
        })
      );
    }

    return this.createTemplate({
      id: 'large-template',
      name: 'Large Template',
      steps,
    });
  }

  createInvalidYaml(): string {
    return `
id: invalid
name: Invalid Template
steps:
  - id: step-1
    title: Step 1
    required: "not a boolean"
  - id: 
    title: Missing ID
`;
  }

  createMockTerminalOutput(width: number = 80, height: number = 24): string[] {
    const lines: string[] = [];
    for (let i = 0; i < height; i++) {
      lines.push(`Line ${i + 1}`.padEnd(width, '.'));
    }
    return lines;
  }

  createProgressBarOutput(percentage: number, width: number = 40): string {
    const filled = Math.floor((percentage / 100) * width);
    const empty = width - filled;
    return `[${'█'.repeat(filled)}${' '.repeat(empty)}] ${percentage}%`;
  }
}

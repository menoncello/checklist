import { describe, test, expect, beforeEach, afterEach, mock } from 'bun:test';
import { WorkflowEngine } from '../src/workflow/WorkflowEngine';
import { ChecklistTemplate, Step } from '../src/workflow/types';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'workflow-test-'));
    engine = new WorkflowEngine(tempDir);
  });

  afterEach(async () => {
    await engine.cleanup();
    rmSync(tempDir, { recursive: true, force: true });
  });

  test('initializes with template', async () => {
    const mockLoadTemplate = mock(() => Promise.resolve({
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
      ],
    }));
    
    engine['loadTemplate'] = mockLoadTemplate;
    
    await engine.init('test-template');
    
    const currentStep = engine.getCurrentStep();
    expect(currentStep).toBeDefined();
    expect(currentStep?.id).toBe('step1');
  });

  test('advances through steps', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
        { id: 'step3', title: 'Third Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    let currentStep = engine.getCurrentStep();
    expect(currentStep?.id).toBe('step1');
    
    const result1 = await engine.advance();
    expect(result1.success).toBe(true);
    expect(result1.step?.id).toBe('step2');
    
    currentStep = engine.getCurrentStep();
    expect(currentStep?.id).toBe('step2');
    
    const result2 = await engine.advance();
    expect(result2.success).toBe(true);
    expect(result2.step?.id).toBe('step3');
  });

  test('goes back to previous step', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
        { id: 'step3', title: 'Third Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    await engine.advance();
    await engine.advance();
    
    let currentStep = engine.getCurrentStep();
    expect(currentStep?.id).toBe('step3');
    
    const result = await engine.goBack();
    expect(result.success).toBe(true);
    expect(result.step?.id).toBe('step2');
    
    currentStep = engine.getCurrentStep();
    expect(currentStep?.id).toBe('step2');
  });

  test('skips step with reason', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
        { id: 'step3', title: 'Third Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    const skipReason = 'Not applicable';
    const result = await engine.skip(skipReason);
    
    expect(result.success).toBe(true);
    expect(result.step?.id).toBe('step2');
    
    const history = engine.getHistory();
    expect(history).toHaveLength(0);
    
    const state = engine['state'];
    expect(state.skippedSteps).toHaveLength(1);
    expect(state.skippedSteps[0].reason).toBe(skipReason);
  });

  test('handles conditional steps', async () => {
    const template: ChecklistTemplate = {
      id: 'conditional-template',
      name: 'Conditional Template',
      steps: [
        { id: 'step1', title: 'Always visible' },
        { 
          id: 'step2', 
          title: 'Conditional step',
          condition: '${skipOptional} !== true'
        },
        { id: 'step3', title: 'Final step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('conditional-template', { skipOptional: true });
    
    // First advance should skip step2 because condition evaluates to false
    const result = await engine.advance();
    expect(result.success).toBe(true);
    expect(result.step?.id).toBe('step3');
  });

  test('emits correct events', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    
    const events: string[] = [];
    
    engine.on('step:changed', () => events.push('changed'));
    engine.on('step:completed', () => events.push('completed'));
    engine.on('progress:updated', () => events.push('progress'));
    engine.on('workflow:completed', () => events.push('workflow-completed'));
    
    await engine.init('test-template');
    
    await engine.advance();
    expect(events).toContain('completed');
    expect(events).toContain('changed');
    expect(events).toContain('progress');
    
    await engine.advance();
    expect(events).toContain('workflow-completed');
  });

  test('validates steps correctly', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { 
          id: 'step1', 
          title: 'Step with validation',
          validation: [
            {
              type: 'file_exists',
              check: '/nonexistent/file.txt',
              errorMessage: 'File must exist'
            }
          ]
        },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    const result = await engine.validateStep();
    expect(result.valid).toBe(false);
    expect(result.error).toContain('File not found');
  });

  test('calculates progress correctly', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
        { id: 'step3', title: 'Third Step' },
        { id: 'step4', title: 'Fourth Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    let progress = engine.getProgress();
    expect(progress.totalSteps).toBe(4);
    expect(progress.completedSteps).toBe(0);
    expect(progress.percentComplete).toBe(0);
    
    await engine.advance();
    progress = engine.getProgress();
    expect(progress.completedSteps).toBe(1);
    expect(progress.percentComplete).toBe(25);
    
    await engine.skip('Not needed');
    progress = engine.getProgress();
    expect(progress.completedSteps).toBe(1);
    expect(progress.skippedSteps).toBe(1);
    expect(progress.percentComplete).toBe(50);
  });

  test('resets workflow correctly', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    await engine.advance();
    await engine.advance();
    
    let progress = engine.getProgress();
    expect(progress.completedSteps).toBe(2);
    
    await engine.reset();
    
    progress = engine.getProgress();
    expect(progress.completedSteps).toBe(0);
    expect(progress.currentStepIndex).toBe(0);
    
    const currentStep = engine.getCurrentStep();
    expect(currentStep?.id).toBe('step1');
  });

  test('handles workflow completion', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    let summaryEmitted = false;
    engine.on('workflow:completed', (summary) => {
      summaryEmitted = true;
      expect(summary.completedSteps).toBe(2);
      expect(summary.totalSteps).toBe(2);
      expect(summary.status).toBe('completed');
    });
    
    await engine.advance();
    await engine.advance();
    
    expect(summaryEmitted).toBe(true);
    
    const state = engine['state'];
    expect(state.status).toBe('completed');
  });

  test('prevents invalid state transitions', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [{ id: 'step1', title: 'First Step' }],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    // Complete the workflow normally
    await engine.advance();
    
    // Now the workflow should be completed
    expect(engine['state'].status).toBe('completed');
    
    // Trying to advance from completed should return no next step
    const result = await engine.advance();
    expect(result.success).toBe(true);
    expect(result.step).toBe(null);
  });

  test('handles invalid conditions safely', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { 
          id: 'step1', 
          title: 'Step with bad condition',
          condition: 'invalid javascript here!!!'
        },
        {
          id: 'step2',
          title: 'Step without condition'
        }
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    // Invalid conditions should be treated as false (skip the step)
    const visibleSteps = engine['getVisibleSteps']();
    expect(visibleSteps).toHaveLength(1);
    expect(visibleSteps[0].id).toBe('step2');
  });

  test('maintains step history', async () => {
    const template: ChecklistTemplate = {
      id: 'test-template',
      name: 'Test Template',
      steps: [
        { id: 'step1', title: 'First Step' },
        { id: 'step2', title: 'Second Step' },
        { id: 'step3', title: 'Third Step' },
      ],
    };
    
    engine['loadTemplate'] = mock(() => Promise.resolve(template));
    await engine.init('test-template');
    
    await engine.advance();
    await engine.skip('Skipping step 2');
    
    const history = engine.getHistory();
    expect(history).toHaveLength(1);
    expect(history[0].step.id).toBe('step1');
    
    const state = engine['state'];
    expect(state.skippedSteps).toHaveLength(1);
    expect(state.skippedSteps[0].step.id).toBe('step2');
  });
});
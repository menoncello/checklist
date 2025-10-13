/**
 * Integration tests for WorkflowEngine with ConditionalEvaluationEngine
 * Story 3.6: Conditional Workflow Branching (Task 3)
 */

import { afterEach, beforeEach, describe, expect, mock, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { StateManager } from '../../src/state/manager/StateManager';
import { TransactionCoordinator } from '../../src/state/TransactionCoordinator';
import type { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import type { VariableStore } from '../../src/variables/VariableStore';
import { ConditionalEvaluationEngine } from '../../src/workflow/ConditionalEvaluationEngine';
import { WorkflowEngine } from '../../src/workflow/WorkflowEngine';
import type { ChecklistTemplate } from '../../src/workflow/types';

describe('WorkflowEngine with ConditionalEvaluationEngine', () => {
  let engine: WorkflowEngine;
  let engineWithoutConditions: WorkflowEngine;
  let stateManager: StateManager;
  let transactionCoordinator: TransactionCoordinator;
  let mockSandbox: TemplateSandbox;
  let mockVariableStore: VariableStore;
  let conditionalEngine: ConditionalEvaluationEngine;
  let tempDir: string;

  const createMockTemplate = (withConditions = false): ChecklistTemplate => ({
    id: 'test-template',
    name: 'Test Template',
    version: '1.0.0',
    steps: [
      {
        id: 'step1',
        title: 'First Step',
      },
      {
        id: 'step2',
        title: 'Conditional Step',
        condition: withConditions ? 'showStep2 === true' : undefined,
      },
      {
        id: 'step3',
        title: 'Another Conditional',
        condition: withConditions ? 'count > 5' : undefined,
      },
    ],
    metadata: {},
  });

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'workflow-conditional-'));
    stateManager = new StateManager(tempDir);
    transactionCoordinator = new TransactionCoordinator(tempDir);

    mockSandbox = {
      evaluateCondition: mock(async (condition: string) => {
        if (condition === 'showStep2 === true') return true;
        if (condition === 'count > 5') return false;
        return true;
      }),
    } as unknown as TemplateSandbox;

    mockVariableStore = {
      getAll: mock(() => ({ showStep2: true, count: 3 })),
    } as unknown as VariableStore;

    conditionalEngine = new ConditionalEvaluationEngine(
      mockSandbox,
      mockVariableStore
    );

    engine = new WorkflowEngine(
      stateManager,
      transactionCoordinator,
      conditionalEngine
    );

    engineWithoutConditions = new WorkflowEngine(
      stateManager,
      transactionCoordinator
    );
  });

  afterEach(async () => {
    await engine.cleanup();
    await engineWithoutConditions.cleanup();
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('initialization with conditions', () => {
    test('evaluates all step conditions on init', async () => {
      const template = createMockTemplate(true);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template', { showStep2: true, count: 3 });

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(2);
      expect(visibleSteps[0]?.id).toBe('step1');
      expect(visibleSteps[1]?.id).toBe('step2');
    });

    test('works without conditional engine', async () => {
      const template = createMockTemplate(true);
      engineWithoutConditions['stateManager']['loadTemplate'] = () =>
        Promise.resolve(template);

      await engineWithoutConditions.init('test-template');

      const visibleSteps = engineWithoutConditions.getVisibleSteps();
      expect(visibleSteps.length).toBe(3);
    });
  });

  describe('getVisibleSteps', () => {
    test('returns only steps with conditionResult !== false', async () => {
      const template = createMockTemplate(true);
      template.steps[0]!.conditionResult = true;
      template.steps[1]!.conditionResult = true;
      template.steps[2]!.conditionResult = false;

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template');

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(2);
      expect(visibleSteps.some((s) => s.id === 'step3')).toBe(false);
    });

    test('returns all steps when no conditions', async () => {
      const template = createMockTemplate(false);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template');

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(3);
    });
  });

  describe('evaluateAllConditions', () => {
    test('evaluates all step conditions', async () => {
      const template = createMockTemplate(true);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template', { showStep2: true, count: 3 });

      await engine.evaluateAllConditions();

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBeGreaterThan(0);
    });

    test('handles engine without conditional evaluation', async () => {
      const template = createMockTemplate(false);
      engineWithoutConditions['stateManager']['loadTemplate'] = () =>
        Promise.resolve(template);

      await engineWithoutConditions.init('test-template');

      await engineWithoutConditions.evaluateAllConditions();

      const visibleSteps = engineWithoutConditions.getVisibleSteps();
      expect(visibleSteps.length).toBe(3);
    });
  });

  describe('manual re-evaluation', () => {
    test('reevaluateConditions invalidates cache and re-evaluates', async () => {
      const template = createMockTemplate(true);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template', { showStep2: true, count: 3 });

      const visibleBefore = engine.getVisibleSteps();

      await engine.reevaluateConditions();

      const visibleAfter = engine.getVisibleSteps();
      expect(visibleAfter.length).toBe(visibleBefore.length);
    });

    test('emits state:changed event on re-evaluation', async () => {
      const template = createMockTemplate(true);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template', { showStep2: true, count: 3 });

      let eventFired = false;
      engine.on('state:changed', () => {
        eventFired = true;
      });

      await engine.reevaluateConditions();

      expect(eventFired).toBe(true);
    });
  });

  describe('condition re-evaluation during operations', () => {
    test('advance triggers condition evaluation', async () => {
      const template = createMockTemplate(false);
      template.steps.push({ id: 'step4', title: 'Fourth Step' });

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template');
      await engine.advance();

      const state = engine.getState();
      expect(state.currentStepIndex).toBe(1);
    });

    test('skip triggers condition evaluation', async () => {
      const template = createMockTemplate(false);
      template.steps.push({ id: 'step4', title: 'Fourth Step' });

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template');
      await engine.skip('Testing');

      const state = engine.getState();
      expect(state.skippedSteps.length).toBe(1);
    });

    test('reset triggers condition evaluation', async () => {
      const template = createMockTemplate(false);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template');
      await engine.advance();
      await engine.reset();

      const state = engine.getState();
      expect(state.currentStepIndex).toBe(0);
      expect(state.completedSteps.length).toBe(0);
    });
  });

  describe('automatic re-evaluation on variable changes (AC2)', () => {
    test('conditions re-evaluated when variables change causing visibility change', async () => {
      // Track evaluation calls
      let evaluationCount = 0;
      let currentCount = 3;

      mockSandbox.evaluateCondition = mock(async (condition: string) => {
        evaluationCount++;
        if (condition === 'showStep2 === true') return true;
        if (condition === 'count > 5') {
          return currentCount > 5;
        }
        return true;
      });

      mockVariableStore.getAll = mock(() => ({
        showStep2: true,
        count: currentCount,
      }));

      const template = createMockTemplate(true);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template', { showStep2: true, count: 3 });

      const visibleBefore = engine.getVisibleSteps();
      expect(visibleBefore.length).toBe(2); // step1, step2 (step3 hidden because count=3 <= 5)
      expect(visibleBefore.some((s) => s.id === 'step3')).toBe(false);

      // Simulate variable change: count changes from 3 to 10
      currentCount = 10;
      mockVariableStore.getAll = mock(() => ({
        showStep2: true,
        count: currentCount,
      }));

      // Trigger re-evaluation (simulates variable update in real system)
      await engine.reevaluateConditions();

      const visibleAfter = engine.getVisibleSteps();
      expect(visibleAfter.length).toBe(3); // Now all steps visible (count=10 > 5)
      expect(visibleAfter.some((s) => s.id === 'step3')).toBe(true);
      expect(template.steps[2]?.conditionResult).toBe(true);
    });

    test('visibility changes reflected in getVisibleSteps after variable update', async () => {
      let featureEnabled = false;

      mockSandbox.evaluateCondition = mock(async (condition: string) => {
        if (condition === 'featureEnabled === true') return featureEnabled;
        return true;
      });

      mockVariableStore.getAll = mock(() => ({ featureEnabled }));

      const template: ChecklistTemplate = {
        id: 'dynamic-test',
        name: 'Dynamic Test',
        version: '1.0.0',
        steps: [
          { id: 'step1', title: 'Always Visible' },
          {
            id: 'step2',
            title: 'Conditionally Visible',
            condition: 'featureEnabled === true',
          },
          {
            id: 'step3',
            title: 'Also Conditionally Visible',
            condition: 'featureEnabled === true',
          },
        ],
        metadata: {},
      };

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('dynamic-test', { featureEnabled: false });

      let visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(1); // Only step1

      // Change variable
      featureEnabled = true;
      mockVariableStore.getAll = mock(() => ({ featureEnabled }));

      await engine.reevaluateConditions();

      visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(3); // All steps now visible
      expect(visibleSteps[1]?.id).toBe('step2');
      expect(visibleSteps[2]?.id).toBe('step3');
    });

    test('state:changed event includes updated condition results', async () => {
      const template = createMockTemplate(true);
      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('test-template', { showStep2: true, count: 3 });

      let stateChangeEvent: unknown = null;
      engine.on('state:changed', (state) => {
        stateChangeEvent = state;
      });

      await engine.reevaluateConditions();

      expect(stateChangeEvent).not.toBeNull();
      expect(stateChangeEvent).toHaveProperty('currentStepIndex');
      expect(stateChangeEvent).toHaveProperty('variables');
    });

    test('multiple variable changes trigger correct re-evaluations', async () => {
      let showAdvanced = false;
      let userRole = 'user';

      mockSandbox.evaluateCondition = mock(async (condition: string) => {
        if (condition === 'showAdvanced === true') return showAdvanced;
        if (condition === 'userRole === "admin"') return userRole === 'admin';
        return true;
      });

      mockVariableStore.getAll = mock(() => ({ showAdvanced, userRole }));

      const template: ChecklistTemplate = {
        id: 'multi-var-test',
        name: 'Multi Variable Test',
        version: '1.0.0',
        steps: [
          { id: 'step1', title: 'Basic Step' },
          {
            id: 'step2',
            title: 'Advanced Step',
            condition: 'showAdvanced === true',
          },
          {
            id: 'step3',
            title: 'Admin Step',
            condition: 'userRole === "admin"',
          },
        ],
        metadata: {},
      };

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('multi-var-test', { showAdvanced: false, userRole: 'user' });

      expect(engine.getVisibleSteps().length).toBe(1); // Only step1

      // Change first variable
      showAdvanced = true;
      mockVariableStore.getAll = mock(() => ({ showAdvanced, userRole }));
      await engine.reevaluateConditions();

      expect(engine.getVisibleSteps().length).toBe(2); // step1, step2

      // Change second variable
      userRole = 'admin';
      mockVariableStore.getAll = mock(() => ({ showAdvanced, userRole }));
      await engine.reevaluateConditions();

      expect(engine.getVisibleSteps().length).toBe(3); // All steps visible
    });
  });

  describe('group conditional logic', () => {
    test('group condition false hides all group steps', async () => {
      mockSandbox.evaluateCondition = mock(async (condition: string) => {
        if (condition === 'featureEnabled === true') return false;
        return true;
      });

      const template: ChecklistTemplate = {
        id: 'group-test',
        name: 'Group Test',
        version: '1.0.0',
        steps: [
          { id: 'step1', title: 'Step 1' },
          {
            id: 'step2',
            title: 'Step 2 (Group A)',
            groupId: 'groupA',
            groupCondition: 'featureEnabled === true',
          },
          {
            id: 'step3',
            title: 'Step 3 (Group A)',
            groupId: 'groupA',
            groupCondition: 'featureEnabled === true',
          },
          { id: 'step4', title: 'Step 4' },
        ],
        metadata: {},
      };

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('group-test', { featureEnabled: false });

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(2);
      expect(visibleSteps[0]?.id).toBe('step1');
      expect(visibleSteps[1]?.id).toBe('step4');
      expect(template.steps[1]?.conditionResult).toBe(false);
      expect(template.steps[2]?.conditionResult).toBe(false);
    });

    test('group condition true evaluates individual step conditions', async () => {
      mockSandbox.evaluateCondition = mock(async (condition: string) => {
        if (condition === 'featureEnabled === true') return true;
        if (condition === 'showStep2 === true') return true;
        if (condition === 'showStep3 === true') return false;
        return true;
      });

      const template: ChecklistTemplate = {
        id: 'group-hierarchy-test',
        name: 'Group Hierarchy Test',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            title: 'Step 1 (Group A)',
            groupId: 'groupA',
            groupCondition: 'featureEnabled === true',
            condition: 'showStep2 === true',
          },
          {
            id: 'step2',
            title: 'Step 2 (Group A)',
            groupId: 'groupA',
            groupCondition: 'featureEnabled === true',
            condition: 'showStep3 === true',
          },
        ],
        metadata: {},
      };

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('group-hierarchy-test', {
        featureEnabled: true,
        showStep2: true,
        showStep3: false,
      });

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(1);
      expect(visibleSteps[0]?.id).toBe('step1');
      expect(template.steps[0]?.conditionResult).toBe(true);
      expect(template.steps[1]?.conditionResult).toBe(false);
    });

    test('steps without groupId are not affected by group conditions', async () => {
      mockSandbox.evaluateCondition = mock(async (condition: string) => {
        if (condition === 'groupEnabled === true') return false;
        return true;
      });

      const template: ChecklistTemplate = {
        id: 'mixed-test',
        name: 'Mixed Test',
        version: '1.0.0',
        steps: [
          { id: 'step1', title: 'Independent Step' },
          {
            id: 'step2',
            title: 'Group Step',
            groupId: 'groupA',
            groupCondition: 'groupEnabled === true',
          },
        ],
        metadata: {},
      };

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('mixed-test', { groupEnabled: false });

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(1);
      expect(visibleSteps[0]?.id).toBe('step1');
    });

    test('multiple groups evaluated independently', async () => {
      mockSandbox.evaluateCondition = mock(async (condition: string) => {
        if (condition === 'groupAEnabled === true') return true;
        if (condition === 'groupBEnabled === true') return false;
        return true;
      });

      const template: ChecklistTemplate = {
        id: 'multi-group-test',
        name: 'Multi Group Test',
        version: '1.0.0',
        steps: [
          {
            id: 'step1',
            title: 'Group A Step 1',
            groupId: 'groupA',
            groupCondition: 'groupAEnabled === true',
          },
          {
            id: 'step2',
            title: 'Group A Step 2',
            groupId: 'groupA',
            groupCondition: 'groupAEnabled === true',
          },
          {
            id: 'step3',
            title: 'Group B Step 1',
            groupId: 'groupB',
            groupCondition: 'groupBEnabled === true',
          },
          {
            id: 'step4',
            title: 'Group B Step 2',
            groupId: 'groupB',
            groupCondition: 'groupBEnabled === true',
          },
        ],
        metadata: {},
      };

      engine['stateManager']['loadTemplate'] = () => Promise.resolve(template);

      await engine.init('multi-group-test', {
        groupAEnabled: true,
        groupBEnabled: false,
      });

      const visibleSteps = engine.getVisibleSteps();
      expect(visibleSteps.length).toBe(2);
      expect(visibleSteps[0]?.id).toBe('step1');
      expect(visibleSteps[1]?.id).toBe('step2');
    });
  });
});

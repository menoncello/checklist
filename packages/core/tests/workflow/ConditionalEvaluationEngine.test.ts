/**
 * Unit tests for ConditionalEvaluationEngine
 * Story 3.6: Conditional Workflow Branching (Task 2)
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ConditionalEvaluationEngine } from '../../src/workflow/ConditionalEvaluationEngine';
import type { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import type { VariableStore } from '../../src/variables/VariableStore';
import type {
  Step,
  ConditionalEvaluationContext,
} from '../../src/workflow/types';

describe('ConditionalEvaluationEngine', () => {
  let engine: ConditionalEvaluationEngine;
  let mockSandbox: TemplateSandbox;
  let mockVariableStore: VariableStore;

  beforeEach(() => {
    // Create mock TemplateSandbox
    mockSandbox = {
      evaluateCondition: mock(async () => true),
    } as unknown as TemplateSandbox;

    // Create mock VariableStore
    mockVariableStore = {
      getAll: mock(() => ({})),
    } as unknown as VariableStore;

    engine = new ConditionalEvaluationEngine(mockSandbox, mockVariableStore);
  });

  describe('evaluateStepCondition', () => {
    test('returns true for steps without condition', async () => {
      const step: Step = {
        id: 'step1',
        title: 'Test step',
      };

      const context: ConditionalEvaluationContext = {
        variables: {},
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true);
    });

    test('evaluates simple condition', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({ count: 15 }));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: 'count > 10',
      };

      const context: ConditionalEvaluationContext = {
        variables: { count: 15 },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true);
      expect(step.conditionResult).toBe(true);
      expect(step.conditionEvaluatedAt).toBeDefined();
    });

    test('evaluates complex condition with AND', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({
        count: 15,
        status: 'active',
      }));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: "count > 10 && status === 'active'",
      };

      const context: ConditionalEvaluationContext = {
        variables: { count: 15, status: 'active' },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true);
    });

    test('evaluates complex condition with OR', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({
        count: 5,
        priority: 'high',
      }));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: "count > 10 || priority === 'high'",
      };

      const context: ConditionalEvaluationContext = {
        variables: { count: 5, priority: 'high' },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true);
    });

    test('evaluates condition with NOT', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({ completed: false }));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: '!completed',
      };

      const context: ConditionalEvaluationContext = {
        variables: { completed: false },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true);
    });

    test('evaluates nested complex condition with parentheses (AC7)', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({
        count: 5,
        status: 'inactive',
        priority: 'urgent',
      }));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: "(count > 10 && status === 'active') || priority === 'urgent'",
      };

      const context: ConditionalEvaluationContext = {
        variables: { count: 5, status: 'inactive', priority: 'urgent' },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true);
      expect(mockSandbox.evaluateCondition).toHaveBeenCalledWith(
        "(count > 10 && status === 'active') || priority === 'urgent'",
        expect.anything(),
        expect.anything()
      );
    });

    test('evaluates all comparison operators (AC7)', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({
        count: 10,
        score: 20,
        status: 'active',
      }));

      const testCases: Array<{ condition: string; description: string }> = [
        { condition: 'count == 10', description: 'equality' },
        { condition: 'count != 5', description: 'inequality' },
        { condition: 'count > 5', description: 'greater than' },
        { condition: 'count < 20', description: 'less than' },
        { condition: 'count >= 10', description: 'greater than or equal' },
        { condition: 'score <= 20', description: 'less than or equal' },
        {
          condition: 'status === "active"',
          description: 'strict equality',
        },
      ];

      for (const testCase of testCases) {
        const step: Step = {
          id: 'step1',
          title: `Test ${testCase.description}`,
          condition: testCase.condition,
        };

        const context: ConditionalEvaluationContext = {
          variables: { count: 10, score: 20, status: 'active' },
          workflowState: {} as any,
          timestamp: Date.now(),
        };

        const result = await engine.evaluateStepCondition(step, context);
        expect(result).toBe(true);
      }
    });

    test('evaluates deeply nested logic (AC7)', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({
        a: true,
        b: true,
        c: false,
        d: true,
        e: false,
      }));

      const step: Step = {
        id: 'step1',
        title: 'Deeply nested test',
        condition: '((a && b) || c) && (d || e)',
      };

      const context: ConditionalEvaluationContext = {
        variables: { a: true, b: true, c: false, d: true, e: false },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true);
      expect(mockSandbox.evaluateCondition).toHaveBeenCalledWith(
        '((a && b) || c) && (d || e)',
        expect.anything(),
        expect.anything()
      );
    });

    test('caches condition results', async () => {
      const evaluateConditionMock = mock(async () => true);
      mockSandbox.evaluateCondition = evaluateConditionMock;
      mockVariableStore.getAll = mock(() => ({ count: 15 }));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: 'count > 10',
      };

      const context: ConditionalEvaluationContext = {
        variables: { count: 15 },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      // First evaluation
      await engine.evaluateStepCondition(step, context);
      expect(evaluateConditionMock).toHaveBeenCalledTimes(1);

      // Second evaluation should use cache
      await engine.evaluateStepCondition(step, context);
      expect(evaluateConditionMock).toHaveBeenCalledTimes(1);
    });

    test('returns true on evaluation error (fail-safe)', async () => {
      mockSandbox.evaluateCondition = mock(async () => {
        throw new Error('Evaluation failed');
      });
      mockVariableStore.getAll = mock(() => ({}));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: 'invalid condition',
      };

      const context: ConditionalEvaluationContext = {
        variables: {},
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      const result = await engine.evaluateStepCondition(step, context);
      expect(result).toBe(true); // Fail-safe behavior
    });
  });

  describe('evaluateGroupCondition', () => {
    test('returns true for empty group', async () => {
      const result = await engine.evaluateGroupCondition('group1', [], {
        variables: {},
        workflowState: {} as any,
        timestamp: Date.now(),
      });

      expect(result).toBe(true);
    });

    test('returns true when no group condition', async () => {
      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Test step',
          groupId: 'group1',
        },
      ];

      const result = await engine.evaluateGroupCondition('group1', steps, {
        variables: {},
        workflowState: {} as any,
        timestamp: Date.now(),
      });

      expect(result).toBe(true);
    });

    test('evaluates group condition', async () => {
      mockSandbox.evaluateCondition = mock(async () => true);
      mockVariableStore.getAll = mock(() => ({ feature: true }));

      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Test step',
          groupId: 'group1',
          groupCondition: 'feature === true',
        },
      ];

      const result = await engine.evaluateGroupCondition('group1', steps, {
        variables: { feature: true },
        workflowState: {} as any,
        timestamp: Date.now(),
      });

      expect(result).toBe(true);
    });

    test('returns true on group evaluation error (fail-safe)', async () => {
      mockSandbox.evaluateCondition = mock(async () => {
        throw new Error('Evaluation failed');
      });
      mockVariableStore.getAll = mock(() => ({}));

      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Test step',
          groupId: 'group1',
          groupCondition: 'invalid condition',
        },
      ];

      const result = await engine.evaluateGroupCondition('group1', steps, {
        variables: {},
        workflowState: {} as any,
        timestamp: Date.now(),
      });

      expect(result).toBe(true); // Fail-safe behavior
    });
  });

  describe('invalidateCache', () => {
    test('clears cache', async () => {
      const evaluateConditionMock = mock(async () => true);
      mockSandbox.evaluateCondition = evaluateConditionMock;
      mockVariableStore.getAll = mock(() => ({ count: 15 }));

      const step: Step = {
        id: 'step1',
        title: 'Test step',
        condition: 'count > 10',
      };

      const context: ConditionalEvaluationContext = {
        variables: { count: 15 },
        workflowState: {} as any,
        timestamp: Date.now(),
      };

      // First evaluation
      await engine.evaluateStepCondition(step, context);
      expect(evaluateConditionMock).toHaveBeenCalledTimes(1);

      // Invalidate cache
      engine.invalidateCache();

      // Second evaluation should re-evaluate
      await engine.evaluateStepCondition(step, context);
      expect(evaluateConditionMock).toHaveBeenCalledTimes(2);
    });
  });

  describe('getCacheStats', () => {
    test('returns cache statistics', () => {
      const stats = engine.getCacheStats();
      expect(stats).toHaveProperty('size');
      expect(stats).toHaveProperty('hitRate');
      expect(typeof stats.size).toBe('number');
      expect(typeof stats.hitRate).toBe('number');
    });
  });
});

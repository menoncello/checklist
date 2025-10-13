/**
 * Unit tests for ConditionDebugger
 * Story 3.6: Conditional Workflow Branching (Task 6)
 */

import { describe, test, expect, beforeEach, mock, afterEach } from 'bun:test';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { ConditionDebugger } from '../../src/workflow/ConditionDebugger';
import type { VariableStore } from '../../src/variables/VariableStore';
import type { Step } from '../../src/workflow/types';

describe('ConditionDebugger', () => {
  let conditionDebugger: ConditionDebugger;
  let mockVariableStore: VariableStore;
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), 'debugger-test-'));

    mockVariableStore = {
      get: mock((name: string) => {
        const vars: Record<string, unknown> = {
          count: 15,
          status: 'active',
          enabled: true,
        };
        return vars[name];
      }),
    } as unknown as VariableStore;

    conditionDebugger = new ConditionDebugger(mockVariableStore);
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  describe('getConditionReport', () => {
    test('generates report for step without condition', () => {
      const step: Step = {
        id: 'step1',
        title: 'Test Step',
      };

      const report = conditionDebugger.getConditionReport(step);

      expect(report.stepId).toBe('step1');
      expect(report.stepTitle).toBe('Test Step');
      expect(report.condition).toBeUndefined();
      expect(report.result).toBe(true);
      expect(report.variablesUsed).toEqual({});
      expect(report.evaluationTime).toBe(0);
      expect(report.reason).toBe('No condition - always visible');
    });

    test('generates report for visible step with condition', () => {
      const step: Step = {
        id: 'step1',
        title: 'Test Step',
        condition: 'count > 10',
        conditionResult: true,
        conditionEvaluatedAt: Date.now() - 1000,
      };

      const report = conditionDebugger.getConditionReport(step);

      expect(report.stepId).toBe('step1');
      expect(report.condition).toBe('count > 10');
      expect(report.result).toBe(true);
      expect(report.variablesUsed).toHaveProperty('count');
      expect(report.variablesUsed.count).toBe(15);
      expect(report.evaluationTime).toBeGreaterThan(900);
      expect(report.reason).toContain('Condition evaluated to true');
    });

    test('generates report for hidden step with condition', () => {
      const step: Step = {
        id: 'step1',
        title: 'Test Step',
        condition: 'count > 20',
        conditionResult: false,
        conditionEvaluatedAt: Date.now() - 500,
      };

      const report = conditionDebugger.getConditionReport(step);

      expect(report.stepId).toBe('step1');
      expect(report.condition).toBe('count > 20');
      expect(report.result).toBe(false);
      expect(report.variablesUsed).toHaveProperty('count');
      expect(report.reason).toContain('Condition evaluated to false');
      expect(report.reason).toContain('step hidden');
      expect(report.reason).toContain('count=15');
    });

    test('extracts multiple variables from condition', () => {
      const step: Step = {
        id: 'step1',
        title: 'Test Step',
        condition: "count > 10 && status === 'active'",
        conditionResult: true,
        conditionEvaluatedAt: Date.now(),
      };

      const report = conditionDebugger.getConditionReport(step);

      expect(report.variablesUsed).toHaveProperty('count');
      expect(report.variablesUsed).toHaveProperty('status');
      expect(report.variablesUsed.count).toBe(15);
      expect(report.variablesUsed.status).toBe('active');
    });

    test('filters out JavaScript keywords from variables', () => {
      const step: Step = {
        id: 'step1',
        title: 'Test Step',
        condition: '!enabled && typeof count !== undefined',
        conditionResult: false,
        conditionEvaluatedAt: Date.now(),
      };

      const report = conditionDebugger.getConditionReport(step);

      expect(report.variablesUsed).toHaveProperty('enabled');
      expect(report.variablesUsed).toHaveProperty('count');
      expect(report.variablesUsed).not.toHaveProperty('typeof');
      expect(report.variablesUsed).not.toHaveProperty('undefined');
    });

    test('handles step with no evaluation timestamp', () => {
      const step: Step = {
        id: 'step1',
        title: 'Test Step',
        condition: 'count > 10',
        conditionResult: true,
      };

      const report = conditionDebugger.getConditionReport(step);

      expect(report.evaluationTime).toBe(0);
    });
  });

  describe('getAllConditionReports', () => {
    test('generates reports for multiple steps', () => {
      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Step 1',
        },
        {
          id: 'step2',
          title: 'Step 2',
          condition: 'count > 10',
          conditionResult: true,
          conditionEvaluatedAt: Date.now(),
        },
        {
          id: 'step3',
          title: 'Step 3',
          condition: 'count < 5',
          conditionResult: false,
          conditionEvaluatedAt: Date.now(),
        },
      ];

      const reports = conditionDebugger.getAllConditionReports(steps);

      expect(reports).toHaveLength(3);
      expect(reports[0]?.stepId).toBe('step1');
      expect(reports[1]?.stepId).toBe('step2');
      expect(reports[2]?.stepId).toBe('step3');
      expect(reports[0]?.result).toBe(true);
      expect(reports[1]?.result).toBe(true);
      expect(reports[2]?.result).toBe(false);
    });

    test('handles empty step list', () => {
      const reports = conditionDebugger.getAllConditionReports([]);
      expect(reports).toHaveLength(0);
    });
  });

  describe('exportDebugReport', () => {
    test('exports report to file', async () => {
      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Step 1',
          condition: 'count > 10',
          conditionResult: true,
          conditionEvaluatedAt: Date.now(),
        },
        {
          id: 'step2',
          title: 'Step 2',
          condition: 'enabled === true',
          conditionResult: true,
          conditionEvaluatedAt: Date.now(),
        },
      ];

      const filePath = join(tempDir, 'debug-report.md');
      await conditionDebugger.exportDebugReport(steps, filePath);

      const fileContent = await Bun.file(filePath).text();

      expect(fileContent).toContain('# Condition Debug Report');
      expect(fileContent).toContain('Step 1 (step1)');
      expect(fileContent).toContain('Step 2 (step2)');
      expect(fileContent).toContain('count > 10');
      expect(fileContent).toContain('enabled === true');
      expect(fileContent).toContain('✅ Visible');
    });

    test('includes variable values in exported report', async () => {
      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Test Step',
          condition: 'count > 10',
          conditionResult: true,
          conditionEvaluatedAt: Date.now(),
        },
      ];

      const filePath = join(tempDir, 'debug-report.md');
      await conditionDebugger.exportDebugReport(steps, filePath);

      const fileContent = await Bun.file(filePath).text();

      expect(fileContent).toContain('Variables Used');
      expect(fileContent).toContain('"count"');
      expect(fileContent).toContain('15');
    });

    test('shows visible and hidden counts in report', async () => {
      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Visible Step',
          condition: 'count > 10',
          conditionResult: true,
          conditionEvaluatedAt: Date.now(),
        },
        {
          id: 'step2',
          title: 'Hidden Step',
          condition: 'count < 5',
          conditionResult: false,
          conditionEvaluatedAt: Date.now(),
        },
        {
          id: 'step3',
          title: 'Another Visible Step',
        },
      ];

      const filePath = join(tempDir, 'debug-report.md');
      await conditionDebugger.exportDebugReport(steps, filePath);

      const fileContent = await Bun.file(filePath).text();

      expect(fileContent).toContain('Total Steps: 3');
      expect(fileContent).toContain('Visible Steps: 2');
      expect(fileContent).toContain('Hidden Steps: 1');
    });

    test('includes reason for visibility in report', async () => {
      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Hidden Step',
          condition: 'count > 20',
          conditionResult: false,
          conditionEvaluatedAt: Date.now(),
        },
      ];

      const filePath = join(tempDir, 'debug-report.md');
      await conditionDebugger.exportDebugReport(steps, filePath);

      const fileContent = await Bun.file(filePath).text();

      expect(fileContent).toContain('Reason');
      expect(fileContent).toContain('step hidden');
      expect(fileContent).toContain('count=15');
    });

    test('formats steps without conditions correctly', async () => {
      const steps: Step[] = [
        {
          id: 'step1',
          title: 'Simple Step',
        },
      ];

      const filePath = join(tempDir, 'debug-report.md');
      await conditionDebugger.exportDebugReport(steps, filePath);

      const fileContent = await Bun.file(filePath).text();

      expect(fileContent).toContain('Simple Step (step1)');
      expect(fileContent).toContain('**Condition:** None');
      expect(fileContent).toContain('No condition - always visible');
    });
  });
});

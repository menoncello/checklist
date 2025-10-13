/**
 * ConditionDebugger - Debug reporting for step condition evaluation
 * Story 3.6: Conditional Workflow Branching (Task 6)
 */

import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import type { ConditionDebugReport, Step } from './types';

const logger = createLogger('checklist:workflow:debugger');

/**
 * Debug tool for analyzing step condition evaluation results
 */
export class ConditionDebugger {
  constructor(private readonly variableStore: VariableStore) {}

  /**
   * Generate condition debug report for a single step
   */
  getConditionReport(step: Step): ConditionDebugReport {
    if (step.condition === undefined || step.condition === '') {
      return this.createReportForNoCondition(step);
    }

    const variablesUsed = this.extractVariablesUsed(step.condition);
    const variableValues = this.getVariableValues(variablesUsed);
    const reason = this.determineReason(step, variableValues);

    return {
      stepId: step.id,
      stepTitle: step.title,
      condition: step.condition,
      result: step.conditionResult ?? true,
      variablesUsed: variableValues,
      evaluationTime: this.calculateEvaluationTime(step),
      reason,
    };
  }

  /**
   * Generate debug reports for all steps
   */
  getAllConditionReports(steps: Step[]): ConditionDebugReport[] {
    logger.debug({
      msg: 'Generating condition reports',
      stepCount: steps.length,
    });
    return steps.map((step) => this.getConditionReport(step));
  }

  /**
   * Export debug report to file
   */
  async exportDebugReport(steps: Step[], filePath: string): Promise<void> {
    const reports = this.getAllConditionReports(steps);
    const reportText = this.formatReportAsText(reports);

    await Bun.write(filePath, reportText);

    logger.info({
      msg: 'Condition debug report exported',
      filePath,
      stepCount: steps.length,
    });
  }

  /**
   * Create report for step without condition
   */
  private createReportForNoCondition(step: Step): ConditionDebugReport {
    return {
      stepId: step.id,
      stepTitle: step.title,
      condition: undefined,
      result: true,
      variablesUsed: {},
      evaluationTime: 0,
      reason: 'No condition - always visible',
    };
  }

  /**
   * Extract variable names from condition expression
   */
  private extractVariablesUsed(condition: string): string[] {
    const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    const matches = condition.match(varPattern) ?? [];

    const keywords = new Set([
      'true',
      'false',
      'null',
      'undefined',
      'typeof',
      'instanceof',
    ]);

    return [...new Set(matches)].filter((v) => !keywords.has(v));
  }

  /**
   * Get variable values for the given variable names
   */
  private getVariableValues(variableNames: string[]): Record<string, unknown> {
    const values: Record<string, unknown> = {};
    for (const varName of variableNames) {
      values[varName] = this.variableStore.get(varName);
    }
    return values;
  }

  /**
   * Calculate time since evaluation
   */
  private calculateEvaluationTime(step: Step): number {
    if (step.conditionEvaluatedAt === undefined) {
      return 0;
    }
    return Date.now() - step.conditionEvaluatedAt;
  }

  /**
   * Determine human-readable reason for visibility
   */
  private determineReason(
    step: Step,
    variableValues: Record<string, unknown>
  ): string {
    const result = step.conditionResult ?? true;

    if (result) {
      return 'Condition evaluated to true - step visible';
    }

    const varDetails = Object.entries(variableValues)
      .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
      .join(', ');

    return `Condition evaluated to false - step hidden. Variables: ${varDetails}`;
  }

  /**
   * Format reports as text for export
   */
  private formatReportAsText(reports: ConditionDebugReport[]): string {
    let text = '# Condition Debug Report\n\n';
    text += `Generated: ${new Date().toISOString()}\n`;
    text += `Total Steps: ${reports.length}\n\n`;

    const visibleCount = reports.filter((r) => r.result).length;
    const hiddenCount = reports.length - visibleCount;
    text += `Visible Steps: ${visibleCount}\n`;
    text += `Hidden Steps: ${hiddenCount}\n\n`;
    text += '---\n\n';

    for (const report of reports) {
      text += this.formatSingleReport(report);
    }

    return text;
  }

  /**
   * Format a single report as text
   */
  private formatSingleReport(report: ConditionDebugReport): string {
    let text = `## Step: ${report.stepTitle} (${report.stepId})\n\n`;
    text += `**Condition:** ${report.condition ?? 'None'}\n\n`;
    text += `**Result:** ${report.result ? '✅ Visible' : '❌ Hidden'}\n\n`;

    if (Object.keys(report.variablesUsed).length > 0) {
      text += `**Variables Used:**\n\`\`\`json\n${JSON.stringify(report.variablesUsed, null, 2)}\n\`\`\`\n\n`;
    }

    text += `**Reason:** ${report.reason}\n\n`;
    text += `**Evaluation Time:** ${report.evaluationTime}ms ago\n\n`;
    text += '---\n\n';

    return text;
  }
}

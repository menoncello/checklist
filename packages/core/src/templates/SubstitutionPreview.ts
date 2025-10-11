/**
 * Variable Substitution System - Preview Functionality
 * Generates before/after previews with variable highlighting
 */

import { createLogger } from '../utils/logger';
import type { VariableStore } from '../variables/VariableStore';
import type { VariableSubstitutor } from './VariableSubstitutor';
import type {
  SubstitutionPreview as PreviewResult,
  VariablePreview,
  VariablePosition,
} from './substitution-types';

const logger = createLogger('checklist:templates:preview');

/**
 * Generates substitution previews with highlighting
 */
export class SubstitutionPreview {
  constructor(
    private readonly substitutor: VariableSubstitutor,
    private readonly variableStore: VariableStore
  ) {}

  /**
   * Generate preview of variable substitution
   */
  generatePreview(template: string, stepId?: string): PreviewResult {
    const startTime = performance.now();

    try {
      // Perform substitution
      const result = this.substitutor.substitute(template, stepId);

      // Extract variable positions
      const variables = this.extractVariablePositions(
        template,
        result.variablesUsed,
        stepId
      );

      const duration = performance.now() - startTime;

      logger.debug({
        msg: 'Preview generated',
        duration,
        variableCount: variables.length,
      });

      return {
        original: template,
        substituted: result.output,
        variables,
      };
    } catch (error) {
      logger.error({
        msg: 'Preview generation failed',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Extract variable positions from template
   */
  private extractVariablePositions(
    template: string,
    variableNames: string[],
    stepId?: string
  ): VariablePreview[] {
    const previews: VariablePreview[] = [];
    const pattern = /\$\{([a-zA-Z0-9_.-]+)(?::-(.*?))?\}/g;

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(template)) !== null) {
      const varName = match[1];
      if (variableNames.includes(varName)) {
        const value = this.variableStore.get(varName, stepId);
        const position: VariablePosition = {
          start: match.index,
          end: match.index + match[0].length,
        };

        previews.push({
          name: varName,
          value: value ?? '<undefined>',
          position,
          highlighted: true,
        });
      }
    }

    return previews;
  }

  /**
   * Format preview for terminal display
   */
  formatForTerminal(preview: PreviewResult): string {
    let output = 'Original:\n';
    output += `  ${preview.original}\n\n`;
    output += 'Substituted:\n';
    output += `  ${preview.substituted}\n\n`;
    output += 'Variables:\n';

    for (const variable of preview.variables) {
      output += `  ${variable.name} = ${this.formatValue(variable.value)}\n`;
    }

    return output;
  }

  /**
   * Format variable value for display
   */
  private formatValue(value: unknown): string {
    if (typeof value === 'string') return `"${value}"`;
    if (typeof value === 'number') return value.toString();
    if (typeof value === 'boolean') return value.toString();
    if (Array.isArray(value)) {
      return `[${value.map((v) => this.formatValue(v)).join(', ')}]`;
    }
    return String(value);
  }
}

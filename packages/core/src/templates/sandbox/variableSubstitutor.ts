/**
 * Variable substitution logic for template expressions
 * Handles safe substitution and sanitization of variable values
 */

/**
 * Substitute variables in template string
 * Replaces ${varName} patterns with actual variable values
 *
 * @param template - Template string with variable placeholders
 * @param variables - Variable values to substitute
 * @returns Template with variables substituted
 */
export function substituteVariables(
  template: string,
  variables: Record<string, unknown>
): string {
  const varPattern = /\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;

  return template.replace(varPattern, (match, varName) => {
    const value = variables[varName];
    if (value === undefined) {
      return match; // Keep original if variable not found
    }

    // Sanitize the value to prevent command injection
    return sanitizeValue(String(value));
  });
}

/**
 * Substitute variables in condition expression
 * Converts variable references to their actual values for evaluation
 *
 * @param condition - Condition expression
 * @param context - Variable context
 * @returns Condition with variables substituted
 */
export function substituteVariablesInCondition(
  condition: string,
  context: Record<string, unknown>
): string {
  const varPattern = /\b([a-zA-Z_][a-zA-Z0-9_]*)\b/g;

  return condition.replace(varPattern, (match) => {
    const value = context[match];
    if (value === undefined) {
      return match;
    }

    if (typeof value === 'string') {
      return `'${value.replace(/'/g, "\\'")}'`;
    }
    if (typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }

    return match;
  });
}

/**
 * Sanitize value for safe substitution
 * Removes shell metacharacters that could be dangerous
 *
 * @param value - Value to sanitize
 * @returns Sanitized value
 */
export function sanitizeValue(value: string): string {
  // Remove shell metacharacters
  const dangerous = /[;|&$(){}[\]<>`\\]/g;
  return value.replace(dangerous, '');
}

/**
 * Check if a condition is a simple variable reference
 * Returns the variable name if it's a simple ${varName} pattern
 *
 * @param condition - Condition string to check
 * @returns Variable name if simple reference, null otherwise
 */
export function getSimpleVariableReference(condition: string): string | null {
  const simpleVarPattern = /^\$\{([a-zA-Z_][a-zA-Z0-9_]*)\}$/;
  const match = condition.trim().match(simpleVarPattern);
  return match !== null ? match[1] : null;
}

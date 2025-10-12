/**
 * Boolean Expression Evaluator - Evaluates boolean expressions with comparison and logical operators
 */

/**
 * Evaluates boolean expressions
 */
export class BooleanExpressionEvaluator {
  /**
   * Evaluate boolean expression with comparison and logical operators
   */
  evaluate(expression: string): boolean {
    if (expression.trim().startsWith('!')) {
      return this.handleNegation(expression);
    }

    if (expression.includes('||')) {
      return this.handleLogicalOr(expression);
    }

    if (expression.includes('&&')) {
      return this.handleLogicalAnd(expression);
    }

    const comparisonResult = this.handleComparison(expression);
    if (comparisonResult !== null) return comparisonResult;

    return this.evaluateLiteral(expression);
  }

  /**
   * Handle negation
   */
  private handleNegation(expression: string): boolean {
    const inner = expression.trim().slice(1).trim();
    return !this.evaluate(inner);
  }

  /**
   * Handle logical OR
   */
  private handleLogicalOr(expression: string): boolean {
    const parts = expression.split('||');
    return parts.some((part) => this.evaluate(part.trim()));
  }

  /**
   * Handle logical AND
   */
  private handleLogicalAnd(expression: string): boolean {
    const parts = expression.split('&&');
    return parts.every((part) => this.evaluate(part.trim()));
  }

  /**
   * Handle comparison
   */
  private handleComparison(expression: string): boolean | null {
    const comparisonOps = ['==', '!=', '>=', '<=', '>', '<'];
    for (const op of comparisonOps) {
      if (expression.includes(op)) {
        const parts = expression.split(op).map((p) => p.trim());
        if (parts.length === 2) {
          return this.compareValues(parts[0], parts[1], op);
        }
      }
    }
    return null;
  }

  /**
   * Evaluate literal
   */
  private evaluateLiteral(expression: string): boolean {
    if (expression === 'true') return true;
    if (expression === 'false') return false;

    const num = Number(expression);
    if (!isNaN(num)) {
      return num !== 0;
    }

    const strMatch = expression.match(/^'(.*)'$/);
    if (strMatch !== null) {
      return strMatch[1].length > 0;
    }

    return false;
  }

  /**
   * Compare two values using the specified operator
   */
  private compareValues(
    left: string,
    right: string,
    operator: string
  ): boolean {
    const leftVal = this.parseValue(left);
    const rightVal = this.parseValue(right);

    switch (operator) {
      case '==':
        return leftVal === rightVal;
      case '!=':
        return leftVal !== rightVal;
      case '>':
        return Number(leftVal) > Number(rightVal);
      case '<':
        return Number(leftVal) < Number(rightVal);
      case '>=':
        return Number(leftVal) >= Number(rightVal);
      case '<=':
        return Number(leftVal) <= Number(rightVal);
      default:
        return false;
    }
  }

  /**
   * Parse value from string
   */
  private parseValue(value: string): string | number | boolean {
    if (value === 'true') return true;
    if (value === 'false') return false;

    const strMatch = value.match(/^'(.*)'$/);
    if (strMatch !== null) {
      return strMatch[1];
    }

    const num = Number(value);
    if (!isNaN(num)) {
      return num;
    }

    return value;
  }
}

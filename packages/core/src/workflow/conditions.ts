export function safeEval(
  condition: string,
  context: Record<string, unknown>
): boolean {
  // Parse and evaluate conditions without eval
  // Support patterns: ${var} === value, ${var} > value, && , ||, !, etc.

  // First, replace ${variable} references with actual JSON values
  const processedCondition = condition.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const trimmedKey = key.trim();
    const value = context[trimmedKey];

    // Convert to JSON for safe embedding
    if (value === undefined) return 'undefined';
    if (value === null) return 'null';
    if (typeof value === 'string') return JSON.stringify(value);
    if (typeof value === 'boolean') return String(value);
    if (typeof value === 'number') return String(value);
    return JSON.stringify(value);
  });

  // Evaluate the processed condition using a safe parser
  return evaluateExpression(processedCondition);
}

// Safe expression evaluator that handles logical operators
function evaluateExpression(expr: string): boolean {
  expr = expr.trim();

  // Handle logical OR (||)
  const orParts = splitByOperator(expr, '||');
  if (orParts.length > 1) {
    return orParts.some((part) => evaluateExpression(part));
  }

  // Handle logical AND (&&)
  const andParts = splitByOperator(expr, '&&');
  if (andParts.length > 1) {
    return andParts.every((part) => evaluateExpression(part));
  }

  // Handle NOT (!)
  if (expr.startsWith('!')) {
    return !evaluateExpression(expr.substring(1));
  }

  // Handle parentheses
  if (expr.startsWith('(') && expr.endsWith(')')) {
    return evaluateExpression(expr.slice(1, -1));
  }

  // Handle comparison operators
  const comparisonRegex = /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/;
  const match = expr.match(comparisonRegex);

  if (match) {
    const [, left, operator, right] = match;
    const leftValue = parseValue(left.trim());
    const rightValue = parseValue(right.trim());

    switch (operator) {
      case '===':
      case '==':
        return leftValue === rightValue;
      case '!==':
      case '!=':
        return leftValue !== rightValue;
      case '>':
        return Number(leftValue) > Number(rightValue);
      case '>=':
        return Number(leftValue) >= Number(rightValue);
      case '<':
        return Number(leftValue) < Number(rightValue);
      case '<=':
        return Number(leftValue) <= Number(rightValue);
      default:
        return false;
    }
  }

  // Handle boolean values and variables
  const value = parseValue(expr);

  // Check if this looks like a valid parsed value (not random text)
  // Valid values: JSON strings, numbers, booleans, null, undefined
  const jsonStringRegex = /^".*"$/;
  const numberRegex = /^-?\d+(\.\d+)?$/;
  const booleanRegex = /^(true|false)$/;
  const nullishRegex = /^(null|undefined)$/;

  if (
    jsonStringRegex.test(expr) ||
    numberRegex.test(expr) ||
    booleanRegex.test(expr) ||
    nullishRegex.test(expr)
  ) {
    // Apply JavaScript truthiness rules to parsed values
    return Boolean(value);
  }

  // Unknown/unparseable expressions default to false for safety
  return false;
}

// Split expression by operator, respecting parentheses
function splitByOperator(expr: string, operator: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  let i = 0;

  while (i < expr.length) {
    if (expr[i] === '(') {
      depth++;
      current += expr[i];
    } else if (expr[i] === ')') {
      depth--;
      current += expr[i];
    } else if (
      depth === 0 &&
      expr.substring(i, i + operator.length) === operator
    ) {
      parts.push(current);
      current = '';
      i += operator.length - 1;
    } else {
      current += expr[i];
    }
    i++;
  }

  if (current) {
    parts.push(current);
  }

  return parts.length > 0 ? parts : [expr];
}

// Parse a value from string representation
function parseValue(str: string): unknown {
  str = str.trim();

  // Handle string literals
  if (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  ) {
    return str.slice(1, -1);
  }

  // Handle boolean literals
  if (str === 'true') return true;
  if (str === 'false') return false;

  // Handle null and undefined
  if (str === 'null') return null;
  if (str === 'undefined') return undefined;

  // Handle numbers
  const num = Number(str);
  if (!isNaN(num) && str !== '') return num;

  // Default to string
  return str;
}

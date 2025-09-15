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

  // Handle logical operators
  const logicalResult = evaluateLogicalOperators(expr);
  if (logicalResult !== null) return logicalResult;

  // Handle unary operators
  const unaryResult = evaluateUnaryOperators(expr);
  if (unaryResult !== null) return unaryResult;

  // Handle comparison operators
  const comparisonResult = evaluateComparisonOperators(expr);
  if (comparisonResult !== null) return comparisonResult;

  // Handle boolean values and variables
  return evaluateValue(expr);
}

function evaluateLogicalOperators(expr: string): boolean | null {
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

  return null;
}

function evaluateUnaryOperators(expr: string): boolean | null {
  // Handle NOT (!)
  if (expr.startsWith('!')) {
    return !evaluateExpression(expr.substring(1));
  }

  // Handle parentheses
  if (expr.startsWith('(') && expr.endsWith(')')) {
    return evaluateExpression(expr.slice(1, -1));
  }

  return null;
}

function evaluateComparisonOperators(expr: string): boolean | null {
  const comparisonRegex = /^(.+?)\s*(===|!==|==|!=|>=|<=|>|<)\s*(.+)$/;
  const match = expr.match(comparisonRegex);

  if (!match) return null;

  const [, left, operator, right] = match;
  const leftValue = parseValue(left.trim());
  const rightValue = parseValue(right.trim());

  return executeComparison(leftValue, operator, rightValue);
}

function executeComparison(
  leftValue: unknown,
  operator: string,
  rightValue: unknown
): boolean {
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

function evaluateValue(expr: string): boolean {
  const value = parseValue(expr);

  if (isValidValue(expr)) {
    // Apply JavaScript truthiness rules to parsed values
    return Boolean(value);
  }

  // Unknown/unparseable expressions default to false for safety
  return false;
}

function isValidValue(expr: string): boolean {
  const jsonStringRegex = /^".*"$/;
  const numberRegex = /^-?\d+(\.\d+)?$/;
  const booleanRegex = /^(true|false)$/;
  const nullishRegex = /^(null|undefined)$/;

  return (
    jsonStringRegex.test(expr) ||
    numberRegex.test(expr) ||
    booleanRegex.test(expr) ||
    nullishRegex.test(expr)
  );
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

// Helper functions to reduce complexity
function isStringLiteral(str: string): boolean {
  return (
    (str.startsWith('"') && str.endsWith('"')) ||
    (str.startsWith("'") && str.endsWith("'"))
  );
}

function parseStringLiteral(str: string): string {
  return str.slice(1, -1);
}

function parsePrimitives(str: string): unknown {
  if (str === 'true') return true;
  if (str === 'false') return false;
  if (str === 'null') return null;
  if (str === 'undefined') return undefined;
  return undefined; // Not a primitive
}

function parseNumber(str: string): number | undefined {
  const num = Number(str);
  return !isNaN(num) && str !== '' ? num : undefined;
}

// Parse a value from string representation
function parseValue(str: string): unknown {
  str = str.trim();

  if (isStringLiteral(str)) {
    return parseStringLiteral(str);
  }

  const primitive = parsePrimitives(str);
  if (primitive !== undefined) {
    return primitive;
  }

  const number = parseNumber(str);
  if (number !== undefined) {
    return number;
  }

  return str;
}

# Story 3.3: Conditional Logic Engine

## Overview

Build a conditional logic engine that enables branching workflows, conditional steps, loops, and dynamic checklist behavior based on variable values and state.

## Story Details

- **Epic**: 3 - Template System & Security
- **Type**: Feature
- **Priority**: High
- **Estimated Effort**: 2 days
- **Dependencies**: [3.1, 3.2]

## Description

Implement a logic engine that allows templates to include conditional statements, loops, and branching logic. This enables dynamic checklists that adapt based on user input and progress.

## Acceptance Criteria

- [ ] If/else conditions in templates
- [ ] Skip steps based on conditions
- [ ] Show/hide sections dynamically
- [ ] Loop constructs for repetitive tasks
- [ ] Switch/case statements for multiple branches
- [ ] Condition evaluation with multiple operators
- [ ] Nested conditions support
- [ ] Early exit conditions
- [ ] Conditional includes of template sections
- [ ] Runtime condition re-evaluation

## Technical Requirements

### Logic Engine Architecture

```typescript
interface LogicEngine {
  // Condition Evaluation
  evaluate(expression: string, context: Context): boolean
  evaluateComplex(ast: ExpressionAST, context: Context): any

  // Control Flow
  processConditional(item: ConditionalItem, context: Context): Item[]
  processLoop(loop: LoopConstruct, context: Context): Item[]
  processSwitch(switch: SwitchConstruct, context: Context): Item[]

  // Dynamic Updates
  reevaluateConditions(template: Template, context: Context): Template
  getDependentItems(expression: string): string[]
}

interface ConditionalItem {
  when?: Expression      // Show when true
  unless?: Expression    // Hide when true
  if?: IfConstruct      // If/else branching
  loop?: LoopConstruct  // Repetition
  switch?: SwitchConstruct // Multiple branches
}

interface Expression {
  raw: string
  ast?: ExpressionAST
  variables: string[]  // Variables referenced
}
```

### Conditional Constructs

#### If/Else Conditions

```yaml
items:
  - id: deployment-prep
    title: Prepare for deployment
    when: "environment == 'production'"

  - id: deploy-check
    if:
      condition: "environment == 'production' && approved"
      then:
        - id: prod-deploy
          title: Deploy to production
      else:
        - id: staging-deploy
          title: Deploy to staging
```

#### Loop Constructs

```yaml
items:
  - id: review-features
    loop:
      over: selectedFeatures
      as: feature
      items:
        - id: 'review-{{feature.id}}'
          title: 'Review {{feature.name}}'
          description: 'Review implementation of {{feature.description}}'
```

#### Switch Statements

```yaml
items:
  - id: environment-setup
    switch:
      on: environment
      cases:
        development:
          - id: setup-dev
            title: Setup development environment
        staging:
          - id: setup-staging
            title: Setup staging environment
        production:
          - id: setup-prod
            title: Setup production environment
          - id: security-check
            title: Run security audit
      default:
        - id: setup-local
          title: Setup local environment
```

### Expression Language

```typescript
// Supported operators
const OPERATORS = {
  // Comparison
  '==': (a, b) => a === b,
  '!=': (a, b) => a !== b,
  '<': (a, b) => a < b,
  '>': (a, b) => a > b,
  '<=': (a, b) => a <= b,
  '>=': (a, b) => a >= b,

  // Logical
  '&&': (a, b) => a && b,
  '||': (a, b) => a || b,
  '!': (a) => !a,

  // String
  contains: (str, substr) => str.includes(substr),
  startsWith: (str, prefix) => str.startsWith(prefix),
  endsWith: (str, suffix) => str.endsWith(suffix),
  matches: (str, pattern) => new RegExp(pattern).test(str),

  // Array
  in: (value, array) => array.includes(value),
  any: (array, condition) => array.some(condition),
  all: (array, condition) => array.every(condition),

  // Existence
  exists: (value) => value !== undefined && value !== null,
  empty: (value) => !value || value.length === 0,
};
```

### Expression Parser

```typescript
class ExpressionParser {
  parse(expression: string): ExpressionAST {
    // Tokenize
    const tokens = this.tokenize(expression);

    // Parse to AST
    const ast = this.buildAST(tokens);

    // Validate
    this.validate(ast);

    // Extract variables
    const variables = this.extractVariables(ast);

    return { ast, variables };
  }

  evaluate(ast: ExpressionAST, context: Context): any {
    switch (ast.type) {
      case 'literal':
        return ast.value;

      case 'variable':
        return this.resolveVariable(ast.name, context);

      case 'binary':
        const left = this.evaluate(ast.left, context);
        const right = this.evaluate(ast.right, context);
        return OPERATORS[ast.operator](left, right);

      case 'unary':
        const operand = this.evaluate(ast.operand, context);
        return OPERATORS[ast.operator](operand);

      case 'function':
        return this.callFunction(ast.name, ast.args, context);
    }
  }
}
```

### Dynamic Re-evaluation

```typescript
class DynamicEvaluation {
  constructor(private engine: LogicEngine) {
    // Watch for variable changes
    this.context.on('change', (variable) => {
      this.reevaluateDependent(variable);
    });
  }

  reevaluateDependent(variable: string) {
    // Find items dependent on this variable
    const dependent = this.template.items.filter(item =>
      item.condition?.variables.includes(variable)\n    );

    // Re-evaluate their conditions
    dependent.forEach(item => {
      const wasVisible = item.visible;
      item.visible = this.engine.evaluate(item.when, this.context);

      if (wasVisible !== item.visible) {
        this.emit('visibility-changed', item);
      }
    });
  }
}
```

## Testing Requirements

- [ ] Unit tests for expression parser
- [ ] Evaluation tests for all operators
- [ ] If/else condition tests
- [ ] Loop construct tests
- [ ] Switch statement tests
- [ ] Nested condition tests
- [ ] Dynamic re-evaluation tests
- [ ] Performance tests with complex logic
- [ ] Edge case tests (null, undefined, empty)

## Performance Requirements

- Simple expression evaluation: <1ms
- Complex expression (10+ operators): <5ms
- Re-evaluation on change: <10ms
- Loop processing (100 items): <50ms

## Security Considerations

- No arbitrary code execution
- Prevent infinite loops
- Resource limits on evaluation
- Safe variable access only

## Definition of Done

- [ ] Expression parser complete
- [ ] All operators implemented
- [ ] If/else conditions working
- [ ] Loop constructs functional
- [ ] Switch statements working
- [ ] Dynamic re-evaluation implemented
- [ ] Performance targets met
- [ ] Tests passing with >90% coverage
- [ ] Security review completed

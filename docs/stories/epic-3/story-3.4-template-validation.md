# Story 3.4: Template Validation

## Overview
Implement comprehensive template validation to ensure template structure, security, and correctness before execution, detecting circular dependencies and validating against schema.

## Story Details
- **Epic**: 3 - Template System & Security  
- **Type**: Feature
- **Priority**: High
- **Estimated Effort**: 1 day
- **Dependencies**: [3.1]

## Description
Create a validation system that checks templates for structural correctness, security issues, circular dependencies, and schema compliance. This ensures templates are safe and functional before use.

## Acceptance Criteria
- [ ] Schema validation for template structure
- [ ] Detect circular dependencies between items
- [ ] Validate variable references exist
- [ ] Check expression syntax validity
- [ ] Identify security risks in templates
- [ ] Validate command safety
- [ ] Check for unreachable items
- [ ] Validate template inheritance chain
- [ ] Performance analysis for complex templates
- [ ] Generate detailed validation reports

## Technical Requirements

### Validation Architecture
```typescript
interface TemplateValidator {
  // Main validation
  validate(template: Template): ValidationResult
  validateAgainstSchema(template: Template, schema: Schema): SchemaResult
  
  // Specific validations
  validateDependencies(template: Template): DependencyResult
  validateVariables(template: Template): VariableResult
  validateExpressions(template: Template): ExpressionResult
  validateSecurity(template: Template): SecurityResult
  
  // Analysis
  analyzeComplexity(template: Template): ComplexityReport
  findUnreachableItems(template: Template): string[]
  suggestOptimizations(template: Template): Optimization[]
}

interface ValidationResult {
  valid: boolean
  errors: ValidationError[]
  warnings: ValidationWarning[]
  info: ValidationInfo[]
  summary: ValidationSummary
}

interface ValidationError {
  severity: 'error' | 'critical'
  code: string
  message: string
  location?: {
    file?: string
    line?: number
    column?: number
    path?: string  // JSON path to element
  }
  suggestion?: string
}
```

### Validation Rules

#### Schema Validation
```typescript
const templateSchema = {
  type: 'object',
  required: ['template', 'items'],
  properties: {
    template: {
      type: 'object',
      required: ['id', 'name', 'version'],
      properties: {
        id: { type: 'string', pattern: '^[a-z0-9-]+$' },
        name: { type: 'string', minLength: 1 },
        version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' }
      }
    },
    variables: {
      type: 'array',
      items: { $ref: '#/definitions/variable' }
    },
    items: {
      type: 'array',
      items: { $ref: '#/definitions/item' },
      minItems: 1
    }
  }
};
```

#### Dependency Validation
```typescript
class DependencyValidator {
  validateDependencies(template: Template): DependencyResult {
    const graph = this.buildDependencyGraph(template);
    const errors: ValidationError[] = [];
    
    // Check for cycles
    const cycles = this.detectCycles(graph);
    if (cycles.length > 0) {
      cycles.forEach(cycle => {
        errors.push({
          severity: 'error',
          code: 'CIRCULAR_DEPENDENCY',
          message: `Circular dependency detected: ${cycle.join(' → ')}`,
          suggestion: 'Remove one of the dependencies to break the cycle'
        });
      });
    }
    
    // Check for missing dependencies
    const missing = this.findMissingDependencies(graph);
    missing.forEach(dep => {
      errors.push({
        severity: 'error',
        code: 'MISSING_DEPENDENCY',
        message: `Item '${dep.from}' depends on non-existent item '${dep.to}'`,
        location: { path: `items.${dep.from}.dependsOn` }
      });
    });
    
    // Check for unreachable items
    const unreachable = this.findUnreachableItems(graph);
    if (unreachable.length > 0) {
      errors.push({
        severity: 'warning',
        code: 'UNREACHABLE_ITEMS',
        message: `Items can never be reached: ${unreachable.join(', ')}`,
        suggestion: 'Review conditional logic and dependencies'
      });
    }
    
    return { valid: errors.length === 0, errors };
  }
}
```

#### Security Validation
```typescript
class SecurityValidator {
  validateSecurity(template: Template): SecurityResult {
    const risks: SecurityRisk[] = [];
    
    // Check for dangerous commands
    this.checkCommands(template, risks);
    
    // Check for path traversal
    this.checkPathTraversal(template, risks);
    
    // Check for injection vulnerabilities
    this.checkInjection(template, risks);
    
    // Check for resource exhaustion
    this.checkResourceLimits(template, risks);
    
    return {
      safe: risks.filter(r => r.severity === 'high').length === 0,
      risks
    };
  }
  
  private checkCommands(template: Template, risks: SecurityRisk[]) {
    const dangerousCommands = ['rm', 'eval', 'exec', 'sudo'];
    
    template.items.forEach(item => {
      item.commands?.forEach(cmd => {
        dangerousCommands.forEach(dangerous => {
          if (cmd.includes(dangerous)) {
            risks.push({
              severity: 'high',
              type: 'dangerous_command',
              message: `Potentially dangerous command: ${dangerous}`,
              location: { path: `items.${item.id}.commands` },
              mitigation: 'Consider using safer alternatives'
            });
          }
        });
      });
    });
  }
}
```

### Validation Report
```
Template Validation Report
══════════════════════════

Template: sprint-planning v1.0.0
Status: ❌ INVALID (3 errors, 2 warnings)

ERRORS:
───────
1. CIRCULAR_DEPENDENCY (Line 45)
   Circular dependency: task-a → task-b → task-c → task-a
   Suggestion: Remove dependency from task-c to task-a

2. UNDEFINED_VARIABLE (Line 23)
   Variable 'teamName' is not defined
   Suggestion: Add variable definition or check spelling

3. INVALID_EXPRESSION (Line 67)
   Invalid expression syntax: "teamSize >> 5"
   Suggestion: Did you mean "teamSize > 5"?

WARNINGS:
─────────
1. UNREACHABLE_ITEM (Line 89)
   Item 'cleanup' can never be reached due to conditions
   
2. PERFORMANCE (Complexity)
   Template complexity score: 8.5/10 (High)
   Consider simplifying conditional logic

INFO:
─────
• 25 items validated
• 8 variables defined
• 3 external dependencies
• Estimated completion time: 45-60 minutes

Validation completed in 23ms
```

## Testing Requirements
- [ ] Schema validation tests
- [ ] Circular dependency detection tests
- [ ] Variable reference validation tests
- [ ] Expression validation tests
- [ ] Security validation tests
- [ ] Performance analysis tests
- [ ] Complex template tests
- [ ] Error message quality tests

## Performance Requirements
- Validation of small template (<50 items): <50ms
- Validation of large template (500+ items): <200ms
- Dependency graph analysis: <100ms
- Security scanning: <50ms

## Definition of Done
- [ ] Schema validation implemented
- [ ] Dependency validation complete
- [ ] Variable validation working
- [ ] Expression validation functional
- [ ] Security validation comprehensive
- [ ] Validation reports generated
- [ ] Performance targets met
- [ ] Tests passing with >90% coverage
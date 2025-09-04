# Story 3.2: Variable System

## Overview
Implement a comprehensive variable system that supports template variables, runtime substitution, environment variables, and validation with defaults.

## Story Details
- **Epic**: 3 - Template System & Security
- **Type**: Feature
- **Priority**: High
- **Estimated Effort**: 1 day
- **Dependencies**: [3.1]

## Description
Create a flexible variable system that allows templates to define variables, collect user input, perform runtime substitution, and access environment variables. This system enables dynamic and reusable templates.

## Acceptance Criteria
- [ ] Define variables in templates with types and constraints
- [ ] Runtime variable substitution in text
- [ ] Environment variable access and override
- [ ] Variable validation with type checking
- [ ] Default values and computed defaults
- [ ] Variable scoping (global, section, item)
- [ ] Variable interpolation in strings
- [ ] Array and object variable support
- [ ] Conditional variables based on other values
- [ ] Variable prompting UI for user input

## Technical Requirements

### Variable System Architecture
```typescript
interface VariableSystem {
  // Variable Management
  defineVariable(variable: VariableDefinition): void
  setVariable(name: string, value: any): void
  getVariable(name: string): any
  
  // Substitution
  substitute(text: string, context?: VariableContext): string
  evaluate(expression: string, context?: VariableContext): any
  
  // Validation
  validate(name: string, value: any): ValidationResult
  validateAll(): ValidationResult[]
  
  // User Input
  promptForVariables(required: VariableDefinition[]): Promise<VariableValues>
  
  // Environment
  loadEnvironmentVariables(prefix?: string): void
  exportVariables(): Record<string, any>
}

interface VariableDefinition {
  name: string
  type: VariableType
  description?: string
  
  // Validation
  required?: boolean
  pattern?: string  // Regex for strings
  min?: number
  max?: number
  enum?: any[]  // Allowed values
  
  // Defaults
  default?: any
  computed?: string  // Expression to compute default
  
  // UI
  prompt?: string
  hidden?: boolean  // For sensitive values
  multiline?: boolean
  
  // Conditions
  when?: string  // Expression for conditional variables
}

type VariableType = 
  | 'string' 
  | 'number' 
  | 'boolean' 
  | 'array' 
  | 'object'
  | 'date'
  | 'enum'
  | 'file'
  | 'url';
```

### Variable Definition Examples

```yaml
variables:
  # Simple string variable
  - name: projectName
    type: string
    required: true
    prompt: "Enter project name"
    pattern: "^[a-z0-9-]+$"
    
  # Number with range
  - name: teamSize
    type: number
    default: 5
    min: 1
    max: 20
    prompt: "Team size (1-20)"
    
  # Enum selection
  - name: environment
    type: enum
    enum: [development, staging, production]
    default: development
    
  # Computed default
  - name: sprintEndDate
    type: date
    computed: "startDate + 14 days"
    
  # Conditional variable
  - name: deploymentTarget
    type: string
    when: "environment == 'production'"
    prompt: "Production deployment target"
    
  # Array variable
  - name: selectedFeatures
    type: array
    prompt: "Select features to include"
    
  # Object variable
  - name: config
    type: object
    default:
      debug: false
      port: 3000
```

### Variable Substitution

```typescript
class VariableSubstitution {
  substitute(text: string, variables: VariableValues): string {
    // Handle different substitution patterns
    return text
      // Handlebars-style: {{variable}}
      .replace(/{{\s*(\w+)\s*}}/g, (_, name) => 
        this.getValue(name, variables))
      
      // Bash-style: ${variable}
      .replace(/\${(\w+)}/g, (_, name) => 
        this.getValue(name, variables))
      
      // Expression evaluation: {{expression}}
      .replace(/{{\s*([^}]+)\s*}}/g, (_, expr) => 
        this.evaluateExpression(expr, variables));
  }
  
  evaluateExpression(expr: string, variables: VariableValues): any {
    // Safe expression evaluation
    const context = {
      ...variables,
      // Built-in functions
      now: () => new Date(),
      env: (key: string) => process.env[key],
      uppercase: (str: string) => str.toUpperCase(),
      lowercase: (str: string) => str.toLowerCase(),
    };
    
    // Use safe evaluator (e.g., expr-eval)
    return evaluate(expr, context);
  }
}
```

### Variable Prompting UI

```typescript
class VariablePrompter {
  async promptForVariables(
    definitions: VariableDefinition[]
  ): Promise<VariableValues> {
    const values: VariableValues = {};
    
    for (const def of definitions) {
      // Skip if condition not met
      if (def.when && !this.evaluateCondition(def.when, values)) {
        continue;
      }
      
      // Get value from user
      const value = await this.promptSingle(def, values);
      
      // Validate
      const validation = this.validate(def, value);
      if (!validation.valid) {
        console.error(validation.message);
        // Retry...
      }
      
      values[def.name] = value;
    }
    
    return values;
  }
  
  private async promptSingle(
    def: VariableDefinition,
    context: VariableValues
  ): Promise<any> {
    // Calculate default
    const defaultValue = def.computed
      ? this.evaluateExpression(def.computed, context)
      : def.default;
    
    // Show appropriate prompt based on type
    switch (def.type) {
      case 'enum':
        return this.selectPrompt(def.prompt, def.enum!, defaultValue);
      case 'boolean':
        return this.confirmPrompt(def.prompt, defaultValue);
      case 'number':
        return this.numberPrompt(def.prompt, defaultValue, def.min, def.max);
      default:
        return this.textPrompt(def.prompt, defaultValue, def.hidden);
    }
  }
}
```

### Environment Variable Integration

```typescript
// Load environment variables with prefix
variableSystem.loadEnvironmentVariables('CHECKLIST_');

// Environment variables override template defaults
// CHECKLIST_PROJECT_NAME=myproject
// CHECKLIST_TEAM_SIZE=10

// Access in templates
"Project: {{env('PROJECT_NAME') || projectName}}"
```

## Testing Requirements
- [ ] Unit tests for variable definition
- [ ] Substitution tests with various patterns
- [ ] Expression evaluation tests
- [ ] Validation tests for all types
- [ ] Environment variable loading tests
- [ ] Prompting UI tests
- [ ] Conditional variable tests
- [ ] Complex expression tests

## Security Considerations
- No code execution in expressions
- Sanitize variable values
- Prevent injection attacks
- Mask sensitive variables in logs

## Definition of Done
- [ ] Variable definition system complete
- [ ] All variable types supported
- [ ] Substitution working for all patterns
- [ ] Expression evaluation safe and functional
- [ ] Validation comprehensive
- [ ] Environment variable support
- [ ] Prompting UI implemented
- [ ] Tests passing with >90% coverage
- [ ] Security review completed
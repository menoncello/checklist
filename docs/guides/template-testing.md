# Template Testing Guide

Comprehensive guide for testing BMAD Checklist templates.

## Overview

The template testing framework allows you to validate template behavior with assertions. Write tests to ensure your templates work correctly across different scenarios.

## Test File Structure

### Basic Test File

Create `tests/template.test.json`:

```json
{
  "name": "Template Test Suite",
  "template": "../template.yaml",
  "testCases": [
    {
      "name": "test case name",
      "input": {},
      "assertions": []
    }
  ]
}
```

### Complete Example

```json
{
  "name": "Deployment Template Tests",
  "template": "../template.yaml",
  "testCases": [
    {
      "name": "should deploy to production",
      "input": {
        "environment": "production",
        "serviceName": "api-gateway",
        "replicas": "3"
      },
      "assertions": [
        {
          "type": "contains",
          "path": "steps.0.title",
          "expected": "production",
          "message": "Should reference production environment"
        },
        {
          "type": "equals",
          "path": "metadata.title",
          "expected": "Deploy api-gateway",
          "message": "Title should include service name"
        },
        {
          "type": "length",
          "path": "steps",
          "expected": 5,
          "message": "Should have 5 deployment steps"
        }
      ]
    }
  ]
}
```

## Assertion Types

### Equals Assertion

Checks for exact value match.

**Syntax:**

```json
{
  "type": "equals",
  "path": "property.path",
  "expected": "value",
  "message": "Optional error message"
}
```

**Examples:**

```json
{
  "type": "equals",
  "path": "metadata.title",
  "expected": "My Checklist"
}
```

```json
{
  "type": "equals",
  "path": "steps.0.completed",
  "expected": false
}
```

```json
{
  "type": "equals",
  "path": "variables.0.default",
  "expected": "production"
}
```

### Contains Assertion

Checks if a string contains a substring or array contains an element.

**Syntax:**

```json
{
  "type": "contains",
  "path": "property.path",
  "expected": "substring or element",
  "message": "Optional error message"
}
```

**String Examples:**

```json
{
  "type": "contains",
  "path": "steps.0.title",
  "expected": "Deploy",
  "message": "Step title should mention deployment"
}
```

**Array Examples:**

```json
{
  "type": "contains",
  "path": "metadata.tags",
  "expected": "deployment",
  "message": "Tags should include deployment"
}
```

### Length Assertion

Checks the length of a string or array.

**Syntax:**

```json
{
  "type": "length",
  "path": "property.path",
  "expected": 5,
  "message": "Optional error message"
}
```

**Array Length:**

```json
{
  "type": "length",
  "path": "steps",
  "expected": 10,
  "message": "Should have exactly 10 steps"
}
```

**String Length:**

```json
{
  "type": "length",
  "path": "metadata.description",
  "expected": 50,
  "message": "Description should be 50 characters"
}
```

### Exists Assertion

Checks if a property exists (or doesn't exist).

**Syntax:**

```json
{
  "type": "exists",
  "path": "property.path",
  "expected": true,  // or false
  "message": "Optional error message"
}
```

**Check Exists:**

```json
{
  "type": "exists",
  "path": "metadata.id",
  "expected": true,
  "message": "Metadata must have an ID"
}
```

**Check Not Exists:**

```json
{
  "type": "exists",
  "path": "steps.0.error",
  "expected": false,
  "message": "Step should not have error field"
}
```

## Path Syntax

Access nested properties using dot notation:

```json
// Access direct property
"path": "metadata"

// Access nested property
"path": "metadata.title"

// Access array element
"path": "steps.0"

// Access nested in array
"path": "steps.0.title"

// Deep nesting
"path": "steps.0.metadata.tags"
```

## Test Cases

### Testing Default Values

```json
{
  "name": "should use default values",
  "input": {
    "projectName": "MyApp"
  },
  "assertions": [
    {
      "type": "equals",
      "path": "steps.0.description",
      "expected": "Created by Team",
      "message": "Should use default author name"
    }
  ]
}
```

### Testing Variable Substitution

```json
{
  "name": "should substitute all variables",
  "input": {
    "serviceName": "api-gateway",
    "version": "2.0.0",
    "environment": "production"
  },
  "assertions": [
    {
      "type": "contains",
      "path": "steps.0.title",
      "expected": "api-gateway"
    },
    {
      "type": "contains",
      "path": "steps.1.description",
      "expected": "2.0.0"
    },
    {
      "type": "contains",
      "path": "metadata.title",
      "expected": "production"
    }
  ]
}
```

### Testing Conditional Logic

```json
{
  "name": "should include optional steps when flag is true",
  "input": {
    "enableTests": "true",
    "enableDocs": "false"
  },
  "assertions": [
    {
      "type": "length",
      "path": "steps",
      "expected": 8,
      "message": "Should have 8 steps with tests enabled"
    },
    {
      "type": "exists",
      "path": "steps.5.title",
      "expected": true,
      "message": "Test step should exist"
    }
  ]
}
```

### Testing Edge Cases

```json
{
  "name": "should handle empty strings",
  "input": {
    "projectName": "",
    "description": ""
  },
  "assertions": [
    {
      "type": "equals",
      "path": "metadata.title",
      "expected": "",
      "message": "Should handle empty project name"
    }
  ]
}
```

```json
{
  "name": "should handle special characters",
  "input": {
    "projectName": "My-Project_2024",
    "author": "O'Brien & Co."
  },
  "assertions": [
    {
      "type": "contains",
      "path": "steps.0.title",
      "expected": "My-Project_2024"
    },
    {
      "type": "contains",
      "path": "steps.1.description",
      "expected": "O'Brien & Co."
    }
  ]
}
```

## Running Tests

### CLI Commands

```bash
# Run all tests in template directory
bmad template test ./my-template

# Run specific test file
bmad template test ./my-template/tests/basic.test.json

# Verbose output
bmad template test ./my-template --verbose

# Watch mode (re-run on changes)
bmad template test ./my-template --watch

# Generate coverage report
bmad template test ./my-template --coverage
```

### Test Output

**Passing Tests:**

```
✓ should substitute project name (12ms)
✓ should use default values (8ms)
✓ should handle special characters (10ms)

Tests: 3 passed, 3 total
Time: 0.5s
```

**Failing Tests:**

```
✓ should substitute project name (12ms)
✗ should use default values (8ms)

  Expected path 'steps.0.description' to equal 'Created by Team'
  Received: 'Created by Unknown'

  at template.test.json:15:7

✓ should handle special characters (10ms)

Tests: 2 passed, 1 failed, 3 total
Time: 0.5s
```

## Best Practices

### Test Organization

Group related tests logically:

```json
{
  "name": "Variable Substitution Tests",
  "testCases": [
    {
      "name": "should substitute single variable"
    },
    {
      "name": "should substitute multiple variables"
    },
    {
      "name": "should substitute nested variables"
    }
  ]
}
```

### Test Coverage

Aim for comprehensive coverage:

1. **Happy path**: Normal usage scenarios
2. **Default values**: Test all default values
3. **Edge cases**: Empty strings, special characters
4. **Error cases**: Invalid inputs
5. **All features**: Test all template features

### Descriptive Names

Use clear, descriptive test names:

```json
// Good
"name": "should substitute project name in all steps"
"name": "should use default author when not provided"
"name": "should handle special characters in variable values"

// Avoid
"name": "test 1"
"name": "substitution test"
"name": "it works"
```

### Assertion Messages

Provide helpful error messages:

```json
{
  "type": "equals",
  "path": "steps.0.title",
  "expected": "Deploy Application",
  "message": "First step title should indicate deployment action"
}
```

### Test Independence

Each test should be independent:

```json
// Good - Independent tests
{
  "testCases": [
    {
      "name": "test 1",
      "input": { "a": "1" },
      "assertions": [...]
    },
    {
      "name": "test 2",
      "input": { "b": "2" },
      "assertions": [...]
    }
  ]
}

// Avoid - Tests depending on each other
```

## Advanced Testing

### Multiple Test Files

Organize tests by feature:

```
tests/
├── basic.test.json          # Basic functionality
├── variables.test.json      # Variable substitution
├── validation.test.json     # Input validation
└── edge-cases.test.json     # Edge cases
```

### Performance Testing

Test template processing performance:

```json
{
  "name": "should process large template quickly",
  "input": {
    "items": "1000"
  },
  "assertions": [
    {
      "type": "length",
      "path": "steps",
      "expected": 1000
    }
  ],
  "timeout": 5000
}
```

### Integration Testing

Test with dependencies:

```json
{
  "name": "should work with base template",
  "input": {
    "baseTemplate": "base-v1",
    "projectName": "MyApp"
  },
  "assertions": [
    {
      "type": "exists",
      "path": "steps.0.inheritedFrom",
      "expected": true
    }
  ]
}
```

## Debugging Tests

### Enable Verbose Mode

```bash
bmad template test ./my-template --verbose
```

Output includes:

- Full test execution log
- Variable substitution details
- Assertion evaluation steps
- Template processing stages

### Inspect Processed Template

View the processed template:

```bash
bmad template process ./my-template \
  --input '{"projectName":"Test"}' \
  --output processed.yaml
```

### Common Issues

**Issue**: Assertion fails unexpectedly

```
Solution: Check the exact path and expected value
- Use verbose mode to see actual value
- Verify property path is correct
```

**Issue**: Test timeout

```
Solution: Increase timeout or optimize template
- Complex templates may need longer timeout
- Check for infinite loops in conditionals
```

**Issue**: Variable not substituted

```
Solution: Verify variable name and syntax
- Check variable is defined in template
- Verify {{variableName}} syntax is correct
```

## Examples

### Complete Test Suite

See [template examples](../../examples/templates/) for complete working examples:

- `basic-template/tests/` - Simple template tests
- `advanced-workflow/tests/` - Complex workflow tests
- `conditional-steps/tests/` - Conditional logic tests

### Test Templates

Use these templates as starting points:

**Basic Test Template:**

```json
{
  "name": "Template Tests",
  "template": "../template.yaml",
  "testCases": [
    {
      "name": "should work with minimal input",
      "input": {
        "required1": "value1"
      },
      "assertions": [
        {
          "type": "exists",
          "path": "metadata.id",
          "expected": true
        }
      ]
    }
  ]
}
```

## Resources

- [Template Authoring Guide](template-authoring.md)
- [API Reference](../architecture/api-specification.md)
- [Examples](../../examples/templates/)

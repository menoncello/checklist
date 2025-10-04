# `/improve-coverage` Command

Generates comprehensive unit tests to achieve 90-100% code coverage for specified files.

## Usage

```bash
/improve-coverage [file-patterns...]
```

### Examples

```bash
# Generate tests for specific files
/improve-coverage packages/tui/src/terminal/CapabilityTester.ts

# Generate tests for multiple files using patterns
/improve-coverage packages/tui/src/terminal/*.ts

# Generate tests for entire directories
/improve-coverage packages/tui/src/terminal/**/*.ts
```

## Features

### Core Functionality
- **Code Analysis**: Parses TypeScript files to understand structure, complexity, and dependencies
- **Coverage Targeting**: Generates tests specifically for uncovered lines and branches
- **Comprehensive Testing**: Creates tests for all methods, error handling, edge cases, and async operations
- **Project Conventions**: Follows the project's testing patterns and monorepo structure

### Testing Coverage Goals
- **Target**: 90-100% code coverage for each specified file
- **Current Analysis**: Automatically detects existing coverage and identifies gaps
- **Comprehensive Scenarios**: Includes happy paths, error conditions, and edge cases

### Generated Test Types

#### Constructor Tests
- Default configuration
- Custom configuration handling
- Parameter validation

#### Method Tests
- Successful execution
- Invalid parameters
- Return value validation

#### Error Handling Tests
- Thrown errors
- Async error scenarios
- Graceful degradation

#### Edge Case Tests
- Empty inputs
- Boundary values
- Complex logic paths (for high-complexity code)

#### Async Operation Tests
- Timeout handling
- Concurrent execution
- Promise resolution/rejection

## Implementation

### Code Analysis Process
1. **Import Extraction**: Identifies all external dependencies
2. **Export Detection**: Finds all public APIs (classes, functions, methods)
3. **Complexity Assessment**: Evaluates code complexity to determine test depth
4. **Pattern Recognition**: Identifies error handling patterns and async operations

### Test Generation Strategy
1. **File Structure**: Creates test files in appropriate `tests/` directories
2. **Mock Setup**: Generates proper mock configurations for dependencies
3. **Test Organization**: Groups tests by functionality with descriptive names
4. **Coverage Focus**: Targets specific uncovered lines and branches

### Project Integration
- **Test Runner**: Uses Bun's native test runner with TypeScript support
- **Monorepo Support**: Handles packages with proper import paths
- **Existing Tests**: Updates existing test files rather than overwriting
- **Directory Structure**: Maintains project's test directory conventions

## Output

### Progress Reporting
```
🔍 Analyzing files for test coverage improvement...

📁 Processing: packages/tui/src/terminal/CapabilityTester.ts
✅ Created test file: packages/tui/tests/terminal/CapabilityTester.test.ts

📊 Coverage Improvement Summary:
───────────────────────────────────────
📄 packages/tui/src/terminal/CapabilityTester.ts
   Current: 0.0%
   Target:  95%
   Status:  ✅ Tests Generated

📈 Overall Summary:
   Files Processed: 1
   Average Current: 0.0%
   Average Target: 95.0%
   Expected Improvement: 95.0%

✅ Test generation complete!
📊 Run `bun test:coverage` to verify improvements.
```

### Generated Test Structure
```typescript
import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { ClassName, exportedFunction } from '@checklist/package/src/module';

describe('ModuleName', () => {
  let instance: ClassName;

  beforeEach(() => {
    instance = new ClassName();
  });

  describe('constructor', () => {
    it('should create instance with default configuration', () => {
      expect(instance).toBeDefined();
      expect(instance).toBeInstanceOf(ClassName);
    });
  });

  describe('methodName', () => {
    it('should execute successfully', () => {
      expect(() => instance.methodName()).not.toThrow();
    });

    it('should handle invalid parameters', () => {
      expect(() => instance.methodName(null as any)).not.toThrow();
    });
  });

  describe('error handling', () => {
    it('should handle thrown errors gracefully', () => {
      const errorSpy = spyOn(console, 'error').mockImplementation(() => {});
      // Test error scenarios
      expect(errorSpy).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('should handle empty inputs', () => {
      expect(() => instance).not.toThrow();
    });

    it('should handle boundary values', () => {
      expect(() => instance).not.toThrow();
    });
  });

  describe('async operations', () => {
    it('should handle methodName timeout', async () => {
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Timeout')), 100);
      });

      await Promise.race([
        instance.methodName(),
        timeoutPromise
      ]);
    });
  });
});
```

## Requirements

### Prerequisites
- Bun runtime environment
- Existing project with TypeScript configuration
- Test directory structure following project conventions

### Dependencies
- Uses built-in Bun test runner
- No additional npm packages required
- Follows project's existing testing patterns

## Best Practices

### Test Quality
- **Descriptive Names**: Clear test and describe block names
- **Realistic Scenarios**: Test actual usage patterns, not just syntax
- **Proper Mocking**: Mock only external dependencies
- **Error Coverage**: Test all error paths and edge cases

### Coverage Strategy
- **Target 100%**: Aim for complete coverage where possible
- **Critical Paths**: Prioritize business logic and error handling
- **Integration Points**: Test all external integrations
- **Performance**: Include performance-sensitive operations

### Maintenance
- **Readable Tests**: Clear, well-structured test code
- **Documentation**: Tests serve as living documentation
- **Refactoring Support**: Tests should survive code refactoring
- **Continuous Integration**: Ensure tests run in CI/CD pipeline

## Next Steps

After running the command:

1. **Review Generated Tests**: Examine the created test files
2. **Run Coverage**: Execute `bun test:coverage` to verify improvements
3. **Adjust as Needed**: Modify test cases for specific requirements
4. **Commit Changes**: Include both source and test improvements
5. **Monitor Coverage**: Use coverage reports to identify remaining gaps

## Troubleshooting

### Common Issues
- **Import Path Errors**: Verify monorepo package structure
- **Missing Dependencies**: Ensure all source file imports are available
- **Test Failures**: Review generated test cases for edge cases
- **Coverage Gaps**: Run coverage analysis to identify remaining untested code

### Getting Help
- Check project documentation for testing conventions
- Review existing test files for pattern examples
- Use `bun test:coverage` for detailed coverage analysis
- Consult project maintainers for complex testing scenarios
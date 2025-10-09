# Log Mocking Best Practices

## Overview

This document provides comprehensive guidelines for mocking console and logger output in tests to ensure clean test execution while maintaining the ability to verify console behavior when needed.

## Problem Statement

Traditional console mocking approaches often lead to:
1. **Test output pollution** - Console messages clutter test results
2. **Test complexity** - Complex mock setups for simple console verification
3. **Maintenance overhead** - Scattered mocking logic across test files
4. **Conflicting requirements** - Need to both suppress and verify console output

## Solution Architecture

Our solution uses a layered approach:

```
┌─────────────────────────────────────┐
│        Global Test Setup            │
│  (test-setup.ts files)             │
├─────────────────────────────────────┤
│     TestLoggerSuppressor           │
│   (Singleton global manager)       │
├─────────────────────────────────────┤
│      TestConsoleMock               │
│   (Per-test mocking utilities)     │
├─────────────────────────────────────┤
│    ConsoleCaptureManager           │
│   (Output capture and analysis)    │
└─────────────────────────────────────┘
```

## Core Components

### 1. ConsoleCaptureManager

Handles capturing and storing console output for analysis.

```typescript
import { ConsoleCaptureManager } from '@checklist/core/tests/utils';

const captureManager = new ConsoleCaptureManager();

// Start capturing
captureManager.enableCapture();

// ... run code that logs to console

// Get captured output
const output = captureManager.getCapturedOutput();
const logCalls = captureManager.getCapturedOutputByMethod('log');
```

### 2. TestConsoleMock

Provides comprehensive console mocking with selective suppression.

```typescript
import { TestConsoleMock } from '@checklist/core/tests/utils';

const consoleMock = new TestConsoleMock({
  enableCapture: true,
  suppressGlobalOutput: true,
  allowTestReporterOutput: true,
});

consoleMock.install();

// ... run tests

consoleMock.uninstall();
```

### 3. TestLoggerSuppressor

Singleton global manager for test-wide console suppression.

```typescript
import { installTestSuppression } from '@checklist/core/tests/utils';

// Install at the start of test suite
installTestSuppression({
  enableCapture: true,
  suppressAllOutput: true,
});
```

## Usage Patterns

### Pattern 1: Basic Console Testing

Use when you need to verify specific console output without pollution.

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { cliConsoleHelper } from '../../test-setup';

describe('MyCommand', () => {
  beforeEach(() => {
    cliConsoleHelper.startCapture();
  });

  afterEach(() => {
    cliConsoleHelper.stopCapture();
  });

  it('should log expected message', () => {
    // ... run command
    expect(cliConsoleHelper.wasCalled('log', 'Expected message')).toBe(true);
  });
});
```

### Pattern 2: Detailed Console Analysis

Use when you need to analyze the exact console output sequence.

```typescript
it('should log messages in correct order', () => {
  cliConsoleHelper.startCapture();

  // ... run code

  const logCalls = cliConsoleHelper.getCalls('log');
  expect(logCalls[0]).toEqual(['First message']);
  expect(logCalls[1]).toEqual(['Second message']);
});
```

### Pattern 3: Selective Console Mocking

Use when you need to mock specific console methods.

```typescript
import { TestConsoleMock } from '@checklist/core/tests/utils';

it('should handle console errors', () => {
  const consoleMock = new TestConsoleMock({ enableCapture: true });
  consoleMock.install();

  const errorSpy = consoleMock.spyOnConsole('error');

  // ... run code that should log errors

  expect(errorSpy.calls.count).toBe(1);
  expect(errorSpy.calls.args[0]).toContain('Error message');

  consoleMock.uninstall();
});
```

### Pattern 4: Global Suppression with Test Exceptions

Use for test suites that need clean output but occasional console verification.

```typescript
// In test-setup.ts
import { installTestSuppression } from '@checklist/core/tests/utils';

installTestSuppression({
  suppressAllOutput: true,
  enableCapture: true,
});

// In individual test
import { TestLoggerSuppressor } from '@checklist/core/tests/utils';

it('should verify console output', () => {
  const suppressor = TestLoggerSuppressor.getInstance();

  // Temporarily enable capture for this test
  suppressor.enableTestCapture();

  // ... run code

  const output = suppressor.getCapturedOutput();
  expect(output.some(entry =>
    entry.method === 'log' && entry.args[0].includes('Expected')
  )).toBe(true);
});
```

## Migration Guide

### From Traditional Console Mocking

**Before:**
```typescript
let consoleSpy: any;

beforeEach(() => {
  consoleSpy = spyOn(console, 'log');
});

afterEach(() => {
  consoleSpy.mockRestore();
});

it('should log message', () => {
  myFunction();
  expect(consoleSpy).toHaveBeenCalledWith('Expected message');
});
```

**After:**
```typescript
import { cliConsoleHelper } from '../../test-setup';

beforeEach(() => {
  cliConsoleHelper.startCapture();
});

afterEach(() => {
  cliConsoleHelper.stopCapture();
});

it('should log message', () => {
  myFunction();
  expect(cliConsoleHelper.wasCalled('log', 'Expected message')).toBe(true);
});
```

### From Multiple Console Suppression Setups

**Before:**
```typescript
// Multiple files with complex stdout/stderr mocking
process.stdout.write = function(chunk) { /* complex logic */ };
console.log = () => {};
// ... scattered across test files
```

**After:**
```typescript
// Single global setup in test-setup.ts
installTestSuppression({ suppressAllOutput: true });

// Clean test files with focused testing
cliConsoleHelper.startCapture();
// ... test logic
cliConsoleHelper.stopCapture();
```

## Best Practices

### 1. Test Structure

- **Use beforeEach/afterEach** for consistent capture setup
- **Always stop capture** after starting it
- **Clear capture state** between tests to avoid interference

```typescript
describe('Feature', () => {
  beforeEach(() => {
    cliConsoleHelper.startCapture();
  });

  afterEach(() => {
    cliConsoleHelper.stopCapture();
  });

  // ... tests
});
```

### 2. Assertion Strategies

- **Use specific assertions** (`wasCalled`) for simple checks
- **Use detailed analysis** (`getCalls`) for complex verification
- **Test call order** when sequence matters
- **Verify exact arguments** for precise validation

```typescript
// Simple check
expect(cliConsoleHelper.wasCalled('log', 'Success')).toBe(true);

// Detailed analysis
const calls = cliConsoleHelper.getCalls('log');
expect(calls).toHaveLength(3);
expect(calls[0][0]).toBe('Step 1');
expect(calls[1][0]).toBe('Step 2');
expect(calls[2][0]).toBe('Success');
```

### 3. Performance Considerations

- **Enable capture only when needed** for better performance
- **Clear captured output** frequently to prevent memory buildup
- **Use global suppression** to avoid multiple mock setups

```typescript
// Good: Selective capture
beforeEach(() => {
  if (testNeedsConsoleVerification) {
    cliConsoleHelper.startCapture();
  }
});

// Good: Clean state
afterEach(() => {
  if (testNeedsConsoleVerification) {
    cliConsoleHelper.stopCapture();
  }
});
```

### 4. Error Handling

- **Test both success and error console output**
- **Verify error messages** are logged appropriately
- **Check that no unexpected errors** are logged

```typescript
it('should log errors appropriately', () => {
  cliConsoleHelper.startCapture();

  // Simulate error condition
  myFunctionWithError();

  expect(cliConsoleHelper.wasCalled('error', 'Expected error message')).toBe(true);
  expect(cliConsoleHelper.wasCalled('log', 'Success message')).toBe(false);
});
```

## Advanced Patterns

### 1. Conditional Console Testing

```typescript
it('should conditionally log based on input', () => {
  cliConsoleHelper.startCapture();

  myFunction(true);  // Should log
  myFunction(false); // Should not log

  const calls = cliConsoleHelper.getCalls('log');
  expect(calls).toHaveLength(1);
  expect(calls[0][0]).toBe('Conditional message');
});
```

### 2. Multi-Method Console Testing

```typescript
it('should use appropriate log levels', () => {
  cliConsoleHelper.startCapture();

  myComplexFunction();

  expect(cliConsoleHelper.wasCalled('info', 'Starting process')).toBe(true);
  expect(cliConsoleHelper.wasCalled('debug', 'Debug info')).toBe(true);
  expect(cliConsoleHelper.wasCalled('error', 'Error occurred')).toBe(true);
});
```

### 3. Console Output Formatting

```typescript
it('should format console output correctly', () => {
  cliConsoleHelper.startCapture();

  myFunction();

  const calls = cliConsoleHelper.getCalls('log');
  // Check for formatted output with specific patterns
  expect(calls.some(call => call[0].includes('User: alice'))).toBe(true);
  expect(calls.some(call => call[0].includes('Status: active'))).toBe(true);
});
```

## Troubleshooting

### Common Issues

1. **Tests not capturing output**
   - Ensure `startCapture()` is called before the code runs
   - Check that global suppression isn't blocking capture
   - Verify the test is importing the correct setup

2. **Console output still showing in tests**
   - Make sure global suppression is installed in test-setup.ts
   - Check for multiple console mock installations
   - Verify that `allowTestReporterOutput` is configured correctly

3. **Memory buildup in long test suites**
   - Call `clearCapturedOutput()` in `afterEach`
   - Use selective capture instead of always-on capture
   - Check for capture manager leaks

### Debug Console State

```typescript
// Debug current capture state
const suppressor = TestLoggerSuppressor.getInstance();
console.log('Capture enabled:', suppressor.getConsoleMock()?.getCaptureManager().isCapturing);
console.log('Captured output:', suppressor.getCapturedOutput());
```

## Integration with Testing Tools

### Bun Test Integration

Our utilities are designed to work seamlessly with Bun's test runner:

```typescript
// bun test --watch works correctly with console suppression
// Test reporter output is preserved while console output is captured
```

### StrykerJS Mutation Testing

The capture utilities ensure mutation testing works correctly:

```typescript
// Mutations that change console.log strings are properly caught
expect(cliConsoleHelper.wasCalled('log', 'Original message')).toBe(true);
// Mutation that changes 'Original message' will fail this test
```

### Coverage Reporting

Console suppression doesn't interfere with coverage:

```bash
bun test --coverage
# Clean output with accurate coverage reports
```

## Examples Repository

See the following files for complete examples:

- `apps/cli/tests/commands/list-clean.test.ts` - Complete command testing example
- `packages/core/tests/test-setup.ts` - Global setup configuration
- `packages/core/tests/utils/` - Core utility implementations

## Future Enhancements

Planned improvements to the console mocking system:

1. **Visual output testing** - Capture and verify terminal formatting/colors
2. **Performance metrics** - Track console overhead in tests
3. **Mock templates** - Pre-configured capture patterns for common scenarios
4. **IDE integration** - Better debugging support for console capture

## Conclusion

This console mocking system provides:

✅ **Clean test output** - No unwanted console pollution
✅ **Flexible verification** - Test console output when needed
✅ **Maintainable code** - Centralized mocking logic
✅ **Better performance** - Optimized capture mechanisms
✅ **Developer-friendly** - Simple, intuitive API

By following these patterns and best practices, you can ensure your tests are both clean and effective at verifying console behavior.
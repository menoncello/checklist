# Testing Guide

## Overview

This project uses a comprehensive testing framework built on Bun's native test runner with additional utilities for TUI testing, visual regression, performance benchmarking, and accessibility compliance.

## Current Status

- **Coverage**: 81.90% (exceeds 80% requirement)
- **Tests**: 382 passing tests across 30 files
- **Quality Gate**: PASS (100/100)
- **Last QA Review**: September 6, 2025

## Test Structure

```
packages/
├── */tests/          # Unit tests colocated with packages
├── */tests/fixtures/ # Test data and fixtures
└── */tests/visual/   # Visual regression baselines

tests/
├── integration/      # Cross-package integration tests  
├── e2e/             # End-to-end tests
├── fixtures/        # Shared test fixtures
└── snapshots/       # Terminal output snapshots
```

## Running Tests

```bash
# Run all tests
bun test

# Run with coverage
bun test:coverage

# Run specific test types
bun test:unit        # Unit tests only
bun test:integration # Integration tests
bun test:e2e        # End-to-end tests

# Run tests for changed files
bun test:changed

# Run mutation testing
bun test:mutation

# Run performance benchmarks
bun bench
```

## Test Types

### Unit Tests

Test individual functions and components in isolation.

```typescript
import { describe, it, expect } from 'bun:test';
import { TestDataFactory } from '@checklist/shared/testing';

describe('TemplateParser', () => {
  const factory = new TestDataFactory();

  it('should parse valid template', async () => {
    const template = factory.createTemplate({
      name: 'Test Template',
      steps: [factory.createStep()],
    });

    const yaml = factory.templateToYaml(template);
    const result = await parser.parse(yaml);
    
    expect(result.errors).toHaveLength(0);
    expect(result.template.name).toBe('Test Template');
  });
});
```

### Terminal Snapshot Testing

Capture and compare terminal output.

```typescript
import { SnapshotUtils } from '@checklist/shared/testing';

describe('CLI Output', () => {
  const snapshots = new SnapshotUtils();

  it('should match help output', async () => {
    const proc = Bun.spawn(['bun', 'run', 'cli', '--help'], {
      stdout: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    await snapshots.assertSnapshot('help-output', output);
  });
});
```

### Visual Regression Testing

Test terminal UI rendering with pixel-perfect comparisons.

```typescript
import { VisualRegressionTester } from '@checklist/shared/testing';

describe('Progress Bar', () => {
  const visual = new VisualRegressionTester();

  it('should render correctly', async () => {
    const output = renderer.render({ percentage: 45 });
    const lines = output.split('\n');
    
    await visual.assertVisualMatch('progress-bar-45', lines);
  });
});
```

### TUI Testing with Terminal Emulation

Test interactive terminal applications.

```typescript
import { TUITestHarness } from '@checklist/shared/testing';

describe('Interactive Checklist', () => {
  const harness = new TUITestHarness({ cols: 80, rows: 24 });

  it('should navigate with keyboard', async () => {
    await harness.spawn('bun', ['run', 'cli']);
    await harness.waitForText('Choose an option:');
    
    await harness.sendKey('down');
    await harness.sendKey('enter');
    
    const screen = await harness.screenshot();
    expect(screen).toContain('Task completed');
  });

  afterEach(async () => {
    await harness.close();
  });
});
```

### Performance Testing

Ensure operations meet performance requirements.

```typescript
import { PerformanceTester } from '@checklist/shared/testing';

describe('Performance', () => {
  const perf = new PerformanceTester();

  it('should start within 100ms', async () => {
    perf.add(
      'CLI Startup',
      async () => {
        const proc = Bun.spawn(['bun', 'run', 'cli'], {
          stdout: 'pipe',
        });
        await proc.exited;
      },
      { mean: 100, p95: 150 }
    );

    await perf.assertPerformance();
  });
});
```

### Accessibility Testing

Verify WCAG 2.1 AA compliance.

```typescript
import { AccessibilityTester, TUITestHarness } from '@checklist/shared/testing';

describe('Accessibility', () => {
  const harness = new TUITestHarness();
  const a11y = new AccessibilityTester(harness);

  it('should be keyboard navigable', async () => {
    await harness.spawn('bun', ['run', 'cli']);
    
    const result = await a11y.testKeyboardNavigation();
    expect(result.passed).toBe(true);
    
    if (!result.passed) {
      console.log(result.violations);
    }
  });

  it('should pass full compliance', async () => {
    const results = await a11y.runFullCompliance();
    const report = a11y.getReport();
    
    console.log(report);
    
    const failed = results.filter(r => !r.passed);
    expect(failed).toHaveLength(0);
  });
});
```

## Test Utilities

### TestDataFactory

Generate consistent test data.

```typescript
const factory = new TestDataFactory();

// Create test templates
const template = factory.createTemplate({
  name: 'My Template',
  steps: [
    factory.createStep({ title: 'Step 1' }),
    factory.createStep({ title: 'Step 2' }),
  ],
});

// Create large datasets for performance testing
const largeTemplate = factory.createLargeTemplate(1000);

// Create invalid data for error testing
const invalidYaml = factory.createInvalidYaml();
```

### TestHelpers

Common testing utilities.

```typescript
import { TestHelpers } from '@checklist/shared/testing';

// Work with temporary directories
await TestHelpers.withTempDir(async (dir) => {
  // Test code using temp directory
});

// Mock environment variables
const restore = TestHelpers.mockEnv({
  NODE_ENV: 'test',
  API_KEY: 'test-key',
});
// ... run tests
restore();

// Wait for conditions
await TestHelpers.waitFor(
  () => element.isVisible(),
  5000 // timeout
);

// Capture output
const [result, stdout] = await TestHelpers.captureStdout(() => {
  console.log('Test output');
});
```

### Flaky Test Detection

Identify unstable tests.

```typescript
import { FlakyTestDetector } from '@checklist/shared/testing';

const detector = new FlakyTestDetector();
detector.install(); // Hooks into test lifecycle

// After running tests multiple times
const report = detector.getReport();
console.log(report);
```

## Best Practices

### 1. Test Isolation

- Each test should be independent
- Use `beforeEach` and `afterEach` for setup/teardown
- Don't rely on test execution order

### 2. Test Data

- Use TestDataFactory for consistent data
- Keep fixtures in version control
- Use meaningful test data that reflects real usage

### 3. Assertions

- Use descriptive assertion messages
- Test both positive and negative cases
- Verify edge cases and error conditions

### 4. Performance

- Keep tests fast (<100ms for unit tests)
- Use test doubles for external dependencies
- Run slow tests separately (e2e, integration)

### 5. Coverage

- Maintain >80% code coverage
- Focus on critical paths
- Don't write tests just for coverage

### 6. Snapshots

- Review snapshot changes carefully
- Keep snapshots readable
- Update snapshots intentionally, not automatically

## Debugging Tests

### Run Single Test

```bash
bun test path/to/test.ts
```

### Debug Output

```typescript
import createDebug from 'debug';
const debug = createDebug('checklist:test');

debug('Test state:', { data });
```

Run with debug output:
```bash
DEBUG=checklist:* bun test
```

### Interactive Debugging

```typescript
it('should work', async () => {
  debugger; // Breakpoint
  const result = await someFunction();
  expect(result).toBe(expected);
});
```

Run with inspector:
```bash
bun --inspect test
```

## Continuous Integration

Tests run automatically on:
- Every push to main/develop
- Every pull request
- Manual workflow dispatch

CI includes:
- Type checking
- Linting
- Format checking
- Unit tests with coverage
- Integration tests
- Performance benchmarks
- Security scanning

## Writing New Tests

1. **Identify test type**: Unit, integration, e2e, or performance
2. **Choose location**: Package tests or root tests directory
3. **Use utilities**: Leverage TestDataFactory and helpers
4. **Follow patterns**: Match existing test structure
5. **Run locally**: Ensure tests pass before committing
6. **Check coverage**: Verify new code is tested
7. **Update snapshots**: If UI changes are intentional

## Test Checklist

Before committing:
- [ ] Tests pass locally
- [ ] Coverage meets threshold (>80%)
- [ ] No flaky tests introduced
- [ ] Performance benchmarks pass
- [ ] Snapshots updated if needed
- [ ] Accessibility tests pass
- [ ] Documentation updated
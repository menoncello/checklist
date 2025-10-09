# Test Improvement Examples

## Example 1: Standardizing Test Syntax

Many files use both `test()` and `it()`. Choose one consistently:

### Current (mixed syntax):
```typescript
// Some files use test()
test('should handle user input', () => {
  expect(handler.process(input)).toBe(expected);
});

// Other files use it()
it('should handle user input', () => {
  expect(handler.process(input)).toBe(expected);
});
```

### Recommended (consistent `test()` syntax):
```typescript
test('should handle user input', () => {
  expect(handler.process(input)).toBe(expected);
});
```

## Example 2: Enhanced Infrastructure Test

### Current CI validation test could be improved:
```typescript
// Current - basic validation
test('ESLint should fail build when quality rules are violated', async () => {
  // Basic file creation and validation
  expect(result.exitCode).not.toBe(0);
});
```

### Enhanced version:
```typescript
test('ESLint should fail build when quality rules are violated', async () => {
  const violationFile = 'temp-violation-test.ts';

  try {
    // Create specific violations
    await createViolationFile(violationFile, {
      maxLines: 350,
      maxComplexity: 15,
      maxFunctionLines: 40
    });

    const result = await $`bun x eslint --max-warnings 0 ${violationFile}`.nothrow();

    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('max-lines');
    expect(result.stderr.toString()).toContain('complexity');
    expect(result.stderr.toString()).toContain('max-lines-per-function');

    // Verify specific violation counts
    const output = result.stderr.toString();
    const lineCountViolations = (output.match(/max-lines/g) || []).length;
    const complexityViolations = (output.match(/complexity/g) || []).length;

    expect(lineCountViolations).toBeGreaterThan(0);
    expect(complexityViolations).toBeGreaterThan(0);

  } finally {
    await cleanupFile(violationFile);
  }
});
```

## Example 3: Performance Test Enhancement

### Add performance regression testing:
```typescript
describe('Performance Regression Tests', () => {
  test('StateManager initialization should complete within 50ms', async () => {
    const tempDir = mkdtempSync(join(tmpdir(), 'perf-test-'));

    try {
      const iterations = 10;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const start = performance.now();
        const stateManager = new StateManager(tempDir);
        await stateManager.initializeState();
        await stateManager.cleanup();
        const end = performance.now();
        times.push(end - start);
      }

      const averageTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);

      expect(averageTime).toBeLessThan(50);
      expect(maxTime).toBeLessThan(100); // Allow for occasional slower runs

      console.log(`StateManager init - Average: ${averageTime.toFixed(2)}ms, Max: ${maxTime.toFixed(2)}ms`);

    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });
});
```

## Example 4: Test Data Factory

### Create reusable test data:
```typescript
// test-factories/StateFactory.ts
export class StateFactory {
  static createBasicState() {
    return {
      version: '1.0.0',
      schemaVersion: '1.0.0',
      instances: [],
      templates: [],
      metadata: {
        created: new Date().toISOString(),
        modified: new Date().toISOString(),
      }
    };
  }

  static createStateWithItems(count: number) {
    const state = this.createBasicState();
    state.instances = Array.from({ length: count }, (_, i) => ({
      id: `item-${i}`,
      title: `Test Item ${i}`,
      completed: i % 2 === 0,
      metadata: {}
    }));
    return state;
  }

  static createComplexState() {
    return {
      ...this.createBasicState(),
      instances: this.createStateWithItems(100).instances,
      templates: [
        {
          id: 'work-project',
          name: 'Work Project Template',
          description: 'Template for work-related projects',
          defaultItems: [
            { title: 'Define requirements', required: true },
            { title: 'Create design', required: true },
            { title: 'Implement', required: true },
            { title: 'Test', required: true },
            { title: 'Deploy', required: false }
          ]
        }
      ]
    };
  }
}
```

### Usage in tests:
```typescript
import { StateFactory } from '../test-factories/StateFactory';

test('should handle large state efficiently', async () => {
  const state = StateFactory.createComplexState();
  const stateManager = new StateManager(tempDir);

  await stateManager.save(state);
  const loaded = await stateManager.load();

  expect(loaded.instances).toHaveLength(100);
  expect(loaded.templates).toHaveLength(1);
});
```

## Example 5: Test Utility Functions

### Create common test utilities:
```typescript
// test-utils/TestHelpers.ts
export class TestHelpers {
  static async withTempDir<T>(
    callback: (tempDir: string) => Promise<T>
  ): Promise<T> {
    const tempDir = mkdtempSync(join(tmpdir(), 'test-'));
    try {
      return await callback(tempDir);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  }

  static expectPerformance<T>(
    operation: () => Promise<T>,
    maxMs: number
  ): Promise<T> {
    return expect(async () => {
      const start = performance.now();
      const result = await operation();
      const duration = performance.now() - start;
      if (duration > maxMs) {
        throw new Error(`Operation took ${duration}ms, expected < ${maxMs}ms`);
      }
      return result;
    }).resolves.not.toThrow();
  }

  static createMockLogger() {
    const logs: Array<{ level: string; msg: string; data?: any }> = [];

    return {
      logs,
      logger: {
        info: (data: any) => logs.push({ level: 'info', ...data }),
        warn: (data: any) => logs.push({ level: 'warn', ...data }),
        error: (data: any) => logs.push({ level: 'error', ...data }),
        debug: (data: any) => logs.push({ level: 'debug', ...data }),
      }
    };
  }
}
```

### Usage in tests:
```typescript
import { TestHelpers } from '../test-utils/TestHelpers';

test('should handle state operations efficiently', async () => {
  await TestHelpers.withTempDir(async (tempDir) => {
    await TestHelpers.expectPerformance(
      () => stateManager.initializeState(),
      50
    );
  });
});
```

## Implementation Priority

1. **Phase 1**: Standardize test syntax across all files
2. **Phase 2**: Add performance regression tests
3. **Phase 3**: Create test data factories and utilities
4. **Phase 4**: Enhance infrastructure tests
5. **Phase 5**: Add comprehensive integration tests

These improvements will significantly enhance test quality while maintaining the existing high standards.
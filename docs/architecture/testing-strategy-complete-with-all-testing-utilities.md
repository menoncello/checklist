# Testing Strategy (Complete with All Testing Utilities)

## Test Data Factory

```typescript
export class TestDataFactory {
  private static counters = new Map<string, number>();
  
  static createTemplate(overrides?: Partial<ChecklistTemplate>): ChecklistTemplate {
    const id = this.nextId('template');
    return {
      id: `test-template-${id}`,
      name: `Test Template ${id}`,
      version: '1.0.0',
      description: 'Test template for testing',
      variables: [],
      steps: [
        this.createStep({ id: 'step-1', title: 'First Step' }),
        this.createStep({ id: 'step-2', title: 'Second Step' }),
      ],
      metadata: {
        author: 'test',
        tags: ['test'],
        visibility: 'private',
        created: new Date(),
        updated: new Date()
      },
      ...overrides
    };
  }
  
  static async createTestWorkspace(): Promise<TestWorkspace> {
    const dir = await mkdtemp(join(tmpdir(), 'checklist-test-'));
    
    return {
      path: dir,
      async cleanup() {
        await rm(dir, { recursive: true, force: true });
      },
      async writeTemplate(name: string, template: ChecklistTemplate) {
        const path = join(dir, 'templates', name);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, yaml.dump(template));
      }
    };
  }
}
```

## Flaky Test Detector

```typescript
export class FlakyTestDetector {
  private results: Map<string, TestResult[]> = new Map();
  private readonly threshold = 0.95;
  
  async runWithRetry(
    testName: string,
    testFn: () => Promise<void>,
    maxRetries = 3
  ): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        await testFn();
        this.recordResult(testName, true);
        return;
      } catch (error) {
        lastError = error as Error;
        this.recordResult(testName, false);
        
        if (attempt < maxRetries) {
          console.warn(`Test "${testName}" failed on attempt ${attempt}, retrying...`);
          await sleep(100 * attempt);
        }
      }
    }
    
    this.markAsFlaky(testName);
    throw lastError;
  }
}
```

## Visual Regression Testing

```typescript
export class VisualRegressionTester {
  private readonly threshold = 0.1;
  
  async compareTerminalOutput(
    actual: string,
    expected: string,
    name: string
  ): Promise<ComparisonResult> {
    const actualImage = this.terminalToImage(actual);
    const expectedImage = this.terminalToImage(expected);
    
    const diff = new PNG({ width: actualImage.width, height: actualImage.height });
    const numDiffPixels = pixelmatch(
      actualImage.data,
      expectedImage.data,
      diff.data,
      actualImage.width,
      actualImage.height,
      { threshold: this.threshold }
    );
    
    const diffPercentage = numDiffPixels / (actualImage.width * actualImage.height);
    
    if (diffPercentage > 0.01) {
      await this.saveDiffImage(diff, name);
      return {
        passed: false,
        difference: diffPercentage,
        diffImage: `tests/visual-diffs/${name}.png`
      };
    }
    
    return { passed: true, difference: 0 };
  }
}
```

## Load Testing

```typescript
export class LoadTester {
  async testLargeChecklist(): Promise<LoadTestResult> {
    const steps = 10000;
    const template = this.generateLargeTemplate(steps);
    
    const initTime = await this.measure(async () => {
      await workflowEngine.init(template);
    });
    
    expect(initTime).toBeLessThan(1000);
    
    const navTime = await this.measure(async () => {
      for (let i = 0; i < 100; i++) {
        await workflowEngine.nextStep();
      }
    });
    
    expect(navTime / 100).toBeLessThan(10);
    
    const memoryUsed = process.memoryUsage().heapUsed;
    expect(memoryUsed).toBeLessThan(100 * 1024 * 1024);
    
    return { initTime, avgNavTime: navTime / 100, memoryUsed };
  }
}
```

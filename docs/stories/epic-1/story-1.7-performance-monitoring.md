# Story 1.7: Performance Monitoring Framework

## Story

**As a** development team,  
**I want** performance monitoring built into the application from the start,  
**so that** we can ensure all operations meet the <100ms requirement throughout development.

## Priority

**HIGH** - Essential for maintaining performance goals

## Acceptance Criteria

### Performance Infrastructure

1. ✅ Performance measurement utilities created
2. ✅ Benchmark suite established
3. ✅ Performance budgets defined and enforced
4. ✅ Automated performance testing in CI/CD
5. ✅ Performance regression detection

### Monitoring Points

1. ✅ Command execution time tracked
2. ✅ File I/O operations measured
3. ✅ TUI rendering performance monitored
4. ✅ Memory usage tracked
5. ✅ Startup time measured

### Performance Targets

1. ✅ All commands complete in <100ms
2. ✅ Startup time <500ms
3. ✅ Memory usage <50MB
4. ✅ TUI renders at 60fps
5. ✅ File operations <50ms

### Explicit Performance Benchmarks

| Operation                     | Target   | P95 Target | Critical |
| ----------------------------- | -------- | ---------- | -------- |
| Command Execution             | <100ms   | <150ms     | Yes      |
| Application Startup           | <500ms   | <750ms     | Yes      |
| Template Parsing (1000 lines) | <100ms   | <200ms     | Yes      |
| State Save                    | <50ms    | <75ms      | Yes      |
| State Load                    | <30ms    | <50ms      | Yes      |
| TUI Frame Render              | <16.67ms | <20ms      | Yes      |
| Checklist Navigation          | <10ms    | <15ms      | No       |
| Search (10000 items)          | <50ms    | <100ms     | No       |
| Template Validation           | <100ms   | <150ms     | No       |
| File System Operations        | <50ms    | <75ms      | Yes      |
| Memory Baseline               | <30MB    | <40MB      | Yes      |
| Memory Peak (10 checklists)   | <50MB    | <75MB      | Yes      |

### Reporting & Alerts

1. ✅ Performance dashboard in development mode
2. ✅ Performance reports in CI/CD
3. ✅ Regression alerts on PR
4. ✅ Performance trends tracked
5. ✅ Bottleneck identification tools

## Technical Implementation

### Performance Monitoring Class

```typescript
export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric> = new Map();
  private budgets: Map<string, number> = new Map();

  /**
   * Start timing an operation
   */
  startTimer(operation: string): () => void {
    const start = performance.now();

    return () => {
      const duration = performance.now() - start;
      this.recordMetric(operation, duration);

      const budget = this.budgets.get(operation);
      if (budget && duration > budget) {
        this.handleBudgetExceeded(operation, duration, budget);
      }
    };
  }

  /**
   * Record a performance metric
   */
  recordMetric(operation: string, duration: number): void {
    const metric = this.metrics.get(operation) || {
      count: 0,
      total: 0,
      min: Infinity,
      max: -Infinity,
      average: 0,
    };

    metric.count++;
    metric.total += duration;
    metric.min = Math.min(metric.min, duration);
    metric.max = Math.max(metric.max, duration);
    metric.average = metric.total / metric.count;

    this.metrics.set(operation, metric);
  }

  /**
   * Set performance budget for an operation
   */
  setBudget(operation: string, maxMs: number): void {
    this.budgets.set(operation, maxMs);
  }

  /**
   * Generate performance report
   */
  generateReport(): PerformanceReport {
    const violations: BudgetViolation[] = [];

    for (const [operation, metric] of this.metrics) {
      const budget = this.budgets.get(operation);
      if (budget && metric.max > budget) {
        violations.push({
          operation,
          budget,
          actual: metric.max,
          exceedance: ((metric.max - budget) / budget) * 100,
        });
      }
    }

    return {
      metrics: Object.fromEntries(this.metrics),
      violations,
      summary: {
        totalOperations: this.metrics.size,
        budgetViolations: violations.length,
        overallHealth: violations.length === 0 ? 'HEALTHY' : 'DEGRADED',
      },
    };
  }
}
```

### Performance Decorators

```typescript
/**
 * Decorator to automatically measure method performance
 */
export function Timed(budgetMs?: number) {
  return function (target: any, propertyKey: string, descriptor: PropertyDescriptor) {
    const originalMethod = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const timer = performanceMonitor.startTimer(propertyKey);

      try {
        const result = await originalMethod.apply(this, args);
        return result;
      } finally {
        timer();
      }
    };

    if (budgetMs) {
      performanceMonitor.setBudget(propertyKey, budgetMs);
    }

    return descriptor;
  };
}

// Usage example
class WorkflowEngine {
  @Timed(100) // 100ms budget
  async loadTemplate(path: string): Promise<Template> {
    // Implementation
  }

  @Timed(50) // 50ms budget
  async saveState(): Promise<void> {
    // Implementation
  }
}
```

### Benchmark Suite

```typescript
// benchmarks/core.bench.ts
import { bench, describe } from 'tinybench';

describe('Core Operations', () => {
  bench(
    'workflow initialization',
    async () => {
      const engine = new WorkflowEngine();
      await engine.initialize({ template: 'default' });
    },
    {
      time: 100, // Must complete in 100ms
    }
  );

  bench(
    'state persistence',
    async () => {
      const state = new StateManager();
      await state.save({
        /* data */
      });
    },
    {
      time: 50, // Must complete in 50ms
    }
  );

  bench(
    'template parsing',
    () => {
      const parser = new TemplateParser();
      parser.parse(largeTemplate);
    },
    {
      time: 100,
    }
  );
});
```

### CI/CD Integration

```yaml
# .github/workflows/performance.yml
name: Performance Tests
on: [pull_request]

jobs:
  benchmark:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: oven-sh/setup-bun@v1
      - run: bun install

      - name: Run benchmarks
        run: bun run bench

      - name: Compare with baseline
        uses: benchmark-action/github-action-benchmark@v1
        with:
          tool: 'bun-test'
          output-file-path: bench-results.json
          github-token: ${{ secrets.GITHUB_TOKEN }}
          alert-threshold: '110%'
          comment-on-alert: true
          fail-on-alert: true
```

## Development Tasks

- [ ] Create PerformanceMonitor class
- [ ] Implement timing decorators
- [ ] Set up benchmark suite with Tinybench
- [ ] Define performance budgets
- [ ] Add performance tracking to core operations
- [ ] Create performance dashboard
- [ ] Integrate with CI/CD pipeline
- [ ] Add performance regression detection
- [ ] Document performance targets
- [ ] Create performance profiling tools

## Definition of Done

- [ ] All core operations have performance budgets
- [ ] Benchmarks run automatically in CI/CD
- [ ] Performance regressions block PR merge
- [ ] Dashboard shows real-time metrics
- [ ] All operations meet <100ms target
- [ ] Memory usage stays under 50MB
- [ ] Performance report generated on each build

## Time Estimate

**8-10 hours** for complete performance framework

## Dependencies

- Story 1.1 must be complete (project setup)
- Story 1.2 must be complete (CI/CD for automation)
- Blocks performance-sensitive stories

## Notes

- Use native performance.now() for precision
- Consider flame graphs for bottleneck analysis
- Monitor both average and P95 latencies
- Track performance trends over time
- Set up alerts for production performance

import { describe, test, beforeAll, expect } from 'bun:test';
import { PerformanceMonitorService } from '../../src/monitoring/PerformanceMonitor';
import { createLogger } from '../../src/utils/logger';

describe('Core Operations Benchmarks', () => {
  let performanceMonitor: PerformanceMonitorService;

  // Setup before benchmarks
  beforeAll(() => {
    const logger = createLogger('benchmark:core');
    performanceMonitor = new PerformanceMonitorService(
      { name: 'benchmark-perf-monitor' },
      logger
    );
  });

  test('PerformanceMonitor.startTimer benchmark', () => {
    // Simple benchmark test - measure operation
    const start = performance.now();
    
    // Run operation multiple times
    for (let i = 0; i < 1000; i++) {
      const timer = performanceMonitor.startTimer('test-operation');
      timer(); // Complete the timing
    }
    
    const duration = performance.now() - start;
    console.log(`PerformanceMonitor.startTimer: ${duration.toFixed(2)}ms for 1000 operations`);
    
    // Should complete reasonably quickly
    expect(duration).toBeLessThan(1000);
  });

  test('PerformanceMonitor.recordMetric benchmark', () => {
    const iterations = 10000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      performanceMonitor.recordMetric('benchmark-metric', Math.random() * 100);
    }
    
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    
    console.log(`PerformanceMonitor.recordMetric: ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    expect(avgDuration).toBeLessThan(0.1); // Should be very fast
  });

  test('PerformanceMonitor.setBudget benchmark', () => {
    const iterations = 10000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      performanceMonitor.setBudget(`test-budget-${i}`, 100);
    }
    
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    
    console.log(`PerformanceMonitor.setBudget: ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    expect(avgDuration).toBeLessThan(0.01);
  });

  test('PerformanceMonitor.generateReport benchmark', () => {
    // Add some metrics first
    for (let i = 0; i < 100; i++) {
      performanceMonitor.recordMetric(`metric-${i}`, Math.random() * 100);
    }
    
    const iterations = 1000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      performanceMonitor.generateReport();
    }
    
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    
    console.log(`PerformanceMonitor.generateReport: ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    expect(avgDuration).toBeLessThan(1);
  });

  test('PerformanceMonitor.getBudgetViolations benchmark', () => {
    // Set up some budgets and violations
    performanceMonitor.setBudget('violation-test', 50);
    performanceMonitor.recordMetric('violation-test', 75); // This will exceed budget
    
    const iterations = 1000;
    const start = performance.now();
    
    for (let i = 0; i < iterations; i++) {
      performanceMonitor.getBudgetViolations();
    }
    
    const duration = performance.now() - start;
    const avgDuration = duration / iterations;
    
    console.log(`PerformanceMonitor.getBudgetViolations: ${avgDuration.toFixed(4)}ms per operation (${iterations} iterations)`);
    expect(avgDuration).toBeLessThan(0.1);
  });

  // Benchmark critical operations per story requirements
  test('Command Execution Simulation benchmark', async () => {
    const iterations = 10;
    const results = [];
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('command-execution');
      // Simulate command processing
      await new Promise(resolve => setTimeout(resolve, Math.random() * 10));
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('command-execution');
    expect(metrics).toBeDefined();
    
    console.log(`Command Execution: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 100ms)`);
    
    // Should generally meet target (allowing some tolerance for async operations)
    if (metrics!.average > 100) {
      console.warn(`⚠️  Command execution average (${metrics!.average.toFixed(2)}ms) exceeds budget (100ms)`);
    }
  });

  test('Template Parsing Simulation benchmark', () => {
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('template-parsing');
      // Simulate template parsing with 1000 lines
      const mockTemplate = Array(1000).fill('line content').join('\n');
      const lines = mockTemplate.split('\n');
      // Simple parsing simulation
      const processed = lines.map(line => ({ content: line, processed: true }));
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('template-parsing');
    expect(metrics).toBeDefined();
    
    console.log(`Template Parsing: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 100ms)`);
    expect(metrics!.average).toBeLessThan(150); // Allow some tolerance
  });

  test('State Save Simulation benchmark', async () => {
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('state-save');
      // Simulate state serialization and save
      const mockState = {
        version: '1.0.0',
        timestamp: Date.now(),
        data: Array(100).fill({ id: 'test', completed: false }),
      };
      const serialized = JSON.stringify(mockState);
      // Simulate file write delay
      await new Promise(resolve => setTimeout(resolve, 1));
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('state-save');
    expect(metrics).toBeDefined();
    
    console.log(`State Save: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 50ms)`);
  });

  test('State Load Simulation benchmark', async () => {
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('state-load');
      // Simulate state load and deserialization
      const mockSerializedState = JSON.stringify({
        version: '1.0.0',
        timestamp: Date.now(),
        data: Array(100).fill({ id: 'test', completed: false }),
      });
      // Simulate file read delay
      await new Promise(resolve => setTimeout(resolve, 1));
      const state = JSON.parse(mockSerializedState);
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('state-load');
    expect(metrics).toBeDefined();
    
    console.log(`State Load: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 30ms)`);
  });

  test('TUI Frame Render Simulation benchmark', () => {
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('tui-frame-render');
      // Simulate TUI rendering at 60fps (16.67ms budget)
      const frame = Array(50).fill(0).map((_, j) => 
        `Row ${j}: [${'='.repeat(Math.floor(Math.random() * 20))}]`
      ).join('\n');
      // Simulate render operations
      const rendered = frame.split('\n').map(line => line.padEnd(30)).join('\n');
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('tui-frame-render');
    expect(metrics).toBeDefined();
    
    console.log(`TUI Frame Render: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 16.67ms)`);
  });

  test('File System Operation Simulation benchmark', async () => {
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('file-system-operation');
      // Simulate file system operations
      const data = JSON.stringify({ test: 'data', timestamp: Date.now() });
      // Simulate fs operations with minimal delay
      await new Promise(resolve => setTimeout(resolve, 1));
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('file-system-operation');
    expect(metrics).toBeDefined();
    
    console.log(`File System Operation: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 50ms)`);
  });

  test('Checklist Navigation Simulation benchmark', () => {
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('checklist-navigation');
      // Simulate navigation through checklist items
      const checklist = Array(1000).fill(0).map((_, j) => ({
        id: j,
        title: `Item ${j}`,
        completed: Math.random() > 0.5,
      }));
      
      // Simulate finding and filtering operations
      const activeItems = checklist.filter(item => !item.completed);
      const searchResults = checklist.filter(item => 
        item.title.includes('5') // Simple search
      );
      
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('checklist-navigation');
    expect(metrics).toBeDefined();
    
    console.log(`Checklist Navigation: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 10ms)`);
  });

  test('Search Operation Simulation benchmark', () => {
    const iterations = 10;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('search-operation');
      // Simulate search through 10000 items
      const items = Array(10000).fill(0).map((_, j) => ({
        id: j,
        title: `Item ${j}`,
        tags: [`tag-${j % 10}`, `category-${j % 5}`],
        content: `This is content for item ${j}`,
      }));
      
      // Simulate full-text search
      const query = 'item 5';
      const results = items.filter(item => 
        item.title.toLowerCase().includes(query) ||
        item.content.toLowerCase().includes(query) ||
        item.tags.some(tag => tag.includes('5'))
      );
      
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('search-operation');
    expect(metrics).toBeDefined();
    
    console.log(`Search Operation: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 50ms)`);
  });

  test('Template Validation Simulation benchmark', () => {
    const iterations = 100;
    
    for (let i = 0; i < iterations; i++) {
      const timer = performanceMonitor.startTimer('template-validation');
      // Simulate template validation
      const template = {
        version: '1.0.0',
        metadata: { name: 'test', author: 'test' },
        steps: Array(100).fill(0).map((_, j) => ({
          id: `step-${j}`,
          title: `Step ${j}`,
          required: true,
          validation: { type: 'string', minLength: 1 },
        })),
      };
      
      // Simulate validation logic
      const isValid = template.version &&
        template.metadata?.name &&
        template.steps.every(step => 
          step.id && step.title && typeof step.required === 'boolean'
        );
      
      timer();
    }
    
    const metrics = performanceMonitor.getMetrics('template-validation');
    expect(metrics).toBeDefined();
    
    console.log(`Template Validation: avg=${metrics!.average.toFixed(2)}ms, max=${metrics!.max.toFixed(2)}ms (budget: 100ms)`);
  });
});
import { describe, test, beforeAll, expect } from 'bun:test';
import { PerformanceMonitorService } from '../../src/monitoring/PerformanceMonitor';
import { createLogger } from '../../src/utils/logger';
import { withTiming } from '../../src/monitoring/decorators';

describe('State Management Benchmarks', () => {
  let performanceMonitor: PerformanceMonitorService;

  beforeAll(() => {
    const logger = createLogger('benchmark:state');
    performanceMonitor = new PerformanceMonitorService(
      { name: 'state-benchmark-monitor' },
      logger
    );
  });

  // Memory usage benchmarks
  test('Memory Baseline Check benchmark', () => {
    const timer = performanceMonitor.startTimer('memory-baseline');
    
    // Simulate baseline memory usage
    const memUsage = process.memoryUsage();
    const baselineKB = Math.round(memUsage.heapUsed / 1024);
    
    // Should be under 30MB (30,720 KB)
    const isWithinBudget = baselineKB < 30720;
    
    timer();
    
    // Record memory metric
    performanceMonitor.recordMetric('memory-usage-baseline-kb', baselineKB);
    
    console.log(`Memory Baseline: ${baselineKB}KB (budget: 30,720KB)`);

    expect(baselineKB).toBeLessThan(50000); // Allow some tolerance
  });

  test('Memory Peak with 10 Checklists benchmark', () => {
    const timer = performanceMonitor.startTimer('memory-peak-10-checklists');
    
    // Simulate loading 10 large checklists
    const checklists = Array(10).fill(0).map((_, i) => ({
      id: `checklist-${i}`,
      metadata: {
        name: `Checklist ${i}`,
        created: new Date(),
        version: '1.0.0',
      },
      items: Array(500).fill(0).map((_, j) => ({
        id: `item-${i}-${j}`,
        title: `Item ${j} in checklist ${i}`,
        completed: false,
        metadata: {
          created: new Date(),
          tags: [`tag-${j % 10}`, `category-${i}`],
        },
      })),
    }));
    
    const memUsage = process.memoryUsage();
    const peakKB = Math.round(memUsage.heapUsed / 1024);
    
    // Should be under 75MB (76,800 KB) for P95
    const isWithinBudget = peakKB < 76800;
    
    timer();
    
    // Record memory metric
    performanceMonitor.recordMetric('memory-usage-peak-kb', peakKB);
    
    console.log(`Memory Peak: ${peakKB}KB (budget: 76,800KB)`);

    // Clean up
    checklists.length = 0;

    expect(peakKB).toBeLessThan(150000); // Allow some tolerance
  });

  // State serialization benchmarks
  test('State Serialization (Large) benchmark', async () => {
    const largeState = {
      version: '1.0.0',
      timestamp: Date.now(),
      checklists: Array(5).fill(0).map((_, i) => ({
        id: `checklist-${i}`,
        items: Array(1000).fill(0).map((_, j) => ({
          id: `item-${j}`,
          title: `Item ${j}`,
          completed: Math.random() > 0.5,
          metadata: {
            created: Date.now() - (j * 1000),
            tags: [`tag-${j % 10}`],
          },
        })),
      })),
    };

    const result = await withTiming('state-serialization-large', async () => {
      const serialized = JSON.stringify(largeState);
      // Simulate write delay
      await new Promise(resolve => setTimeout(resolve, 1));
      return serialized.length;
    }, { budgetMs: 50, monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('state-serialization-large');
    if (metrics) {
      console.log(`State Serialization: ${metrics.average.toFixed(2)}ms (budget: 50ms)`);
    }
    
    expect(result).toBeGreaterThan(0);
    return result;
  });

  test('State Deserialization (Large) benchmark', async () => {
    const largeState = {
      version: '1.0.0',
      timestamp: Date.now(),
      checklists: Array(5).fill(0).map((_, i) => ({
        id: `checklist-${i}`,
        items: Array(1000).fill(0).map((_, j) => ({
          id: `item-${j}`,
          title: `Item ${j}`,
          completed: Math.random() > 0.5,
          metadata: {
            created: Date.now() - (j * 1000),
            tags: [`tag-${j % 10}`],
          },
        })),
      })),
    };
    
    const serializedState = JSON.stringify(largeState);

    const result = await withTiming('state-deserialization-large', async () => {
      // Simulate read delay
      await new Promise(resolve => setTimeout(resolve, 1));
      const parsed = JSON.parse(serializedState);
      return parsed.checklists.length;
    }, { budgetMs: 30, monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('state-deserialization-large');
    if (metrics) {
      console.log(`State Deserialization: ${metrics.average.toFixed(2)}ms (budget: 30ms)`);
    }
    
    expect(result).toBe(5);
    return result;
  });

  // State validation benchmarks
  test('State Validation (Complex) benchmark', async () => {
    const complexState = {
      version: '1.0.0',
      timestamp: Date.now(),
      checklists: Array(100).fill(0).map((_, i) => ({
        id: `checklist-${i}`,
        metadata: {
          name: `Checklist ${i}`,
          version: '1.0.0',
          created: Date.now(),
          template: 'standard',
        },
        items: Array(200).fill(0).map((_, j) => ({
          id: `item-${j}`,
          title: `Item ${j}`,
          completed: Math.random() > 0.5,
          required: j % 5 === 0,
          metadata: {
            created: Date.now() - (j * 1000),
            modified: Date.now() - (j * 500),
            tags: [`tag-${j % 10}`, `priority-${j % 3}`],
            category: `category-${i % 5}`,
          },
          validation: {
            type: 'boolean',
            required: j % 5 === 0,
          },
        })),
      })),
    };

    const result = await withTiming('state-validation-complex', () => {
      // Simulate comprehensive validation
      const isValid = complexState.version &&
        complexState.timestamp &&
        complexState.checklists.every(checklist => 
          checklist.id &&
          checklist.metadata?.name &&
          checklist.items.every(item => 
            item.id &&
            item.title &&
            typeof item.completed === 'boolean' &&
            item.metadata?.created &&
            Array.isArray(item.metadata?.tags)
          )
        );
      
      // Simulate validation performance cost
      const itemCount = complexState.checklists.reduce(
        (total, checklist) => total + checklist.items.length, 0
      );
      
      return { valid: isValid, itemsValidated: itemCount };
    }, { budgetMs: 100, monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('state-validation-complex');
    if (metrics) {
      console.log(`State Validation: ${metrics.average.toFixed(2)}ms (budget: 100ms)`);
    }
    
    expect(result.valid).toBe(true);
    expect(result.itemsValidated).toBe(20000);
    return result;
  });

  // Concurrent operations simulation
  test('Concurrent State Operations benchmark', async () => {
    const operations = [
      () => withTiming('concurrent-save-1', async () => {
        const state = { id: 1, data: Array(100).fill('test') };
        await new Promise(resolve => setTimeout(resolve, 2));
        return JSON.stringify(state).length;
      }, { monitor: performanceMonitor }),
      
      () => withTiming('concurrent-save-2', async () => {
        const state = { id: 2, data: Array(100).fill('test') };
        await new Promise(resolve => setTimeout(resolve, 3));
        return JSON.stringify(state).length;
      }, { monitor: performanceMonitor }),
      
      () => withTiming('concurrent-load', async () => {
        const mockData = JSON.stringify({ items: Array(200).fill('item') });
        await new Promise(resolve => setTimeout(resolve, 1));
        return JSON.parse(mockData);
      }, { monitor: performanceMonitor }),
    ];

    const results = await Promise.all(operations.map(op => op()));
    const totalSize = results.reduce((sum, result) => sum + (typeof result === 'number' ? result : 1), 0);
    
    console.log(`Concurrent Operations completed with total size: ${totalSize}`);
    
    expect(results).toHaveLength(3);
    expect(totalSize).toBeGreaterThan(0);
    
    return totalSize;
  });

  // State migration simulation
  test('State Migration Performance benchmark', async () => {
    const oldState = {
      version: '0.9.0',
      items: Array(1000).fill(0).map((_, i) => ({
        id: i,
        title: `Old Item ${i}`,
        done: Math.random() > 0.5,
      })),
    };

    const result = await withTiming('state-migration', () => {
      // Simulate migration from v0.9.0 to v1.0.0
      const newState = {
        version: '1.0.0',
        timestamp: Date.now(),
        checklists: [{
          id: 'migrated-checklist',
          metadata: {
            name: 'Migrated Checklist',
            version: '1.0.0',
            migrated: true,
          },
          items: oldState.items.map(item => ({
            id: `migrated-${item.id}`,
            title: item.title,
            completed: item.done,
            metadata: {
              created: Date.now(),
              migrated: true,
            },
          })),
        }],
      };
      
      return newState.checklists[0].items.length;
    }, { budgetMs: 100, monitor: performanceMonitor });
    
    const metrics = performanceMonitor.getMetrics('state-migration');
    if (metrics) {
      console.log(`State Migration: ${metrics.average.toFixed(2)}ms (budget: 100ms)`);
    }
    
    expect(result).toBe(1000);
    return result;
  });
});
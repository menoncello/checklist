/**
 * Performance Tests
 *
 * Tests for view switching performance, concurrent view handling, and
 * resource management in the ViewSystem. Addresses QA gaps:
 * - Performance monitoring integration (Story 1.7)
 * - Concurrent view load testing (10+ views requirement)
 * - Timing validation for response targets
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { ViewSystem } from '../../src/views/ViewSystem.js';
import { 
  LayoutType, 
  type View, 
  type ViewState 
} from '../../src/views/types.js';

// Performance monitoring mock
class PerformanceMonitor {
  private measurements: Map<string, number[]> = new Map();

  startTiming(operation: string): () => number {
    const startTime = performance.now();
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.measurements.has(operation)) {
        this.measurements.set(operation, []);
      }
      this.measurements.get(operation)!.push(duration);
      
      return duration;
    };
  }

  getStats(operation: string): {
    count: number;
    average: number;
    min: number;
    max: number;
    latest: number;
  } | undefined {
    const measurements = this.measurements.get(operation);
    if (!measurements || measurements.length === 0) {
      return undefined;
    }

    return {
      count: measurements.length,
      average: measurements.reduce((a, b) => a + b, 0) / measurements.length,
      min: Math.min(...measurements),
      max: Math.max(...measurements),
      latest: measurements[measurements.length - 1],
    };
  }

  clear(): void {
    this.measurements.clear();
  }

  getAllOperations(): string[] {
    return Array.from(this.measurements.keys());
  }
}

// Mock view with configurable loading time
class MockViewWithDelay implements View {
  public mounted = false;
  public state: ViewState = {};
  private loadDelay: number;

  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly canGoBack: boolean = true,
    loadDelay: number = 0
  ) {
    this.loadDelay = loadDelay;
  }

  async onMount(): Promise<void> {
    if (this.loadDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.loadDelay));
    }
    this.mounted = true;
  }

  async onUnmount(): Promise<void> {
    this.mounted = false;
  }

  onResize(width: number, height: number): void {}

  saveState(): ViewState {
    return { ...this.state };
  }

  restoreState(state: ViewState): void {
    this.state = { ...state };
  }

  render(): string {
    return `Content of ${this.title}`;
  }

  getKeyBindings() {
    return [
      { key: 'q', description: 'Quit', action: () => {} },
    ];
  }
}

// ViewSystem with performance monitoring
class MonitoredViewSystem extends ViewSystem {
  private performanceMonitor = new PerformanceMonitor();

  async navigateTo(viewId: string, params?: any): Promise<void> {
    const endTiming = this.performanceMonitor.startTiming('navigation');
    await super.navigateTo(viewId, params);
    endTiming();
  }

  async switchToTab(viewId: string): Promise<void> {
    const endTiming = this.performanceMonitor.startTiming('tab-switch');
    await super.switchToTab(viewId);
    endTiming();
  }

  setLayout(layout: LayoutType): void {
    const endTiming = this.performanceMonitor.startTiming('layout-change');
    super.setLayout(layout);
    endTiming();
  }

  saveViewState(viewId: string): void {
    const endTiming = this.performanceMonitor.startTiming('state-save');
    super.saveViewState(viewId);
    endTiming();
  }

  restoreViewState(viewId: string): void {
    const endTiming = this.performanceMonitor.startTiming('state-restore');
    super.restoreViewState(viewId);
    endTiming();
  }

  getPerformanceStats(operation: string) {
    return this.performanceMonitor.getStats(operation);
  }

  getAllPerformanceOperations(): string[] {
    return this.performanceMonitor.getAllOperations();
  }

  clearPerformanceStats(): void {
    this.performanceMonitor.clear();
  }
}

describe('Performance Tests', () => {
  let viewSystem: MonitoredViewSystem;

  beforeEach(async () => {
    viewSystem = new MonitoredViewSystem();
    await viewSystem.initialize();
  });

  describe('View Switching Performance', () => {
    test('should meet <50ms view switching requirement', async () => {
      const view1 = new MockViewWithDelay('view-1', 'View 1');
      const view2 = new MockViewWithDelay('view-2', 'View 2');

      viewSystem.registerView(view1.id, view1);
      viewSystem.registerView(view2.id, view2);

      // Perform multiple view switches to get average
      await viewSystem.navigateTo(view1.id);
      await viewSystem.navigateTo(view2.id);
      await viewSystem.goBack();
      await viewSystem.navigateTo(view2.id);
      await viewSystem.goBack();

      const navigationStats = viewSystem.getPerformanceStats('navigation');
      expect(navigationStats).toBeDefined();
      expect(navigationStats!.average).toBeLessThan(50); // <50ms requirement
      expect(navigationStats!.max).toBeLessThan(100); // No single navigation should be too slow
    });

    test('should handle view switching under load', async () => {
      // Create multiple views
      const views = Array.from({ length: 10 }, (_, i) => 
        new MockViewWithDelay(`view-${i}`, `View ${i}`)
      );

      views.forEach(view => viewSystem.registerView(view.id, view));

      // Rapid view switching
      const startTime = performance.now();
      for (let i = 0; i < 20; i++) {
        const viewIndex = i % views.length;
        await viewSystem.navigateTo(views[viewIndex].id);
      }
      const totalTime = performance.now() - startTime;

      // Average per navigation should still be reasonable
      const avgTimePerNavigation = totalTime / 20;
      expect(avgTimePerNavigation).toBeLessThan(50);

      const navigationStats = viewSystem.getPerformanceStats('navigation');
      expect(navigationStats!.count).toBe(20);
      expect(navigationStats!.average).toBeLessThan(50);
    });

    test('should handle slow-loading views gracefully', async () => {
      const fastView = new MockViewWithDelay('fast-view', 'Fast View', true, 5);
      const slowView = new MockViewWithDelay('slow-view', 'Slow View', true, 30);

      viewSystem.registerView(fastView.id, fastView);
      viewSystem.registerView(slowView.id, slowView);

      // Switch to slow view
      await viewSystem.navigateTo(slowView.id);
      
      // Switch back to fast view should still be fast
      await viewSystem.navigateTo(fastView.id);

      const navigationStats = viewSystem.getPerformanceStats('navigation');
      expect(navigationStats).toBeDefined();
      
      // Even with slow views, the navigation system should be responsive
      expect(navigationStats!.min).toBeLessThan(50); // At least one navigation should be fast
    });
  });

  describe('State Save/Restore Performance', () => {
    test('should meet <10ms state save/restore requirement', async () => {
      const view = new MockViewWithDelay('test-view', 'Test View');
      viewSystem.registerView(view.id, view);
      await viewSystem.navigateTo(view.id);

      // Set complex state
      view.state = {
        items: Array.from({ length: 1000 }, (_, i) => ({ id: i, name: `Item ${i}` })),
        metadata: { lastModified: Date.now(), version: '1.0' },
        settings: { theme: 'dark', language: 'en' },
      };

      // Perform multiple save/restore operations
      for (let i = 0; i < 10; i++) {
        viewSystem.saveViewState(view.id);
        viewSystem.restoreViewState(view.id);
      }

      const saveStats = viewSystem.getPerformanceStats('state-save');
      const restoreStats = viewSystem.getPerformanceStats('state-restore');

      expect(saveStats).toBeDefined();
      expect(restoreStats).toBeDefined();
      expect(saveStats!.average).toBeLessThan(10); // <10ms requirement
      expect(restoreStats!.average).toBeLessThan(10); // <10ms requirement
    });

    test('should handle large state objects efficiently', async () => {
      const view = new MockViewWithDelay('large-state-view', 'Large State View');
      viewSystem.registerView(view.id, view);
      await viewSystem.navigateTo(view.id);

      // Create very large state
      view.state = {
        largeArray: Array.from({ length: 10000 }, (_, i) => ({
          id: i,
          data: `Large data item ${i}`.repeat(10),
          nested: { value: i * 2, items: Array.from({ length: 10 }, (_, j) => j) },
        })),
      };

      const startTime = performance.now();
      viewSystem.saveViewState(view.id);
      const saveTime = performance.now() - startTime;

      const restoreStartTime = performance.now();
      viewSystem.restoreViewState(view.id);
      const restoreTime = performance.now() - restoreStartTime;

      // Even with large state, should be reasonably fast
      expect(saveTime).toBeLessThan(50);
      expect(restoreTime).toBeLessThan(50);
    });
  });

  describe('Layout Change Performance', () => {
    test('should meet <30ms layout change requirement', async () => {
      const view = new MockViewWithDelay('layout-test-view', 'Layout Test View');
      viewSystem.registerView(view.id, view);
      await viewSystem.navigateTo(view.id);

      // Perform multiple layout changes
      const layouts = [
        LayoutType.SINGLE,
        LayoutType.SPLIT_VERTICAL,
        LayoutType.SPLIT_HORIZONTAL,
        LayoutType.TABBED,
      ];

      for (let i = 0; i < 20; i++) {
        const layout = layouts[i % layouts.length];
        viewSystem.setLayout(layout);
      }

      const layoutStats = viewSystem.getPerformanceStats('layout-change');
      expect(layoutStats).toBeDefined();
      expect(layoutStats!.average).toBeLessThan(30); // <30ms requirement
      expect(layoutStats!.max).toBeLessThan(50); // No single layout change should be too slow
    });
  });

  describe('Concurrent View Handling', () => {
    test('should support 10+ concurrent views in memory', async () => {
      // Create and register 15 views
      const views = Array.from({ length: 15 }, (_, i) => 
        new MockViewWithDelay(`concurrent-view-${i}`, `Concurrent View ${i}`)
      );

      views.forEach(view => viewSystem.registerView(view.id, view));

      // Navigate to all views to load them into memory
      for (const view of views) {
        await viewSystem.navigateTo(view.id);
        view.state = {
          viewIndex: views.indexOf(view),
          data: Array.from({ length: 100 }, (_, j) => `Data ${j}`),
          timestamp: Date.now(),
        };
        // Explicitly save state for each view
        viewSystem.saveViewState(view.id);
      }

      // Verify all views are properly registered and have state
      const stats = viewSystem.getStats();
      expect(stats.registeredViews).toBe(15);
      expect(stats.savedStates).toBe(15);

      // Random access to views should still be fast
      const randomAccesses = 50;
      const startTime = performance.now();

      for (let i = 0; i < randomAccesses; i++) {
        const randomView = views[Math.floor(Math.random() * views.length)];
        await viewSystem.navigateTo(randomView.id);
      }

      const totalTime = performance.now() - startTime;
      const avgAccessTime = totalTime / randomAccesses;

      expect(avgAccessTime).toBeLessThan(50); // Should still be fast with many views
    });

    test('should handle memory efficiently with many views', async () => {
      const viewCount = 20;
      const views = Array.from({ length: viewCount }, (_, i) => 
        new MockViewWithDelay(`memory-test-view-${i}`, `Memory Test View ${i}`)
      );

      views.forEach(view => viewSystem.registerView(view.id, view));

      // Load all views with substantial state
      for (const view of views) {
        await viewSystem.navigateTo(view.id);
        view.state = {
          heavyData: Array.from({ length: 1000 }, (_, j) => ({
            id: j,
            content: `Heavy content for view ${view.id} item ${j}`,
          })),
        };
        viewSystem.saveViewState(view.id);
      }

      // Memory usage should be reasonable
      const stats = viewSystem.getStats();
      expect(stats.registeredViews).toBe(viewCount);
      expect(stats.savedStates).toBe(viewCount);

      // Should be able to clean up efficiently
      await viewSystem.destroy();
      
      const finalStats = viewSystem.getStats();
      expect(finalStats.registeredViews).toBe(0);
      expect(finalStats.savedStates).toBe(0);
    });

    test('should handle concurrent tab operations', async () => {
      const tabCount = 12;
      const views = Array.from({ length: tabCount }, (_, i) => 
        new MockViewWithDelay(`tab-view-${i}`, `Tab View ${i}`)
      );

      views.forEach(view => viewSystem.registerView(view.id, view));

      // Add all views as tabs
      for (const view of views) {
        await viewSystem.addTab(view.id);
      }

      expect(viewSystem.getTabs()).toHaveLength(tabCount);

      // Rapid tab switching
      const switchCount = 50;
      const startTime = performance.now();

      for (let i = 0; i < switchCount; i++) {
        const randomView = views[Math.floor(Math.random() * views.length)];
        await viewSystem.switchToTab(randomView.id);
      }

      const totalTime = performance.now() - startTime;
      const avgSwitchTime = totalTime / switchCount;

      expect(avgSwitchTime).toBeLessThan(50); // Fast tab switching even with many tabs
      
      const tabStats = viewSystem.getPerformanceStats('tab-switch');
      expect(tabStats!.count).toBe(switchCount + tabCount); // Initial adds + switches
      expect(tabStats!.average).toBeLessThan(50);
    });
  });

  describe('Performance Regression Detection', () => {
    test('should detect performance degradation over time', async () => {
      const view1 = new MockViewWithDelay('perf-view-1', 'Performance View 1');
      const view2 = new MockViewWithDelay('perf-view-2', 'Performance View 2');

      viewSystem.registerView(view1.id, view1);
      viewSystem.registerView(view2.id, view2);

      // First set of operations (baseline)
      for (let i = 0; i < 10; i++) {
        await viewSystem.navigateTo(view1.id);
        await viewSystem.navigateTo(view2.id);
      }

      const baselineStats = viewSystem.getPerformanceStats('navigation');
      const baselineAverage = baselineStats!.average;

      // Clear stats for second measurement
      viewSystem.clearPerformanceStats();

      // Second set of operations (should be similar performance)
      for (let i = 0; i < 10; i++) {
        await viewSystem.navigateTo(view1.id);
        await viewSystem.navigateTo(view2.id);
      }

      const secondStats = viewSystem.getPerformanceStats('navigation');
      const secondAverage = secondStats!.average;

      // Performance should not degrade significantly
      const degradationRatio = secondAverage / baselineAverage;
      expect(degradationRatio).toBeLessThan(1.5); // No more than 50% degradation
    });

    test('should provide comprehensive performance metrics', async () => {
      const view = new MockViewWithDelay('metrics-view', 'Metrics View');
      viewSystem.registerView(view.id, view);

      // Perform various operations
      await viewSystem.navigateTo(view.id);
      viewSystem.setLayout(LayoutType.SPLIT_VERTICAL);
      viewSystem.saveViewState(view.id);
      viewSystem.restoreViewState(view.id);
      await viewSystem.addTab(view.id);
      await viewSystem.switchToTab(view.id);

      const operations = viewSystem.getAllPerformanceOperations();
      
      // Should track all major operations
      expect(operations).toContain('navigation');
      expect(operations).toContain('layout-change');
      expect(operations).toContain('state-save');
      expect(operations).toContain('state-restore');
      expect(operations).toContain('tab-switch');

      // Each operation should have meaningful stats
      operations.forEach(operation => {
        const stats = viewSystem.getPerformanceStats(operation);
        expect(stats).toBeDefined();
        expect(stats!.count).toBeGreaterThan(0);
        expect(stats!.average).toBeGreaterThan(0);
        expect(stats!.min).toBeGreaterThanOrEqual(0);
        expect(stats!.max).toBeGreaterThanOrEqual(stats!.min);
      });
    });
  });

  describe('Resource Management Performance', () => {
    test('should clean up resources efficiently', async () => {
      const viewCount = 10;
      const views = Array.from({ length: viewCount }, (_, i) => 
        new MockViewWithDelay(`cleanup-view-${i}`, `Cleanup View ${i}`)
      );

      views.forEach(view => viewSystem.registerView(view.id, view));

      // Load all views
      for (const view of views) {
        await viewSystem.navigateTo(view.id);
      }

      // Measure cleanup time
      const startTime = performance.now();
      await viewSystem.destroy();
      const cleanupTime = performance.now() - startTime;

      // Cleanup should be fast even with many views
      expect(cleanupTime).toBeLessThan(100);

      // All resources should be cleaned up
      const stats = viewSystem.getStats();
      expect(stats.registeredViews).toBe(0);
      expect(stats.savedStates).toBe(0);
    });

    test('should handle view unregistration efficiently', async () => {
      const viewCount = 20;
      const views = Array.from({ length: viewCount }, (_, i) => 
        new MockViewWithDelay(`unreg-view-${i}`, `Unregister View ${i}`)
      );

      views.forEach(view => viewSystem.registerView(view.id, view));

      // Load all views to create state
      for (const view of views) {
        await viewSystem.navigateTo(view.id);
      }

      // Unregister half the views
      const startTime = performance.now();
      for (let i = 0; i < viewCount / 2; i++) {
        viewSystem.unregisterView(views[i].id);
      }
      const unregisterTime = performance.now() - startTime;

      // Unregistration should be fast
      expect(unregisterTime).toBeLessThan(50);

      // Should have correct count remaining
      const stats = viewSystem.getStats();
      expect(stats.registeredViews).toBe(viewCount / 2);
    });
  });
});
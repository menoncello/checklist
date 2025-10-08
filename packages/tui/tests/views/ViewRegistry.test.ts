/**
 * ViewRegistry Tests
 * 
 * Tests for view registration, retrieval, and lifecycle management.
 */

import { describe, test, expect, beforeEach} from 'bun:test';
import { ViewRegistry } from '../../src/navigation/ViewRegistry.js';
import type { View, ViewParams, ViewState, KeyBinding} from '../../src/views/types.js';
// Mock view implementation for testing
class MockView implements View {
  public readonly id: string;
  public readonly title: string;
  public readonly canGoBack = true;
  
  private state: ViewState = {};

  constructor(id: string, title: string = 'Mock View') {
    this.id = id;
    this.title = title;
  }

  async onMount(params?: ViewParams): Promise<void> {
    // Mock implementation
  }

  async onUnmount(): Promise<void> {
    // Mock implementation
  }

  onResize(width: number, height: number): void {
    // Mock implementation
  }

  saveState(): ViewState {
    return { ...this.state };
  }

  restoreState(state: ViewState): void {
    this.state = { ...state };
  }

  render(): string {
    return `Mock view: ${this.title}`;
  }

  getKeyBindings(): KeyBinding[] {
    return [];
  }
}

describe('ViewRegistry', () => {
  let registry: ViewRegistry;
  let view1: MockView;
  let view2: MockView;

  beforeEach(() => {
    registry = new ViewRegistry();
    view1 = new MockView('view1', 'Test View 1');
    view2 = new MockView('view2', 'Test View 2');
  });

  describe('Registration', () => {
    test('should register views successfully', () => {
      registry.register('view1', view1);
      
      expect(registry.has('view1')).toBe(true);
      expect(registry.get('view1')).toBe(view1);
    });

    test('should throw error for duplicate registration', () => {
      registry.register('view1', view1);
      
      expect(() => registry.register('view1', view1)).toThrow(
        "View with id 'view1' is already registered"
      );
    });

    test('should throw error for mismatched id', () => {
      expect(() => registry.register('different-id', view1)).toThrow(
        "View id 'view1' does not match registration id 'different-id'"
      );
    });

    test('should unregister views successfully', () => {
      registry.register('view1', view1);
      registry.setActive('view1', true);
      
      const result = registry.unregister('view1');
      
      expect(result).toBe(true);
      expect(registry.has('view1')).toBe(false);
      expect(registry.get('view1')).toBeUndefined();
    });

    test('should return false when unregistering non-existent view', () => {
      const result = registry.unregister('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('Retrieval', () => {
    beforeEach(() => {
      registry.register('view1', view1);
      registry.register('view2', view2);
    });

    test('should retrieve view by id', () => {
      expect(registry.get('view1')).toBe(view1);
      expect(registry.get('view2')).toBe(view2);
    });

    test('should return undefined for non-existent view', () => {
      expect(registry.get('nonexistent')).toBeUndefined();
    });

    test('should check view existence', () => {
      expect(registry.has('view1')).toBe(true);
      expect(registry.has('nonexistent')).toBe(false);
    });

    test('should get all view ids', () => {
      const ids = registry.getViewIds();
      expect(ids).toContain('view1');
      expect(ids).toContain('view2');
      expect(ids).toHaveLength(2);
    });

    test('should get all views', () => {
      const views = registry.getViews();
      expect(views).toContain(view1);
      expect(views).toContain(view2);
      expect(views).toHaveLength(2);
    });
  });

  describe('Active State Management', () => {
    beforeEach(() => {
      registry.register('view1', view1);
      registry.register('view2', view2);
    });

    test('should set views as active/inactive', () => {
      registry.setActive('view1', true);
      registry.setActive('view2', false);
      
      const activeViews = registry.getActiveViews();
      expect(activeViews).toContain(view1);
      expect(activeViews).not.toContain(view2);
      expect(activeViews).toHaveLength(1);
    });

    test('should handle setting active state for non-existent view', () => {
      // Should not throw error
      registry.setActive('nonexistent', true);
      
      const activeViews = registry.getActiveViews();
      expect(activeViews).toHaveLength(0);
    });

    test('should get registration info', () => {
      registry.setActive('view1', true);
      
      const info = registry.getRegistrationInfo('view1');
      expect(info?.view).toBe(view1);
      expect(info?.isActive).toBe(true);
      expect(info?.registeredAt).toBeTypeOf('number');
    });

    test('should return undefined for non-existent registration info', () => {
      const info = registry.getRegistrationInfo('nonexistent');
      expect(info).toBeUndefined();
    });
  });

  describe('Cleanup', () => {
    beforeEach(() => {
      registry.register('view1', view1);
      registry.register('view2', view2);
      registry.setActive('view1', true);
      registry.setActive('view2', true);
    });

    test('should clear all views', () => {
      registry.clear();
      
      expect(registry.getViewIds()).toHaveLength(0);
      expect(registry.getActiveViews()).toHaveLength(0);
      expect(registry.has('view1')).toBe(false);
      expect(registry.has('view2')).toBe(false);
    });
  });

  describe('Statistics', () => {
    beforeEach(() => {
      registry.register('view1', view1);
      registry.register('view2', view2);
      registry.setActive('view1', true);
    });

    test('should provide accurate statistics', () => {
      const stats = registry.getStats();
      
      expect(stats.totalViews).toBe(2);
      expect(stats.activeViews).toBe(1);
      expect(stats.registeredViews).toContain('view1');
      expect(stats.registeredViews).toContain('view2');
    });

    test('should update statistics when views change', () => {
      registry.setActive('view2', true);
      
      const stats = registry.getStats();
      expect(stats.activeViews).toBe(2);
      
      registry.unregister('view1');
      const newStats = registry.getStats();
      expect(newStats.totalViews).toBe(1);
      expect(newStats.activeViews).toBe(1);
    });
  });
});
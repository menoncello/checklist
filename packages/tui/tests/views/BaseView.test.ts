/**
 * BaseView Tests
 * 
 * Tests for the BaseView abstract class functionality.
 */

import { describe, test, expect, beforeEach} from 'bun:test';
import { BaseView } from '../../src/views/BaseView';
import { KeyBinding, ViewState } from '../../src/views/types.js';
// Concrete implementation of BaseView for testing
class TestView extends BaseView {
  public renderCallCount = 0;
  public keyBindingsCallCount = 0;
  public handleMountCallCount = 0;
  public handleUnmountCallCount = 0;
  public handleResizeCallCount = 0;

  constructor(id: string, title: string, canGoBack = true) {
    super(id, title, canGoBack);
  }

  render(): string {
    this.renderCallCount++;
    return `Test View: ${this.title}`;
  }

  getKeyBindings(): KeyBinding[] {
    this.keyBindingsCallCount++;
    return [
      { key: 'Enter', description: 'Test action', action: () => {} },
      ...this.getCommonKeyBindings()
    ];
  }

  protected async handleMount(): Promise<void> {
    this.handleMountCallCount++;
  }

  protected async handleUnmount(): Promise<void> {
    this.handleUnmountCallCount++;
  }

  protected handleResize(width: number, height: number): void {
    this.handleResizeCallCount++;
    this.setState({ lastResize: { width, height } });
  }

  // Expose protected methods for testing
  public testSetState(state: Partial<ViewState>): void {
    this.setState(state);
  }

  public testGetState<T>(key: string): T | undefined {
    return this.getState<T>(key);
  }

  public testGetStateWithDefault<T>(key: string, defaultValue: T): T {
    return this.getStateWithDefault(key, defaultValue);
  }

  public testClearState(): void {
    this.clearState();
  }

  public testIsMounted(): boolean {
    return this.isMounted();
  }

  public testCreateSection(title: string, content: string, width?: number): string {
    return this.createSection(title, content, width);
  }

  public testCenterText(text: string, width: number): string {
    return this.centerText(text, width);
  }

  public testTruncateText(text: string, maxLength: number): string {
    return this.truncateText(text, maxLength);
  }
}

describe('BaseView', () => {
  let view: TestView;

  beforeEach(() => {
    view = new TestView('test-view', 'Test View Title');
  });

  describe('Construction', () => {
    test('should create view with correct properties', () => {
      expect(view.id).toBe('test-view');
      expect(view.title).toBe('Test View Title');
      expect(view.canGoBack).toBe(true);
    });

    test('should create view with canGoBack false', () => {
      const rootView = new TestView('root', 'Root View', false);
      expect(rootView.canGoBack).toBe(false);
    });
  });

  describe('Lifecycle Management', () => {
    test('should handle mount lifecycle', async () => {
      expect(view.testIsMounted()).toBe(false);
      
      await view.onMount({ param1: 'value1' });
      
      expect(view.testIsMounted()).toBe(true);
      expect(view.handleMountCallCount).toBe(1);
    });

    test('should handle unmount lifecycle', async () => {
      await view.onMount();
      expect(view.testIsMounted()).toBe(true);
      
      await view.onUnmount();
      
      expect(view.testIsMounted()).toBe(false);
      expect(view.handleUnmountCallCount).toBe(1);
    });

    test('should handle resize events', () => {
      view.onResize(100, 50);
      
      expect(view.handleResizeCallCount).toBe(1);
      expect(view.testGetState<{ width: number; height: number }>('lastResize')).toEqual({ width: 100, height: 50 });
    });
  });

  describe('State Management', () => {
    test('should save and restore state', () => {
      view.testSetState({ key1: 'value1', key2: 42 });
      
      const savedState = view.saveState();
      expect(savedState).toEqual({ key1: 'value1', key2: 42 });
      
      view.testClearState();
      view.restoreState(savedState);
      
      expect(view.testGetState<string>('key1')).toBe('value1');
      expect(view.testGetState<number>('key2')).toBe(42);
    });

    test('should handle state operations', () => {
      view.testSetState({ existing: 'value' });
      view.testSetState({ new: 'addition' });
      
      expect(view.testGetState<string>('existing')).toBe('value');
      expect(view.testGetState<string>('new')).toBe('addition');
    });

    test('should get state with default values', () => {
      const result1 = view.testGetStateWithDefault('nonexistent', 'default');
      expect(result1).toBe('default');
      
      view.testSetState({ existing: 'actual' });
      const result2 = view.testGetStateWithDefault('existing', 'default');
      expect(result2).toBe('actual');
    });

    test('should clear all state', () => {
      view.testSetState({ key1: 'value1', key2: 'value2' });
      view.testClearState();
      
      expect(view.testGetState<string>('key1')).toBeUndefined();
      expect(view.testGetState<string>('key2')).toBeUndefined();
    });
  });

  describe('Abstract Method Requirements', () => {
    test('should require render implementation', () => {
      const result = view.render();
      expect(result).toBe('Test View: Test View Title');
      expect(view.renderCallCount).toBe(1);
    });

    test('should require getKeyBindings implementation', () => {
      const bindings = view.getKeyBindings();
      expect(bindings).toHaveLength(4); // 1 custom + 3 common
      expect(view.keyBindingsCallCount).toBe(1);
    });
  });

  describe('Common Key Bindings', () => {
    test('should include help and exit bindings', () => {
      const bindings = view.getKeyBindings();
      
      const helpBinding = bindings.find(b => b.key === 'F1');
      expect(helpBinding?.description).toBe('Help');
      
      const exitBinding = bindings.find(b => b.key === 'Ctrl+C');
      expect(exitBinding?.description).toBe('Exit');
    });

    test('should include back binding when canGoBack is true', () => {
      const bindings = view.getKeyBindings();
      const backBinding = bindings.find(b => b.key === 'Escape');
      expect(backBinding?.description).toBe('Go back');
    });

    test('should not include back binding when canGoBack is false', () => {
      const rootView = new TestView('root', 'Root', false);
      const bindings = rootView.getKeyBindings();
      const backBinding = bindings.find(b => b.key === 'Escape');
      expect(backBinding).toBeUndefined();
    });
  });

  describe('Utility Methods', () => {
    test('should create formatted sections', () => {
      const section = view.testCreateSection('Test Section', 'Line 1\nLine 2', 20);
      
      expect(section).toContain('Test Section');
      expect(section).toContain('Line 1');
      expect(section).toContain('Line 2');
      expect(section).toContain('┌─');
      expect(section).toContain('└─');
    });

    test('should center text correctly', () => {
      const centered = view.testCenterText('Hello', 10);
      expect(centered).toBe('  Hello'); // 2 spaces + Hello
      
      const exactFit = view.testCenterText('Hello', 5);
      expect(exactFit).toBe('Hello'); // No padding needed
    });

    test('should truncate text with ellipsis', () => {
      const truncated = view.testTruncateText('This is a long text', 10);
      expect(truncated).toBe('This is...');
      
      const notTruncated = view.testTruncateText('Short', 10);
      expect(notTruncated).toBe('Short');
      
      const exactLength = view.testTruncateText('Exactly10!', 10);
      expect(exactLength).toBe('Exactly10!');
    });
  });

  describe('State Isolation', () => {
    test('should maintain separate state between instances', () => {
      const view1 = new TestView('view1', 'View 1');
      const view2 = new TestView('view2', 'View 2');
      
      view1.testSetState({ data: 'view1-data' });
      view2.testSetState({ data: 'view2-data' });
      
      expect(view1.testGetState<string>('data')).toBe('view1-data');
      expect(view2.testGetState<string>('data')).toBe('view2-data');
    });
  });
});
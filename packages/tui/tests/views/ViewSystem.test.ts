/**
 * ViewSystem Tests
 * 
 * Comprehensive tests for the main ViewSystem implementation
 * including navigation, state management, and lifecycle.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ViewSystem } from '../../src/views/ViewSystem.js';
import { LayoutType, View, ViewParams, ViewState, KeyBinding } from '../../src/views/types.js';

// Mock view implementation for testing
class MockView implements View {
  public readonly id: string;
  public readonly title: string;
  public readonly canGoBack = true;
  
  private state: ViewState = {};
  public mountCalls: ViewParams[] = [];
  public unmountCalls: number = 0;
  public resizeCalls: Array<{width: number, height: number}> = [];

  constructor(id: string, title: string = 'Mock View') {
    this.id = id;
    this.title = title;
  }

  async onMount(params?: ViewParams): Promise<void> {
    this.mountCalls.push(params || {});
  }

  async onUnmount(): Promise<void> {
    this.unmountCalls++;
  }

  onResize(width: number, height: number): void {
    this.resizeCalls.push({ width, height });
  }

  saveState(): ViewState {
    return { ...this.state, saveStateCallCount: (this.state.saveStateCallCount as number || 0) + 1 };
  }

  restoreState(state: ViewState): void {
    this.state = { ...state };
  }

  render(): string {
    return `Mock view: ${this.title}`;
  }

  getKeyBindings(): KeyBinding[] {
    return [
      { key: 'Enter', description: 'Test action', action: () => {} }
    ];
  }

  // Test utilities
  setState(state: ViewState): void {
    this.state = state;
  }

  getState(): ViewState {
    return this.state;
  }

  clearCallHistory(): void {
    this.mountCalls = [];
    this.unmountCalls = 0;
    this.resizeCalls = [];
  }
}

describe('ViewSystem', () => {
  let viewSystem: ViewSystem;
  let homeView: MockView;
  let settingsView: MockView;
  let helpView: MockView;

  beforeEach(async () => {
    viewSystem = new ViewSystem({
      maxHistorySize: 10,
      enableAnimations: false,
      defaultLayout: LayoutType.SINGLE
    });

    homeView = new MockView('home', 'Home View');
    settingsView = new MockView('settings', 'Settings View');
    helpView = new MockView('help', 'Help View');

    // Register views
    viewSystem.registerView('home', homeView);
    viewSystem.registerView('settings', settingsView);
    viewSystem.registerView('help', helpView);

    await viewSystem.initialize();
  });

  afterEach(async () => {
    await viewSystem.destroy();
  });

  describe('Initialization and Cleanup', () => {
    it('should initialize successfully', async () => {
      const newViewSystem = new ViewSystem();
      await newViewSystem.initialize();
      
      // Should not throw and should be ready for use
      expect(newViewSystem.getRegisteredViews()).toEqual([]);
    });

    it('should handle multiple initialization calls', async () => {
      await viewSystem.initialize();
      await viewSystem.initialize(); // Should not cause issues
      
      expect(viewSystem.getRegisteredViews()).toContain('home');
    });

    it('should destroy and cleanup properly', async () => {
      await viewSystem.navigateTo('home');
      await viewSystem.destroy();
      
      expect(homeView.unmountCalls).toBe(1);
    });
  });

  describe('View Registration', () => {
    it('should register views correctly', () => {
      const newView = new MockView('test', 'Test View');
      viewSystem.registerView('test', newView);
      
      expect(viewSystem.getView('test')).toBe(newView);
      expect(viewSystem.getRegisteredViews()).toContain('test');
    });

    it('should unregister views correctly', () => {
      viewSystem.unregisterView('help');
      
      expect(viewSystem.getView('help')).toBeUndefined();
      expect(viewSystem.getRegisteredViews()).not.toContain('help');
    });

    it('should get view by id', () => {
      expect(viewSystem.getView('home')).toBe(homeView);
      expect(viewSystem.getView('nonexistent')).toBeUndefined();
    });
  });

  describe('Navigation', () => {
    it('should navigate to view successfully', async () => {
      await viewSystem.navigateTo('home');
      
      expect(viewSystem.getCurrentView()).toBe(homeView);
      expect(homeView.mountCalls).toHaveLength(1);
    });

    it('should navigate with parameters', async () => {
      const params = { userId: 123, mode: 'edit' };
      await viewSystem.navigateTo('home', params);
      
      expect(homeView.mountCalls[0]).toEqual(params);
    });

    it('should handle navigation to non-existent view', async () => {
      await expect(viewSystem.navigateTo('nonexistent')).rejects.toThrow(
        "View 'nonexistent' not found"
      );
    });

    it('should require initialization before navigation', async () => {
      const newViewSystem = new ViewSystem();
      newViewSystem.registerView('test', new MockView('test'));
      
      await expect(newViewSystem.navigateTo('test')).rejects.toThrow(
        'ViewSystem not initialized'
      );
    });

    it('should unmount previous view when navigating', async () => {
      await viewSystem.navigateTo('home');
      await viewSystem.navigateTo('settings');
      
      expect(homeView.unmountCalls).toBe(1);
      expect(settingsView.mountCalls).toHaveLength(1);
    });
  });

  describe('Back Navigation', () => {
    it('should go back successfully', async () => {
      await viewSystem.navigateTo('home');
      await viewSystem.navigateTo('settings');
      
      const result = await viewSystem.goBack();
      
      expect(result).toBe(true);
      expect(viewSystem.getCurrentView()).toBe(homeView);
      expect(settingsView.unmountCalls).toBe(1);
      expect(homeView.mountCalls).toHaveLength(2); // Mounted twice
    });

    it('should not go back when no history', async () => {
      const result = await viewSystem.goBack();
      expect(result).toBe(false);
    });

    it('should not go back from single view', async () => {
      await viewSystem.navigateTo('home');
      
      expect(viewSystem.canGoBack()).toBe(false);
      const result = await viewSystem.goBack();
      expect(result).toBe(false);
    });

    it('should check canGoBack correctly', async () => {
      expect(viewSystem.canGoBack()).toBe(false);
      
      await viewSystem.navigateTo('home');
      expect(viewSystem.canGoBack()).toBe(false);
      
      await viewSystem.navigateTo('settings');
      expect(viewSystem.canGoBack()).toBe(true);
    });

    it('should clear history', async () => {
      await viewSystem.navigateTo('home');
      await viewSystem.navigateTo('settings');
      
      viewSystem.clearHistory();
      
      expect(viewSystem.canGoBack()).toBe(false);
      expect(viewSystem.getNavigationHistory()).toHaveLength(0);
    });
  });

  describe('State Management', () => {
    it('should save and restore view state', async () => {
      homeView.setState({ scrollPosition: 100, selectedItem: 'item1' });
      
      await viewSystem.navigateTo('home');
      viewSystem.saveViewState('home');
      
      homeView.setState({}); // Clear state
      viewSystem.restoreViewState('home');
      
      expect(homeView.getState().scrollPosition).toBe(100);
      expect(homeView.getState().selectedItem).toBe('item1');
    });

    it('should preserve state during navigation', async () => {
      await viewSystem.navigateTo('home');
      homeView.setState({ data: 'preserved' });
      
      await viewSystem.navigateTo('settings');
      await viewSystem.goBack();
      
      // State should be preserved
      expect(homeView.getState().data).toBe('preserved');
    });
  });

  describe('Layout Management', () => {
    it('should set and get layout', () => {
      viewSystem.setLayout(LayoutType.SPLIT_VERTICAL);
      expect(viewSystem.getLayout()).toBe(LayoutType.SPLIT_VERTICAL);
    });

    it('should trigger resize on layout change', async () => {
      await viewSystem.navigateTo('home');
      homeView.clearCallHistory();
      
      viewSystem.setLayout(LayoutType.SPLIT_HORIZONTAL);
      
      expect(homeView.resizeCalls).toHaveLength(1);
    });

    it('should handle split view navigation', async () => {
      await viewSystem.splitView('home', 'settings');
      
      expect(viewSystem.getLayout()).toBe(LayoutType.SPLIT_VERTICAL);
      expect(viewSystem.getCurrentView()).toBe(homeView);
    });

    it('should throw error for split view with non-existent views', async () => {
      await expect(viewSystem.splitView('nonexistent1', 'nonexistent2')).rejects.toThrow(
        'Both views must be registered for split view'
      );
    });
  });

  describe('Modal and Overlay', () => {
    it('should show and hide modal', async () => {
      const modal = {
        id: 'test-modal',
        title: 'Test Modal',
        content: 'Test content',
        buttons: []
      };

      const promise = viewSystem.showModal(modal);
      expect(viewSystem.getCurrentModal()).toBe(modal);
      
      viewSystem.hideModal();
      expect(viewSystem.getCurrentModal()).toBeNull();
      
      await promise; // Should resolve
    });

    it('should show and hide overlay', () => {
      const overlay = {
        id: 'test-overlay',
        content: 'Test overlay',
        position: { x: 10, y: 10 }
      };

      viewSystem.showOverlay(overlay);
      expect(viewSystem.getCurrentOverlay()).toBe(overlay);
      
      viewSystem.hideOverlay();
      expect(viewSystem.getCurrentOverlay()).toBeNull();
    });
  });

  describe('Statistics and Debugging', () => {
    it('should provide navigation history', async () => {
      await viewSystem.navigateTo('home');
      await viewSystem.navigateTo('settings');
      await viewSystem.navigateTo('help');
      
      const history = viewSystem.getNavigationHistory();
      expect(history).toHaveLength(3);
      expect(history.map(entry => entry.viewId)).toEqual(['home', 'settings', 'help']);
    });

    it('should provide accurate statistics', async () => {
      await viewSystem.navigateTo('home');
      await viewSystem.navigateTo('settings');
      
      const stats = viewSystem.getStats();
      expect(stats.navigationStackSize).toBe(2);
      expect(stats.registeredViews).toBe(3);
      expect(stats.activeViews).toBe(1);
    });

    it('should track saved states', async () => {
      await viewSystem.navigateTo('home');
      viewSystem.saveViewState('home');
      
      const stats = viewSystem.getStats();
      expect(stats.savedStates).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle view mounting errors gracefully', async () => {
      const errorView = new MockView('error-view');
      errorView.onMount = async () => {
        throw new Error('Mount failed');
      };
      
      viewSystem.registerView('error-view', errorView);
      
      await expect(viewSystem.navigateTo('error-view')).rejects.toThrow('Mount failed');
    });

    it('should handle state operations on non-existent views', () => {
      // Should not throw errors
      viewSystem.saveViewState('nonexistent');
      viewSystem.restoreViewState('nonexistent');
    });
  });
});
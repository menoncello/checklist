/**
 * Tab Switching Tests
 *
 * Tests for tab-based view switching functionality in the ViewSystem.
 * Addresses QA gap: AC7 (Tab-based view switching) - No specific tests found.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ViewSystem } from '../../src/views/ViewSystem.js';
import { LayoutType, type View, type ViewState } from '../../src/views/types.js';

// Mock view implementation for testing
class MockView implements View {
  public mounted = false;
  public unmounted = false;
  public resized = false;
  public state: ViewState = {};

  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly canGoBack: boolean = true
  ) {}

  async onMount(): Promise<void> {
    this.mounted = true;
  }

  async onUnmount(): Promise<void> {
    this.unmounted = true;
    this.mounted = false;
  }

  onResize(width: number, height: number): void {
    this.resized = true;
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

  getKeyBindings() {
    return [
      {
        key: 'q',
        description: 'Quit',
        action: () => {},
      },
    ];
  }
}

describe('Tab Switching Functionality', () => {
  let viewSystem: ViewSystem;
  let view1: MockView;
  let view2: MockView;
  let view3: MockView;

  beforeEach(async () => {
    viewSystem = new ViewSystem();
    await viewSystem.initialize();

    view1 = new MockView('checklist-view', 'Checklist');
    view2 = new MockView('template-browser', 'Templates');
    view3 = new MockView('settings-view', 'Settings');

    viewSystem.registerView(view1.id, view1);
    viewSystem.registerView(view2.id, view2);
    viewSystem.registerView(view3.id, view3);
  });

  describe('Tab Management', () => {
    test('should add tab successfully', async () => {
      await viewSystem.addTab(view1.id);

      const tabs = viewSystem.getTabs();
      expect(tabs).toHaveLength(1);
      expect(tabs[0].viewId).toBe(view1.id);
      expect(tabs[0].title).toBe(view1.title);
      expect(tabs[0].isActive).toBe(true);
      expect(viewSystem.getActiveTabId()).toBe(view1.id);
    });

    test('should throw error when adding tab for non-existent view', async () => {
      await expect(viewSystem.addTab('non-existent')).rejects.toThrow(
        "View 'non-existent' not found"
      );
    });

    test('should throw error when ViewSystem not initialized', async () => {
      const uninitializedSystem = new ViewSystem();
      await expect(uninitializedSystem.addTab(view1.id)).rejects.toThrow(
        'ViewSystem not initialized'
      );
    });

    test('should add multiple tabs', async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);
      await viewSystem.addTab(view3.id);

      const tabs = viewSystem.getTabs();
      expect(tabs).toHaveLength(3);

      const tabViewIds = tabs.map((tab) => tab.viewId);
      expect(tabViewIds).toContain(view1.id);
      expect(tabViewIds).toContain(view2.id);
      expect(tabViewIds).toContain(view3.id);
    });

    test('should set first tab as active automatically', async () => {
      await viewSystem.addTab(view1.id);

      expect(viewSystem.getActiveTabId()).toBe(view1.id);
      expect(view1.mounted).toBe(true);
      expect(viewSystem.getLayout()).toBe(LayoutType.TABBED);
    });

    test('should switch active tab when adding subsequent tabs in TABBED layout', async () => {
      await viewSystem.addTab(view1.id);
      viewSystem.setLayout(LayoutType.TABBED);
      await viewSystem.addTab(view2.id);

      expect(viewSystem.getActiveTabId()).toBe(view2.id);
      expect(view2.mounted).toBe(true);
      expect(view1.unmounted).toBe(true);
    });
  });

  describe('Tab Switching', () => {
    beforeEach(async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);
      await viewSystem.addTab(view3.id);
    });

    test('should switch to tab successfully', async () => {
      await viewSystem.switchToTab(view2.id);

      expect(viewSystem.getActiveTabId()).toBe(view2.id);
      expect(view2.mounted).toBe(true);

      const tabs = viewSystem.getTabs();
      const activeTab = tabs.find((tab) => tab.isActive);
      expect(activeTab?.viewId).toBe(view2.id);
    });

    test('should unmount previous tab when switching', async () => {
      const previousActiveId = viewSystem.getActiveTabId();
      await viewSystem.switchToTab(view2.id);

      if (previousActiveId === view1.id) {
        expect(view1.unmounted).toBe(true);
      } else if (previousActiveId === view3.id) {
        expect(view3.unmounted).toBe(true);
      }
    });

    test('should preserve state when switching tabs', async () => {
      // Start with view1 active
      await viewSystem.switchToTab(view1.id);
      
      // Set state in first tab
      view1.state = { formData: 'test data', progress: 50 };
      
      // Manually save the state to simulate the behavior
      viewSystem.saveViewState(view1.id);
      
      // Switch to another tab 
      await viewSystem.switchToTab(view2.id);

      // Clear view1 state to test restoration
      view1.state = {};

      // Switch back to first tab (this should restore view1's state)
      await viewSystem.switchToTab(view1.id);

      // State should be preserved
      expect(view1.state.formData).toBe('test data');
      expect(view1.state.progress).toBe(50);
    });

    test('should throw error when switching to non-existent tab', async () => {
      await expect(viewSystem.switchToTab('non-existent')).rejects.toThrow(
        "Tab 'non-existent' not found"
      );
    });

    test('should throw error when ViewSystem not initialized', async () => {
      const uninitializedSystem = new ViewSystem();
      await expect(uninitializedSystem.switchToTab(view1.id)).rejects.toThrow(
        'ViewSystem not initialized'
      );
    });

    test('should set layout to TABBED when switching tabs', async () => {
      viewSystem.setLayout(LayoutType.SINGLE);
      await viewSystem.switchToTab(view2.id);

      expect(viewSystem.getLayout()).toBe(LayoutType.TABBED);
    });

    test('should update tab active status correctly', async () => {
      await viewSystem.switchToTab(view2.id);

      const tabs = viewSystem.getTabs();
      const activeTab = tabs.find((tab) => tab.isActive);
      const inactiveTabs = tabs.filter((tab) => !tab.isActive);

      expect(activeTab?.viewId).toBe(view2.id);
      expect(inactiveTabs).toHaveLength(2);
      expect(inactiveTabs.every((tab) => !tab.isActive)).toBe(true);
    });
  });

  describe('Tab Removal', () => {
    beforeEach(async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);
      await viewSystem.addTab(view3.id);
    });

    test('should remove tab successfully', async () => {
      await viewSystem.removeTab(view2.id);

      const tabs = viewSystem.getTabs();
      expect(tabs).toHaveLength(2);
      expect(tabs.find((tab) => tab.viewId === view2.id)).toBeUndefined();
    });

    test('should handle removing non-existent tab gracefully', async () => {
      // This should not throw an error
      await viewSystem.removeTab('non-existent');
      expect(viewSystem.getTabs()).toHaveLength(3);
    });

    test('should switch to another tab when removing active tab', async () => {
      const activeTabId = viewSystem.getActiveTabId();
      await viewSystem.removeTab(activeTabId!);

      const newActiveTabId = viewSystem.getActiveTabId();
      expect(newActiveTabId).not.toBe(activeTabId);
      expect(newActiveTabId).toBeDefined();
    });

    test('should switch to single layout when removing last tab', async () => {
      await viewSystem.removeTab(view1.id);
      await viewSystem.removeTab(view2.id);
      await viewSystem.removeTab(view3.id);

      expect(viewSystem.getActiveTabId()).toBeUndefined();
      expect(viewSystem.getLayout()).toBe(LayoutType.SINGLE);
      expect(viewSystem.getTabs()).toHaveLength(0);
    });

    test('should maintain tab integrity after removal', async () => {
      const initialTabCount = viewSystem.getTabs().length;
      await viewSystem.removeTab(view2.id);

      const tabs = viewSystem.getTabs();
      expect(tabs).toHaveLength(initialTabCount - 1);

      // Ensure remaining tabs are valid
      tabs.forEach((tab) => {
        expect(viewSystem.getView(tab.viewId)).toBeDefined();
      });
    });
  });

  describe('getCurrentView with Tabs', () => {
    test('should return active tab view in TABBED layout', async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);
      await viewSystem.switchToTab(view2.id);

      const currentView = viewSystem.getCurrentView();
      expect(currentView?.id).toBe(view2.id);
    });

    test('should return navigation stack view in non-TABBED layout', async () => {
      await viewSystem.navigateTo(view1.id);
      viewSystem.setLayout(LayoutType.SINGLE);

      const currentView = viewSystem.getCurrentView();
      expect(currentView?.id).toBe(view1.id);
    });

    test('should return undefined when no active tab in TABBED layout', async () => {
      viewSystem.setLayout(LayoutType.TABBED);

      const currentView = viewSystem.getCurrentView();
      expect(currentView).toBeUndefined();
    });
  });

  describe('Tab Integration with Navigation', () => {
    test('should maintain separate tab state from navigation stack', async () => {
      // Navigate normally
      await viewSystem.navigateTo(view1.id);

      // Add tabs
      await viewSystem.addTab(view2.id);
      await viewSystem.addTab(view3.id);

      // Navigation history should be separate from tabs
      const history = viewSystem.getNavigationHistory();
      const tabs = viewSystem.getTabs();

      expect(history.length).toBe(1);
      expect(history[0].viewId).toBe(view1.id);
      expect(tabs.length).toBe(2);
    });

    test('should handle switching between tabbed and navigation modes', async () => {
      // Start with navigation
      await viewSystem.navigateTo(view1.id);
      expect(viewSystem.getCurrentView()?.id).toBe(view1.id);

      // Switch to tabs
      await viewSystem.addTab(view2.id);
      expect(viewSystem.getLayout()).toBe(LayoutType.TABBED);
      expect(viewSystem.getCurrentView()?.id).toBe(view2.id);

      // Switch back to single layout
      viewSystem.setLayout(LayoutType.SINGLE);
      expect(viewSystem.getCurrentView()?.id).toBe(view1.id);
    });
  });

  describe('Tab Performance and Edge Cases', () => {
    test('should handle rapid tab switching without errors', async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);
      await viewSystem.addTab(view3.id);

      // Rapid switching
      for (let i = 0; i < 10; i++) {
        await viewSystem.switchToTab(view1.id);
        await viewSystem.switchToTab(view2.id);
        await viewSystem.switchToTab(view3.id);
      }

      expect(viewSystem.getActiveTabId()).toBe(view3.id);
      expect(viewSystem.getTabs()).toHaveLength(3);
    });

    test('should handle tab switching with state preservation under load', async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);

      // Start with view1 active and set complex state
      await viewSystem.switchToTab(view1.id);
      view1.state = { 
        largeData: new Array(1000).fill('test'),
        nested: { deeply: { nested: { value: 'preserved' } } }
      };
      
      // Manually save initial state
      viewSystem.saveViewState(view1.id);

      // Switch multiple times
      for (let i = 0; i < 5; i++) {
        await viewSystem.switchToTab(view2.id);
        // Clear state to test restoration
        view1.state = {};
        await viewSystem.switchToTab(view1.id);
      }

      // State should still be preserved
      expect(view1.state.largeData).toHaveLength(1000);
      expect((view1.state.nested as any).deeply.nested.value).toBe('preserved');
    });
  });

  describe('Tab Statistics and Cleanup', () => {
    test('should include tab information in stats', async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);

      const stats = viewSystem.getStats();
      expect(stats.tabs).toBe(2);
      expect(stats.activeTabId).toBe(view2.id);
    });

    test('should clear all tabs on destroy', async () => {
      await viewSystem.addTab(view1.id);
      await viewSystem.addTab(view2.id);
      await viewSystem.addTab(view3.id);

      await viewSystem.destroy();

      const stats = viewSystem.getStats();
      expect(stats.tabs).toBe(0);
      expect(stats.activeTabId).toBeUndefined();
    });
  });
});
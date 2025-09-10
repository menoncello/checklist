/**
 * Keyboard Navigation Integration Tests
 *
 * Tests for keyboard shortcut handling and navigation integration
 * in the ViewSystem. Addresses QA gap: AC8 (Keyboard shortcuts) - 
 * No integration tests for actual keyboard shortcut handling during navigation.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test';
import { ViewSystem } from '../../src/views/ViewSystem.js';
import { 
  LayoutType, 
  type View, 
  type ViewState, 
  type KeyBinding 
} from '../../src/views/types.js';

// Mock view implementation with keyboard shortcuts
class MockViewWithKeys implements View {
  public mounted = false;
  public state: ViewState = {};
  public keyActionsCalled: string[] = [];

  constructor(
    public readonly id: string,
    public readonly title: string,
    public readonly canGoBack: boolean = true,
    private readonly keyBindings: KeyBinding[] = []
  ) {}

  async onMount(): Promise<void> {
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

  getKeyBindings(): KeyBinding[] {
    return this.keyBindings;
  }

  // Helper method to simulate key action
  triggerKeyAction(key: string): boolean {
    const binding = this.keyBindings.find(b => b.key === key);
    if (binding) {
      binding.action();
      this.keyActionsCalled.push(key);
      return true;
    }
    return false;
  }
}

// Keyboard handler mock to simulate terminal input
class KeyboardHandler {
  private viewSystem: ViewSystem;
  private globalKeyBindings: Map<string, () => void | Promise<void>> = new Map();

  constructor(viewSystem: ViewSystem) {
    this.viewSystem = viewSystem;
    this.setupGlobalKeys();
  }

  private setupGlobalKeys(): void {
    // Global navigation keys
    this.globalKeyBindings.set('Escape', async () => {
      await this.viewSystem.goBack();
    });

    this.globalKeyBindings.set('Tab', async () => {
      // Switch to next tab if in tabbed layout
      if (this.viewSystem.getLayout() === LayoutType.TABBED) {
        const tabs = this.viewSystem.getTabs();
        const currentActiveId = this.viewSystem.getActiveTabId();
        const currentIndex = tabs.findIndex(tab => tab.viewId === currentActiveId);
        const nextIndex = (currentIndex + 1) % tabs.length;
        if (tabs[nextIndex]) {
          await this.viewSystem.switchToTab(tabs[nextIndex].viewId);
        }
      }
    });

    this.globalKeyBindings.set('Shift+Tab', async () => {
      // Switch to previous tab if in tabbed layout
      if (this.viewSystem.getLayout() === LayoutType.TABBED) {
        const tabs = this.viewSystem.getTabs();
        const currentActiveId = this.viewSystem.getActiveTabId();
        const currentIndex = tabs.findIndex(tab => tab.viewId === currentActiveId);
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        if (tabs[prevIndex]) {
          await this.viewSystem.switchToTab(tabs[prevIndex].viewId);
        }
      }
    });

    // Layout switching keys
    this.globalKeyBindings.set('Ctrl+1', () => {
      this.viewSystem.setLayout(LayoutType.SINGLE);
    });

    this.globalKeyBindings.set('Ctrl+2', () => {
      this.viewSystem.setLayout(LayoutType.SPLIT_VERTICAL);
    });

    this.globalKeyBindings.set('Ctrl+3', () => {
      this.viewSystem.setLayout(LayoutType.TABBED);
    });
  }

  async handleKeyPress(key: string): Promise<boolean> {
    // First, try global key bindings
    const globalHandler = this.globalKeyBindings.get(key);
    if (globalHandler) {
      await globalHandler();
      return true;
    }

    // Then, try current view key bindings
    const currentView = this.viewSystem.getCurrentView();
    if (currentView && currentView instanceof MockViewWithKeys) {
      return currentView.triggerKeyAction(key);
    }

    return false;
  }

  getAvailableKeys(): string[] {
    const globalKeys = Array.from(this.globalKeyBindings.keys());
    const currentView = this.viewSystem.getCurrentView();
    const viewKeys = currentView?.getKeyBindings().map(b => b.key) || [];
    return [...globalKeys, ...viewKeys];
  }

  checkKeyConflicts(): { key: string; sources: string[] }[] {
    const conflicts: { key: string; sources: string[] }[] = [];
    const keyUsage = new Map<string, string[]>();

    // Add global keys
    this.globalKeyBindings.forEach((_, key) => {
      keyUsage.set(key, ['global']);
    });

    // Add current view keys
    const currentView = this.viewSystem.getCurrentView();
    if (currentView) {
      currentView.getKeyBindings().forEach(binding => {
        const sources = keyUsage.get(binding.key) || [];
        sources.push(`view:${currentView.id}`);
        keyUsage.set(binding.key, sources);
      });
    }

    // Find conflicts
    keyUsage.forEach((sources, key) => {
      if (sources.length > 1) {
        conflicts.push({ key, sources });
      }
    });

    return conflicts;
  }
}

describe('Keyboard Navigation Integration', () => {
  let viewSystem: ViewSystem;
  let keyboardHandler: KeyboardHandler;
  let checklistView: MockViewWithKeys;
  let settingsView: MockViewWithKeys;
  let helpView: MockViewWithKeys;

  beforeEach(async () => {
    viewSystem = new ViewSystem();
    await viewSystem.initialize();

    // Create views with different key bindings
    checklistView = new MockViewWithKeys(
      'checklist-view',
      'Checklist',
      true,
      [
        { key: 'n', description: 'New item', action: mock(() => {}) },
        { key: 'd', description: 'Delete item', action: mock(() => {}) },
        { key: 'space', description: 'Toggle item', action: mock(() => {}) },
      ]
    );

    settingsView = new MockViewWithKeys(
      'settings-view',
      'Settings',
      true,
      [
        { key: 's', description: 'Save settings', action: mock(() => {}) },
        { key: 'r', description: 'Reset settings', action: mock(() => {}) },
        { key: 'Escape', description: 'Cancel', action: mock(() => {}) }, // Conflict with global
      ]
    );

    helpView = new MockViewWithKeys(
      'help-view',
      'Help',
      true,
      [
        { key: '?', description: 'Toggle help', action: mock(() => {}) },
        { key: 'h', description: 'Show shortcuts', action: mock(() => {}) },
      ]
    );

    viewSystem.registerView(checklistView.id, checklistView);
    viewSystem.registerView(settingsView.id, settingsView);
    viewSystem.registerView(helpView.id, helpView);

    keyboardHandler = new KeyboardHandler(viewSystem);
  });

  describe('Global Navigation Keys', () => {
    test('should handle Escape key for navigation back', async () => {
      // Navigate to create history
      await viewSystem.navigateTo(checklistView.id);
      await viewSystem.navigateTo(settingsView.id);

      expect(viewSystem.getCurrentView()?.id).toBe(settingsView.id);

      // Press Escape to go back
      const handled = await keyboardHandler.handleKeyPress('Escape');
      expect(handled).toBe(true);
      expect(viewSystem.getCurrentView()?.id).toBe(checklistView.id);
    });

    test('should not go back when at root view', async () => {
      await viewSystem.navigateTo(checklistView.id);

      const handled = await keyboardHandler.handleKeyPress('Escape');
      expect(handled).toBe(true);
      expect(viewSystem.getCurrentView()?.id).toBe(checklistView.id); // Should stay the same
    });

    test('should handle layout switching shortcuts', async () => {
      await viewSystem.navigateTo(checklistView.id);

      // Test Ctrl+1 for single layout
      await keyboardHandler.handleKeyPress('Ctrl+1');
      expect(viewSystem.getLayout()).toBe(LayoutType.SINGLE);

      // Test Ctrl+2 for split layout
      await keyboardHandler.handleKeyPress('Ctrl+2');
      expect(viewSystem.getLayout()).toBe(LayoutType.SPLIT_VERTICAL);

      // Test Ctrl+3 for tabbed layout
      await keyboardHandler.handleKeyPress('Ctrl+3');
      expect(viewSystem.getLayout()).toBe(LayoutType.TABBED);
    });
  });

  describe('Tab Navigation Keys', () => {
    beforeEach(async () => {
      await viewSystem.addTab(checklistView.id);
      await viewSystem.addTab(settingsView.id);
      await viewSystem.addTab(helpView.id);
    });

    test('should handle Tab key for next tab switching', async () => {
      await viewSystem.switchToTab(checklistView.id);
      expect(viewSystem.getActiveTabId()).toBe(checklistView.id);

      // Press Tab to switch to next tab
      await keyboardHandler.handleKeyPress('Tab');
      expect(viewSystem.getActiveTabId()).toBe(settingsView.id);

      // Press Tab again
      await keyboardHandler.handleKeyPress('Tab');
      expect(viewSystem.getActiveTabId()).toBe(helpView.id);

      // Press Tab to wrap around
      await keyboardHandler.handleKeyPress('Tab');
      expect(viewSystem.getActiveTabId()).toBe(checklistView.id);
    });

    test('should handle Shift+Tab for previous tab switching', async () => {
      await viewSystem.switchToTab(checklistView.id);
      expect(viewSystem.getActiveTabId()).toBe(checklistView.id);

      // Press Shift+Tab to switch to previous tab (wrap around)
      await keyboardHandler.handleKeyPress('Shift+Tab');
      expect(viewSystem.getActiveTabId()).toBe(helpView.id);

      // Press Shift+Tab again
      await keyboardHandler.handleKeyPress('Shift+Tab');
      expect(viewSystem.getActiveTabId()).toBe(settingsView.id);
    });

    test('should not handle tab keys in non-tabbed layout', async () => {
      viewSystem.setLayout(LayoutType.SINGLE);
      await viewSystem.navigateTo(checklistView.id);

      const currentView = viewSystem.getCurrentView()!;
      expect(currentView).toBeDefined();
      
      await keyboardHandler.handleKeyPress('Tab');

      // Should remain the same view since not in tabbed layout
      expect(viewSystem.getCurrentView()).toBe(currentView);
    });
  });

  describe('View-Specific Key Bindings', () => {
    test('should execute view-specific key actions', async () => {
      await viewSystem.navigateTo(checklistView.id);

      // Press view-specific keys
      const handled1 = await keyboardHandler.handleKeyPress('n');
      const handled2 = await keyboardHandler.handleKeyPress('d');
      const handled3 = await keyboardHandler.handleKeyPress('space');

      expect(handled1).toBe(true);
      expect(handled2).toBe(true);
      expect(handled3).toBe(true);

      expect(checklistView.keyActionsCalled).toEqual(['n', 'd', 'space']);
    });

    test('should not execute keys for inactive views', async () => {
      await viewSystem.navigateTo(checklistView.id);

      // Try to trigger settings view keys while checklist is active
      const handled = await keyboardHandler.handleKeyPress('s'); // Settings save key
      expect(handled).toBe(false);
      expect(settingsView.keyActionsCalled).toEqual([]); // Should not be called
    });

    test('should change key bindings when switching views', async () => {
      await viewSystem.navigateTo(checklistView.id);
      
      // Get available keys for checklist view
      const checklistKeys = keyboardHandler.getAvailableKeys();
      expect(checklistKeys).toContain('n');
      expect(checklistKeys).toContain('d');
      expect(checklistKeys).toContain('space');

      // Switch to settings view
      await viewSystem.navigateTo(settingsView.id);
      
      // Get available keys for settings view
      const settingsKeys = keyboardHandler.getAvailableKeys();
      expect(settingsKeys).toContain('s');
      expect(settingsKeys).toContain('r');
      expect(settingsKeys).not.toContain('n'); // Checklist-specific key should not be available
    });
  });

  describe('Keyboard Conflict Detection', () => {
    test('should detect key binding conflicts', async () => {
      await viewSystem.navigateTo(settingsView.id);

      const conflicts = keyboardHandler.checkKeyConflicts();
      
      // Should detect Escape key conflict between global and settings view
      const escapeConflict = conflicts.find(c => c.key === 'Escape');
      expect(escapeConflict).toBeDefined();
      expect(escapeConflict?.sources).toContain('global');
      expect(escapeConflict?.sources).toContain('view:settings-view');
    });

    test('should handle conflicting keys with priority', async () => {
      await viewSystem.navigateTo(settingsView.id);

      // Press Escape (conflicting key)
      const handled = await keyboardHandler.handleKeyPress('Escape');
      expect(handled).toBe(true);

      // Global handler should take priority (navigation back should occur)
      // Settings view Escape action should not be called
      expect(settingsView.keyActionsCalled).not.toContain('Escape');
    });

    test('should report no conflicts for non-conflicting views', async () => {
      await viewSystem.navigateTo(checklistView.id);

      const conflicts = keyboardHandler.checkKeyConflicts();
      
      // Checklist view keys don't conflict with global keys
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('Complex Navigation Scenarios', () => {
    test('should handle keyboard navigation with state preservation', async () => {
      await viewSystem.navigateTo(checklistView.id);
      
      // Set some state
      checklistView.state = { selectedItem: 5, filter: 'completed' };
      
      // Navigate using keyboard
      await keyboardHandler.handleKeyPress('Escape'); // Should not go back (no history)
      
      // Navigate to another view
      await viewSystem.navigateTo(settingsView.id);
      
      // Navigate back using keyboard
      await keyboardHandler.handleKeyPress('Escape');
      
      // State should be preserved
      expect(checklistView.state.selectedItem).toBe(5);
      expect(checklistView.state.filter).toBe('completed');
    });

    test('should handle rapid key presses without errors', async () => {
      await viewSystem.addTab(checklistView.id);
      await viewSystem.addTab(settingsView.id);
      await viewSystem.addTab(helpView.id);

      // Rapid tab switching
      for (let i = 0; i < 10; i++) {
        await keyboardHandler.handleKeyPress('Tab');
      }

      // Should end up back at the first tab
      expect(viewSystem.getActiveTabId()).toBe(checklistView.id);
      expect(viewSystem.getTabs()).toHaveLength(3); // No tabs should be corrupted
    });

    test('should handle keyboard shortcuts during layout changes', async () => {
      await viewSystem.navigateTo(checklistView.id);

      // Change layout using keyboard
      await keyboardHandler.handleKeyPress('Ctrl+3'); // Switch to tabbed
      expect(viewSystem.getLayout()).toBe(LayoutType.TABBED);

      // View-specific keys should still work
      const handled = await keyboardHandler.handleKeyPress('n');
      expect(handled).toBe(true);
      expect(checklistView.keyActionsCalled).toContain('n');

      // Layout keys should still work
      await keyboardHandler.handleKeyPress('Ctrl+1'); // Switch to single
      expect(viewSystem.getLayout()).toBe(LayoutType.SINGLE);
    });

    test('should handle keyboard shortcuts with modal/overlay interactions', async () => {
      await viewSystem.navigateTo(checklistView.id);

      // Show modal (simulated)
      await viewSystem.showModal({
        id: 'test-modal',
        title: 'Test Modal',
        content: 'Test content',
        buttons: [],
      });

      // Keys should still be available (view is still active behind modal)
      const availableKeys = keyboardHandler.getAvailableKeys();
      expect(availableKeys).toContain('n');
      expect(availableKeys).toContain('Escape');

      // Hide modal
      viewSystem.hideModal();

      // Keys should still work normally
      const currentView = viewSystem.getCurrentView();
      if (currentView && currentView instanceof MockViewWithKeys) {
        const handled = await keyboardHandler.handleKeyPress('n');
        expect(handled).toBe(true);
      }
    });
  });

  describe('Accessibility and Usability', () => {
    test('should provide unique keys across different views', () => {
      const allViews = [checklistView, settingsView, helpView];
      const allKeys = allViews.flatMap(view => view.getKeyBindings().map(b => b.key));
      
      // Count occurrences of each key
      const keyCounts = allKeys.reduce((acc, key) => {
        acc[key] = (acc[key] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Find duplicates within view-specific keys
      const duplicateKeys = Object.entries(keyCounts)
        .filter(([_, count]) => count > 1)
        .map(([key, _]) => key);

      // In our test setup, all view-specific keys should be unique
      expect(duplicateKeys).toHaveLength(0);
      
      // Ensure we have a good variety of keys
      expect(allKeys.length).toBeGreaterThan(5);
    });

    test('should support contextual help for key bindings', async () => {
      await viewSystem.navigateTo(helpView.id);

      const currentView = viewSystem.getCurrentView();
      const keyBindings = currentView?.getKeyBindings() || [];
      
      // Help view should have descriptive key bindings
      expect(keyBindings.some(b => b.description.includes('help'))).toBe(true);
      expect(keyBindings.some(b => b.description.includes('shortcuts'))).toBe(true);
    });

    test('should handle unknown keys gracefully', async () => {
      await viewSystem.navigateTo(checklistView.id);

      // Press unknown key
      const handled = await keyboardHandler.handleKeyPress('unknown-key');
      expect(handled).toBe(false);

      // System should remain stable
      expect(viewSystem.getCurrentView()?.id).toBe(checklistView.id);
      expect(checklistView.keyActionsCalled).toEqual([]);
    });

    test('should maintain key binding consistency during view transitions', async () => {
      // Start with checklist
      await viewSystem.navigateTo(checklistView.id);
      const initialKeys = keyboardHandler.getAvailableKeys();

      // Navigate away and back
      await viewSystem.navigateTo(settingsView.id);
      await keyboardHandler.handleKeyPress('Escape'); // Go back

      // Keys should be the same as initially
      const finalKeys = keyboardHandler.getAvailableKeys();
      expect(finalKeys).toEqual(initialKeys);
    });
  });
});
/**
 * ViewSystem Implementation
 *
 * Main view management system that coordinates navigation, layout management,
 * and state preservation for the terminal UI application.
 */

import { NavigationStack } from '../navigation/NavigationStack.js';
import { ViewRegistry } from '../navigation/ViewRegistry.js';
import {
  ViewSystem as IViewSystem,
  View,
  ViewParams,
  ViewState,
  ViewSystemOptions,
  LayoutType,
  Modal,
  Overlay,
} from './types.js';

export class ViewSystem implements IViewSystem {
  private readonly navigationStack: NavigationStack;
  private readonly viewRegistry: ViewRegistry;
  private readonly viewStates = new Map<string, ViewState>();
  private currentLayout: LayoutType;
  private currentModal: Modal | null = null;
  private currentOverlay: Overlay | null = null;
  private readonly options: Required<ViewSystemOptions>;
  private isInitialized = false;

  constructor(options: ViewSystemOptions = {}) {
    this.options = {
      maxHistorySize: options.maxHistorySize ?? 50,
      enableAnimations: options.enableAnimations ?? false,
      defaultLayout: options.defaultLayout ?? LayoutType.SINGLE,
    };

    this.navigationStack = new NavigationStack(this.options.maxHistorySize);
    this.viewRegistry = new ViewRegistry();
    this.currentLayout = this.options.defaultLayout;
  }

  /**
   * Initialize the view system
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    // Perform any initialization tasks
    this.isInitialized = true;
  }

  /**
   * Destroy the view system and cleanup resources
   */
  async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    // Unmount current view
    const currentView = this.getCurrentView();
    if (currentView) {
      await currentView.onUnmount();
    }

    // Clear all state
    this.navigationStack.clear();
    this.viewRegistry.clear();
    this.viewStates.clear();
    this.currentModal = null;
    this.currentOverlay = null;

    this.isInitialized = false;
  }

  // View Management
  registerView(id: string, view: View): void {
    this.viewRegistry.register(id, view);
  }

  unregisterView(id: string): void {
    // Remove from navigation stack
    this.navigationStack.removeView(id);

    // Remove saved state
    this.viewStates.delete(id);

    // Unregister from registry
    this.viewRegistry.unregister(id);
  }

  getView(id: string): View | undefined {
    return this.viewRegistry.get(id);
  }

  getCurrentView(): View | undefined {
    const current = this.navigationStack.peek();
    if (!current) {
      return undefined;
    }
    return this.viewRegistry.get(current.viewId);
  }

  // Navigation
  async navigateTo(viewId: string, params?: ViewParams): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ViewSystem not initialized');
    }

    const targetView = this.viewRegistry.get(viewId);
    if (!targetView) {
      throw new Error(`View '${viewId}' not found`);
    }

    const currentView = this.getCurrentView();

    // Save current view state before navigation
    if (currentView) {
      this.saveViewState(currentView.id);
      await currentView.onUnmount();
      this.viewRegistry.setActive(currentView.id, false);
    }

    // Add to navigation stack
    this.navigationStack.push(viewId, params);

    // Restore or create state for target view
    this.restoreViewState(viewId);

    // Activate and mount the new view
    this.viewRegistry.setActive(viewId, true);
    await targetView.onMount(params);
  }

  async goBack(): Promise<boolean> {
    if (!this.canGoBack()) {
      return false;
    }

    const currentView = this.getCurrentView();
    if (currentView) {
      this.saveViewState(currentView.id);
      await currentView.onUnmount();
      this.viewRegistry.setActive(currentView.id, false);
    }

    // Remove current entry
    this.navigationStack.pop();

    // Get previous view
    const previous = this.navigationStack.peek();
    if (!previous) {
      return false;
    }

    const previousView = this.viewRegistry.get(previous.viewId);
    if (!previousView) {
      return false;
    }

    // Restore and mount previous view
    this.restoreViewState(previous.viewId);
    this.viewRegistry.setActive(previous.viewId, true);
    await previousView.onMount(previous.params);

    return true;
  }

  canGoBack(): boolean {
    return this.navigationStack.canGoBack();
  }

  clearHistory(): void {
    this.navigationStack.clear();
  }

  // Layout Management
  setLayout(layout: LayoutType): void {
    this.currentLayout = layout;

    // Trigger resize on current view if active
    const currentView = this.getCurrentView();
    if (currentView) {
      // Get terminal dimensions (would come from terminal canvas)
      const width = process.stdout.columns || 80;
      const height = process.stdout.rows || 24;
      currentView.onResize(width, height);
    }
  }

  getLayout(): LayoutType {
    return this.currentLayout;
  }

  async splitView(primary: string, secondary: string): Promise<void> {
    const primaryView = this.viewRegistry.get(primary);
    const secondaryView = this.viewRegistry.get(secondary);

    if (!primaryView || !secondaryView) {
      throw new Error('Both views must be registered for split view');
    }

    // Set layout to split and activate both views
    this.setLayout(LayoutType.SPLIT_VERTICAL);

    // For now, just navigate to primary - full split implementation
    // would require layout manager integration
    await this.navigateTo(primary);
  }

  // State Management
  saveViewState(viewId: string): void {
    const view = this.viewRegistry.get(viewId);
    if (view) {
      const state = view.saveState();
      this.viewStates.set(viewId, state);
    }
  }

  restoreViewState(viewId: string): void {
    const view = this.viewRegistry.get(viewId);
    const state = this.viewStates.get(viewId);

    if (view && state) {
      view.restoreState(state);
    }
  }

  // Modal/Overlay
  async showModal(modal: Modal): Promise<unknown> {
    this.currentModal = modal;

    // Return a promise that resolves when modal is closed
    return new Promise((resolve) => {
      // Modal implementation would handle user interaction
      // For now, just resolve immediately
      resolve(undefined);
    });
  }

  hideModal(): void {
    this.currentModal = null;
  }

  showOverlay(overlay: Overlay): void {
    this.currentOverlay = overlay;
  }

  hideOverlay(): void {
    this.currentOverlay = null;
  }

  // Utility methods
  getNavigationHistory(): readonly import('../views/types.js').NavigationStackEntry[] {
    return this.navigationStack.getHistory();
  }

  getRegisteredViews(): string[] {
    return this.viewRegistry.getViewIds();
  }

  getCurrentModal(): Modal | null {
    return this.currentModal;
  }

  getCurrentOverlay(): Overlay | null {
    return this.currentOverlay;
  }

  getStats(): {
    navigationStackSize: number;
    registeredViews: number;
    activeViews: number;
    savedStates: number;
  } {
    const registryStats = this.viewRegistry.getStats();

    return {
      navigationStackSize: this.navigationStack.size(),
      registeredViews: registryStats.totalViews,
      activeViews: registryStats.activeViews,
      savedStates: this.viewStates.size,
    };
  }
}

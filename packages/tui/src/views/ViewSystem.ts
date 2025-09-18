/**
 * ViewSystem Implementation
 */

import { LayoutManager } from '../layout/LayoutManager';
import { NavigationStack } from '../navigation/NavigationStack';
import { ViewRegistry } from '../navigation/ViewRegistry';
import { BaseView } from './BaseView';
import { ViewSystemModalHelper } from './ViewSystemModalHelper';
import { ViewSystemNavigation } from './ViewSystemNavigation';
import { ViewSystemTabManager } from './ViewSystemTabManager';
import {
  ViewSystem as IViewSystem,
  View,
  ViewParams,
  ViewState,
  ViewSystemOptions,
  LayoutType,
  Modal,
  Overlay,
  TabInfo,
  LayoutComponent,
  LayoutRender,
} from './types';

export class ViewSystem implements IViewSystem {
  private readonly viewRegistry: ViewRegistry;
  private readonly layoutManager: LayoutManager;
  private readonly tabManager: ViewSystemTabManager;
  private readonly modalHelper: ViewSystemModalHelper;
  private readonly navigation: ViewSystemNavigation;
  private readonly viewStates = new Map<string, ViewState>();
  private currentLayout: LayoutType;
  private readonly options: Required<ViewSystemOptions>;
  private isInitialized = false;

  constructor(options: ViewSystemOptions = {}) {
    this.options = {
      maxHistorySize: options.maxHistorySize ?? 50,
      enableAnimations: options.enableAnimations ?? false,
      defaultLayout: options.defaultLayout ?? LayoutType.SINGLE,
    };

    const navigationStack = new NavigationStack(this.options.maxHistorySize);
    this.viewRegistry = new ViewRegistry();
    this.layoutManager = new LayoutManager();
    this.tabManager = new ViewSystemTabManager(
      this.viewRegistry,
      this.viewStates
    );
    this.modalHelper = new ViewSystemModalHelper();
    this.navigation = new ViewSystemNavigation(
      navigationStack,
      this.viewRegistry,
      this.viewStates
    );
    this.currentLayout = this.options.defaultLayout;
  }

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }
    this.isInitialized = true;
  }

  async destroy(): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const currentView = this.getCurrentView();
    if (currentView) {
      await currentView.onUnmount();
    }

    this.navigation.clear();
    this.viewRegistry.clear();
    this.layoutManager.clear();
    this.viewStates.clear();
    this.tabManager.clear();
    this.modalHelper.clear();
    this.isInitialized = false;
  }

  registerView(id: string, view: View): void {
    this.viewRegistry.register(id, view);
  }

  unregisterView(id: string): void {
    this.navigation.removeView(id);
    this.viewStates.delete(id);
    this.viewRegistry.unregister(id);
  }

  getView(id: string): View | undefined {
    return this.viewRegistry.get(id);
  }

  getCurrentView(): View | undefined {
    const activeTabId = this.tabManager.getActiveTabId();
    if (this.currentLayout === LayoutType.TABBED && activeTabId !== undefined) {
      return this.viewRegistry.get(activeTabId);
    }

    const current = this.navigation.peek();
    return current ? this.viewRegistry.get(current.viewId) : undefined;
  }

  async navigateTo(viewId: string, params?: ViewParams): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ViewSystem not initialized');
    }

    await this.navigation.navigateTo(viewId, params, {
      saveViewState: (id) => this.saveViewState(id),
      restoreViewState: (id) => this.restoreViewState(id),
      getCurrentView: () => this.getCurrentView(),
    });
  }

  async goBack(): Promise<boolean> {
    return this.navigation.goBack({
      saveViewState: (id) => this.saveViewState(id),
      restoreViewState: (id) => this.restoreViewState(id),
      getCurrentView: () => this.getCurrentView(),
    });
  }

  canGoBack(): boolean {
    return this.navigation.canGoBack();
  }

  setLayout(layout: LayoutType): void {
    this.currentLayout = layout;

    // Trigger resize on current view when layout changes
    const currentView = this.getCurrentView();
    if (currentView && typeof currentView.onResize === 'function') {
      // Use process.stdout dimensions as default
      const width = process.stdout.columns || 80;
      const height = process.stdout.rows || 24;
      currentView.onResize(width, height);
    }
  }

  getLayout(): LayoutType {
    return this.currentLayout;
  }

  async splitView(primary: string, secondary: string): Promise<void> {
    // Validate both views exist
    if (!this.viewRegistry.has(primary) || !this.viewRegistry.has(secondary)) {
      throw new Error('Both views must be registered for split view');
    }

    this.setLayout(LayoutType.SPLIT_VERTICAL);
    await this.navigateTo(primary);
  }

  registerLayoutComponent(component: LayoutComponent): void {
    this.layoutManager.registerComponent(component);
  }

  unregisterLayoutComponent(componentId: string): void {
    this.layoutManager.unregisterComponent(componentId);
  }

  getLayoutComponent(componentId: string): LayoutComponent | undefined {
    return this.layoutManager.getComponent(componentId);
  }

  getLayoutComponents(
    position: LayoutComponent['position']
  ): LayoutComponent[] {
    return this.layoutManager.getComponentsByPosition(position);
  }

  renderLayout(width: number, height: number): LayoutRender {
    const currentView = this.getCurrentView();
    const navigation = {
      canGoBack: this.canGoBack(),
      breadcrumbs: this.navigation.generateBreadcrumbs(
        this.currentLayout.toString(),
        () => this.getCurrentView()
      ),
    };

    return this.layoutManager.renderLayout({
      width,
      height,
      currentView,
      navigation,
    });
  }

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

  async showModal(modal: Modal): Promise<unknown> {
    return this.modalHelper.showModal(modal);
  }

  hideModal(): void {
    this.modalHelper.hideModal();
  }

  showOverlay(overlay: Overlay): void {
    this.modalHelper.showOverlay(overlay);
  }

  hideOverlay(): void {
    this.modalHelper.hideOverlay();
  }

  async addTab(viewId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ViewSystem not initialized');
    }

    await this.tabManager.addTab(viewId);

    if (
      this.tabManager.getTabs().length === 1 ||
      this.currentLayout === LayoutType.TABBED
    ) {
      await this.switchToTab(viewId);
    }
  }

  async removeTab(viewId: string): Promise<void> {
    if (!this.tabManager.hasTab(viewId)) {
      return;
    }

    const wasActive = this.tabManager.getActiveTabId() === viewId;
    await this.tabManager.removeTab(viewId);

    if (wasActive) {
      const remainingTabs = this.tabManager.getTabs();
      if (remainingTabs.length > 0) {
        await this.switchToTab(remainingTabs[0].viewId);
      } else if (this.currentLayout === LayoutType.TABBED) {
        this.setLayout(LayoutType.SINGLE);
      }
    }
  }

  async switchToTab(viewId: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('ViewSystem not initialized');
    }

    await this.tabManager.switchToTab(
      viewId,
      this.getCurrentView() as unknown as BaseView | undefined,
      (id) => this.saveViewState(id),
      (id) => this.restoreViewState(id)
    );

    if (this.currentLayout !== LayoutType.TABBED) {
      this.setLayout(LayoutType.TABBED);
    }
  }

  getTabs(): readonly TabInfo[] {
    return this.tabManager.getTabs();
  }

  getActiveTabId(): string | undefined {
    return this.tabManager.getActiveTabId();
  }

  getNavigationHistory(): readonly import('../views/types.js').NavigationStackEntry[] {
    return this.navigation.getHistory();
  }

  getRegisteredViews(): string[] {
    return this.viewRegistry.getViewIds();
  }

  getCurrentModal(): Modal | null {
    return this.modalHelper.getCurrentModal();
  }

  getCurrentOverlay(): Overlay | null {
    return this.modalHelper.getCurrentOverlay();
  }

  clearHistory(): void {
    this.navigation.clear();
  }

  getStats(): {
    navigationStackSize: number;
    registeredViews: number;
    activeViews: number;
    savedStates: number;
    tabs: number;
    activeTabId: string | undefined;
  } {
    const registryStats = this.viewRegistry.getStats();

    return {
      navigationStackSize: this.navigation.size(),
      registeredViews: registryStats.totalViews,
      activeViews: registryStats.activeViews,
      savedStates: this.viewStates.size,
      tabs: this.tabManager.getTabs().length,
      activeTabId: this.tabManager.getActiveTabId(),
    };
  }
}

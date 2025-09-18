/**
 * ViewSystemTabManager
 *
 * Manages tab functionality for the ViewSystem
 */

import { ViewRegistry } from '../navigation/ViewRegistry';
import { BaseView } from './BaseView';
import { TabInfo, ViewState, View } from './types';

export class ViewSystemTabManager {
  private readonly tabs = new Map<string, TabInfo>();
  private activeTabId: string | undefined;

  constructor(
    private readonly viewRegistry: ViewRegistry,
    private readonly viewStates: Map<string, ViewState>
  ) {}

  async addTab(viewId: string): Promise<void> {
    if (this.tabs.has(viewId)) {
      throw new Error(`Tab '${viewId}' already exists`);
    }

    const view = this.viewRegistry.get(viewId);
    if (!view) {
      throw new Error(`View '${viewId}' not found`);
    }

    const tabInfo: TabInfo = {
      viewId: viewId,
      title: view.title ?? viewId,
      isActive: false,
    };

    this.tabs.set(viewId, tabInfo);
  }

  async removeTab(viewId: string): Promise<void> {
    if (!this.tabs.has(viewId)) {
      throw new Error(`Tab '${viewId}' not found`);
    }

    const view = this.viewRegistry.get(viewId);
    if (view && this.activeTabId === viewId) {
      await view.onUnmount();
      this.viewRegistry.setActive(viewId, false);
    }

    this.tabs.delete(viewId);
    this.viewStates.delete(viewId);

    if (this.activeTabId === viewId) {
      this.activeTabId = undefined;
      const remainingTabs = Array.from(this.tabs.keys());
      if (remainingTabs.length > 0) {
        this.activeTabId = remainingTabs[0];
      }
    }
  }

  async switchToTab(
    viewId: string,
    currentView: BaseView | undefined,
    saveViewState: (id: string) => void,
    restoreViewState: (id: string) => void
  ): Promise<void> {
    this.validateTabSwitch(viewId);
    const targetView = this.viewRegistry.get(viewId);
    if (!targetView) {
      throw new Error(`View '${viewId}' not found in registry`);
    }

    await this.deactivateCurrentTab(currentView, saveViewState);
    await this.activateTabForView(viewId, targetView, restoreViewState);
  }

  private validateTabSwitch(viewId: string): void {
    if (!this.tabs.has(viewId)) {
      throw new Error(`Tab '${viewId}' not found`);
    }

    if (!this.viewRegistry.get(viewId)) {
      throw new Error(`View '${viewId}' not found`);
    }
  }

  private async deactivateCurrentTab(
    currentView: BaseView | undefined,
    saveViewState: (id: string) => void
  ): Promise<void> {
    if (currentView && this.activeTabId !== undefined) {
      saveViewState(this.activeTabId);
      await currentView.onUnmount();
      this.viewRegistry.setActive(this.activeTabId, false);

      const prevTab = this.tabs.get(this.activeTabId);
      if (prevTab) {
        this.tabs.set(this.activeTabId, { ...prevTab, isActive: false });
      }
    }
  }

  private async activateTabForView(
    viewId: string,
    targetView: View,
    restoreViewState: (id: string) => void
  ): Promise<void> {
    this.activeTabId = viewId;

    const currentTab = this.tabs.get(viewId);
    if (currentTab) {
      this.tabs.set(viewId, { ...currentTab, isActive: true });
    }

    restoreViewState(viewId);
    this.viewRegistry.setActive(viewId, true);
    await targetView.onMount();
  }

  getTabs(): readonly TabInfo[] {
    return Array.from(this.tabs.values());
  }

  getActiveTabId(): string | undefined {
    return this.activeTabId;
  }

  hasTab(viewId: string): boolean {
    return this.tabs.has(viewId);
  }

  clear(): void {
    this.tabs.clear();
    this.activeTabId = undefined;
  }
}

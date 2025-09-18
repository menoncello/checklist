/**
 * ViewSystemNavigation
 *
 * Manages navigation functionality for the ViewSystem
 */

import { NavigationStack } from '../navigation/NavigationStack';
import { ViewRegistry } from '../navigation/ViewRegistry';
import { View, ViewParams, ViewState } from './types';

export class ViewSystemNavigation {
  constructor(
    private readonly navigationStack: NavigationStack,
    private readonly viewRegistry: ViewRegistry,
    private readonly viewStates: Map<string, ViewState>
  ) {}

  async navigateTo(
    viewId: string,
    params: ViewParams | undefined,
    callbacks: {
      saveViewState: (id: string) => void;
      restoreViewState: (id: string) => void;
      getCurrentView: () => View | undefined;
    }
  ): Promise<void> {
    const targetView = this.viewRegistry.get(viewId);
    if (!targetView) {
      throw new Error(`View '${viewId}' not found`);
    }

    const currentView = callbacks.getCurrentView();
    if (currentView) {
      const currentEntry = this.navigationStack.peek();
      if (currentEntry) {
        callbacks.saveViewState(currentEntry.viewId);
        this.viewRegistry.setActive(currentEntry.viewId, false);
      }
      await currentView.onUnmount();
    }

    this.navigationStack.push(viewId, params);
    callbacks.restoreViewState(viewId);
    this.viewRegistry.setActive(viewId, true);
    await targetView.onMount(params);
  }

  async goBack(callbacks: {
    saveViewState: (id: string) => void;
    restoreViewState: (id: string) => void;
    getCurrentView: () => View | undefined;
  }): Promise<boolean> {
    if (!this.canGoBack()) {
      return false;
    }

    await this.handleCurrentViewUnmount(callbacks);
    const navigationSuccessful = await this.performNavigation(callbacks);

    return navigationSuccessful;
  }

  private async handleCurrentViewUnmount(callbacks: {
    saveViewState: (id: string) => void;
    getCurrentView: () => View | undefined;
  }): Promise<void> {
    const currentView = callbacks.getCurrentView();
    if (currentView) {
      const currentEntry = this.navigationStack.peek();
      if (currentEntry) {
        callbacks.saveViewState(currentEntry.viewId);
        this.viewRegistry.setActive(currentEntry.viewId, false);
      }
      await currentView.onUnmount();
    }
  }

  private async performNavigation(callbacks: {
    restoreViewState: (id: string) => void;
  }): Promise<boolean> {
    const popped = this.navigationStack.pop();
    if (!popped) {
      return false;
    }

    const previousEntry = this.navigationStack.peek();
    if (previousEntry) {
      const view = this.viewRegistry.get(previousEntry.viewId);
      if (view) {
        callbacks.restoreViewState(previousEntry.viewId);
        this.viewRegistry.setActive(previousEntry.viewId, true);
        await view.onMount(previousEntry.params);
      }
    }

    return true;
  }

  canGoBack(): boolean {
    return this.navigationStack.canGoBack();
  }

  generateBreadcrumbs(
    currentLayout: string,
    getCurrentView: () => View | undefined
  ): string[] {
    const breadcrumbs: string[] = [];
    const currentView = getCurrentView();

    if (currentView) {
      if (currentLayout === 'tabbed') {
        breadcrumbs.push('Tabs');
        breadcrumbs.push(currentView.title);
      } else {
        const history = this.navigationStack.getHistory();
        history.slice(-3).forEach((entry) => {
          const view = this.viewRegistry.get(entry.viewId);
          if (view) {
            breadcrumbs.push(view.title);
          }
        });
      }
    }

    return breadcrumbs;
  }

  getHistory() {
    return this.navigationStack.getHistory();
  }

  size() {
    return this.navigationStack.size();
  }

  removeView(id: string) {
    this.navigationStack.removeView(id);
  }

  peek() {
    return this.navigationStack.peek();
  }

  clear() {
    this.navigationStack.clear();
  }
}

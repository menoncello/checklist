/**
 * View Registry
 *
 * Central registry for managing all available views in the application.
 * Provides view registration, retrieval, and lifecycle management.
 */

import { View } from '../views/types.js';

export interface ViewRegistrationInfo {
  view: View;
  registeredAt: number;
  isActive: boolean;
}

export class ViewRegistry {
  private readonly views = new Map<string, ViewRegistrationInfo>();

  /**
   * Register a new view
   */
  register(id: string, view: View): void {
    if (this.views.has(id)) {
      throw new Error(`View with id '${id}' is already registered`);
    }

    if (view.id !== id) {
      throw new Error(
        `View id '${view.id}' does not match registration id '${id}'`
      );
    }

    this.views.set(id, {
      view,
      registeredAt: Date.now(),
      isActive: false,
    });
  }

  /**
   * Unregister a view
   */
  unregister(id: string): boolean {
    const info = this.views.get(id);
    if (!info) {
      return false;
    }

    // Ensure the view is properly unmounted before unregistering
    if (info.isActive) {
      this.setActive(id, false);
    }

    return this.views.delete(id);
  }

  /**
   * Get a view by id
   */
  get(id: string): View | undefined {
    const info = this.views.get(id);
    return info?.view;
  }

  /**
   * Check if a view is registered
   */
  has(id: string): boolean {
    return this.views.has(id);
  }

  /**
   * Get all registered view ids
   */
  getViewIds(): string[] {
    return Array.from(this.views.keys());
  }

  /**
   * Get all registered views
   */
  getViews(): View[] {
    return Array.from(this.views.values()).map((info) => info.view);
  }

  /**
   * Set a view as active/inactive
   */
  setActive(id: string, active: boolean): void {
    const info = this.views.get(id);
    if (info) {
      info.isActive = active;
    }
  }

  /**
   * Get currently active views
   */
  getActiveViews(): View[] {
    return Array.from(this.views.values())
      .filter((info) => info.isActive)
      .map((info) => info.view);
  }

  /**
   * Get registration info for a view
   */
  getRegistrationInfo(id: string): ViewRegistrationInfo | undefined {
    return this.views.get(id);
  }

  /**
   * Clear all registered views
   */
  clear(): void {
    // Deactivate all views first
    for (const [id] of this.views) {
      this.setActive(id, false);
    }
    this.views.clear();
  }

  /**
   * Get registry statistics
   */
  getStats(): {
    totalViews: number;
    activeViews: number;
    registeredViews: string[];
  } {
    const activeCount = Array.from(this.views.values()).filter(
      (info) => info.isActive
    ).length;

    return {
      totalViews: this.views.size,
      activeViews: activeCount,
      registeredViews: this.getViewIds(),
    };
  }
}

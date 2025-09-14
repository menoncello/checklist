/**
 * Navigation Stack
 *
 * Manages navigation history and view state preservation during navigation.
 * Implements a stack-based navigation system with state preservation.
 */

import { NavigationStackEntry, ViewParams, ViewState } from '../views/types';

export class NavigationStack {
  private readonly stack: NavigationStackEntry[] = [];
  private readonly maxSize: number;

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  /**
   * Push a new entry onto the navigation stack
   */
  push(viewId: string, params?: ViewParams, state?: ViewState): void {
    const entry: NavigationStackEntry = {
      viewId,
      params,
      state,
      timestamp: Date.now(),
    };

    this.stack.push(entry);

    // Maintain max size
    if (this.stack.length > this.maxSize) {
      this.stack.shift();
    }
  }

  /**
   * Pop the most recent entry from the stack
   */
  pop(): NavigationStackEntry | undefined {
    return this.stack.pop();
  }

  /**
   * Peek at the top entry without removing it
   */
  peek(): NavigationStackEntry | undefined {
    return this.stack[this.stack.length - 1];
  }

  /**
   * Get the previous entry (second from top)
   */
  getPrevious(): NavigationStackEntry | undefined {
    if (this.stack.length < 2) {
      return undefined;
    }
    return this.stack[this.stack.length - 2];
  }

  /**
   * Check if we can go back
   */
  canGoBack(): boolean {
    return this.stack.length > 1;
  }

  /**
   * Get current stack size
   */
  size(): number {
    return this.stack.length;
  }

  /**
   * Clear the entire navigation stack
   */
  clear(): void {
    this.stack.length = 0;
  }

  /**
   * Get a copy of the current stack for debugging
   */
  getHistory(): readonly NavigationStackEntry[] {
    return [...this.stack];
  }

  /**
   * Replace the current entry (useful for navigation with replace=true)
   */
  replace(viewId: string, params?: ViewParams, state?: ViewState): void {
    if (this.stack.length === 0) {
      this.push(viewId, params, state);
      return;
    }

    const entry: NavigationStackEntry = {
      viewId,
      params,
      state,
      timestamp: Date.now(),
    };

    this.stack[this.stack.length - 1] = entry;
  }

  /**
   * Find the most recent entry for a specific view
   */
  findEntry(viewId: string): NavigationStackEntry | undefined {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].viewId === viewId) {
        return this.stack[i];
      }
    }
    return undefined;
  }

  /**
   * Remove all entries for a specific view
   */
  removeView(viewId: string): void {
    for (let i = this.stack.length - 1; i >= 0; i--) {
      if (this.stack[i].viewId === viewId) {
        this.stack.splice(i, 1);
      }
    }
  }
}

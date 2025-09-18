/**
 * Base View Class
 *
 * Abstract base class that provides common functionality for all views.
 * Implements the View interface with standard behavior that can be extended.
 */

import { View, ViewParams, ViewState, KeyBinding } from './types';

export abstract class BaseView implements View {
  public readonly id: string;
  public readonly title: string;
  public readonly canGoBack: boolean;

  protected state: ViewState = {};
  protected mounted = false;

  constructor(id: string, title: string, canGoBack = true) {
    this.id = id;
    this.title = title;
    this.canGoBack = canGoBack;
  }

  // Lifecycle methods
  async onMount(params?: ViewParams): Promise<void> {
    this.mounted = true;
    await this.handleMount(params);
  }

  async onUnmount(): Promise<void> {
    this.mounted = false;
    await this.handleUnmount();
  }

  onResize(width: number, height: number): void {
    this.handleResize(width, height);
  }

  // State management
  saveState(): ViewState {
    return { ...this.state };
  }

  restoreState(state: ViewState): void {
    this.state = { ...state };
  }

  // Abstract methods that must be implemented by subclasses
  abstract render(): string;
  abstract getKeyBindings(): KeyBinding[];

  // Protected methods for subclasses to override
  protected async handleMount(_params?: ViewParams): Promise<void> {
    // Default implementation - can be overridden
  }

  protected async handleUnmount(): Promise<void> {
    // Default implementation - can be overridden
  }

  protected handleResize(_width: number, _height: number): void {
    // Default implementation - can be overridden
  }

  // Utility methods for subclasses
  protected isMounted(): boolean {
    return this.mounted;
  }

  protected setState(newState: Partial<ViewState>): void {
    this.state = { ...this.state, ...newState };
  }

  protected getState<T = unknown>(key: string): T | undefined {
    return this.state[key] as T;
  }

  protected getStateWithDefault<T = unknown>(key: string, defaultValue: T): T {
    const value = this.state[key];
    return value !== undefined ? (value as T) : defaultValue;
  }

  protected clearState(): void {
    this.state = {};
  }

  // Common key bindings that most views will want
  protected getCommonKeyBindings(): KeyBinding[] {
    const bindings: KeyBinding[] = [];

    if (this.canGoBack) {
      bindings.push({
        key: 'Escape',
        description: 'Go back',
        action: () => {
          // This would need to be injected or passed through context
          // For now, it's a placeholder
        },
      });
    }

    bindings.push(
      {
        key: 'F1',
        description: 'Help',
        action: () => {
          // Navigate to help view
        },
      },
      {
        key: 'Ctrl+C',
        description: 'Exit',
        action: () => {
          process.exit(0);
        },
      }
    );

    return bindings;
  }

  // Utility method to create formatted content sections
  protected createSection(title: string, content: string, width = 80): string {
    const titleLine = `┌─ ${title} ${'─'.repeat(Math.max(0, width - title.length - 4))}┐`;
    const contentLines = content
      .split('\n')
      .map((line) => `│ ${line.padEnd(width - 2)} │`);
    const bottomLine = `└${'─'.repeat(width)}┘`;

    return [titleLine, ...contentLines, bottomLine].join('\n');
  }

  // Utility method to center text
  protected centerText(text: string, width: number): string {
    const padding = Math.max(0, Math.floor((width - text.length) / 2));
    return ' '.repeat(padding) + text;
  }

  // Utility method to truncate text with ellipsis
  protected truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) {
      return text;
    }
    return text.substring(0, maxLength - 3) + '...';
  }
}

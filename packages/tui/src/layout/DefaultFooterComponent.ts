/**
 * Default Footer Component
 *
 * Provides standard footer layout with key bindings, status messages,
 * and application information for the terminal UI.
 */

import type {
  FooterComponent,
  LayoutContext,
  KeyBinding,
} from '../views/types.js';

export class DefaultFooterComponent implements FooterComponent {
  public readonly id = 'default-footer';
  public readonly position = 'footer' as const;

  constructor(
    public readonly showKeyBindings: boolean = true,
    public readonly showStatus: boolean = true
  ) {}

  render(context: LayoutContext): string {
    const lines: string[] = [];

    // Separator line
    lines.push('─'.repeat(context.width));

    // Status line
    if (this.showStatus && context.status) {
      const statusLine = this.formatStatusLine(context.status, context.width);
      lines.push(statusLine);
    }

    // Key bindings line
    if (
      this.showKeyBindings &&
      context.keyBindings &&
      context.keyBindings.length > 0
    ) {
      const keyBindingsLine = this.formatKeyBindings(
        context.keyBindings,
        context.width
      );
      lines.push(keyBindingsLine);
    }

    return lines.join('\n');
  }

  private formatStatusLine(
    status: { message: string; type: 'info' | 'warning' | 'error' | 'success' },
    width: number
  ): string {
    const icon = this.getStatusIcon(status.type);
    const statusText = `${icon} ${status.message}`;

    // Truncate if too long
    const maxLength = width - 4;
    const displayText =
      statusText.length > maxLength && maxLength > 0
        ? statusText.substring(0, maxLength - 3) + '...'
        : statusText;

    return `  ${displayText}`;
  }

  private formatKeyBindings(keyBindings: KeyBinding[], width: number): string {
    // Format key bindings as "key: description"
    const bindings = keyBindings
      .slice(0, 6) // Limit to first 6 bindings to avoid overflow
      .map((binding) => `${binding.key}: ${binding.description}`);

    const bindingText = bindings.join('  |  ');

    // Truncate if too long
    const maxLength = width - 4;
    const displayText =
      bindingText.length > maxLength && maxLength > 0
        ? bindingText.substring(0, maxLength - 3) + '...'
        : bindingText;

    return `  ${displayText}`;
  }

  private getStatusIcon(
    type: 'info' | 'warning' | 'error' | 'success'
  ): string {
    switch (type) {
      case 'info':
        return 'ℹ';
      case 'warning':
        return '⚠';
      case 'error':
        return '✗';
      case 'success':
        return '✓';
      default:
        return 'ℹ';
    }
  }

  getHeight(): number {
    let height = 1; // Separator line
    if (this.showStatus) height++;
    if (this.showKeyBindings) height++;
    return height;
  }
}

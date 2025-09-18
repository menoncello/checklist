/**
 * Default Header Component
 *
 * Provides standard header layout with title, breadcrumbs, and navigation
 * information for the terminal UI application.
 */

import type { HeaderComponent, LayoutContext } from '../views/types';

export class DefaultHeaderComponent implements HeaderComponent {
  public readonly id = 'default-header';
  public readonly position = 'header' as const;

  constructor(
    public readonly showBreadcrumbs: boolean = true,
    public readonly showTitle: boolean = true
  ) {}

  render(context: LayoutContext): string {
    const lines: string[] = [];

    // Title line
    if (this.showTitle && context.currentView) {
      const title = context.currentView.title || 'Checklist Manager';
      const titleLine = this.formatTitleLine(title, context.width);
      lines.push(titleLine);
    }

    // Breadcrumbs line
    if (
      this.showBreadcrumbs &&
      context.navigation?.breadcrumbs &&
      context.navigation.breadcrumbs.length > 0
    ) {
      const breadcrumbLine = this.formatBreadcrumbs(
        context.navigation.breadcrumbs,
        context.width
      );
      lines.push(breadcrumbLine);
    }

    // If we have content, add a separator line
    if (lines.length > 0) {
      lines.push('─'.repeat(context.width));
    }

    return lines.join('\n');
  }

  private formatTitleLine(title: string, width: number): string {
    // Truncate title if too long, leaving space for padding
    const maxTitleLength = width - 4; // Leave space for padding
    const displayTitle =
      title.length > maxTitleLength && maxTitleLength > 0
        ? title.substring(0, maxTitleLength - 3) + '...'
        : title;

    // Center the title
    const padding = Math.max(0, Math.floor((width - displayTitle.length) / 2));
    return ' '.repeat(padding) + displayTitle;
  }

  private formatBreadcrumbs(breadcrumbs: string[], width: number): string {
    const separator = ' › ';
    const breadcrumbText = breadcrumbs.join(separator);

    // Truncate if too long
    const maxLength = width - 4;
    if (breadcrumbText.length <= maxLength && maxLength > 0) {
      return `  ${breadcrumbText}`;
    }

    // Show only the last few breadcrumbs if too long
    let truncated = breadcrumbText;
    while (truncated.length > maxLength && breadcrumbs.length > 1) {
      breadcrumbs.shift();
      truncated = '...' + separator + breadcrumbs.join(separator);
    }

    return `  ${truncated.substring(0, maxLength)}`;
  }

  getHeight(): number {
    return this.showTitle && this.showBreadcrumbs
      ? 3
      : this.showTitle || this.showBreadcrumbs
        ? 2
        : 1;
  }
}

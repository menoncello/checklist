export interface DebugOverlayBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export class DebugOverlayHelpers {
  public static formatTabs(
    panels: Array<{
      id: string;
      title: string;
      hotkey: string;
      icon?: string;
      enabled: boolean;
    }>,
    selectedId: string,
    width: number
  ): string {
    const tabs = panels
      .filter((p) => p.enabled)
      .map((p) => {
        const content = `${p.icon ?? ''} ${p.title} (${p.hotkey})`;
        return p.id === selectedId ? `[${content}]` : ` ${content} `;
      });
    const joined = tabs.join('│');
    return joined.length <= width
      ? joined.padEnd(width)
      : joined.slice(0, width - 3) + '...';
  }

  public static renderBorder(width: number, title: string): string[] {
    const titleLine = title ? ` ${title} ` : '';
    const padding = width - titleLine.length - 2;
    const left = Math.floor(padding / 2);
    const right = padding - left;

    return [
      `┌${'─'.repeat(left)}${titleLine}${'─'.repeat(right)}┐`,
      '',
      `├${'─'.repeat(width - 2)}┤`,
    ];
  }

  public static buildOverlayLines(options: {
    panelContent: string[];
    width: number;
    height: number;
    title: string;
    tabs: string;
  }): string[] {
    const { panelContent, width, height, title, tabs } = options;
    const lines: string[] = [];
    const border = this.renderBorder(width, title);

    lines.push(border[0]);
    lines.push(`│${tabs}│`);
    lines.push(border[2]);

    const contentHeight = height - 4;
    const paddedContent = panelContent.slice(0, contentHeight);
    while (paddedContent.length < contentHeight) {
      paddedContent.push(' '.repeat(width - 2));
    }

    paddedContent.forEach((line) => lines.push(`│${line}│`));
    lines.push(`└${'─'.repeat(width - 2)}┘`);

    return lines;
  }

  public static calculatePosition(options: {
    position: string;
    termWidth: number;
    termHeight: number;
    overlayWidth: number;
    overlayHeight: number;
  }): { x: number; y: number } {
    const { position, termWidth, termHeight, overlayWidth, overlayHeight } =
      options;
    return {
      x: position.includes('right') ? termWidth - overlayWidth : 0,
      y: position.includes('bottom') ? termHeight - overlayHeight : 0,
    };
  }

  public static isPointInBounds(
    x: number,
    y: number,
    bounds: DebugOverlayBounds
  ): boolean {
    return (
      x >= bounds.x &&
      x < bounds.x + bounds.width &&
      y >= bounds.y &&
      y < bounds.y + bounds.height
    );
  }
}

import { RenderContext } from '../framework/UIFramework';
import { BaseComponent } from './BaseComponent';

export interface ScrollRenderOptions {
  scrollX: number;
  scrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  showScrollbars: boolean;
  enableHorizontal: boolean;
  enableVertical: boolean;
}

export class ScrollContentRenderer {
  static renderContent(
    content: BaseComponent | null,
    context: RenderContext,
    options: ScrollRenderOptions
  ): string[] {
    if (!content) {
      return this.createEmptyLines(
        options.viewportWidth,
        options.viewportHeight
      );
    }

    const contentContext: RenderContext = {
      ...context,
      width: options.viewportWidth,
      height: options.viewportHeight,
      scrollX: options.scrollX,
      scrollY: options.scrollY,
    };

    const contentOutput = content.render(contentContext);
    const contentLines = contentOutput.split('\n');

    return this.extractVisibleLines(contentLines, {
      scrollX: options.scrollX,
      scrollY: options.scrollY,
      viewportWidth: options.viewportWidth,
      viewportHeight: options.viewportHeight,
    });
  }

  private static extractVisibleLines(
    contentLines: string[],
    options: {
      scrollX: number;
      scrollY: number;
      viewportWidth: number;
      viewportHeight: number;
    }
  ): string[] {
    const { scrollX, scrollY, viewportWidth, viewportHeight } = options;
    const visibleLines: string[] = [];

    for (let y = 0; y < viewportHeight; y++) {
      const sourceY = y + Math.floor(scrollY);
      let line = '';

      if (sourceY < contentLines.length) {
        const sourceLine = contentLines[sourceY] ?? '';
        const startX = Math.floor(scrollX);
        line = sourceLine.slice(startX, startX + viewportWidth);
      }

      line = line.padEnd(viewportWidth, ' ');
      visibleLines.push(line);
    }

    return visibleLines;
  }

  static addScrollbars(
    visibleLines: string[],
    scrollbars: {
      vertical: string;
      horizontal: string;
    },
    context: {
      width: number;
      height: number;
    }
  ): string[] {
    const { vertical: verticalScrollbar, horizontal: horizontalScrollbar } =
      scrollbars;
    const { width: contextWidth, height: contextHeight } = context;
    const result = [...visibleLines];

    if (verticalScrollbar) {
      const scrollbarChars = verticalScrollbar.split('');
      for (let i = 0; i < Math.min(result.length, scrollbarChars.length); i++) {
        result[i] += scrollbarChars[i];
      }
    }

    if (horizontalScrollbar) {
      result.push(horizontalScrollbar);
    }

    while (result.length < contextHeight) {
      result.push(' '.repeat(contextWidth));
    }

    return result;
  }

  private static createEmptyLines(width: number, height: number): string[] {
    return new Array(height).fill(' '.repeat(width));
  }
}

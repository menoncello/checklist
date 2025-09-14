export interface ScrollBounds {
  scrollX: number;
  scrollY: number;
  maxScrollX: number;
  maxScrollY: number;
  viewportWidth: number;
  viewportHeight: number;
  contentWidth: number;
  contentHeight: number;
}

export class ScrollCalculator {
  static clampPosition(
    value: number,
    max: number,
    elasticBounds: boolean,
    viewportSize: number
  ): number {
    if (elasticBounds) {
      const overscroll = viewportSize * 0.1;
      return Math.max(-overscroll, Math.min(max + overscroll, value));
    }
    return Math.max(0, Math.min(max, value));
  }

  static calculateMaxScroll(
    contentSize: number,
    viewportSize: number
  ): number {
    return Math.max(0, contentSize - viewportSize);
  }

  static calculateScrollIntoView(
    target: { x: number; y: number; width: number; height: number },
    options: { bounds: ScrollBounds; margin: number; enableHorizontal: boolean; enableVertical: boolean }
  ): { x: number; y: number } {
    const { bounds, margin } = options;
    return {
      x: options.enableHorizontal ? this.calculateAxisScroll({
        targetPos: target.x, targetSize: target.width,
        currentScroll: bounds.scrollX, viewportSize: bounds.viewportWidth,
        maxScroll: bounds.maxScrollX, margin
      }) : bounds.scrollX,
      y: options.enableVertical ? this.calculateAxisScroll({
        targetPos: target.y, targetSize: target.height,
        currentScroll: bounds.scrollY, viewportSize: bounds.viewportHeight,
        maxScroll: bounds.maxScrollY, margin
      }) : bounds.scrollY
    };
  }

  private static calculateAxisScroll(
    params: {
      targetPos: number;
      targetSize: number;
      currentScroll: number;
      viewportSize: number;
      maxScroll: number;
      margin: number;
    }
  ): number {
    const { targetPos, targetSize, currentScroll, viewportSize, maxScroll, margin } = params;
    if (targetPos < currentScroll + margin) {
      return Math.max(0, targetPos - margin);
    }

    if (targetPos + targetSize > currentScroll + viewportSize - margin) {
      return Math.min(
        maxScroll,
        targetPos + targetSize - viewportSize + margin
      );
    }

    return currentScroll;
  }

  static calculateScrollPercentage(
    position: number,
    max: number
  ): number {
    return max > 0 ? (position / max) * 100 : 0;
  }

  static getScrollActionForKey(
    key: string,
    viewportHeight: number
  ): { type: 'delta'; deltaX: number; deltaY: number } |
     { type: 'absolute'; action: string } | null {
    const actions: Record<string, { type: 'delta'; deltaX: number; deltaY: number } | { type: 'absolute'; action: string }> = {
      'ArrowUp': { type: 'delta', deltaX: 0, deltaY: -1 },
      'ArrowDown': { type: 'delta', deltaX: 0, deltaY: 1 },
      'ArrowLeft': { type: 'delta', deltaX: -1, deltaY: 0 },
      'ArrowRight': { type: 'delta', deltaX: 1, deltaY: 0 },
      'PageUp': {
        type: 'delta',
        deltaX: 0,
        deltaY: -Math.floor(viewportHeight * 0.8)
      },
      'PageDown': {
        type: 'delta',
        deltaX: 0,
        deltaY: Math.floor(viewportHeight * 0.8)
      },
      'Home': { type: 'absolute', action: 'scrollToTop' },
      'End': { type: 'absolute', action: 'scrollToBottom' }
    };

    return actions[key] ?? null;
  }
}
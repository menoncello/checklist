import {
  ScrollableContainerConfig,
  ScrollableContainerState,
  ScrollIntoViewOptions,
  ScrollMetrics,
} from './ScrollableContainerTypes';

export class ScrollableContainerUtils {
  static createDefaultConfig(): ScrollableContainerConfig {
    return {
      enableHorizontalScroll: true,
      enableVerticalScroll: true,
      showScrollbars: true,
      scrollbarStyle: 'simple',
      smoothScrolling: true,
      scrollSensitivity: 1.0,
      autoScrollMargin: 10,
      elasticBounds: false,
      wheelSupport: true,
    };
  }

  static createDefaultState(): ScrollableContainerState {
    return {
      scrollX: 0,
      scrollY: 0,
      contentWidth: 0,
      contentHeight: 0,
      viewportWidth: 0,
      viewportHeight: 0,
      maxScrollX: 0,
      maxScrollY: 0,
      isDragging: false,
      lastScrollTime: 0,
    };
  }

  static clampScrollPosition(
    x: number,
    y: number,
    state: ScrollableContainerState,
    config: ScrollableContainerConfig
  ): { x: number; y: number } {
    let clampedX = x;
    let clampedY = y;

    if (!config.elasticBounds) {
      clampedX = Math.max(0, Math.min(x, state.maxScrollX));
      clampedY = Math.max(0, Math.min(y, state.maxScrollY));
    }

    return { x: clampedX, y: clampedY };
  }

  static calculateScrollIntoViewPosition(
    options: ScrollIntoViewOptions,
    state: ScrollableContainerState
  ): { x: number; y: number } {
    const { x = 0, y = 0, width = 0, height = 0, margin = 0 } = options;
    const { alignX = 'start', alignY = 'start' } = options;

    const targetX = this.calculateTargetX(options, state, {
      x,
      width,
      margin,
      alignX,
    });
    const targetY = this.calculateTargetY(options, state, {
      y,
      height,
      margin,
      alignY,
    });

    return this.clampScrollPosition(targetX, targetY, state, {
      elasticBounds: false,
    } as ScrollableContainerConfig);
  }

  private static calculateTargetX(
    options: ScrollIntoViewOptions,
    state: ScrollableContainerState,
    params: { x: number; width: number; margin: number; alignX: string }
  ): number {
    const { x, width, margin, alignX } = params;

    if (alignX === 'start') {
      return Math.max(0, x - margin);
    }
    if (alignX === 'center') {
      return x - state.viewportWidth / 2 + width / 2;
    }
    if (alignX === 'end') {
      return x - state.viewportWidth + width + margin;
    }
    return state.scrollX;
  }

  private static calculateTargetY(
    options: ScrollIntoViewOptions,
    state: ScrollableContainerState,
    params: { y: number; height: number; margin: number; alignY: string }
  ): number {
    const { y, height, margin, alignY } = params;

    if (alignY === 'start') {
      return Math.max(0, y - margin);
    }
    if (alignY === 'center') {
      return y - state.viewportHeight / 2 + height / 2;
    }
    if (alignY === 'end') {
      return y - state.viewportHeight + height + margin;
    }
    return state.scrollY;
  }

  static calculateScrollDelta(
    key: string,
    state: ScrollableContainerState,
    config: ScrollableContainerConfig
  ): { deltaX: number; deltaY: number } {
    return this.getScrollDeltaForKey(key, state, config);
  }

  private static getScrollDeltaForKey(
    key: string,
    state: ScrollableContainerState,
    config: ScrollableContainerConfig
  ): { deltaX: number; deltaY: number } {
    const lineHeight = 20;
    const stepSize = 20;
    const sens = config.scrollSensitivity;
    const pageHeight = state.viewportHeight - lineHeight;

    const deltas: Record<string, { deltaX: number; deltaY: number }> = {
      ArrowUp: { deltaX: 0, deltaY: -lineHeight * sens },
      ArrowDown: { deltaX: 0, deltaY: lineHeight * sens },
      ArrowLeft: { deltaX: -stepSize * sens, deltaY: 0 },
      ArrowRight: { deltaX: stepSize * sens, deltaY: 0 },
      PageUp: { deltaX: 0, deltaY: -pageHeight },
      PageDown: { deltaX: 0, deltaY: pageHeight },
      Home: { deltaX: -state.scrollX, deltaY: -state.scrollY },
      End: {
        deltaX: state.maxScrollX - state.scrollX,
        deltaY: state.maxScrollY - state.scrollY,
      },
    };

    return deltas[key] ?? { deltaX: 0, deltaY: 0 };
  }

  static getScrollMetrics(state: ScrollableContainerState): ScrollMetrics {
    const scrollableWidth = Math.max(
      0,
      state.contentWidth - state.viewportWidth
    );
    const scrollableHeight = Math.max(
      0,
      state.contentHeight - state.viewportHeight
    );

    return {
      scrollableWidth,
      scrollableHeight,
      scrollPercentageX:
        scrollableWidth > 0 ? state.scrollX / scrollableWidth : 0,
      scrollPercentageY:
        scrollableHeight > 0 ? state.scrollY / scrollableHeight : 0,
      isScrollableX: scrollableWidth > 0,
      isScrollableY: scrollableHeight > 0,
      isAtTop: state.scrollY <= 0,
      isAtBottom: state.scrollY >= state.maxScrollY,
      isAtLeft: state.scrollX <= 0,
      isAtRight: state.scrollX >= state.maxScrollX,
    };
  }

  static updateMaxScroll(state: ScrollableContainerState): void {
    state.maxScrollX = Math.max(0, state.contentWidth - state.viewportWidth);
    state.maxScrollY = Math.max(0, state.contentHeight - state.viewportHeight);
  }

  static shouldShowScrollbar(
    config: ScrollableContainerConfig,
    direction: 'horizontal' | 'vertical',
    metrics: ScrollMetrics
  ): boolean {
    if (!config.showScrollbars) return false;

    if (direction === 'horizontal') {
      return config.enableHorizontalScroll && metrics.isScrollableX;
    } else {
      return config.enableVerticalScroll && metrics.isScrollableY;
    }
  }

  static applyScrollSensitivity(
    deltaX: number,
    deltaY: number,
    sensitivity: number
  ): { deltaX: number; deltaY: number } {
    return {
      deltaX: deltaX * sensitivity,
      deltaY: deltaY * sensitivity,
    };
  }
}

import { ScrollableContainer } from './ScrollableContainer';

export interface ScrollableContainerConfig {
  enableHorizontalScroll: boolean;
  enableVerticalScroll: boolean;
  showScrollbars: boolean;
  scrollbarStyle: 'simple' | 'styled' | 'minimal';
  smoothScrolling: boolean;
  scrollSensitivity: number;
  autoScrollMargin: number;
  elasticBounds: boolean;
  wheelSupport: boolean;
}

export interface ScrollableContainerState extends Record<string, unknown> {
  scrollX: number;
  scrollY: number;
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  maxScrollX: number;
  maxScrollY: number;
  isDragging: boolean;
  lastScrollTime: number;
}

export interface ScrollEvent {
  deltaX: number;
  deltaY: number;
  scrollX: number;
  scrollY: number;
  target: ScrollableContainer;
}

export interface ScrollIntoViewOptions {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  margin?: number;
  animated?: boolean;
  alignX?: 'start' | 'center' | 'end';
  alignY?: 'start' | 'center' | 'end';
}

export interface ScrollAnimation {
  active: boolean;
  startTime: number;
  duration: number;
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
  easing: (t: number) => number;
}

export interface ScrollMetrics {
  scrollableWidth: number;
  scrollableHeight: number;
  scrollPercentageX: number;
  scrollPercentageY: number;
  isScrollableX: boolean;
  isScrollableY: boolean;
  isAtTop: boolean;
  isAtBottom: boolean;
  isAtLeft: boolean;
  isAtRight: boolean;
}

import { RenderContext } from '../framework/UIFramework';
import { BaseComponent } from './BaseComponent';

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

export class ScrollableContainer extends BaseComponent {
  public readonly id: string;
  private config: ScrollableContainerConfig;
  protected state: ScrollableContainerState;
  private content: BaseComponent | null = null;
  protected eventHandlers = new Map<string, Set<Function>>();
  private scrollAnimation: {
    active: boolean;
    startTime: number;
    duration: number;
    startX: number;
    startY: number;
    targetX: number;
    targetY: number;
  } | null = null;

  constructor(props: Record<string, unknown> = {}) {
    super(props);
    this.id = (props.id as string) || `scroll-${Date.now()}`;
    const config = (props.config as Partial<ScrollableContainerConfig>) ?? {};

    this.config = {
      enableHorizontalScroll: true,
      enableVerticalScroll: true,
      showScrollbars: true,
      scrollbarStyle: 'simple',
      smoothScrolling: false,
      scrollSensitivity: 3,
      autoScrollMargin: 2,
      elasticBounds: false,
      wheelSupport: true,
      ...config,
    };

    this.state = {
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

  public setContent(content: BaseComponent): void {
    this.content = content;
    this.updateContentDimensions();
    this.markDirty();
  }

  public getContent(): BaseComponent | null {
    return this.content;
  }

  public scrollTo(x: number, y: number, animated: boolean = false): void {
    const targetX = this.clampScrollX(x);
    const targetY = this.clampScrollY(y);

    if (animated && this.config.smoothScrolling) {
      this.startScrollAnimation(targetX, targetY);
    } else {
      this.setScrollPosition(targetX, targetY);
    }
  }

  public scrollBy(
    deltaX: number,
    deltaY: number,
    animated: boolean = false
  ): void {
    this.scrollTo(
      this.state.scrollX + deltaX,
      this.state.scrollY + deltaY,
      animated
    );
  }

  public scrollToTop(animated: boolean = false): void {
    this.scrollTo(this.state.scrollX, 0, animated);
  }

  public scrollToBottom(animated: boolean = false): void {
    this.scrollTo(this.state.scrollX, this.state.maxScrollY, animated);
  }

  public scrollToLeft(animated: boolean = false): void {
    this.scrollTo(0, this.state.scrollY, animated);
  }

  public scrollToRight(animated: boolean = false): void {
    this.scrollTo(this.state.maxScrollX, this.state.scrollY, animated);
  }

  public scrollIntoView(
    targetX: number,
    targetY: number,
    targetWidth: number = 1,
    targetHeight: number = 1,
    animated: boolean = false
  ): void {
    let newScrollX = this.state.scrollX;
    let newScrollY = this.state.scrollY;

    // Horizontal scrolling
    if (this.config.enableHorizontalScroll) {
      if (targetX < this.state.scrollX + this.config.autoScrollMargin) {
        newScrollX = Math.max(0, targetX - this.config.autoScrollMargin);
      } else if (
        targetX + targetWidth >
        this.state.scrollX +
          this.state.viewportWidth -
          this.config.autoScrollMargin
      ) {
        newScrollX = Math.min(
          this.state.maxScrollX,
          targetX +
            targetWidth -
            this.state.viewportWidth +
            this.config.autoScrollMargin
        );
      }
    }

    // Vertical scrolling
    if (this.config.enableVerticalScroll) {
      if (targetY < this.state.scrollY + this.config.autoScrollMargin) {
        newScrollY = Math.max(0, targetY - this.config.autoScrollMargin);
      } else if (
        targetY + targetHeight >
        this.state.scrollY +
          this.state.viewportHeight -
          this.config.autoScrollMargin
      ) {
        newScrollY = Math.min(
          this.state.maxScrollY,
          targetY +
            targetHeight -
            this.state.viewportHeight +
            this.config.autoScrollMargin
        );
      }
    }

    if (
      newScrollX !== this.state.scrollX ||
      newScrollY !== this.state.scrollY
    ) {
      this.scrollTo(newScrollX, newScrollY, animated);
    }
  }

  public handleScroll(deltaX: number, deltaY: number): boolean {
    if (!this.config.enableHorizontalScroll) deltaX = 0;
    if (!this.config.enableVerticalScroll) deltaY = 0;

    if (deltaX === 0 && deltaY === 0) return false;

    const scaledDeltaX = deltaX * this.config.scrollSensitivity;
    const scaledDeltaY = deltaY * this.config.scrollSensitivity;

    const oldScrollX = this.state.scrollX;
    const oldScrollY = this.state.scrollY;

    this.scrollBy(scaledDeltaX, scaledDeltaY);

    const scrolled =
      this.state.scrollX !== oldScrollX || this.state.scrollY !== oldScrollY;

    if (scrolled) {
      this.emit('scroll', {
        deltaX: this.state.scrollX - oldScrollX,
        deltaY: this.state.scrollY - oldScrollY,
        scrollX: this.state.scrollX,
        scrollY: this.state.scrollY,
        target: this,
      });
    }

    return scrolled;
  }

  public handleMouseWheel(deltaX: number, deltaY: number): boolean {
    if (!this.config.wheelSupport) return false;
    return this.handleScroll(deltaX, deltaY);
  }

  public handleKeyScroll(key: string): boolean {
    let deltaX = 0;
    let deltaY = 0;

    switch (key) {
      case 'ArrowUp':
        deltaY = -1;
        break;
      case 'ArrowDown':
        deltaY = 1;
        break;
      case 'ArrowLeft':
        deltaX = -1;
        break;
      case 'ArrowRight':
        deltaX = 1;
        break;
      case 'PageUp':
        deltaY = -Math.floor(this.state.viewportHeight * 0.8);
        break;
      case 'PageDown':
        deltaY = Math.floor(this.state.viewportHeight * 0.8);
        break;
      case 'Home':
        return (this.scrollToTop(this.config.smoothScrolling), true);
      case 'End':
        return (this.scrollToBottom(this.config.smoothScrolling), true);
      default:
        return false;
    }

    return this.handleScroll(deltaX, deltaY);
  }

  private startScrollAnimation(
    targetX: number,
    targetY: number,
    duration: number = 300
  ): void {
    this.scrollAnimation = {
      active: true,
      startTime: performance.now(),
      duration,
      startX: this.state.scrollX,
      startY: this.state.scrollY,
      targetX,
      targetY,
    };
  }

  private updateScrollAnimation(): void {
    if (this.scrollAnimation?.active !== true) return;

    const now = performance.now();
    const elapsed = now - this.scrollAnimation.startTime;
    const progress = Math.min(elapsed / this.scrollAnimation.duration, 1);

    // Easing function (ease-out)
    const eased = 1 - Math.pow(1 - progress, 3);

    const currentX =
      this.scrollAnimation.startX +
      (this.scrollAnimation.targetX - this.scrollAnimation.startX) * eased;
    const currentY =
      this.scrollAnimation.startY +
      (this.scrollAnimation.targetY - this.scrollAnimation.startY) * eased;

    this.setScrollPosition(currentX, currentY);

    if (progress >= 1) {
      this.scrollAnimation.active = false;
      this.scrollAnimation = null;
    }
  }

  private setScrollPosition(x: number, y: number): void {
    const oldScrollX = this.state.scrollX;
    const oldScrollY = this.state.scrollY;

    this.state.scrollX = this.clampScrollX(x);
    this.state.scrollY = this.clampScrollY(y);
    this.state.lastScrollTime = performance.now();

    if (
      this.state.scrollX !== oldScrollX ||
      this.state.scrollY !== oldScrollY
    ) {
      this.markDirty();
    }
  }

  private clampScrollX(x: number): number {
    if (this.config.elasticBounds) {
      // Allow some over-scroll for elastic effect
      const overscroll = this.state.viewportWidth * 0.1;
      return Math.max(
        -overscroll,
        Math.min(this.state.maxScrollX + overscroll, x)
      );
    }
    return Math.max(0, Math.min(this.state.maxScrollX, x));
  }

  private clampScrollY(y: number): number {
    if (this.config.elasticBounds) {
      // Allow some over-scroll for elastic effect
      const overscroll = this.state.viewportHeight * 0.1;
      return Math.max(
        -overscroll,
        Math.min(this.state.maxScrollY + overscroll, y)
      );
    }
    return Math.max(0, Math.min(this.state.maxScrollY, y));
  }

  private updateContentDimensions(): void {
    if (!this.content) {
      this.state.contentWidth = 0;
      this.state.contentHeight = 0;
    } else {
      // This would need to be implemented based on how content reports its size
      // For now, we'll use placeholder logic
      // Use proper interface method calls
      this.state.contentWidth = this.getContentWidth();
      this.state.contentHeight = this.getContentHeight();
    }

    this.updateScrollLimits();
  }

  private updateScrollLimits(): void {
    this.state.maxScrollX = Math.max(
      0,
      this.state.contentWidth - this.state.viewportWidth
    );
    this.state.maxScrollY = Math.max(
      0,
      this.state.contentHeight - this.state.viewportHeight
    );

    // Clamp current scroll position
    this.state.scrollX = this.clampScrollX(this.state.scrollX);
    this.state.scrollY = this.clampScrollY(this.state.scrollY);
  }

  private renderScrollbar(
    position: number,
    maxPosition: number,
    viewportSize: number,
    isHorizontal: boolean
  ): string {
    if (maxPosition <= 0 || !this.config.showScrollbars) return '';

    const trackSize = isHorizontal
      ? this.state.viewportWidth
      : this.state.viewportHeight;
    const thumbSize = Math.max(
      1,
      Math.floor((viewportSize / (viewportSize + maxPosition)) * trackSize)
    );
    const thumbPosition = Math.floor(
      (position / maxPosition) * (trackSize - thumbSize)
    );

    switch (this.config.scrollbarStyle) {
      case 'styled':
        return this.renderStyledScrollbar(
          thumbPosition,
          thumbSize,
          trackSize,
          isHorizontal
        );
      case 'minimal':
        return this.renderMinimalScrollbar(
          thumbPosition,
          thumbSize,
          trackSize,
          isHorizontal
        );
      default:
        return this.renderSimpleScrollbar(
          thumbPosition,
          thumbSize,
          trackSize,
          isHorizontal
        );
    }
  }

  private renderSimpleScrollbar(
    thumbPosition: number,
    thumbSize: number,
    trackSize: number,
    isHorizontal: boolean
  ): string {
    const track = new Array(trackSize).fill(isHorizontal ? '─' : '│');

    for (
      let i = thumbPosition;
      i < thumbPosition + thumbSize && i < trackSize;
      i++
    ) {
      track[i] = isHorizontal ? '█' : '█';
    }

    return track.join('');
  }

  private renderStyledScrollbar(
    thumbPosition: number,
    thumbSize: number,
    trackSize: number,
    isHorizontal: boolean
  ): string {
    const track = new Array(trackSize).fill(isHorizontal ? '░' : '░');

    for (
      let i = thumbPosition;
      i < thumbPosition + thumbSize && i < trackSize;
      i++
    ) {
      track[i] = isHorizontal ? '▓' : '▓';
    }

    return track.join('');
  }

  private renderMinimalScrollbar(
    thumbPosition: number,
    thumbSize: number,
    trackSize: number,
    isHorizontal: boolean
  ): string {
    const track = new Array(trackSize).fill(' ');

    for (
      let i = thumbPosition;
      i < thumbPosition + thumbSize && i < trackSize;
      i++
    ) {
      track[i] = isHorizontal ? '■' : '■';
    }

    return track.join('');
  }

  public render(context: RenderContext): string {
    // Update animation if active
    if (this.scrollAnimation?.active === true) {
      this.updateScrollAnimation();
    }

    // Update viewport dimensions
    const scrollbarSpace = this.config.showScrollbars ? 1 : 0;
    this.state.viewportWidth =
      context.width - (this.config.enableVerticalScroll ? scrollbarSpace : 0);
    this.state.viewportHeight =
      context.height -
      (this.config.enableHorizontalScroll ? scrollbarSpace : 0);

    this.updateContentDimensions();

    if (!this.content) {
      return ' '.repeat(context.width * context.height);
    }

    // Create content render context with scroll offset
    const contentContext: RenderContext = {
      ...context,
      width: this.state.viewportWidth,
      height: this.state.viewportHeight,
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
    };

    // Render content
    const contentOutput = this.content.render(contentContext);
    const contentLines = contentOutput.split('\n');

    // Apply scroll offset and clipping
    const visibleLines: string[] = [];

    for (let y = 0; y < this.state.viewportHeight; y++) {
      const sourceY = y + Math.floor(this.state.scrollY);
      let line = '';

      if (sourceY < contentLines.length) {
        const sourceLine = contentLines[sourceY] ?? '';
        const startX = Math.floor(this.state.scrollX);
        line = sourceLine.slice(startX, startX + this.state.viewportWidth);
      }

      // Pad line to viewport width
      line = line.padEnd(this.state.viewportWidth, ' ');
      visibleLines.push(line);
    }

    // Add scrollbars if needed
    if (this.config.showScrollbars) {
      // Vertical scrollbar
      if (this.config.enableVerticalScroll && this.state.maxScrollY > 0) {
        const vScrollbar = this.renderScrollbar(
          this.state.scrollY,
          this.state.maxScrollY,
          this.state.viewportHeight,
          false
        );

        const scrollbarChars = vScrollbar.split('');
        for (
          let i = 0;
          i < Math.min(visibleLines.length, scrollbarChars.length);
          i++
        ) {
          visibleLines[i] += scrollbarChars[i];
        }
      }

      // Horizontal scrollbar
      if (this.config.enableHorizontalScroll && this.state.maxScrollX > 0) {
        const hScrollbar = this.renderScrollbar(
          this.state.scrollX,
          this.state.maxScrollX,
          this.state.viewportWidth,
          true
        );

        visibleLines.push(hScrollbar);
      }
    }

    // Ensure we fill the context height
    while (visibleLines.length < context.height) {
      visibleLines.push(' '.repeat(context.width));
    }

    return visibleLines.join('\n');
  }

  // Public API
  public getScrollPosition(): { x: number; y: number } {
    return { x: this.state.scrollX, y: this.state.scrollY };
  }

  public getScrollPercentage(): { x: number; y: number } {
    return {
      x:
        this.state.maxScrollX > 0
          ? (this.state.scrollX / this.state.maxScrollX) * 100
          : 0,
      y:
        this.state.maxScrollY > 0
          ? (this.state.scrollY / this.state.maxScrollY) * 100
          : 0,
    };
  }

  public getContentSize(): { width: number; height: number } {
    return { width: this.state.contentWidth, height: this.state.contentHeight };
  }

  public getViewportSize(): { width: number; height: number } {
    return {
      width: this.state.viewportWidth,
      height: this.state.viewportHeight,
    };
  }

  public isScrollable(): { x: boolean; y: boolean } {
    return {
      x: this.config.enableHorizontalScroll && this.state.maxScrollX > 0,
      y: this.config.enableVerticalScroll && this.state.maxScrollY > 0,
    };
  }

  public getState(): ScrollableContainerState {
    return { ...this.state };
  }

  public updateConfig(newConfig: Partial<ScrollableContainerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.updateScrollLimits();
    this.markDirty();
  }

  public getConfig(): ScrollableContainerConfig {
    return { ...this.config };
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private getContentWidth(): number {
    if (!this.content) return 0;
    // Access protected method through proper type casting
    if (this.content instanceof BaseComponent) {
      return (
        (this.content as unknown as { getWidth(): number }).getWidth() ?? 0
      );
    }
    return 0;
  }

  private getContentHeight(): number {
    if (!this.content) return 0;
    // Access protected method through proper type casting
    if (this.content instanceof BaseComponent) {
      return (
        (this.content as unknown as { getHeight(): number }).getHeight() ?? 0
      );
    }
    return 0;
  }
}

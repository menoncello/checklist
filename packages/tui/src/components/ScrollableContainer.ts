import { RenderContext } from '../framework/UIFramework';
import { BaseComponent } from './BaseComponent';
import { ScrollCalculator } from './ScrollCalculator';
import { ScrollContentRenderer } from './ScrollContentRenderer';
import { ScrollbarRenderer } from './ScrollbarRenderer';

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

  public scrollIntoView(options: {
    targetX: number;
    targetY: number;
    targetWidth?: number;
    targetHeight?: number;
    animated?: boolean;
  }): void {
    const { targetX, targetY, targetWidth = 1, targetHeight = 1, animated = false } = options;

    const newPosition = ScrollCalculator.calculateScrollIntoView(
      { x: targetX, y: targetY, width: targetWidth, height: targetHeight },
      {
        bounds: this.state,
        margin: this.config.autoScrollMargin,
        enableHorizontal: this.config.enableHorizontalScroll,
        enableVertical: this.config.enableVerticalScroll
      }
    );

    if (newPosition.x !== this.state.scrollX || newPosition.y !== this.state.scrollY) {
      this.scrollTo(newPosition.x, newPosition.y, animated);
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
    const scrollAction = ScrollCalculator.getScrollActionForKey(
      key,
      this.state.viewportHeight
    );
    if (!scrollAction) return false;

    if (scrollAction.type === 'absolute') {
      this.handleAbsoluteScroll(scrollAction.action);
      return true;
    }

    return this.handleScroll(scrollAction.deltaX, scrollAction.deltaY);
  }

  private handleAbsoluteScroll(action: string): void {
    switch (action) {
      case 'scrollToTop':
        this.scrollToTop(this.config.smoothScrolling);
        break;
      case 'scrollToBottom':
        this.scrollToBottom(this.config.smoothScrolling);
        break;
    }
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
    return ScrollCalculator.clampPosition(
      x,
      this.state.maxScrollX,
      this.config.elasticBounds,
      this.state.viewportWidth
    );
  }

  private clampScrollY(y: number): number {
    return ScrollCalculator.clampPosition(
      y,
      this.state.maxScrollY,
      this.config.elasticBounds,
      this.state.viewportHeight
    );
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
    this.state.maxScrollX = ScrollCalculator.calculateMaxScroll(
      this.state.contentWidth,
      this.state.viewportWidth
    );
    this.state.maxScrollY = ScrollCalculator.calculateMaxScroll(
      this.state.contentHeight,
      this.state.viewportHeight
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

    return ScrollbarRenderer.render({
      position,
      maxPosition,
      viewportSize,
      trackSize,
      style: this.config.scrollbarStyle,
      isHorizontal
    });
  }

  public render(context: RenderContext): string {
    this.updateRenderState(context);

    const visibleLines = ScrollContentRenderer.renderContent(
      this.content,
      context,
      {
        scrollX: this.state.scrollX,
        scrollY: this.state.scrollY,
        viewportWidth: this.state.viewportWidth,
        viewportHeight: this.state.viewportHeight,
        showScrollbars: this.config.showScrollbars,
        enableHorizontal: this.config.enableHorizontalScroll,
        enableVertical: this.config.enableVerticalScroll
      }
    );

    const vScrollbar = this.getVerticalScrollbar();
    const hScrollbar = this.getHorizontalScrollbar();

    const finalLines = ScrollContentRenderer.addScrollbars(
      visibleLines,
      { vertical: vScrollbar, horizontal: hScrollbar },
      { width: context.width, height: context.height }
    );

    return finalLines.join('\n');
  }

  private updateRenderState(context: RenderContext): void {
    if (this.scrollAnimation?.active === true) {
      this.updateScrollAnimation();
    }

    const scrollbarSpace = this.config.showScrollbars ? 1 : 0;
    this.state.viewportWidth =
      context.width - (this.config.enableVerticalScroll ? scrollbarSpace : 0);
    this.state.viewportHeight =
      context.height -
      (this.config.enableHorizontalScroll ? scrollbarSpace : 0);

    this.updateContentDimensions();
  }

  private getVerticalScrollbar(): string {
    if (!this.config.showScrollbars ||
        !this.config.enableVerticalScroll ||
        this.state.maxScrollY <= 0) {
      return '';
    }

    return this.renderScrollbar(
      this.state.scrollY,
      this.state.maxScrollY,
      this.state.viewportHeight,
      false
    );
  }

  private getHorizontalScrollbar(): string {
    if (!this.config.showScrollbars ||
        !this.config.enableHorizontalScroll ||
        this.state.maxScrollX <= 0) {
      return '';
    }

    return this.renderScrollbar(
      this.state.scrollX,
      this.state.maxScrollX,
      this.state.viewportWidth,
      true
    );
  }

  // Public API
  public getScrollPosition(): { x: number; y: number } {
    return { x: this.state.scrollX, y: this.state.scrollY };
  }

  public getScrollPercentage(): { x: number; y: number } {
    return {
      x: ScrollCalculator.calculateScrollPercentage(
        this.state.scrollX,
        this.state.maxScrollX
      ),
      y: ScrollCalculator.calculateScrollPercentage(
        this.state.scrollY,
        this.state.maxScrollY
      ),
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

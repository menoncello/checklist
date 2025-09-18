import { RenderContext } from '../framework/UIFramework';
import { BaseComponent } from './BaseComponent';
import { ScrollCalculator } from './ScrollCalculator';
import { ScrollContentRenderer } from './ScrollContentRenderer';
import { ScrollableContainerAnimation } from './ScrollableContainerAnimation';
import {
  ScrollableContainerConfig,
  ScrollableContainerState,
  ScrollEvent,
  ScrollIntoViewOptions,
  ScrollAnimation,
  ScrollMetrics,
} from './ScrollableContainerTypes';
import { ScrollableContainerUtils } from './ScrollableContainerUtils';
import { ScrollbarRenderer } from './ScrollbarRenderer';

export * from './ScrollableContainerTypes';

export class ScrollableContainer extends BaseComponent {
  public readonly id: string;
  private config: ScrollableContainerConfig;
  protected state: ScrollableContainerState;
  private content: BaseComponent | null = null;
  protected eventHandlers = new Map<string, Set<Function>>();
  private scrollAnimation: ScrollAnimation | null = null;
  private calculator: ScrollCalculator;
  private contentRenderer: ScrollContentRenderer;
  private scrollbarRenderer: ScrollbarRenderer;

  constructor(id: string, config: Partial<ScrollableContainerConfig> = {}) {
    super();
    this.id = id;
    this.config = {
      ...ScrollableContainerUtils.createDefaultConfig(),
      ...config,
    };
    this.state = ScrollableContainerUtils.createDefaultState();
    this.calculator = new ScrollCalculator();
    this.contentRenderer = new ScrollContentRenderer();
    this.scrollbarRenderer = new ScrollbarRenderer();
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.on('scroll', (_event: ScrollEvent) => {
      this.updateScrollMetrics();
    });
  }

  public setContent(content: BaseComponent): void {
    this.content = content;
    this.updateContentDimensions();
  }

  public getContent(): BaseComponent | null {
    return this.content;
  }

  public scrollTo(x: number, y: number, animated: boolean = false): void {
    const clamped = ScrollableContainerUtils.clampScrollPosition(
      x,
      y,
      this.state,
      this.config
    );

    if (animated && this.config.smoothScrolling) {
      this.startScrollAnimation(clamped.x, clamped.y);
    } else {
      this.setScrollPosition(clamped.x, clamped.y);
    }
  }

  public scrollBy(
    deltaX: number,
    deltaY: number,
    animated: boolean = false
  ): void {
    const targetX = this.state.scrollX + deltaX;
    const targetY = this.state.scrollY + deltaY;
    this.scrollTo(targetX, targetY, animated);
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

  public scrollIntoView(options: ScrollIntoViewOptions): void {
    const position = ScrollableContainerUtils.calculateScrollIntoViewPosition(
      options,
      this.state
    );

    this.scrollTo(position.x, position.y, options.animated);
  }

  public handleScroll(deltaX: number, deltaY: number): boolean {
    if (!this.config.enableHorizontalScroll) deltaX = 0;
    if (!this.config.enableVerticalScroll) deltaY = 0;

    if (deltaX === 0 && deltaY === 0) return false;

    const sensitivity = ScrollableContainerUtils.applyScrollSensitivity(
      deltaX,
      deltaY,
      this.config.scrollSensitivity
    );

    this.scrollBy(sensitivity.deltaX, sensitivity.deltaY);
    this.emit(
      'scroll',
      this.createScrollEvent(sensitivity.deltaX, sensitivity.deltaY)
    );
    return true;
  }

  public handleMouseWheel(deltaX: number, deltaY: number): boolean {
    if (!this.config.wheelSupport) return false;
    return this.handleScroll(deltaX, deltaY);
  }

  public handleKeyScroll(key: string): boolean {
    const delta = ScrollableContainerUtils.calculateScrollDelta(
      key,
      this.state,
      this.config
    );

    if (delta.deltaX === 0 && delta.deltaY === 0) return false;

    return this.handleScroll(delta.deltaX, delta.deltaY);
  }

  private startScrollAnimation(targetX: number, targetY: number): void {
    this.scrollAnimation = ScrollableContainerAnimation.createAnimation({
      startX: this.state.scrollX,
      startY: this.state.scrollY,
      targetX,
      targetY,
    });

    this.updateScrollAnimation();
  }

  private updateScrollAnimation(): void {
    if (this.scrollAnimation?.active !== true) return;

    const result = ScrollableContainerAnimation.updateAnimation(
      this.scrollAnimation
    );
    this.setScrollPosition(result.x, result.y);

    if (result.completed) {
      this.scrollAnimation = null;
    } else {
      setTimeout(() => this.updateScrollAnimation(), 16);
    }
  }

  private setScrollPosition(x: number, y: number): void {
    const oldX = this.state.scrollX;
    const oldY = this.state.scrollY;

    this.state.scrollX = x;
    this.state.scrollY = y;
    this.state.lastScrollTime = Date.now();

    if (oldX !== x || oldY !== y) {
      this.emit('scrollPositionChanged', {
        oldX,
        oldY,
        newX: x,
        newY: y,
      });
    }
  }

  private updateContentDimensions(): void {
    if (!this.content) return;

    // This would typically measure the content
    // For now, we'll use placeholder logic
    this.state.contentWidth = 1000; // placeholder
    this.state.contentHeight = 2000; // placeholder
    this.state.viewportWidth = 800; // placeholder
    this.state.viewportHeight = 600; // placeholder

    ScrollableContainerUtils.updateMaxScroll(this.state);
    this.emit('contentDimensionsChanged');
  }

  private updateScrollMetrics(): void {
    const metrics = ScrollableContainerUtils.getScrollMetrics(this.state);
    this.emit('scrollMetricsUpdated', metrics);
  }

  private createScrollEvent(deltaX: number, deltaY: number): ScrollEvent {
    return {
      deltaX,
      deltaY,
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
      target: this,
    };
  }

  public render(context: RenderContext): string {
    if (!this.content) {
      return '';
    }

    const metrics = ScrollableContainerUtils.getScrollMetrics(this.state);

    // Render content with scroll offset
    const scrollOptions = {
      scrollX: this.state.scrollX,
      scrollY: this.state.scrollY,
      viewportWidth: this.state.viewportWidth,
      viewportHeight: this.state.viewportHeight,
      showScrollbars: this.config.showScrollbars,
      enableHorizontal: this.config.enableHorizontalScroll,
      enableVertical: this.config.enableVerticalScroll,
    };
    const contentLines = ScrollContentRenderer.renderContent(
      this.content,
      context,
      scrollOptions
    );
    const contentOutput = contentLines.join('\n');

    // Render scrollbars if needed
    const scrollbars = this.renderScrollbars(metrics);

    return `${contentOutput}${scrollbars}`;
  }

  private renderScrollbars(metrics: ScrollMetrics): string {
    let output = '';

    output += this.renderVerticalScrollbar(metrics);
    output += this.renderHorizontalScrollbar(metrics);

    return output;
  }

  private renderVerticalScrollbar(metrics: ScrollMetrics): string {
    if (
      !ScrollableContainerUtils.shouldShowScrollbar(
        this.config,
        'vertical',
        metrics
      )
    ) {
      return '';
    }

    return ScrollbarRenderer.render({
      position: this.state.scrollY,
      maxPosition: this.state.contentHeight - this.state.viewportHeight,
      viewportSize: this.state.viewportHeight,
      trackSize: this.state.viewportHeight,
      style: 'simple',
      isHorizontal: false,
    });
  }

  private renderHorizontalScrollbar(metrics: ScrollMetrics): string {
    if (
      !ScrollableContainerUtils.shouldShowScrollbar(
        this.config,
        'horizontal',
        metrics
      )
    ) {
      return '';
    }

    return ScrollbarRenderer.render({
      position: this.state.scrollX,
      maxPosition: this.state.contentWidth - this.state.viewportWidth,
      viewportSize: this.state.viewportWidth,
      trackSize: this.state.viewportWidth,
      style: 'simple',
      isHorizontal: true,
    });
  }

  public getConfig(): ScrollableContainerConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<ScrollableContainerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { config: this.config });
  }

  public getState(): ScrollableContainerState {
    return { ...this.state };
  }

  public getScrollMetrics() {
    return ScrollableContainerUtils.getScrollMetrics(this.state);
  }

  public destroy(): void {
    if (this.scrollAnimation) {
      ScrollableContainerAnimation.stopAnimation(this.scrollAnimation);
      this.scrollAnimation = null;
    }

    this.eventHandlers.clear();
    this.content = null;
    this.emit('destroyed');
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  public off(event: string, handler: Function): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  protected emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in scroll container event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

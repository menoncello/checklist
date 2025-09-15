import { VirtualizationEngine } from './VirtualizationEngine';
import { VirtualListState, ScrollEvent, VirtualListItem } from './types';

export class ScrollManager<T> {
  private lastScrollTop = 0;

  constructor(
    private state: VirtualListState,
    private virtualizationEngine: VirtualizationEngine<T>,
    private onScroll?: (event: ScrollEvent) => void
  ) {}

  scrollTo(items: VirtualListItem<T>[], index: number): void {
    if (index < 0 || index >= items.length) return;

    const targetOffset = this.virtualizationEngine.getItemOffset(items, index);
    const { viewportHeight } = this.state;

    // Center the item in the viewport if possible
    const centeredScrollTop = Math.max(0, targetOffset - viewportHeight / 2);

    this.setScrollTop(centeredScrollTop);
    this.virtualizationEngine.updateVisibleRange(items);
  }

  scrollBy(items: VirtualListItem<T>[], delta: number): void {
    const newScrollTop = Math.max(
      0,
      Math.min(this.state.scrollTop + delta, this.getMaxScrollTop())
    );

    this.setScrollTop(newScrollTop);
    this.virtualizationEngine.updateVisibleRange(items);
  }

  scrollToTop(): void {
    this.setScrollTop(0);
  }

  scrollToBottom(): void {
    const maxScrollTop = this.getMaxScrollTop();
    this.setScrollTop(maxScrollTop);
  }

  setScrollTop(scrollTop: number): void {
    const clampedScrollTop = Math.max(
      0,
      Math.min(scrollTop, this.getMaxScrollTop())
    );
    const previousScrollTop = this.lastScrollTop;

    this.state.scrollTop = clampedScrollTop;
    this.lastScrollTop = clampedScrollTop;

    this.emitScrollEvent(previousScrollTop, clampedScrollTop);
  }

  private emitScrollEvent(
    previousScrollTop: number,
    newScrollTop: number
  ): void {
    if (this.onScroll) {
      const delta = newScrollTop - previousScrollTop;
      const direction = delta > 0 ? 'down' : 'up';

      this.onScroll({
        scrollTop: newScrollTop,
        viewportHeight: this.state.viewportHeight,
        direction,
        delta: Math.abs(delta),
      });
    }
  }

  getMaxScrollTop(): number {
    return Math.max(0, this.state.totalHeight - this.state.viewportHeight);
  }

  getScrollPercentage(): number {
    const maxScroll = this.getMaxScrollTop();
    if (maxScroll === 0) return 0;
    return (this.state.scrollTop / maxScroll) * 100;
  }

  isAtTop(): boolean {
    return this.state.scrollTop === 0;
  }

  isAtBottom(): boolean {
    return this.state.scrollTop >= this.getMaxScrollTop();
  }

  canScrollUp(): boolean {
    return this.state.scrollTop > 0;
  }

  canScrollDown(): boolean {
    return this.state.scrollTop < this.getMaxScrollTop();
  }

  getVisibleRange(): { start: number; end: number } {
    return {
      start: this.state.scrollTop,
      end: this.state.scrollTop + this.state.viewportHeight,
    };
  }

  setViewportHeight(height: number): void {
    this.state.viewportHeight = height;

    // Ensure scroll position is still valid
    const maxScrollTop = this.getMaxScrollTop();
    if (this.state.scrollTop > maxScrollTop) {
      this.setScrollTop(maxScrollTop);
    }
  }

  ensureIndexVisible(
    items: VirtualListItem<T>[],
    index: number,
    position: 'top' | 'center' | 'bottom' = 'center'
  ): void {
    if (!this.isValidIndex(index, items.length)) return;

    const bounds = this.calculateItemBounds(items, index);
    if (this.isItemVisible(bounds)) return;

    const newScrollTop = this.calculateScrollPosition(bounds, position);
    this.setScrollTop(newScrollTop);
    this.virtualizationEngine.updateVisibleRange(items);
  }

  private isValidIndex(index: number, length: number): boolean {
    return index >= 0 && index < length;
  }

  private calculateItemBounds(items: VirtualListItem<T>[], index: number) {
    const offset = this.virtualizationEngine.getItemOffset(items, index);
    const height = this.virtualizationEngine.getItemHeight(items[index], index);
    return { top: offset, bottom: offset + height, height };
  }

  private isItemVisible(bounds: { top: number; bottom: number }): boolean {
    const { scrollTop, viewportHeight } = this.state;
    const viewportBottom = scrollTop + viewportHeight;
    return bounds.top >= scrollTop && bounds.bottom <= viewportBottom;
  }

  private calculateScrollPosition(
    bounds: { top: number; bottom: number; height: number },
    position: 'top' | 'center' | 'bottom'
  ): number {
    const { viewportHeight } = this.state;
    switch (position) {
      case 'top':
        return bounds.top;
      case 'bottom':
        return bounds.bottom - viewportHeight;
      default:
        return bounds.top - (viewportHeight - bounds.height) / 2;
    }
  }
}

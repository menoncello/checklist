import { VirtualListConfig, VirtualListState, VirtualListItem } from './types';

export class VirtualizationEngine<T> {
  private itemHeights = new Map<number, number>();

  constructor(
    private config: VirtualListConfig,
    private state: VirtualListState
  ) {}

  updateVisibleRange(items: VirtualListItem<T>[]): void {
    if (items.length === 0) {
      this.state.visibleStartIndex = 0;
      this.state.visibleEndIndex = 0;
      return;
    }

    const { scrollTop, viewportHeight } = this.state;
    const { bufferSize, overscan } = this.config;

    let startIndex = 0;
    let currentTop = 0;

    // Find start index
    for (let i = 0; i < items.length; i++) {
      const itemHeight = this.getItemHeight(items[i], i);
      if (currentTop + itemHeight > scrollTop) {
        startIndex = Math.max(0, i - overscan);
        break;
      }
      currentTop += itemHeight;
    }

    // Calculate visible item count
    const visibleCount = this.calculateVisibleCount(
      items,
      startIndex,
      viewportHeight + overscan * this.config.itemHeight
    );

    const endIndex = Math.min(
      items.length,
      startIndex + visibleCount + bufferSize
    );

    this.state.visibleStartIndex = startIndex;
    this.state.visibleEndIndex = endIndex;
  }

  private calculateVisibleCount(
    items: VirtualListItem<T>[],
    startIndex: number,
    availableHeight: number
  ): number {
    let count = 0;
    let currentHeight = 0;

    for (let i = startIndex; i < items.length; i++) {
      const itemHeight = this.getItemHeight(items[i], i);
      if (currentHeight + itemHeight > availableHeight) {
        break;
      }
      currentHeight += itemHeight;
      count++;
    }

    return Math.max(1, count);
  }

  calculateTotalHeight(items: VirtualListItem<T>[]): void {
    let totalHeight = 0;

    for (let i = 0; i < items.length; i++) {
      totalHeight += this.getItemHeight(items[i], i);
    }

    this.state.totalHeight = totalHeight;
  }

  getItemHeight(item: VirtualListItem<T>, index: number): number {
    if (this.config.enableDynamicHeight) {
      // Check cache first
      const cachedHeight = this.itemHeights.get(index);
      if (cachedHeight !== undefined) {
        return cachedHeight;
      }

      // Use item's height if provided
      if (item.height !== undefined) {
        this.itemHeights.set(index, item.height);
        return item.height;
      }
    }

    return this.config.itemHeight;
  }

  setItemHeight(index: number, height: number): void {
    this.itemHeights.set(index, height);
  }

  getItemOffset(items: VirtualListItem<T>[], index: number): number {
    let offset = 0;

    for (let i = 0; i < index && i < items.length; i++) {
      offset += this.getItemHeight(items[i], i);
    }

    return offset;
  }

  updateItemHeights(startIndex: number, removedCount: number): void {
    const newHeights = new Map<number, number>();

    for (const [index, height] of this.itemHeights) {
      if (index < startIndex) {
        newHeights.set(index, height);
      } else if (index >= startIndex + removedCount) {
        newHeights.set(index - removedCount, height);
      }
    }

    this.itemHeights = newHeights;
  }

  clearItemHeights(): void {
    this.itemHeights.clear();
  }

  getVisibleIndices(): { start: number; end: number } {
    return {
      start: this.state.visibleStartIndex,
      end: this.state.visibleEndIndex,
    };
  }

  isItemVisible(index: number): boolean {
    return (
      index >= this.state.visibleStartIndex &&
      index < this.state.visibleEndIndex
    );
  }
}

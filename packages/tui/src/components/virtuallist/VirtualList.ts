import { RenderContext } from '../../framework/UIFramework';
import { BaseComponent } from '../BaseComponent';
import { ScrollManager } from './ScrollManager';
import { SearchEngine } from './SearchEngine';
import { SelectionManager } from './SelectionManager';
import { VirtualizationEngine } from './VirtualizationEngine';
import {
  VirtualListItem,
  VirtualListConfig,
  VirtualListState,
  VirtualListRenderer,
  ScrollEvent,
  SelectionEvent,
  SearchResult,
} from './types';

export class VirtualList<T = unknown> extends BaseComponent {
  public readonly id: string;
  private config: VirtualListConfig;
  protected state: VirtualListState;
  private items: VirtualListItem<T>[] = [];
  private renderer: VirtualListRenderer<T>;
  protected lastRenderTime = 0;
  private renderCache = new Map<string, string>();

  // Specialized managers
  private virtualizationEngine: VirtualizationEngine<T>;
  private selectionManager: SelectionManager;
  private searchEngine: SearchEngine<T>;
  private scrollManager: ScrollManager<T>;

  constructor(props: Record<string, unknown> = {}) {
    super(props);
    this.id = (props.id as string) || `virtuallist-${Date.now()}`;
    const items = (props.items as VirtualListItem<T>[]) ?? [];
    const renderer = props.renderer as VirtualListRenderer<T>;
    const config = (props.config as Partial<VirtualListConfig>) ?? {};

    if (renderer == null) {
      throw new Error('VirtualList requires a renderer');
    }

    this.renderer = renderer;
    this.config = this.createConfig(config);
    this.state = this.createInitialState();

    // Initialize managers
    this.initializeManagers();

    // Set initial items
    this.setItems(items);
  }

  private createConfig(config: Partial<VirtualListConfig>): VirtualListConfig {
    return {
      itemHeight: 1,
      bufferSize: 5,
      overscan: 5,
      enableDynamicHeight: false,
      enableSelection: false,
      enableMultiSelection: false,
      enableSearch: false,
      scrollbarVisible: true,
      virtualizationThreshold: 100,
      ...config,
    };
  }

  private createInitialState(): VirtualListState {
    return {
      scrollTop: 0,
      viewportHeight: 10,
      totalHeight: 0,
      visibleStartIndex: 0,
      visibleEndIndex: 0,
      selectedIndices: new Set<number>(),
      focusedIndex: -1,
      searchQuery: '',
      filteredIndices: [],
    };
  }

  private initializeManagers(): void {
    this.virtualizationEngine = new VirtualizationEngine(this.config, this.state);

    this.selectionManager = new SelectionManager(
      this.config,
      this.state,
      this.handleSelectionChange.bind(this)
    );

    this.searchEngine = new SearchEngine(this.state);

    this.scrollManager = new ScrollManager(
      this.state,
      this.virtualizationEngine,
      this.handleScroll.bind(this)
    );
  }

  // Public API methods
  public setItems(items: VirtualListItem<T>[]): void {
    this.items = [...items];
    this.renderCache.clear();
    this.recalculateLayout();

    if (this.config.enableSearch) {
      this.searchEngine.buildSearchIndex(this.items);
    }
  }

  public addItem(item: VirtualListItem<T>, index?: number): void {
    if (index !== undefined && index >= 0 && index <= this.items.length) {
      this.items.splice(index, 0, item);
      this.selectionManager.updateSelectionAfterInsert(index);
    } else {
      this.items.push(item);
    }

    this.recalculateLayout();
    this.invalidateCache();
  }

  public removeItem(index: number): VirtualListItem<T> | null {
    if (index < 0 || index >= this.items.length) return null;

    const removed = this.items.splice(index, 1)[0];
    this.virtualizationEngine.updateItemHeights(index, 1);
    this.selectionManager.updateSelectionAfterRemove(index);
    this.updateFocusAfterRemove(index);
    this.recalculateLayout();
    this.invalidateCache();

    return removed;
  }

  public updateItem(index: number, item: Partial<VirtualListItem<T>>): boolean {
    if (index < 0 || index >= this.items.length) return false;

    this.items[index] = { ...this.items[index], ...item };

    if (this.config.enableDynamicHeight && item.height !== undefined) {
      this.virtualizationEngine.setItemHeight(index, item.height);
      this.recalculateLayout();
    }

    this.invalidateItemCache(index);
    return true;
  }

  // Scrolling methods
  public scrollTo(index: number): void {
    this.scrollManager.scrollTo(this.items, index);
  }

  public scrollBy(delta: number): void {
    this.scrollManager.scrollBy(this.items, delta);
  }

  // Selection methods
  public selectItem(index: number, toggle: boolean = false): void {
    this.selectionManager.selectItem(index, toggle);
    this.state.focusedIndex = index;
  }

  public selectRange(startIndex: number, endIndex: number): void {
    this.selectionManager.selectRange(startIndex, endIndex);
  }

  public clearSelection(): void {
    this.selectionManager.clearSelection();
  }

  // Search methods
  public search(query: string): SearchResult {
    if (!this.config.enableSearch) {
      return { query: '', matches: [], totalMatches: 0 };
    }
    return this.searchEngine.search(query);
  }

  public clearSearch(): void {
    this.searchEngine.clearSearch();
  }

  // Private helper methods
  private recalculateLayout(): void {
    this.virtualizationEngine.calculateTotalHeight(this.items);
    this.virtualizationEngine.updateVisibleRange(this.items);
  }

  private updateFocusAfterRemove(removedIndex: number): void {
    if (this.state.focusedIndex >= removedIndex && this.state.focusedIndex > 0) {
      this.state.focusedIndex--;
    }
  }

  private invalidateCache(): void {
    this.renderCache.clear();
  }

  private invalidateItemCache(index: number): void {
    const cacheKey = `item-${index}`;
    this.renderCache.delete(cacheKey);
  }

  private handleSelectionChange(event: SelectionEvent): void {
    this.emit('selectionChange', event);
  }

  private handleScroll(event: ScrollEvent): void {
    this.emit('scroll', event);
  }

  // Rendering
  render(context: RenderContext): string {
    this.lastRenderTime = Date.now();

    if (this.items.length === 0) {
      return this.renderEmpty();
    }

    return this.renderList(context);
  }

  private renderEmpty(): string {
    return this.renderer.renderEmpty?.() ?? 'No items';
  }

  private renderList(context: RenderContext): string {
    const parts: string[] = [];

    if (this.renderer.renderHeader) {
      parts.push(this.renderer.renderHeader());
    }

    parts.push(this.renderVisibleItems(context));

    if (this.renderer.renderFooter) {
      parts.push(this.renderer.renderFooter());
    }

    if (this.config.scrollbarVisible && this.renderer.renderScrollbar) {
      parts.push(this.renderScrollbar());
    }

    return parts.join('');
  }

  private renderVisibleItems(_context: RenderContext): string {
    const visibleItems: string[] = [];
    const { start, end } = this.virtualizationEngine.getVisibleIndices();

    for (let i = start; i < end && i < this.items.length; i++) {
      const item = this.items[i];
      const isSelected = this.selectionManager.isSelected(i);
      const isFocused = this.state.focusedIndex === i;

      const rendered = this.renderer.renderItem(item, i, isSelected, isFocused);
      visibleItems.push(rendered);
    }

    return visibleItems.join('');
  }

  private renderScrollbar(): string {
    if (!this.renderer.renderScrollbar) return '';

    return this.renderer.renderScrollbar(
      this.state.scrollTop,
      this.state.totalHeight,
      this.state.viewportHeight
    );
  }
}
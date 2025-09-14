export interface VirtualListItem<T = unknown> {
  id: string | number;
  data: T;
  height?: number;
  selected?: boolean;
  disabled?: boolean;
  metadata?: Record<string, unknown>;
}

export interface VirtualListConfig {
  itemHeight: number;
  bufferSize: number;
  overscan: number;
  enableDynamicHeight: boolean;
  enableSelection: boolean;
  enableMultiSelection: boolean;
  enableSearch: boolean;
  scrollbarVisible: boolean;
  virtualizationThreshold: number;
}

export interface VirtualListState extends Record<string, unknown> {
  scrollTop: number;
  viewportHeight: number;
  totalHeight: number;
  visibleStartIndex: number;
  visibleEndIndex: number;
  selectedIndices: Set<number>;
  focusedIndex: number;
  searchQuery: string;
  filteredIndices: number[];
}

export interface VirtualListRenderer<T = unknown> {
  renderItem: (
    item: VirtualListItem<T>,
    index: number,
    isSelected: boolean,
    isFocused: boolean
  ) => string;
  renderEmpty?: () => string;
  renderHeader?: () => string;
  renderFooter?: () => string;
  renderScrollbar?: (
    scrollTop: number,
    scrollHeight: number,
    viewportHeight: number
  ) => string;
  getItemHeight?: (item: VirtualListItem<T>, index: number) => number;
}

export interface ScrollEvent {
  scrollTop: number;
  viewportHeight: number;
  direction: 'up' | 'down';
  delta: number;
}

export interface SelectionEvent {
  selectedIndices: Set<number>;
  lastSelected: number;
  action: 'select' | 'deselect' | 'toggle' | 'clear';
}

export interface SearchResult {
  query: string;
  matches: number[];
  totalMatches: number;
}
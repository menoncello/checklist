import { VirtualListItem, VirtualListState, SearchResult } from './types';

export class SearchEngine<T> {
  private searchIndex = new Map<string, number[]>();

  constructor(private state: VirtualListState) {}

  buildSearchIndex(items: VirtualListItem<T>[]): void {
    this.searchIndex.clear();

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const searchableText = this.getSearchableText(item);

      if (!searchableText) continue;

      const words = this.tokenizeText(searchableText);
      for (const word of words) {
        if (!this.searchIndex.has(word)) {
          this.searchIndex.set(word, []);
        }
        const wordIndices = this.searchIndex.get(word);
        if (wordIndices) {
          wordIndices.push(i);
        }
      }
    }
  }

  search(query: string): SearchResult {
    if (!query.trim()) {
      this.state.filteredIndices = [];
      return { query: '', matches: [], totalMatches: 0 };
    }

    const normalizedQuery = query.toLowerCase().trim();
    const matches = this.performSearch(normalizedQuery);

    this.state.searchQuery = query;
    this.state.filteredIndices = matches;

    return {
      query,
      matches,
      totalMatches: matches.length,
    };
  }

  private performSearch(query: string): number[] {
    const queryWords = this.tokenizeText(query);
    if (queryWords.length === 0) return [];

    let results = this.searchIndex.get(queryWords[0]) ?? [];

    // For multi-word queries, find intersection
    for (let i = 1; i < queryWords.length; i++) {
      const wordMatches = this.searchIndex.get(queryWords[i]) ?? [];
      results = this.intersectArrays(results, wordMatches);
    }

    return results.sort((a, b) => a - b);
  }

  private intersectArrays(arr1: number[], arr2: number[]): number[] {
    const set2 = new Set(arr2);
    return arr1.filter(item => set2.has(item));
  }

  private tokenizeText(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 0);
  }

  private getSearchableText(item: VirtualListItem<T>): string {
    const parts: string[] = [];

    // Add ID if it's a string
    if (typeof item.id === 'string') {
      parts.push(item.id);
    }

    // Add data if it's searchable
    if (item.data != null) {
      if (typeof item.data === 'string') {
        parts.push(item.data);
      } else if (typeof item.data === 'object' && item.data !== null) {
        parts.push(...this.extractSearchableFromObject(item.data));
      }
    }

    // Add metadata
    if (item.metadata) {
      parts.push(...this.extractSearchableFromObject(item.metadata));
    }

    return parts.join(' ');
  }

  private extractSearchableFromObject(obj: unknown): string[] {
    const parts: string[] = [];

    if (typeof obj !== 'object' || obj === null) {
      return parts;
    }

    for (const value of Object.values(obj as Record<string, unknown>)) {
      if (typeof value === 'string') {
        parts.push(value);
      } else if (typeof value === 'number') {
        parts.push(value.toString());
      }
    }

    return parts;
  }

  clearSearch(): void {
    this.state.searchQuery = '';
    this.state.filteredIndices = [];
  }

  hasActiveSearch(): boolean {
    return this.state.searchQuery.length > 0;
  }

  getFilteredIndices(): number[] {
    return [...this.state.filteredIndices];
  }

  isIndexVisible(index: number): boolean {
    if (!this.hasActiveSearch()) return true;
    return this.state.filteredIndices.includes(index);
  }

  getNextMatch(currentIndex: number): number | null {
    if (!this.hasActiveSearch()) return null;

    const matches = this.state.filteredIndices;
    const nextMatch = matches.find(index => index > currentIndex);
    return nextMatch ?? matches[0] ?? null;
  }

  getPreviousMatch(currentIndex: number): number | null {
    if (!this.hasActiveSearch()) return null;

    const matches = this.state.filteredIndices;
    const reversedMatches = [...matches].reverse();
    const prevMatch = reversedMatches.find(index => index < currentIndex);
    return prevMatch ?? matches[matches.length - 1] ?? null;
  }
}
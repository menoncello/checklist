import { VirtualListConfig, VirtualListState, SelectionEvent } from './types';

export class SelectionManager {
  constructor(
    private config: VirtualListConfig,
    private state: VirtualListState,
    private onSelectionChange?: (event: SelectionEvent) => void
  ) {}

  selectItem(index: number, toggle: boolean = false): void {
    if (!this.config.enableSelection) return;

    const wasSelected = this.state.selectedIndices.has(index);
    let action: SelectionEvent['action'] = 'select';

    if (toggle && wasSelected) {
      this.state.selectedIndices.delete(index);
      action = 'deselect';
    } else if (!this.config.enableMultiSelection && !toggle) {
      this.state.selectedIndices.clear();
      this.state.selectedIndices.add(index);
      action = 'select';
    } else if (toggle) {
      action = wasSelected ? 'deselect' : 'select';
      if (wasSelected) {
        this.state.selectedIndices.delete(index);
      } else {
        this.state.selectedIndices.add(index);
      }
    } else {
      this.state.selectedIndices.add(index);
      action = 'select';
    }

    this.emitSelectionChange(action, index);
  }

  selectRange(startIndex: number, endIndex: number): void {
    if (!this.config.enableSelection || !this.config.enableMultiSelection) return;

    const start = Math.min(startIndex, endIndex);
    const end = Math.max(startIndex, endIndex);

    for (let i = start; i <= end; i++) {
      this.state.selectedIndices.add(i);
    }

    this.emitSelectionChange('select', endIndex);
  }

  selectAll(itemCount: number): void {
    if (!this.config.enableSelection || !this.config.enableMultiSelection) return;

    this.state.selectedIndices.clear();
    for (let i = 0; i < itemCount; i++) {
      this.state.selectedIndices.add(i);
    }

    this.emitSelectionChange('select', itemCount - 1);
  }

  clearSelection(): void {
    if (!this.config.enableSelection) return;

    this.state.selectedIndices.clear();
    this.emitSelectionChange('clear', -1);
  }

  toggleSelection(index: number): void {
    this.selectItem(index, true);
  }

  isSelected(index: number): boolean {
    return this.state.selectedIndices.has(index);
  }

  getSelectedCount(): number {
    return this.state.selectedIndices.size;
  }

  getSelectedIndices(): number[] {
    return Array.from(this.state.selectedIndices).sort((a, b) => a - b);
  }

  hasSelection(): boolean {
    return this.state.selectedIndices.size > 0;
  }

  getFirstSelected(): number | null {
    const indices = this.getSelectedIndices();
    return indices.length > 0 ? indices[0] : null;
  }

  getLastSelected(): number | null {
    const indices = this.getSelectedIndices();
    return indices.length > 0 ? indices[indices.length - 1] : null;
  }

  updateSelectionAfterRemove(removedIndex: number): void {
    const newSelection = new Set<number>();

    for (const selectedIndex of this.state.selectedIndices) {
      if (selectedIndex < removedIndex) {
        newSelection.add(selectedIndex);
      } else if (selectedIndex > removedIndex) {
        newSelection.add(selectedIndex - 1);
      }
      // Skip the removed index
    }

    this.state.selectedIndices = newSelection;
  }

  updateSelectionAfterInsert(insertIndex: number): void {
    const newSelection = new Set<number>();

    for (const selectedIndex of this.state.selectedIndices) {
      if (selectedIndex < insertIndex) {
        newSelection.add(selectedIndex);
      } else {
        newSelection.add(selectedIndex + 1);
      }
    }

    this.state.selectedIndices = newSelection;
  }

  private emitSelectionChange(action: SelectionEvent['action'], lastSelected: number): void {
    if (this.onSelectionChange) {
      this.onSelectionChange({
        selectedIndices: new Set(this.state.selectedIndices),
        lastSelected,
        action,
      });
    }
  }
}
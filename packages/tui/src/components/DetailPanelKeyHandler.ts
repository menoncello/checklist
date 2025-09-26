export interface ScrollableComponent {
  scrollUp(): void;
  scrollDown(): void;
  scrollPageUp(): void;
  scrollPageDown(): void;
  scrollToTop(): void;
  scrollToBottom(): void;
}

export class DetailPanelKeyHandler {
  constructor(private component: ScrollableComponent) {}

  public handleKeyPress(key: string): boolean {
    return this.handleScrollKey(key);
  }

  private handleScrollKey(key: string): boolean {
    const arrowResult = this.handleArrowKeys(key);
    if (arrowResult !== null) return arrowResult;

    return this.handlePageKeys(key);
  }

  private handleArrowKeys(key: string): boolean | null {
    if (key === 'up') {
      this.component.scrollUp();
      return true;
    }
    if (key === 'down') {
      this.component.scrollDown();
      return true;
    }
    return null;
  }

  private handlePageKeys(key: string): boolean {
    const actions: Record<string, () => void> = {
      pageup: () => this.component.scrollPageUp(),
      pagedown: () => this.component.scrollPageDown(),
      home: () => this.component.scrollToTop(),
      end: () => this.component.scrollToBottom(),
    };

    const action = actions[key];
    if (action !== null && action !== undefined) {
      action();
      return true;
    }

    return false;
  }
}

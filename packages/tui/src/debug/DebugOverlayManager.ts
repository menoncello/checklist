export class DebugOverlayManager {
  private visible = false;
  private content: string[] = [];
  private position: 'top' | 'bottom' | 'left' | 'right' = 'bottom';

  show(): void {
    this.visible = true;
  }

  hide(): void {
    this.visible = false;
  }

  toggle(): void {
    this.visible = !this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  setContent(content: string[]): void {
    this.content = content;
  }

  getContent(): string[] {
    return [...this.content];
  }

  setPosition(position: 'top' | 'bottom' | 'left' | 'right'): void {
    this.position = position;
  }

  getPosition(): string {
    return this.position;
  }

  clear(): void {
    this.content = [];
  }
}

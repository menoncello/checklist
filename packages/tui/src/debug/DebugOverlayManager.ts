import type { DebugConfig } from './helpers/ConfigInitializer';

export class DebugOverlayManager {
  private config: DebugConfig;
  private logCallback: (message: string) => void;
  private visible: boolean = false;

  constructor(config: DebugConfig, logCallback: (message: string) => void) {
    this.config = config;
    this.logCallback = logCallback;
  }

  show(): void {
    this.visible = true;
    this.config.showOverlay = true;
    this.logCallback('Debug overlay shown');
  }

  hide(): void {
    this.visible = false;
    this.config.showOverlay = false;
    this.logCallback('Debug overlay hidden');
  }

  toggle(): void {
    if (this.visible) {
      this.hide();
    } else {
      this.show();
    }
  }

  isShowing(): boolean {
    return this.visible;
  }

  isVisible(): boolean {
    return this.visible;
  }

  destroy(): void {
    this.visible = false;
    this.config.showOverlay = false;
  }

  setContent(_content: string[]): void {
    // Store content for future rendering if needed
    // This method is called by DebugManager but we don't need to do anything with it
    // for the basic toggle functionality
  }

  setPosition(
    position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'
  ): void {
    this.config.overlayPosition = position;
    this.logCallback(`Overlay position set to: ${position}`);
  }
}

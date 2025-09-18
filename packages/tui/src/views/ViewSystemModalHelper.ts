/**
 * ViewSystemModalHelper
 *
 * Manages modal and overlay functionality for the ViewSystem
 */

import { Modal, Overlay } from './types';

export class ViewSystemModalHelper {
  private currentModal: Modal | null = null;
  private currentOverlay: Overlay | null = null;

  async showModal(modal: Modal): Promise<unknown> {
    this.currentModal = modal;

    // Return a promise that resolves when modal is closed
    return new Promise((resolve) => {
      // Modal implementation would handle user interaction
      // For now, just resolve immediately
      resolve(undefined);
    });
  }

  hideModal(): void {
    this.currentModal = null;
  }

  showOverlay(overlay: Overlay): void {
    this.currentOverlay = overlay;
  }

  hideOverlay(): void {
    this.currentOverlay = null;
  }

  getCurrentModal(): Modal | null {
    return this.currentModal;
  }

  getCurrentOverlay(): Overlay | null {
    return this.currentOverlay;
  }

  clear(): void {
    this.currentModal = null;
    this.currentOverlay = null;
  }
}

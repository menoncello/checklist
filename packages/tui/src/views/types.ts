/**
 * View System Types
 *
 * Core type definitions for the view management system that handles
 * application screens, navigation, and layout management.
 */

export interface ViewParams {
  [key: string]: unknown;
}

export interface ViewState {
  [key: string]: unknown;
}

export interface View {
  readonly id: string;
  readonly title: string;
  readonly canGoBack: boolean;

  // Lifecycle methods
  onMount(params?: ViewParams): Promise<void> | void;
  onUnmount(): Promise<void> | void;
  onResize(width: number, height: number): void;

  // State management
  saveState(): ViewState;
  restoreState(state: ViewState): void;

  // Rendering
  render(): string;
  getKeyBindings(): KeyBinding[];
}

export interface KeyBinding {
  key: string;
  description: string;
  action: () => void | Promise<void>;
}

export interface Modal {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly buttons: ModalButton[];
}

export interface ModalButton {
  label: string;
  action: () => void | Promise<void>;
  variant?: 'primary' | 'secondary' | 'danger';
}

export interface Overlay {
  readonly id: string;
  readonly content: string;
  readonly position: OverlayPosition;
}

export interface OverlayPosition {
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export enum LayoutType {
  SINGLE = 'single',
  SPLIT_VERTICAL = 'split-vertical',
  SPLIT_HORIZONTAL = 'split-horizontal',
  TABBED = 'tabbed',
}

export interface NavigationStackEntry {
  viewId: string;
  params?: ViewParams;
  state?: ViewState;
  timestamp: number;
}

export interface ViewSystemOptions {
  maxHistorySize?: number;
  enableAnimations?: boolean;
  defaultLayout?: LayoutType;
}

export interface ViewSystem {
  // View Management
  registerView(id: string, view: View): void;
  unregisterView(id: string): void;
  getView(id: string): View | undefined;
  getCurrentView(): View | undefined;

  // Navigation
  navigateTo(viewId: string, params?: ViewParams): Promise<void>;
  goBack(): Promise<boolean>;
  canGoBack(): boolean;
  clearHistory(): void;

  // Layout Management
  setLayout(layout: LayoutType): void;
  getLayout(): LayoutType;
  splitView(primary: string, secondary: string): Promise<void>;

  // State Management
  saveViewState(viewId: string): void;
  restoreViewState(viewId: string): void;

  // Modal/Overlay
  showModal(modal: Modal): Promise<unknown>;
  hideModal(): void;
  showOverlay(overlay: Overlay): void;
  hideOverlay(): void;

  // Lifecycle
  initialize(): Promise<void>;
  destroy(): Promise<void>;
}

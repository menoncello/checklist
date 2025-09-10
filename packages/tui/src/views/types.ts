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

export interface TabInfo {
  readonly viewId: string;
  readonly title: string;
  readonly isActive: boolean;
}

export interface LayoutComponent {
  readonly id: string;
  readonly position: 'header' | 'footer' | 'sidebar-left' | 'sidebar-right';
  render(context: LayoutContext): string;
}

export interface LayoutContext {
  readonly width: number;
  readonly height: number;
  readonly currentView?: View;
  readonly navigation?: {
    canGoBack: boolean;
    breadcrumbs: string[];
  };
  readonly status?: {
    message: string;
    type: 'info' | 'warning' | 'error' | 'success';
  };
  readonly keyBindings?: KeyBinding[];
}

export interface HeaderComponent extends LayoutComponent {
  readonly position: 'header';
  readonly showBreadcrumbs: boolean;
  readonly showTitle: boolean;
}

export interface FooterComponent extends LayoutComponent {
  readonly position: 'footer';
  readonly showKeyBindings: boolean;
  readonly showStatus: boolean;
}

export interface LayoutRender {
  readonly header: string;
  readonly footer: string;
  readonly content: {
    x: number;
    y: number;
    width: number;
    height: number;
    content: string;
  };
  readonly sidebars: {
    left?: string;
    right?: string;
  };
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

  // Layout Component Management
  registerLayoutComponent(component: LayoutComponent): void;
  unregisterLayoutComponent(componentId: string): void;
  getLayoutComponent(componentId: string): LayoutComponent | undefined;
  getLayoutComponents(position: LayoutComponent['position']): LayoutComponent[];
  renderLayout(width: number, height: number): LayoutRender;

  // Tab Management
  addTab(viewId: string): Promise<void>;
  removeTab(viewId: string): Promise<void>;
  switchToTab(viewId: string): Promise<void>;
  getTabs(): readonly TabInfo[];
  getActiveTabId(): string | undefined;

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

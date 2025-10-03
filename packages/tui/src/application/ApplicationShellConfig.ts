export interface ApplicationState {
  version: string;
  mode: 'tui' | 'cli';
  activeWorkflow?: unknown;
  terminal: TerminalInfo;
  layout: LayoutState;
  focus: FocusState;
  errorState?: ErrorState;
}

export interface TerminalInfo {
  supportsColor: boolean;
  supportsUnicode: boolean;
  width: number;
  height: number;
  originalMode?: number;
}

export interface LayoutState {
  type: 'split-pane';
  ratio: number;
  leftPanel: PanelState;
  rightPanel: PanelState;
}

export interface PanelState {
  width: number;
  height: number;
  content: string[];
}

export interface FocusState {
  activePanel: 'left' | 'right';
  focusedComponent?: string;
  focusHistory: Array<{
    panel: 'left' | 'right';
    component?: string;
    timestamp: number;
  }>;
}

export interface ErrorState {
  error: Error;
  timestamp: number;
  context: Record<string, unknown>;
}

export interface ApplicationShellConfig {
  version: string;
  splitRatio?: number;
  targetFPS?: number;
  performanceConfig?: unknown;
  errorBoundaryConfig?: unknown;
  enableSplashScreen?: boolean;
  enableDebugMode?: boolean;
}

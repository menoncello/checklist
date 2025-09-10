export interface EventHandler {
  (event: unknown): void;
}

export interface Screen {
  id: string;
  name: string;
  render(): string;
  handleInput(input: string): void;
  onEnter?(): void;
  onExit?(): void;
  onResize?(width: number, height: number): void;
}

export interface Component {
  id: string;
  render(props: Record<string, unknown>): string;
  handleInput?(input: string): void;
  onMount?(): void;
  onUnmount?(): void;
}

export interface ComponentInstance {
  component: Component;
  props: Record<string, unknown>;
  mounted: boolean;
  render(): string;
  destroy(): void;
}

export interface UIFramework {
  // Lifecycle management
  initialize(): Promise<void>;
  render(): void;
  shutdown(): Promise<void>;

  // Screen management
  pushScreen(screen: Screen): void;
  popScreen(): void;
  replaceScreen(screen: Screen): void;
  getCurrentScreen(): Screen | null;

  // Event handling
  on(event: string, handler: EventHandler): void;
  off(event: string, handler: EventHandler): void;
  emit(event: string, data?: unknown): void;

  // Component system
  registerComponent(name: string, component: Component): void;
  createComponent(
    name: string,
    props: Record<string, unknown>
  ): ComponentInstance;

  // Terminal management
  getTerminalSize(): { width: number; height: number };
  isTerminalCapable(capability: string): boolean;

  // Performance monitoring
  getMetrics(): PerformanceMetrics;
  startProfiling(name: string): void;
  endProfiling(name: string): number;
}

export interface PerformanceMetrics {
  startupTime: number;
  renderTime: number;
  memoryUsage: number;
  frameRate: number;
  lastRenderDuration: number;
}

export interface TerminalCapabilities {
  color: boolean;
  color256: boolean;
  trueColor: boolean;
  unicode: boolean;
  mouse: boolean;
  altScreen: boolean;
  cursorShape: boolean;
}

export interface RenderContext {
  width: number;
  height: number;
  capabilities: TerminalCapabilities;
  buffer: string[];
  cursor: { x: number; y: number };
  scrollX?: number;
  scrollY?: number;
}

export interface LifecycleState {
  phase: 'initializing' | 'running' | 'shutting-down' | 'stopped';
  startTime: number;
  components: Set<string>;
  screens: string[];
  errorState?: Error;
}

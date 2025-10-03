/**
 * Dependency Injection Tokens
 *
 * Define tokens for all injectable dependencies.
 * Using Symbols ensures uniqueness and prevents naming collisions.
 */

// Core Services
export const EVENT_BUS = Symbol('EventBus');
export const PERFORMANCE_MONITOR = Symbol('PerformanceMonitor');
export const VIEW_SYSTEM = Symbol('ViewSystem');

// Navigation
export const COMMAND_QUEUE = Symbol('CommandQueue');
export const NAVIGATION_COMMAND_HANDLER = Symbol('NavigationCommandHandler');
export const NAVIGATION_COMMAND_EXECUTOR = Symbol('NavigationCommandExecutor');

// Terminal
export const TERMINAL_MANAGER = Symbol('TerminalManager');
export const TERMINAL_INFO = Symbol('TerminalInfo');

// Framework
export const LIFECYCLE_MANAGER = Symbol('LifecycleManager');
export const APPLICATION_LOOP = Symbol('ApplicationLoop');

// Error Handling
export const ERROR_BOUNDARY = Symbol('ErrorBoundary');
export const PANIC_RECOVERY = Symbol('PanicRecoveryHandler');

// Input
export const INPUT_ROUTER = Symbol('InputRouter');
export const KEYBOARD_HANDLER = Symbol('KeyboardHandler');

// Layout
export const LAYOUT_MANAGER = Symbol('LayoutManager');
export const SPLIT_PANE_LAYOUT = Symbol('SplitPaneLayout');

// Debugging
export const DEBUG_MANAGER = Symbol('DebugManager');

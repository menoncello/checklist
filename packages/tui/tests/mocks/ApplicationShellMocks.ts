/**
 * Test mocks for ApplicationShell dependencies
 * This file provides comprehensive mocks for all ApplicationShell dependencies
 */

import { LifecycleManager } from '../src/framework/Lifecycle';
import { LifecycleState } from '../src/framework/UIFramework';
import { ApplicationLoop } from '../src/framework/ApplicationLoop';
import { PerformanceMonitor, PerformanceMonitorConfig } from '../src/performance/PerformanceMonitor';
import { TerminalManager } from '../src/terminal/TerminalManager';
import { SplitPaneLayout } from '../src/layout/SplitPaneLayout';
import { InputRouter } from '../src/input/InputRouter';
import { ShutdownManager } from '../src/application/ShutdownManager';
import { ErrorBoundary } from '../src/errors/ErrorBoundary';
import { PanicRecovery } from '../src/errors/PanicRecovery';
import { ApplicationShellComponents } from '../src/application/ApplicationShellComponents';
import { ApplicationShellConfig } from '../src/application/ApplicationShellConfig';
import { ApplicationShellEventHandlers } from '../src/application/ApplicationShellEventHandlers';
import { ApplicationShellEvents } from '../src/application/ApplicationShellEvents';
import { ApplicationShellLifecycle } from '../src/application/ApplicationShellLifecycle';
import { ApplicationShellMethods } from '../src/application/ApplicationShellMethods';
import { ApplicationShellPerformance } from '../src/application/ApplicationShellPerformance';
import { ApplicationShellRenderer } from '../src/application/ApplicationShellRenderer';
import { ApplicationShellRendering } from '../src/application/ApplicationShellRendering';
import { ApplicationShellScreens } from '../src/application/ApplicationShellScreens';
import { ApplicationShellStartup } from '../src/application/ApplicationShellStartup';
import { ApplicationShellState } from '../src/application/ApplicationShellState';
import { ApplicationShellUI } from '../src/application/ApplicationShellUI';
import { ApplicationShellUIFramework } from '../src/application/ApplicationShellUIFramework';

// Mock LifecycleManager
export class MockLifecycleManager extends LifecycleManager {
  constructor() {
    super();
    // Override any methods that might cause issues in tests
  }

  public async initialize(): Promise<void> {
    // Mock implementation that doesn't throw
  }

  public async shutdown(): Promise<void> {
    // Mock implementation that doesn't throw
  }

  public getState(): LifecycleState {
    return {
      phase: 'stopped',
      startTime: 0,
      components: new Set(),
      screens: [],
      errorState: undefined,
    };
  }

  public updatePhase(phase: string): void {
    // Mock implementation
  }

  public onStateChange(callback: (state: LifecycleState) => void): void {
    // Mock implementation
  }

  public registerHooks(hooks: any): void {
    // Mock implementation
  }

  public displaySplashScreen(): void {
    // Mock implementation
  }
}

// Mock ApplicationLoop
export class MockApplicationLoop extends ApplicationLoop {
  constructor(targetFPS: number = 60) {
    super(targetFPS);
  }

  public on(event: string, handler: Function): void {
    // Mock implementation
  }

  public off(event: string, handler: Function): void {
    // Mock implementation
  }

  public emit(event: string, data?: unknown): void {
    // Mock implementation
  }
}

// Mock PerformanceMonitor
export class MockPerformanceMonitor extends PerformanceMonitor {
  constructor(config: Partial<PerformanceMonitorConfig> = {}) {
    super({
      enableMetrics: false, // Disable for faster tests
      enableBenchmarks: false,
      enableAlerts: false,
      metricsBufferSize: 100,
      benchmarksBufferSize: 50,
      alertsBufferSize: 10,
      samplingInterval: 60000,
      enableAutoSampling: false,
      enableMemoryProfiling: false,
      enableCPUProfiling: false,
      ...config,
    });
  }

  // Additional methods that tests expect but base class doesn't have
  public startProfiling(name: string): void {
    // Mock implementation
    this.mark(name);
  }

  public endProfiling(name: string): number {
    // Mock implementation - return a dummy duration
    return 10;
  }
}

// Mock TerminalManager
export class MockTerminalManager extends TerminalManager {
  constructor(config: any = {}) {
    super({
      enableRawMode: false,
      enableMouseSupport: false,
      enableAltScreen: false,
      fallbackRenderer: true,
      autoDetectCapabilities: false,
      ...config,
    });
  }

  public getDimensions(): { width: number; height: number } {
    return { width: 80, height: 24 };
  }

  public hasCapability(name: string): boolean {
    return false; // Mock implementation
  }

  public async cleanup(): Promise<void> {
    // Mock implementation
  }
}

// Mock SplitPaneLayout
export class MockSplitPaneLayout extends SplitPaneLayout {
  constructor(splitRatio: number = 0.7) {
    super(splitRatio);
  }

  public getLeftPanelContent(): string[] {
    return ['Mock left panel content'];
  }

  public getRightPanelContent(): string[] {
    return ['Mock right panel content'];
  }

  public render(leftContent: string[], rightContent: string[]): string {
    return 'Mock layout output';
  }

  public async cleanup(): Promise<void> {
    // Mock implementation
  }
}

// Mock InputRouter
export class MockInputRouter extends InputRouter {
  constructor() {
    super();
  }

  public async onShutdown(): Promise<void> {
    // Mock implementation
  }
}

// Mock ShutdownManager
export class MockShutdownManager extends ShutdownManager {
  constructor() {
    super();
  }

  public async executeGracefulShutdown(): Promise<void> {
    // Mock implementation
  }
}

// Mock ErrorBoundary
export class MockErrorBoundary extends ErrorBoundary {
  constructor(config?: any) {
    super(config);
  }

  public async execute(fn: () => Promise<void>): Promise<void> {
    await fn(); // Just execute the function without error handling for tests
  }

  public async handleApplicationError(error: Error, context: any): Promise<void> {
    // Mock implementation - don't throw in tests
  }
}

// Mock PanicRecovery
export class MockPanicRecovery extends PanicRecovery {
  constructor(errorBoundary: ErrorBoundary) {
    super(errorBoundary);
  }

  public setApplicationShell(shell: any): void {
    // Mock implementation
  }

  public async handlePanic(error: Error, context: any): Promise<void> {
    // Mock implementation - don't throw in tests
  }
}

// Mock helper classes
export class MockApplicationShellComponents extends ApplicationShellComponents {
  constructor() {
    super();
  }
}

export class MockApplicationShellEventHandlers extends ApplicationShellEventHandlers {
  constructor(state: any) {
    super(state);
  }
}

export class MockApplicationShellEvents extends ApplicationShellEvents {
  constructor() {
    super();
  }
}

export class MockApplicationShellLifecycle extends ApplicationShellLifecycle {
  constructor(state: any) {
    super(state);
  }
}

export class MockApplicationShellPerformance extends ApplicationShellPerformance {
  constructor(performanceMonitor: PerformanceMonitor) {
    super(performanceMonitor);
  }

  public getMetrics(): any {
    return {
      startupTime: 50,
      renderTime: 25,
      memoryUsage: 1024 * 1024,
      frameRate: 60,
      lastRenderDuration: 25,
    };
  }

  public startProfiling(name: string): void {
    // Mock implementation
  }

  public endProfiling(name: string): number {
    return 10; // Mock duration
  }

  public getPerformanceReport(): any {
    return {
      startupTime: 50,
      memoryUsage: 1024 * 1024,
      layoutReflowTime: 25,
      timestamp: Date.now(),
    };
  }
}

export class MockApplicationShellRenderer extends ApplicationShellRenderer {
  constructor(splitPaneLayout: SplitPaneLayout, performanceMonitor: PerformanceMonitor, rendering: ApplicationShellRendering) {
    super(splitPaneLayout, performanceMonitor, rendering);
  }

  public render(): void {
    // Mock implementation - don't actually write to stdout in tests
  }
}

export class MockApplicationShellRendering extends ApplicationShellRendering {
  constructor() {
    super();
  }
}

export class MockApplicationShellScreens extends ApplicationShellScreens {
  constructor() {
    super();
  }
}

export class MockApplicationShellStartup extends ApplicationShellStartup {
  constructor(deps: any) {
    super(deps);
  }

  public async initializeSubsystems(...args: any[]): Promise<void> {
    // Mock implementation
  }

  public async start(applicationLoop: ApplicationLoop, renderCallback: () => void): Promise<void> {
    // Mock implementation
  }

  public async stop(applicationLoop: ApplicationLoop): Promise<void> {
    // Mock implementation
  }

  public recordStartupMetrics(startTime: number): void {
    // Mock implementation
  }
}

export class MockApplicationShellState extends ApplicationShellState {
  constructor(state: any, lifecycleManager: LifecycleManager) {
    super(state, lifecycleManager);
  }
}

export class MockApplicationShellUI extends ApplicationShellUI {
  constructor(terminalManager: TerminalManager, screens: ApplicationShellScreens, components: ApplicationShellComponents, performance: ApplicationShellPerformance) {
    super(terminalManager, screens, components, performance);
  }
}

export class MockApplicationShellUIFramework extends ApplicationShellUIFramework {
  constructor() {
    super();
  }
}

export class MockApplicationShellMethods extends ApplicationShellMethods {
  constructor(deps: any) {
    super(deps);
  }

  public getMetrics(): any {
    return {
      startupTime: 50,
      memoryUsage: 1024 * 1024,
      layoutReflowTime: 25,
    };
  }

  public startProfiling(name: string): void {
    // Mock implementation
  }

  public endProfiling(name: string): number {
    return 10; // Mock duration
  }

  public getPerformanceReport(): any {
    return {
      startupTime: 50,
      memoryUsage: 1024 * 1024,
      layoutReflowTime: 25,
      timestamp: Date.now(),
    };
  }
}

// Factory function to create mock dependencies
export function createMockDependencies(config: ApplicationShellConfig) {
  const state = {
    version: config.version,
    mode: 'tui' as const,
    terminal: {
      supportsColor: false,
      supportsUnicode: false,
      width: 80,
      height: 24,
    },
    layout: {
      type: 'split-pane' as const,
      ratio: config.splitRatio ?? 0.7,
      leftPanel: { width: 0, height: 0, content: [] },
      rightPanel: { width: 0, height: 0, content: [] },
    },
    focus: {
      activePanel: 'left' as const,
      focusHistory: [],
    },
  };

  // Create mock instances
  const lifecycleManager = new MockLifecycleManager();
  const applicationLoop = new MockApplicationLoop();
  const performanceMonitor = new MockPerformanceMonitor();
  const terminalManager = new MockTerminalManager();
  const splitPaneLayout = new MockSplitPaneLayout(config.splitRatio);
  const inputRouter = new MockInputRouter();
  const shutdownManager = new MockShutdownManager();
  const errorBoundary = new MockErrorBoundary();
  const panicRecovery = new MockPanicRecovery(errorBoundary);

  // Create helper classes
  const rendering = new MockApplicationShellRendering();
  const eventHandler = new MockApplicationShellEventHandlers(state);
  const lifecycle = new MockApplicationShellLifecycle(state);
  const events = new MockApplicationShellEvents();
  const performance = new MockApplicationShellPerformance(performanceMonitor);
  const renderer = new MockApplicationShellRenderer(splitPaneLayout, performanceMonitor, rendering);
  const startup = new MockApplicationShellStartup({
    config,
    errorBoundary,
    panicRecovery,
    lifecycleManager,
    performanceMonitor,
  });
  const uiFramework = new MockApplicationShellUIFramework();
  const screens = new MockApplicationShellScreens();
  const components = new MockApplicationShellComponents();
  const ui = new MockApplicationShellUI(terminalManager, screens, components, performance);
  const stateManager = new MockApplicationShellState(state, lifecycleManager);
  const methods = new MockApplicationShellMethods({
    state,
    eventHandler,
    lifecycle,
    events,
    ui,
    stateManager,
    inputRouter,
  });

  return {
    config,
    lifecycleManager,
    applicationLoop,
    performanceMonitor,
    terminalManager,
    splitPaneLayout,
    inputRouter,
    shutdownManager,
    errorBoundary,
    panicRecovery,
    state,
    rendering,
    eventHandler,
    lifecycle,
    renderer,
    events,
    uiFramework,
    screens,
    components,
    performance,
    startup,
    ui,
    stateManager,
    methods,
  };
}
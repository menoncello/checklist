/**
 * Test mocks for ApplicationShell dependencies
 * This file provides comprehensive mocks for all ApplicationShell dependencies using IOC
 */

import { ApplicationShellConfig } from '../../src/application/ApplicationShellConfig';
import { createApplicationShellIOC, ApplicationShellIOC } from './ApplicationShellIOC';

// Re-export IOC for external use
export { ApplicationShellIOC, createApplicationShellIOC };

// Mock state interface for type safety
export interface MockLifecycleState {
  phase: 'initializing' | 'running' | 'shutting-down' | 'stopped';
  startTime: number;
  components: Set<string>;
  screens: string[];
  errorState?: Error;
}

// Mock Performance Metrics interface
export interface MockPerformanceMetrics {
  startupTime: number;
  memoryUsage: number;
  renderTime: number;
}

// Factory function to create mock dependencies using IOC
export function createMockDependencies(config: ApplicationShellConfig) {
  const container = createApplicationShellIOC(config);
  return container.createDependencies(config);
}


// Mock application state for testing
export function createMockState(): MockLifecycleState {
  return {
    phase: 'stopped',
    startTime: 0,
    components: new Set(),
    screens: [],
  };
}

// Mock performance metrics for testing
export function createMockMetrics(): MockPerformanceMetrics {
  return {
    startupTime: 50,
    memoryUsage: 1024 * 1024,
    renderTime: 25,
  };
}

// Legacy mock classes for backward compatibility
export class MockLifecycleManager {
  private state: MockLifecycleState;

  constructor() {
    this.state = createMockState();
  }

  public async initialize(): Promise<void> {
    this.state.phase = 'initializing';
    this.state.startTime = Date.now();
  }

  public async start(): Promise<void> {
    this.state.phase = 'running';
  }

  public async stop(): Promise<void> {
    this.state.phase = 'stopped';
  }

  public async shutdown(): Promise<void> {
    this.state.phase = 'stopped';
  }

  public getState(): MockLifecycleState {
    return { ...this.state };
  }

  public updatePhase(phase: MockLifecycleState['phase']): void {
    this.state.phase = phase;
  }

  public registerComponent(componentId: string): void {
    this.state.components.add(componentId);
  }

  public unregisterComponent(componentId: string): void {
    this.state.components.delete(componentId);
  }

  public pushScreen(screenId: string): void {
    this.state.screens.push(screenId);
  }

  public popScreen(): string | undefined {
    return this.state.screens.pop();
  }

  public isRunning(): boolean {
    return this.state.phase === 'running';
  }

  public onStateChange(callback: (state: MockLifecycleState) => void): void {
    // Mock implementation
  }

  public registerHooks(hooks: any): void {
    // Mock implementation
  }

  public displaySplashScreen(): void {
    // Mock implementation
  }
}

export class MockApplicationLoop {
  constructor(targetFPS: number = 60) {
    // Mock implementation
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

export class MockPerformanceMonitor {
  private config: any;

  constructor(config: any = {}) {
    this.config = {
      enableMetrics: true,
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
    };
  }

  public getConfig(): any {
    return this.config;
  }

  public recordMetricValue(name: string, value: number): void {
    // Mock implementation
  }

  public mark(name: string): void {
    // Mock implementation
  }

  public measure(name: string, startMark?: string, endMark?: string): number {
    return 10; // Mock duration
  }

  public getMetrics(): any {
    return {
      memoryUsage: 50 * 1024 * 1024,
      cpuUsage: 25,
      timestamp: Date.now(),
    };
  }

  public startProfiling(name: string): void {
    this.mark(name);
  }

  public endProfiling(name: string): number {
    return 10; // Mock duration
  }

  public getPerformanceReport(): any {
    return {
      startupTime: 50,
      memoryUsage: 1024 * 1024,
      renderTime: 25,
      timestamp: Date.now(),
    };
  }

  public startSampling(): void {
    // Mock implementation
  }

  public stopSampling(): void {
    // Mock implementation
  }
}

export class MockTerminalManager {
  private config: any;
  private dimensions: { width: number; height: number };

  constructor(config: any = {}) {
    this.config = {
      enableRawMode: false,
      enableMouseSupport: false,
      enableAltScreen: false,
      fallbackRenderer: true,
      autoDetectCapabilities: false,
      ...config,
    };
    this.dimensions = { width: 80, height: 24 };
  }

  public getDimensions(): { width: number; height: number } {
    return this.dimensions;
  }

  public hasCapability(name: string): boolean {
    return name === 'color' || name === 'unicode';
  }

  public detectCapabilities(): any {
    return {
      supportsColor: true,
      supportsUnicode: true,
      supportsMouse: false,
      supportsAltScreen: false
    };
  }

  public setupTerminal(): void {
    // Mock implementation
  }

  public async cleanup(): Promise<void> {
    // Mock implementation
  }

  public onResize(callback: (dimensions: { width: number; height: number }) => void): void {
    // Mock implementation
  }

  public enableRawMode(): void {
    // Mock implementation
  }

  public disableRawMode(): void {
    // Mock implementation
  }
}

export class MockSplitPaneLayout {
  private splitRatio: number;

  constructor(splitRatio: number = 0.7) {
    this.splitRatio = splitRatio;
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

  public initialize(): void {
    // Mock implementation
  }

  public updateDimensions(): void {
    // Mock implementation
  }

  public async cleanup(): Promise<void> {
    // Mock implementation
  }

  public setSplitRatio(ratio: number): void {
    this.splitRatio = ratio;
  }

  public getSplitRatio(): number {
    return this.splitRatio;
  }
}

export class MockInputRouter {
  public initialize(): void {
    // Mock implementation
  }

  public routeInput(input: any): void {
    // Mock implementation
  }

  public async cleanup(): Promise<void> {
    // Mock implementation
  }

  public async onShutdown(): Promise<void> {
    // Mock implementation
  }

  public registerHandler(key: string, handler: Function): void {
    // Mock implementation
  }

  public unregisterHandler(key: string): void {
    // Mock implementation
  }
}

export class MockShutdownManager {
  public onInitialize(): Promise<void> {
    return Promise.resolve();
  }

  public onShutdown(): Promise<void> {
    return Promise.resolve();
  }

  public registerHooks(): void {
    // Mock implementation
  }

  public async executeGracefulShutdown(reason?: string): Promise<any> {
    return {
      duration: 100,
      stepsCompleted: 3,
      stepsFailed: 0,
      steps: [],
      forceShutdown: false,
      timeoutReached: false
    };
  }
}

export class MockErrorBoundary {
  private config?: any;

  constructor(config?: any) {
    this.config = config;
  }

  public async execute(fn: () => Promise<void>): Promise<void> {
    await fn();
  }

  public async handleApplicationError(error: Error, context: any): Promise<void> {
    // Mock implementation
  }

  public initialize(): void {
    // Mock implementation
  }

  public handleError(): void {
    // Mock implementation
  }

  public recover(): void {
    // Mock implementation
  }
}

export class MockPanicRecovery {
  private errorBoundary: any;
  private applicationShell: any;

  constructor(errorBoundary: any) {
    this.errorBoundary = errorBoundary;
  }

  public setApplicationShell(shell: any): void {
    this.applicationShell = shell;
  }

  public setLogger(logger: any): void {
    // Mock implementation
  }

  public initialize(): void {
    // Mock implementation
  }

  public async handlePanic(error: Error): Promise<void> {
    // Mock implementation
  }

  public async attemptRecovery(): Promise<boolean> {
    return true;
  }
}

export class MockApplicationShellMethods {
  private deps: any;

  constructor(deps: any) {
    this.deps = deps;
  }

  public pushScreen(screen: any): void {
    // Mock implementation
  }

  public popScreen(): any {
    return null;
  }

  public getCurrentScreen(): any {
    return null;
  }

  public on(event: string, handler: Function): void {
    // Mock implementation
  }

  public off(event: string, handler: Function): void {
    // Mock implementation
  }

  public emit(event: string, data?: any): void {
    // Mock implementation
  }

  public getTerminalSize(): { width: number; height: number } {
    return { width: 80, height: 24 };
  }

  public isTerminalCapable(capability: string): boolean {
    return capability === 'color' || capability === 'unicode';
  }

  public getMetrics(): any {
    return {
      startupTime: 50,
      memoryUsage: 1024 * 1024,
      renderTime: 25,
    };
  }

  public startProfiling(name: string): void {
    // Mock implementation
  }

  public endProfiling(name: string): number {
    return 10;
  }

  public getPerformanceReport(): any {
    return {
      startupTime: 50,
      memoryUsage: 1024 * 1024,
      renderTime: 25,
      timestamp: Date.now(),
    };
  }
}

export class MockApplicationShellRenderer {
  private splitPaneLayout: any;
  private performanceMonitor: any;
  private rendering: any;

  constructor(splitPaneLayout: any, performanceMonitor: any, rendering: any) {
    this.splitPaneLayout = splitPaneLayout;
    this.performanceMonitor = performanceMonitor;
    this.rendering = rendering;
  }

  public render(): void {
    // Mock implementation - don't actually write to stdout in tests
  }
}

// Factory function that maintains backward compatibility while using IOC internally
export function createMockDependenciesLegacy(config: ApplicationShellConfig) {
  return createMockDependencies(config);
}
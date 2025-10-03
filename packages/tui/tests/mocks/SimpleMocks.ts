/**
 * Simple test mocks for ApplicationShell dependencies
 * These mocks don't extend the real classes to avoid import issues
 * Updated to use IOC container for better dependency management
 */

import { ApplicationShellConfig } from '../../src/application/ApplicationShellConfig';
import { createApplicationShellIOC, ApplicationShellIOC } from './ApplicationShellIOC';

// Re-export IOC for external use
export { ApplicationShellIOC, createApplicationShellIOC };

// Simple mock interfaces for backward compatibility
export interface MockLifecycleState {
  phase: 'initializing' | 'running' | 'shutting-down' | 'stopped';
  startTime: number;
  components: Set<string>;
  screens: string[];
  errorState?: Error;
}

export interface MockPerformanceMetrics {
  startupTime: number;
  memoryUsage: number;
  renderTime: number;
}

// Simple mock classes
export class MockLifecycleManager {
  private state: MockLifecycleState;

  constructor() {
    this.state = {
      phase: 'stopped',
      startTime: 0,
      components: new Set(),
      screens: [],
    };
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
  constructor(config: any = {}) {
    // Mock implementation
  }

  public getConfig(): any {
    return { enableMetrics: true };
  }

  public recordMetricValue(name: string, value: number): void {
    // Mock implementation
  }

  public startBenchmark(name: string): void {
    // Mock implementation
  }

  public endBenchmark(name: string): number {
    return 0;
  }

  public on(event: string, handler: Function): void {
    // Mock implementation
  }

  public off(event: string, handler: Function): void {
    // Mock implementation
  }

  public getMetrics(): MockPerformanceMetrics {
    return {
      startupTime: 10,
      memoryUsage: 1024,
      renderTime: 5,
    };
  }
}

export class MockTerminalManager {
  constructor(config: any = {}) {
    // Mock implementation
  }

  public getDimensions(): { width: number; height: number } {
    return { width: 80, height: 24 };
  }

  public hasCapability(name: string): boolean {
    return false;
  }

  public async cleanup(): Promise<void> {
    // Mock implementation
  }
}

export class MockSplitPaneLayout {
  constructor(splitRatio: number = 0.7) {
    // Mock implementation
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

export class MockInputRouter {
  constructor() {
    // Mock implementation
  }

  public async onShutdown(): Promise<void> {
    // Mock implementation
  }
}

export class MockShutdownManager {
  constructor() {
    // Mock implementation
  }

  public async executeGracefulShutdown(): Promise<void> {
    // Mock implementation
  }
}

export class MockErrorBoundary {
  constructor(config?: any) {
    // Mock implementation
  }

  public async execute(fn: () => Promise<void>): Promise<void> {
    await fn();
  }

  public async handleApplicationError(error: Error, context: any): Promise<void> {
    // Mock implementation
  }
}

export class MockPanicRecovery {
  constructor(errorBoundary: MockErrorBoundary) {
    // Mock implementation
  }

  public setApplicationShell(shell: any): void {
    // Mock implementation
  }

  public async handlePanic(error: Error, context: any): Promise<void> {
    // Mock implementation
  }
}

// Factory function to create mock dependencies using IOC
export function createSimpleMockDependencies(config: ApplicationShellConfig) {
  const container = createApplicationShellIOC(config);
  return container.createDependencies(config);
}

// Legacy factory function for backward compatibility
export function createMockDependencies(config: ApplicationShellConfig) {
  return createSimpleMockDependencies(config);
}
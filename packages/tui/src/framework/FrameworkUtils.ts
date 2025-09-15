import { TUIFrameworkConfig } from './FrameworkInitializer';

export interface TUIFrameworkState {
  isInitialized: boolean;
  isRunning: boolean;
  currentScreen: string | null;
  componentCount: number;
  errorCount: number;
  startupTime: number;
}

export class FrameworkUtils {
  static createDefaultConfig(
    config: Partial<TUIFrameworkConfig> = {}
  ): TUIFrameworkConfig {
    return {
      // Framework settings
      enableFramework: true,
      targetFPS: 60,

      // Performance settings
      enablePerformanceMonitoring: true,
      performanceTargets: {
        startupTime: 100, // ms
        renderTime: 16, // ms (60fps)
        memoryLimit: 50, // MB
      },

      // Debug settings
      enableDebugMode: process.env.NODE_ENV !== 'production',
      debugInProduction: false,

      // Error handling
      enableErrorBoundaries: true,
      enableCrashRecovery: true,

      // Terminal settings
      enableTerminalDetection: true,
      fallbackToBasic: true,

      // Event handling
      enableKeyboardShortcuts: true,
      enableMouseSupport: false,

      // Override with provided config
      ...config,
    };
  }

  static createInitialState(): TUIFrameworkState {
    return {
      isInitialized: false,
      isRunning: false,
      currentScreen: null,
      componentCount: 0,
      errorCount: 0,
      startupTime: 0,
    };
  }

  static logShutdownStart(signal?: string): void {
    const signalText = signal !== undefined ? ` (${signal})` : '';
    console.log(`TUI Framework shutdown initiated${signalText}`);
  }

  static logShutdownComplete(): void {
    console.log('TUI Framework shutdown completed');
  }

  static logShutdownError(error: unknown): void {
    console.error('TUI Framework shutdown error:', error);
  }

  static destroyIfExists(component: unknown): void {
    if (
      component !== null &&
      component !== undefined &&
      typeof component === 'object' &&
      'destroy' in component
    ) {
      try {
        (component as { destroy: () => void }).destroy();
      } catch (error) {
        console.warn('Failed to destroy component:', error);
      }
    }
  }

  static isValidHandlerFunction(handler: unknown): boolean {
    return typeof handler === 'function';
  }

  static createMetricsSnapshot(
    state: TUIFrameworkState,
    performanceManager?: { getMetrics?: () => Record<string, unknown> }
  ): Record<string, unknown> {
    const baseMetrics = {
      isInitialized: state.isInitialized,
      isRunning: state.isRunning,
      currentScreen: state.currentScreen,
      componentCount: state.componentCount,
      errorCount: state.errorCount,
      startupTime: state.startupTime,
      timestamp: Date.now(),
    };

    if (performanceManager?.getMetrics !== undefined) {
      try {
        return {
          ...baseMetrics,
          performance: performanceManager.getMetrics(),
        };
      } catch (error) {
        console.warn('Failed to get performance metrics:', error);
      }
    }

    return baseMetrics;
  }
}

import { DebugManager } from './DebugManager';
import { ComponentDebugInfo } from './DebugManager';
import { DebugOverlay } from './DebugOverlay';

export class DebugIntegrationCore {
  constructor(
    private debugManager: DebugManager,
    private debugOverlay: DebugOverlay
  ) {}

  public handleKeyPress(key: string, enableShortcuts: boolean): boolean {
    if (!enableShortcuts) return false;

    if (this.debugManager.handleKeyPress?.(key) === true) {
      return true;
    }

    if (this.debugManager.isDebugVisible?.() === true) {
      return this.debugOverlay.handleKeyPress(key);
    }

    return false;
  }

  public handleMouseEvent(
    x: number,
    y: number,
    button: 'left' | 'right' | 'wheel',
    delta?: number
  ): boolean {
    if (this.debugManager.isDebugVisible?.() === true) {
      return this.debugOverlay.handleMouseEvent(x, y, button, delta);
    }
    return false;
  }

  public logComponentEvent(
    componentId: string,
    event: string,
    data?: unknown
  ): void {
    this.debugManager.logEvent(event, {
      componentId,
      ...(data as Record<string, unknown>),
    });
  }

  public updateComponentTree(tree: ComponentDebugInfo): void {
    this.debugManager.updateComponentTree(tree);
  }

  public startProfiling(name: string): string {
    return this.debugManager.startProfiling(name);
  }

  public endProfiling(profileId: string): number {
    return this.debugManager.endProfiling(profileId);
  }

  public log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: string,
    message: string,
    data?: unknown
  ): void {
    this.debugManager.log({ level, category, message, data });
  }

  public enable(): void {
    this.debugManager.enable();
  }

  public disable(): void {
    this.debugManager.disable();
  }

  public toggle(): void {
    this.debugManager.toggle();
  }

  public getDebugManager(): DebugManager {
    return this.debugManager;
  }

  public getDebugOverlay(): DebugOverlay {
    return this.debugOverlay;
  }
}

export class GlobalErrorHandlerSetup {
  public static setup(debugManager: DebugManager): void {
    if (typeof process !== 'undefined') {
      this.setupNodeHandlers(debugManager);
    }
    // Browser handlers not needed in Node.js TUI environment
    // if (typeof window !== 'undefined') {
    //   this.setupBrowserHandlers(debugManager);
    // }
  }

  private static setupNodeHandlers(debugManager: DebugManager): void {
    this.setupUncaughtExceptionHandler(debugManager);
    this.setupUnhandledRejectionHandler(debugManager);
    this.setupWarningHandler(debugManager);
  }

  private static setupUncaughtExceptionHandler(
    debugManager: DebugManager
  ): void {
    process.on('uncaughtException', (error) => {
      debugManager.log({
        level: 'error',
        category: 'System',
        message: 'Uncaught exception',
        data: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      });
    });
  }

  private static setupUnhandledRejectionHandler(
    debugManager: DebugManager
  ): void {
    process.on('unhandledRejection', (reason, promise) => {
      debugManager.log({
        level: 'error',
        category: 'System',
        message: 'Unhandled promise rejection',
        data: {
          reason: reason instanceof Error ? reason.message : String(reason),
          stack: reason instanceof Error ? reason.stack : undefined,
          promise: promise.toString(),
        },
      });
    });
  }

  private static setupWarningHandler(debugManager: DebugManager): void {
    process.on('warning', (warning) => {
      debugManager.log({
        level: 'warn',
        category: 'System',
        message: `Node.js warning: ${warning.name}`,
        data: {
          message: warning.message,
          stack: warning.stack,
        },
      });
    });
  }

  private static setupBrowserHandlers(debugManager: DebugManager): void {
    const win = this.getBrowserWindow();
    if (!win?.addEventListener) return;

    const winWithHandler = win as {
      addEventListener: (event: string, handler: (e: unknown) => void) => void;
    };

    this.setupErrorHandler(winWithHandler, debugManager);
    this.setupRejectionHandler(winWithHandler, debugManager);
  }

  private static getBrowserWindow(): {
    addEventListener?: (event: string, handler: (e: unknown) => void) => void;
  } | null {
    // window is not available in Node.js environments
    if (typeof globalThis !== 'undefined' && 'window' in globalThis) {
      return (globalThis as unknown as { window: unknown }).window as {
        addEventListener?: (
          event: string,
          handler: (e: unknown) => void
        ) => void;
      };
    }
    return null;
  }

  private static setupErrorHandler(
    win: {
      addEventListener: (event: string, handler: (e: unknown) => void) => void;
    },
    debugManager: DebugManager
  ): void {
    win.addEventListener('error', (event: unknown) => {
      const e = event as {
        message?: string;
        filename?: string;
        lineno?: number;
        colno?: number;
        error?: Error;
      };
      debugManager.log({
        level: 'error',
        category: 'Browser',
        message: 'Uncaught error',
        data: {
          message: e.message,
          filename: e.filename,
          line: e.lineno,
          column: e.colno,
          stack: e.error?.stack,
        },
      });
    });
  }

  private static setupRejectionHandler(
    win: {
      addEventListener: (event: string, handler: (e: unknown) => void) => void;
    },
    debugManager: DebugManager
  ): void {
    win.addEventListener('unhandledrejection', (event: unknown) => {
      const e = event as { reason?: unknown; promise?: Promise<unknown> };
      const reason =
        e.reason instanceof Error ? e.reason.message : String(e.reason);
      const stack = e.reason instanceof Error ? e.reason.stack : undefined;
      debugManager.log({
        level: 'error',
        category: 'Browser',
        message: 'Unhandled promise rejection',
        data: {
          reason,
          stack,
        },
      });
    });
  }
}

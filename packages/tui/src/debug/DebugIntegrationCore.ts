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

    if (this.debugManager.handleKeyPress(key)) {
      return true;
    }

    if (this.debugManager.isDebugVisible()) {
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
    if (this.debugManager.isDebugVisible()) {
      return this.debugOverlay.handleMouseEvent(x, y, button, delta);
    }
    return false;
  }

  public logComponentEvent(
    componentId: string,
    event: string,
    data?: unknown
  ): void {
    this.debugManager.logEvent(event, componentId, data);
  }

  public updateComponentTree(tree: ComponentDebugInfo): void {
    this.debugManager.updateComponentTree(tree);
  }

  public startProfiling(name: string): string {
    return this.debugManager.startProfiling(name);
  }

  public endProfiling(profileId: string, name: string): number {
    return this.debugManager.endProfiling(profileId, name);
  }

  public log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: string,
    message: string,
    data?: unknown
  ): void {
    this.debugManager.log(level, category, message, data);
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
    process.on('uncaughtException', (error) => {
      debugManager.log('error', 'System', 'Uncaught exception', {
        message: error.message,
        stack: error.stack,
        name: error.name,
      });
    });

    process.on('unhandledRejection', (reason, promise) => {
      debugManager.log('error', 'System', 'Unhandled promise rejection', {
        reason: reason instanceof Error ? reason.message : String(reason),
        stack: reason instanceof Error ? reason.stack : undefined,
        promise: promise.toString(),
      });
    });

    process.on('warning', (warning) => {
      debugManager.log('warn', 'System', `Node.js warning: ${warning.name}`, {
        message: warning.message,
        stack: warning.stack,
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
      debugManager.log('error', 'Browser', 'Uncaught error', {
        message: e.message,
        filename: e.filename,
        line: e.lineno,
        column: e.colno,
        stack: e.error?.stack,
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
      debugManager.log('error', 'Browser', 'Unhandled promise rejection', {
        reason,
        stack,
      });
    });
  }
}

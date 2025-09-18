import { EventHandler } from '../shutdown/types';

export class ShutdownTimerManager {
  private gracefulTimer: NodeJS.Timeout | null = null;
  private forceTimer: NodeJS.Timeout | null = null;

  public setupGracefulTimer(timeout: number, onTimeout: () => void): void {
    this.gracefulTimer = setTimeout(onTimeout, timeout);
  }

  public setupForceTimer(
    gracefulTimeout: number,
    forceTimeout: number,
    onTimeout: () => void
  ): void {
    this.forceTimer = setTimeout(onTimeout, gracefulTimeout + forceTimeout);
  }

  public clearTimers(): void {
    if (this.gracefulTimer != null) {
      clearTimeout(this.gracefulTimer);
      this.gracefulTimer = null;
    }
    if (this.forceTimer != null) {
      clearTimeout(this.forceTimer);
      this.forceTimer = null;
    }
  }
}

export class EventBus {
  private eventHandlers = new Map<string, Set<EventHandler>>();

  public on(event: string, handler: EventHandler): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  public off(event: string, handler: EventHandler): void {
    this.eventHandlers.get(event)?.delete(handler);
  }

  public once(event: string, handler: EventHandler): void {
    const wrappedHandler: EventHandler = (data) => {
      handler(data);
      this.off(event, wrappedHandler);
    };
    this.on(event, wrappedHandler);
  }

  public emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (_error) {
          // Silently catch handler errors
        }
      });
    }
  }

  public clear(): void {
    this.eventHandlers.clear();
  }
}

export class SignalHandlerSetup {
  public static setup(handlers: {
    onSigterm: () => void;
    onSigint: () => void;
    onSigkill: () => void;
    onUncaught: (error: Error) => void;
    onUnhandled: (reason: unknown) => void;
  }): void {
    process.on('SIGTERM', handlers.onSigterm);
    process.on('SIGINT', handlers.onSigint);
    process.on('SIGKILL', handlers.onSigkill);
    process.on('uncaughtException', handlers.onUncaught);
    process.on('unhandledRejection', handlers.onUnhandled);
  }
}

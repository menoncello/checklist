import { InputEvent } from '../framework/ApplicationLoop';
import {
  EventHandler,
  Screen,
  ComponentInstance,
  PerformanceMetrics,
  LifecycleState,
} from '../framework/UIFramework';
import { InputRouter } from '../input/InputRouter';
import { ApplicationState } from './ApplicationShellConfig';
import { ApplicationShellEventHandlers } from './ApplicationShellEventHandlers';
import { ApplicationShellEvents } from './ApplicationShellEvents';
import { ApplicationShellLifecycle } from './ApplicationShellLifecycle';
import { ApplicationShellState } from './ApplicationShellState';
import { ApplicationShellUI } from './ApplicationShellUI';

export class ApplicationShellMethods {
  constructor(
    private deps: {
      state: ApplicationState;
      eventHandler: ApplicationShellEventHandlers;
      lifecycle: ApplicationShellLifecycle;
      events: ApplicationShellEvents;
      ui: ApplicationShellUI;
      stateManager: ApplicationShellState;
      inputRouter: InputRouter;
    }
  ) {}

  public handleInput(input: InputEvent): void {
    try {
      this.deps.inputRouter.routeInput(input, this.deps.state.focus);
      this.deps.eventHandler.handleInput(input);
      this.deps.events.emit('input', input);
    } catch (error) {
      this.deps.lifecycle.handleError(error as Error);
    }
  }

  public handleResize(width: number, height: number): void {
    try {
      this.deps.eventHandler.handleResize(width, height);
      this.deps.lifecycle.updateLayoutDimensions(width, height);
      this.deps.events.emit('resize', { width, height });
    } catch (error) {
      this.deps.lifecycle.handleError(error as Error);
    }
  }

  public handleSignal(signalType: string): void {
    this.deps.eventHandler.handleSignal(signalType);
    this.deps.lifecycle.handleSignal(signalType);
  }

  public handleError(error: Error): void {
    this.deps.eventHandler.handleError(error);
    this.deps.lifecycle.handleError(error);
    this.deps.events.emitError(error);
  }

  public pushScreen(screen: unknown): void {
    this.deps.ui.pushScreen(screen);
  }

  public popScreen(): void {
    this.deps.ui.popScreen();
  }

  public replaceScreen(screen: unknown): void {
    this.deps.ui.replaceScreen(screen);
  }

  public getCurrentScreen(): Screen | null {
    return this.deps.ui.getCurrentScreen();
  }

  public on(event: string, handler: EventHandler): void {
    this.deps.events.on(event, handler);
  }

  public off(event: string, handler: EventHandler): void {
    this.deps.events.off(event, handler);
  }

  public emit(event: string, data?: unknown): void {
    this.deps.events.emit(event, data);
  }

  public registerComponent(name: string, component: unknown): void {
    this.deps.ui.registerComponent(name, component);
  }

  public createComponent(
    name: string,
    props: Record<string, unknown>
  ): ComponentInstance {
    return this.deps.ui.createComponent(name, props);
  }

  public getTerminalSize(): { width: number; height: number } {
    return this.deps.ui.getTerminalSize();
  }

  public isTerminalCapable(capability: string): boolean {
    return this.deps.ui.isTerminalCapable(capability);
  }

  public getMetrics(): PerformanceMetrics {
    return this.deps.ui.getMetrics();
  }

  public startProfiling(name: string): void {
    this.deps.ui.startProfiling(name);
  }

  public endProfiling(name: string): number {
    return this.deps.ui.endProfiling(name);
  }

  public getState(): ApplicationState {
    return this.deps.stateManager.getState();
  }

  public getLifecycleState(): LifecycleState {
    return this.deps.stateManager.getLifecycleState();
  }

  public getPerformanceReport(): unknown {
    return this.deps.ui.getPerformanceReport();
  }
}

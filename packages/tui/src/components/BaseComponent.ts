import { Component } from '../framework/UIFramework';
import { TableRenderer, type TableOptions } from './helpers/TableRenderer';
import {
  TextFormatter,
  type TextFormatOptions,
  type AnsiStyle,
} from './helpers/TextFormatter';

// Base component types
export type ComponentState = Record<string, unknown>;
export type ComponentProps = Record<string, unknown>;
export type ComponentEventHandler = (event: unknown) => void;
export type LifecyclePhase =
  | 'initializing'
  | 'initialized'
  | 'mounting'
  | 'mounted'
  | 'updating'
  | 'unmounting'
  | 'unmounted'
  | 'error';
export interface ComponentMetadata {
  id: string;
  name?: string;
  version?: string;
  description?: string;
  tags?: string[];
}

export abstract class BaseComponent implements Component {
  public abstract readonly id: string;

  protected props: Record<string, unknown> = {};
  protected state: Record<string, unknown> = {};
  protected mounted: boolean = false;
  protected eventHandlers = new Map<string, Set<Function>>();
  protected updateCallbacks = new Set<Function>();
  protected errorHandlers = new Set<(error: Error) => void>();
  protected lastRender: string = '';
  protected renderCount: number = 0;
  protected lastRenderTime: number = 0;

  constructor(initialProps: Record<string, unknown> = {}) {
    this.props = { ...initialProps };
    this.initialize();
  }

  protected initialize(): void {
    // Override in subclasses for initialization logic
  }

  public abstract render(props: unknown): string;

  public handleInput?(input: string): void {
    // Default implementation - override in subclasses
    this.emit('input', { input, component: this });
  }

  public onMount(): void {
    if (this.mounted) return;

    this.mounted = true;
    this.emit('mount');

    // Call initialization hooks
    this.onAfterMount();
  }

  public onUnmount(): void {
    if (!this.mounted) return;

    this.mounted = false;
    this.emit('unmount');

    // Cleanup resources
    this.cleanup();
  }

  protected onAfterMount(): void {
    // Override in subclasses for post-mount logic
  }

  protected cleanup(): void {
    // Override in subclasses for cleanup logic
    this.eventHandlers.clear();
    this.updateCallbacks.clear();
    this.errorHandlers.clear();
  }

  protected setState(newState: Partial<typeof this.state>): void {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...newState };

    this.emit('stateChange', {
      previousState,
      newState: this.state,
      component: this,
    });

    // Trigger updates
    this.notifyUpdates();
  }

  protected getState(): typeof this.state {
    return { ...this.state };
  }

  public setProps(newProps: Partial<typeof this.props>): void {
    const previousProps = { ...this.props };
    this.props = { ...this.props, ...newProps };

    this.emit('propsChange', {
      previousProps,
      newProps: this.props,
      component: this,
    });

    // Trigger updates
    this.notifyUpdates();
  }

  protected getProps(): typeof this.props {
    return { ...this.props };
  }

  protected isMounted(): boolean {
    return this.mounted;
  }

  protected shouldUpdate(_newProps: unknown, _newState: unknown): boolean {
    // Default implementation: always update
    // Override in subclasses for optimization
    return true;
  }

  protected markDirty(): void {
    this.emit('dirty', { component: this });
    this.notifyUpdates();
  }

  protected getWidth(): number {
    // Default implementation - can be overridden
    return (this.props.width as number) || 80;
  }

  protected getHeight(): number {
    // Default implementation - can be overridden
    return (this.props.height as number) || 24;
  }

  protected renderWithErrorBoundary(props: unknown): string {
    try {
      const startTime = performance.now();
      const result = this.render(props);
      const endTime = performance.now();

      this.lastRender = result;
      this.renderCount++;
      this.lastRenderTime = endTime - startTime;

      this.emit('renderComplete', {
        result,
        renderTime: this.lastRenderTime,
        renderCount: this.renderCount,
      });

      return result;
    } catch (error) {
      this.handleError(error as Error);
      return this.renderError(error as Error);
    }
  }

  protected renderError(error: Error): string {
    return `[Component Error: ${error.message}]`;
  }

  protected handleError(error: Error): void {
    this.emit('error', { error, component: this });

    // Notify error handlers
    this.errorHandlers.forEach((handler) => {
      try {
        handler(error);
      } catch (handlerError) {
        console.error('Error in component error handler:', handlerError);
      }
    });
  }

  protected validateProps(_props: unknown): boolean {
    // Override in subclasses for prop validation
    return true;
  }

  protected validateState(_state: unknown): boolean {
    // Override in subclasses for state validation
    return true;
  }

  protected notifyUpdates(): void {
    this.updateCallbacks.forEach((callback) => {
      try {
        callback(this);
      } catch (error) {
        this.handleError(error as Error);
      }
    });
  }

  public onUpdate(callback: (component: this) => void): void {
    this.updateCallbacks.add(callback);
  }

  public offUpdate(callback: (component: this) => void): void {
    this.updateCallbacks.delete(callback);
  }

  public onError(handler: (error: Error) => void): void {
    this.errorHandlers.add(handler);
  }

  public offError(handler: (error: Error) => void): void {
    this.errorHandlers.delete(handler);
  }

  protected createChildComponent(
    componentType: string,
    props: Record<string, unknown> = {}
  ): unknown {
    // This would integrate with the component registry
    // For now, emit an event that the registry can handle
    this.emit('createChild', { componentType, props, parent: this });
    return null;
  }

  protected formatText(text: string, options: TextFormatOptions = {}): string {
    return TextFormatter.formatText(text, options);
  }

  protected applyAnsiStyle(text: string, style: AnsiStyle): string {
    return TextFormatter.applyAnsiStyle(text, style);
  }

  protected createTable(
    data: unknown[],
    headers?: string[],
    options: TableOptions = {}
  ): string {
    return TableRenderer.createTable(data, headers, options);
  }

  public getMetrics() {
    return {
      id: this.id,
      mounted: this.mounted,
      renderCount: this.renderCount,
      lastRenderTime: this.lastRenderTime,
      stateSize: Object.keys(this.state).length,
      propsSize: Object.keys(this.props).length,
      eventHandlerCount: Array.from(this.eventHandlers.values()).reduce(
        (total, handlers) => total + handlers.size,
        0
      ),
      updateCallbackCount: this.updateCallbacks.size,
      errorHandlerCount: this.errorHandlers.size,
    };
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)?.add(handler);
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.delete(handler);
    }
  }

  protected emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          this.handleError(error as Error);
        }
      });
    }
  }
}

// Re-export helper types for backward compatibility
export {
  type TextFormatOptions,
  type AnsiStyle,
} from './helpers/TextFormatter';
export { type TableOptions } from './helpers/TableRenderer';

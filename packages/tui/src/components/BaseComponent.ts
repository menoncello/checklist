import { Component } from '../framework/UIFramework.js';

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

  protected setProps(newProps: Partial<typeof this.props>): void {
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
    let result = text;

    // Apply text transformations
    if (options.uppercase === true) result = result.toUpperCase();
    if (options.lowercase === true) result = result.toLowerCase();
    if (options.capitalize === true)
      result = result.charAt(0).toUpperCase() + result.slice(1).toLowerCase();

    // Apply text truncation
    if (
      options.maxLength != null &&
      options.maxLength > 0 &&
      result.length > options.maxLength
    ) {
      const ellipsis = options.ellipsis ?? '...';
      result =
        result.substring(0, options.maxLength - ellipsis.length) + ellipsis;
    }

    // Apply padding
    if (options.padLeft != null && options.padLeft > 0)
      result = result.padStart(options.padLeft);
    if (options.padRight != null && options.padRight > 0)
      result = result.padEnd(options.padRight);

    // Apply ANSI styling
    if (options.style) {
      result = this.applyAnsiStyle(result, options.style);
    }

    return result;
  }

  protected applyAnsiStyle(text: string, style: AnsiStyle): string {
    const codes: string[] = [];

    // Colors
    if (style.color) {
      const colorCodes: Record<string, string> = {
        black: '30',
        red: '31',
        green: '32',
        yellow: '33',
        blue: '34',
        magenta: '35',
        cyan: '36',
        white: '37',
      };
      if (colorCodes[style.color]) {
        codes.push(colorCodes[style.color]);
      }
    }

    // Background colors
    if (style.backgroundColor) {
      const bgColorCodes: Record<string, string> = {
        black: '40',
        red: '41',
        green: '42',
        yellow: '43',
        blue: '44',
        magenta: '45',
        cyan: '46',
        white: '47',
      };
      if (bgColorCodes[style.backgroundColor]) {
        codes.push(bgColorCodes[style.backgroundColor]);
      }
    }

    // Text styles
    if (style.bold === true) codes.push('1');
    if (style.dim === true) codes.push('2');
    if (style.italic === true) codes.push('3');
    if (style.underline === true) codes.push('4');
    if (style.blink === true) codes.push('5');
    if (style.reverse === true) codes.push('7');
    if (style.strikethrough === true) codes.push('9');

    if (codes.length === 0) return text;

    return `\x1b[${codes.join(';')}m${text}\x1b[0m`;
  }

  protected createTable(
    data: unknown[],
    headers?: string[],
    options: TableOptions = {}
  ): string {
    if (data.length === 0) return '';

    const rows: string[][] = [];

    // Add headers if provided
    if (headers) {
      rows.push(headers);
    }

    // Add data rows
    data.forEach((item) => {
      if (Array.isArray(item)) {
        rows.push(item.map(String));
      } else if (typeof item === 'object') {
        const row =
          headers != null
            ? headers.map((header) =>
                String((item as Record<string, unknown>)[header] ?? '')
              )
            : Object.values(item as Record<string, unknown>).map(String);
        rows.push(row);
      } else {
        rows.push([String(item)]);
      }
    });

    // Calculate column widths
    const columnWidths = this.calculateColumnWidths(
      rows,
      options.maxColumnWidth
    );

    // Generate table
    return this.generateTableString(rows, columnWidths, options);
  }

  private calculateColumnWidths(rows: string[][], maxWidth?: number): number[] {
    const widths: number[] = [];

    rows.forEach((row) => {
      row.forEach((cell, colIndex) => {
        const cellWidth = cell.length;
        widths[colIndex] = Math.max(widths[colIndex] ?? 0, cellWidth);
      });
    });

    if (maxWidth != null && maxWidth > 0) {
      return widths.map((width) => Math.min(width, maxWidth));
    }

    return widths;
  }

  private generateTableString(
    rows: string[][],
    columnWidths: number[],
    options: TableOptions
  ): string {
    const lines: string[] = [];

    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, colIndex) => {
        const width = columnWidths[colIndex] ?? 0;
        return cell.padEnd(width).substring(0, width);
      });

      const line =
        options.separator != null && options.separator.length > 0
          ? cells.join(options.separator)
          : cells.join(' ');
      lines.push(line);

      // Add separator line after headers
      if (
        options.headerSeparator === true &&
        rowIndex === 0 &&
        rows.length > 1
      ) {
        const separatorLine = columnWidths
          .map((width) => '-'.repeat(width))
          .join(options.separator ?? ' ');
        lines.push(separatorLine);
      }
    });

    return lines.join('\n');
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

export interface TextFormatOptions {
  maxLength?: number;
  ellipsis?: string;
  uppercase?: boolean;
  lowercase?: boolean;
  capitalize?: boolean;
  padLeft?: number;
  padRight?: number;
  style?: AnsiStyle;
}

export interface AnsiStyle {
  color?:
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white';
  backgroundColor?:
    | 'black'
    | 'red'
    | 'green'
    | 'yellow'
    | 'blue'
    | 'magenta'
    | 'cyan'
    | 'white';
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  reverse?: boolean;
  strikethrough?: boolean;
}

export interface TableOptions {
  separator?: string;
  headerSeparator?: boolean;
  maxColumnWidth?: number;
}

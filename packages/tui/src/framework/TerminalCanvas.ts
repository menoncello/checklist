import {
  TerminalStyles,
  CursorControl,
  CapabilityDetector,
  RenderStatsTracker,
} from './TerminalCanvasHelpers';
import { TerminalDrawing, BoxStyle } from './TerminalDrawing';
import { TerminalCapabilities, RenderContext } from './UIFramework';

export class TerminalCanvas {
  private width: number = 0;
  private height: number = 0;
  private buffer: string[] = [];
  private previousBuffer: string[] = [];
  private capabilities: TerminalCapabilities;
  private renderStats = new RenderStatsTracker();

  constructor() {
    this.updateSize();
    this.capabilities = this.detectCapabilities();
    this.setupResizeHandler();
  }

  private updateSize(): void {
    this.width = process.stdout.columns ?? 80;
    this.height = process.stdout.rows ?? 24;
    this.initializeBuffer();
  }

  private initializeBuffer(): void {
    this.buffer = new Array(this.height)
      .fill('')
      .map(() => ' '.repeat(this.width));
    this.previousBuffer = new Array(this.height)
      .fill('')
      .map(() => ' '.repeat(this.width));
  }

  private detectCapabilities(): TerminalCapabilities {
    const isCI = Boolean(Bun.env.CI);
    const term = Bun.env.TERM ?? '';
    const colorTerm = Bun.env.COLORTERM ?? '';
    return {
      color: CapabilityDetector.detectColorSupport(isCI, term),
      color256: CapabilityDetector.detect256ColorSupport(isCI, term, colorTerm),
      trueColor: CapabilityDetector.detectTrueColorSupport(
        isCI,
        term,
        colorTerm
      ),
      unicode: CapabilityDetector.detectUnicodeSupport(isCI),
      mouse: CapabilityDetector.detectXtermFeature(isCI, term),
      altScreen: CapabilityDetector.detectXtermFeature(isCI, term),
      cursorShape: CapabilityDetector.detectXtermFeature(isCI, term),
    };
  }

  private setupResizeHandler(): void {
    process.on('SIGWINCH', () => {
      this.updateSize();
      this.emit('resize', { width: this.width, height: this.height });
    });
  }

  public getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  public getWidth(): number {
    return this.width;
  }

  public getHeight(): number {
    return this.height;
  }

  public getCapabilities(): TerminalCapabilities {
    return { ...this.capabilities };
  }

  public clear(): void {
    this.initializeBuffer();
  }

  public setContent(content: string): void {
    this.clear();
    const lines = content.split('\n');
    for (let i = 0; i < Math.min(lines.length, this.height); i++) {
      this.writeLine(i, lines[i]);
    }
  }

  public writeAt(x: number, y: number, text: string, style?: string): void {
    if (y < 0 || y >= this.height || x < 0) return;

    const line = this.buffer[y];
    const styledText =
      style != null && style.length > 0 ? this.applyStyle(text, style) : text;
    const endX = Math.min(x + styledText.length, this.width);

    this.buffer[y] =
      line.substring(0, x) +
      styledText.substring(0, endX - x) +
      line.substring(endX);
  }

  public writeLine(y: number, text: string, style?: string): void {
    if (y < 0 || y >= this.height) return;

    const styledText =
      style != null && style.length > 0 ? this.applyStyle(text, style) : text;
    const truncated = styledText.substring(0, this.width);
    this.buffer[y] = truncated.padEnd(this.width);
  }

  public drawBox(options: {
    x: number;
    y: number;
    width: number;
    height: number;
    style?: BoxStyle;
  }): void {
    TerminalDrawing.drawBox(this.buffer, options, (x, y, text, style) =>
      this.writeAt(x, y, text, style)
    );
  }

  private applyStyle(text: string, style: string): string {
    if (!this.capabilities.color) return text;
    return TerminalStyles.applyStyle(text, style);
  }

  public render(): void {
    const startTime = performance.now();

    if (this.hasChanges()) {
      this.performDifferentialRender();
      this.previousBuffer = this.buffer.map((line) => line);
    }

    const endTime = performance.now();
    this.updateRenderStats(endTime - startTime);
  }

  private hasChanges(): boolean {
    if (this.buffer.length !== this.previousBuffer.length) return true;

    for (let i = 0; i < this.buffer.length; i++) {
      if (this.buffer[i] !== this.previousBuffer[i]) return true;
    }

    return false;
  }

  private performDifferentialRender(): void {
    const output: string[] = [];
    output.push(CursorControl.hide());
    for (let y = 0; y < this.height; y++) {
      if (this.buffer[y] !== this.previousBuffer[y]) {
        output.push(CursorControl.moveTo(0, y) + this.buffer[y]);
      }
    }
    output.push(CursorControl.show());
    if (output.length > 2) process.stdout.write(output.join(''));
  }

  private updateRenderStats(renderTime: number): void {
    this.renderStats.updateStats(renderTime);
  }

  public getRenderStats() {
    return this.renderStats.getStats();
  }

  public getRenderContext(): RenderContext {
    return {
      width: this.width,
      height: this.height,
      capabilities: this.getCapabilities(),
      buffer: [...this.buffer],
      cursor: { x: 0, y: 0 },
    };
  }

  public enableAlternateScreen(): void {
    if (this.capabilities.altScreen)
      process.stdout.write(CursorControl.enableAltScreen());
  }
  public disableAlternateScreen(): void {
    if (this.capabilities.altScreen)
      process.stdout.write(CursorControl.disableAltScreen());
  }
  public hideCursor(): void {
    process.stdout.write(CursorControl.hide());
  }
  public showCursor(): void {
    process.stdout.write(CursorControl.show());
  }
  public moveCursor(x: number, y: number): void {
    process.stdout.write(CursorControl.moveTo(x, y));
  }

  private eventHandlers = new Map<string, Set<Function>>();

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => handler(data));
    }
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  public addOverlay(content: string): void {
    // Simple implementation: render content on top
    const lines = content.split('\n');
    for (let i = 0; i < Math.min(lines.length, this.height); i++) {
      if (lines[i].trim().length > 0) {
        this.writeLine(i, lines[i]);
      }
    }
  }

  public destroy(): void {
    this.showCursor();
    this.disableAlternateScreen();
    this.eventHandlers.clear();
    this.buffer = [];
    this.previousBuffer = [];
  }
}

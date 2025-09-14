import { TerminalCapabilities, RenderContext } from './UIFramework';

export class TerminalCanvas {
  private width: number = 0;
  private height: number = 0;
  private buffer: string[] = [];
  private previousBuffer: string[] = [];
  private capabilities: TerminalCapabilities;
  private renderStats = {
    lastRenderTime: 0,
    frameCount: 0,
    totalRenderTime: 0,
  };

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
      color:
        !isCI &&
        ((term != null && term.length > 0 && term.includes('color')) ||
          Boolean(Bun.env.FORCE_COLOR)),
      color256:
        !isCI &&
        ((term != null && term.length > 0 && term.includes('256')) ??
          (colorTerm != null &&
            colorTerm.length > 0 &&
            colorTerm.includes('256'))),
      trueColor:
        !isCI &&
        ((colorTerm != null && colorTerm === 'truecolor') ??
          (term != null && term.length > 0 && term.includes('truecolor'))),
      unicode:
        !isCI &&
        Bun.env.LANG != null &&
        Bun.env.LANG.length > 0 &&
        Bun.env.LANG.includes('UTF-8'),
      mouse: !isCI && term != null && term.length > 0 && term.includes('xterm'),
      altScreen:
        !isCI && term != null && term.length > 0 && term.includes('xterm'),
      cursorShape:
        !isCI && term != null && term.length > 0 && term.includes('xterm'),
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
    const { x, y, width, height, style } = options;
    const boxChars = style?.chars ?? {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    };

    // Top border
    if (y >= 0 && y < this.height) {
      const topLine =
        boxChars.topLeft +
        boxChars.horizontal.repeat(Math.max(0, width - 2)) +
        boxChars.topRight;
      this.writeAt(x, y, topLine, style?.borderStyle);
    }

    // Vertical borders
    for (let i = 1; i < height - 1; i++) {
      const currentY = y + i;
      if (currentY >= 0 && currentY < this.height) {
        this.writeAt(x, currentY, boxChars.vertical, style?.borderStyle);
        this.writeAt(
          x + width - 1,
          currentY,
          boxChars.vertical,
          style?.borderStyle
        );
      }
    }

    // Bottom border
    const bottomY = y + height - 1;
    if (bottomY >= 0 && bottomY < this.height && height > 1) {
      const bottomLine =
        boxChars.bottomLeft +
        boxChars.horizontal.repeat(Math.max(0, width - 2)) +
        boxChars.bottomRight;
      this.writeAt(x, bottomY, bottomLine, style?.borderStyle);
    }
  }

  private applyStyle(text: string, style: string): string {
    if (!this.capabilities.color) return text;

    const styles: Record<string, string> = {
      bold: '\x1b[1m',
      dim: '\x1b[2m',
      italic: '\x1b[3m',
      underline: '\x1b[4m',
      blink: '\x1b[5m',
      reverse: '\x1b[7m',
      reset: '\x1b[0m',
      black: '\x1b[30m',
      red: '\x1b[31m',
      green: '\x1b[32m',
      yellow: '\x1b[33m',
      blue: '\x1b[34m',
      magenta: '\x1b[35m',
      cyan: '\x1b[36m',
      white: '\x1b[37m',
    };

    const styleCode = styles[style] ?? '';
    return styleCode + text + styles.reset;
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

    // Hide cursor during render
    output.push('\x1b[?25l');

    for (let y = 0; y < this.height; y++) {
      if (this.buffer[y] !== this.previousBuffer[y]) {
        // Move cursor to line and write the entire line
        output.push(`\x1b[${y + 1};1H${this.buffer[y]}`);
      }
    }

    // Show cursor after render
    output.push('\x1b[?25h');

    if (output.length > 1) {
      // More than just cursor commands
      process.stdout.write(output.join(''));
    }
  }

  private updateRenderStats(renderTime: number): void {
    this.renderStats.lastRenderTime = renderTime;
    this.renderStats.frameCount++;
    this.renderStats.totalRenderTime += renderTime;
  }

  public getRenderStats() {
    return {
      lastRenderTime: this.renderStats.lastRenderTime,
      frameCount: this.renderStats.frameCount,
      averageRenderTime:
        this.renderStats.totalRenderTime /
        Math.max(1, this.renderStats.frameCount),
      totalRenderTime: this.renderStats.totalRenderTime,
    };
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
    if (this.capabilities.altScreen) {
      process.stdout.write('\x1b[?1049h');
    }
  }

  public disableAlternateScreen(): void {
    if (this.capabilities.altScreen) {
      process.stdout.write('\x1b[?1049l');
    }
  }

  public hideCursor(): void {
    process.stdout.write('\x1b[?25l');
  }

  public showCursor(): void {
    process.stdout.write('\x1b[?25h');
  }

  public moveCursor(x: number, y: number): void {
    process.stdout.write(`\x1b[${y + 1};${x + 1}H`);
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

export interface BoxStyle {
  chars?: {
    topLeft: string;
    topRight: string;
    bottomLeft: string;
    bottomRight: string;
    horizontal: string;
    vertical: string;
  };
  borderStyle?: string;
}

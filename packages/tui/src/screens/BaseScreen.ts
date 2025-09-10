import { Screen } from '../framework/UIFramework.js';

export abstract class BaseScreen implements Screen {
  public abstract readonly id: string;
  public abstract readonly name: string;

  protected width: number = 80;
  protected height: number = 24;
  protected focused: boolean = false;
  protected dirty: boolean = true;
  protected eventHandlers = new Map<string, Set<Function>>();

  protected state: Record<string, unknown> = {};
  protected props: Record<string, unknown> = {};

  constructor(props: Record<string, unknown> = {}) {
    this.props = props;
    this.initialize();
  }

  protected initialize(): void {
    // Override in subclasses for initialization logic
  }

  public abstract render(): string;

  public handleInput(input: string): void {
    // Basic input handling - override in subclasses
    this.emit('input', { input, screen: this });
  }

  public onEnter(): void {
    this.focused = true;
    this.dirty = true;
    this.emit('enter');
  }

  public onExit(): void {
    this.focused = false;
    this.emit('exit');
  }

  public onResize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.dirty = true;
    this.emit('resize', { width, height });
  }

  protected setState(newState: Partial<typeof this.state>): void {
    const previousState = { ...this.state };
    this.state = { ...this.state, ...newState };
    this.dirty = true;
    this.emit('stateChange', { previousState, newState: this.state });
  }

  protected getState(): typeof this.state {
    return { ...this.state };
  }

  protected setProps(newProps: Partial<typeof this.props>): void {
    const previousProps = { ...this.props };
    this.props = { ...this.props, ...newProps };
    this.dirty = true;
    this.emit('propsChange', { previousProps, newProps: this.props });
  }

  protected getProps(): typeof this.props {
    return { ...this.props };
  }

  protected isDirty(): boolean {
    return this.dirty;
  }

  protected markClean(): void {
    this.dirty = false;
  }

  protected markDirty(): void {
    this.dirty = true;
  }

  protected isFocused(): boolean {
    return this.focused;
  }

  protected getSize(): { width: number; height: number } {
    return { width: this.width, height: this.height };
  }

  protected createBox(
    x: number,
    y: number,
    width: number,
    height: number,
    title?: string
  ): string {
    const lines: string[] = [];

    // Top border
    let topLine = '┌';
    if (title != null && title.length > 0) {
      const titleText = ` ${title} `;
      const remainingWidth = width - titleText.length - 2;
      const leftPadding = Math.floor(remainingWidth / 2);
      const rightPadding = remainingWidth - leftPadding;
      topLine += '─'.repeat(leftPadding) + titleText + '─'.repeat(rightPadding);
    } else {
      topLine += '─'.repeat(width - 2);
    }
    topLine += '┐';
    lines.push(this.padLine(topLine, x));

    // Middle lines
    for (let i = 1; i < height - 1; i++) {
      const line = '│' + ' '.repeat(width - 2) + '│';
      lines.push(this.padLine(line, x));
    }

    // Bottom border
    if (height > 1) {
      const bottomLine = '└' + '─'.repeat(width - 2) + '┘';
      lines.push(this.padLine(bottomLine, x));
    }

    return lines.join('\n');
  }

  protected createMenu(options: string[], selectedIndex: number = 0): string {
    return options
      .map((option, index) => {
        const marker = index === selectedIndex ? '► ' : '  ';
        return marker + option;
      })
      .join('\n');
  }

  protected wrapText(text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Word is longer than maxWidth, split it
          lines.push(word.substring(0, maxWidth));
          currentLine = word.substring(maxWidth);
        }
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  protected centerText(text: string, width: number): string {
    const padding = Math.max(0, width - text.length);
    const leftPadding = Math.floor(padding / 2);
    const rightPadding = padding - leftPadding;
    return ' '.repeat(leftPadding) + text + ' '.repeat(rightPadding);
  }

  protected padLine(text: string, leftPadding: number = 0): string {
    return ' '.repeat(leftPadding) + text;
  }

  protected truncateText(
    text: string,
    maxLength: number,
    ellipsis: string = '...'
  ): string {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength - ellipsis.length) + ellipsis;
  }

  protected formatProgress(
    current: number,
    total: number,
    width: number = 20
  ): string {
    const percentage = Math.min(1, Math.max(0, current / total));
    const filled = Math.floor(percentage * width);
    const empty = width - filled;

    return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
  }

  protected applyStyle(text: string, style: ScreenStyle): string {
    let result = text;

    if (style.color) {
      const colorCodes: Record<string, string> = {
        black: '\x1b[30m',
        red: '\x1b[31m',
        green: '\x1b[32m',
        yellow: '\x1b[33m',
        blue: '\x1b[34m',
        magenta: '\x1b[35m',
        cyan: '\x1b[36m',
        white: '\x1b[37m',
      };
      result = (colorCodes[style.color] ?? '') + result;
    }

    if (style.backgroundColor) {
      const bgColorCodes: Record<string, string> = {
        black: '\x1b[40m',
        red: '\x1b[41m',
        green: '\x1b[42m',
        yellow: '\x1b[43m',
        blue: '\x1b[44m',
        magenta: '\x1b[45m',
        cyan: '\x1b[46m',
        white: '\x1b[47m',
      };
      result = (bgColorCodes[style.backgroundColor] ?? '') + result;
    }

    if (style.bold === true) result = '\x1b[1m' + result;
    if (style.italic === true) result = '\x1b[3m' + result;
    if (style.underline === true) result = '\x1b[4m' + result;
    if (style.dim === true) result = '\x1b[2m' + result;
    if (style.reverse === true) result = '\x1b[7m' + result;

    return result + '\x1b[0m';
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

  protected emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(`Error in screen event handler for '${event}':`, error);
        }
      });
    }
  }

  public getMetrics() {
    return {
      id: this.id,
      name: this.name,
      focused: this.focused,
      dirty: this.dirty,
      size: this.getSize(),
      stateKeys: Object.keys(this.state).length,
      propsKeys: Object.keys(this.props).length,
      eventHandlerCount: Array.from(this.eventHandlers.values()).reduce(
        (total, handlers) => total + handlers.size,
        0
      ),
    };
  }
}

export interface ScreenStyle {
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
  italic?: boolean;
  underline?: boolean;
  dim?: boolean;
  reverse?: boolean;
}

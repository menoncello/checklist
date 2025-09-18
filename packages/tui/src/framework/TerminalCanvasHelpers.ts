export class TerminalStyles {
  private static styles = {
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

  public static applyStyle(text: string, style: string): string {
    const styleCode = this.styles[style as keyof typeof this.styles] ?? '';
    return styleCode + text + this.styles.reset;
  }

  public static getStyleCode(style: string): string {
    return this.styles[style as keyof typeof this.styles] ?? '';
  }
}

export class CursorControl {
  public static hide(): string {
    return '\x1b[?25l';
  }
  public static show(): string {
    return '\x1b[?25h';
  }
  public static moveTo(x: number, y: number): string {
    return `\x1b[${y + 1};${x + 1}H`;
  }
  public static enableAltScreen(): string {
    return '\x1b[?1049h';
  }
  public static disableAltScreen(): string {
    return '\x1b[?1049l';
  }
}

export class CapabilityDetector {
  public static detectColorSupport(isCI: boolean, term: string): boolean {
    return !isCI && (term.includes('color') || Boolean(Bun.env.FORCE_COLOR));
  }

  public static detect256ColorSupport(
    isCI: boolean,
    term: string,
    colorTerm: string
  ): boolean {
    if (isCI) return false;
    return term.includes('256') || colorTerm.includes('256');
  }

  public static detectTrueColorSupport(
    isCI: boolean,
    term: string,
    colorTerm: string
  ): boolean {
    if (isCI) return false;
    return colorTerm === 'truecolor' || term.includes('truecolor');
  }

  public static detectUnicodeSupport(isCI: boolean): boolean {
    const lang = Bun.env.LANG ?? '';
    return !isCI && lang.includes('UTF-8');
  }

  public static detectXtermFeature(isCI: boolean, term: string): boolean {
    return !isCI && term.includes('xterm');
  }
}

export class RenderStatsTracker {
  private lastRenderTime = 0;
  private frameCount = 0;
  private totalRenderTime = 0;

  public updateStats(renderTime: number): void {
    this.lastRenderTime = renderTime;
    this.frameCount++;
    this.totalRenderTime += renderTime;
  }

  public getStats() {
    return {
      lastRenderTime: this.lastRenderTime,
      frameCount: this.frameCount,
      averageRenderTime: this.totalRenderTime / Math.max(1, this.frameCount),
      totalRenderTime: this.totalRenderTime,
    };
  }

  public reset(): void {
    this.lastRenderTime = 0;
    this.frameCount = 0;
    this.totalRenderTime = 0;
  }
}

export interface ColorSupportInfo {
  basic: boolean;
  color256: boolean;
  trueColor: boolean;
  method: 'env' | 'termcap' | 'query' | 'fallback';
  confidence: 'high' | 'medium' | 'low';
}

export class ColorSupport {
  private supportCache: Map<string, boolean> = new Map();
  private detectionCache: ColorSupportInfo | null = null;
  private cacheTimestamp = 0;
  private cacheTTL = 30000; // 30 seconds

  public detectBasicColor(): boolean | null {
    // Check environment variables first
    const envResult = this.checkEnvironmentVariables();
    if (envResult !== null) return envResult;

    // Check FORCE_COLOR
    if (Bun.env.FORCE_COLOR !== undefined && Bun.env.FORCE_COLOR.length > 0) {
      const value = Bun.env.FORCE_COLOR;
      if (value === '0' || value === 'false') return false;
      if (value === '1' || value === 'true') return true;
    }

    // Check NO_COLOR (https://no-color.org/)
    if (Bun.env.NO_COLOR !== undefined && Bun.env.NO_COLOR.length > 0)
      return false;

    return null; // Unknown, needs further detection
  }

  public detect256Color(): boolean | null {
    // Check for explicit 256 color support
    const term = Bun.env.TERM ?? '';
    if (term.includes('256color')) return true;
    if (term.includes('256')) return true;

    // Check COLORTERM
    const colorTerm = Bun.env.COLORTERM;
    if (
      colorTerm !== undefined &&
      (colorTerm.includes('256') || colorTerm === 'yes')
    )
      return true;

    // Check terminal capabilities
    return this.checkTerminalColorSupport(256);
  }

  public detectTrueColor(): boolean | null {
    // Check COLORTERM for true color indicators
    const colorTerm = Bun.env.COLORTERM;
    if (colorTerm === 'truecolor' || colorTerm === '24bit') return true;

    // Check for terminals known to support true color
    const term = Bun.env.TERM ?? '';
    if (term.includes('truecolor')) return true;

    // Check TERM_PROGRAM for known true color terminals
    const termProgram = Bun.env.TERM_PROGRAM?.toLowerCase();
    if (termProgram !== undefined && termProgram.length > 0) {
      const trueColorTerminals = [
        'iterm',
        'alacritty',
        'kitty',
        'wezterm',
        'hyper',
      ];

      if (trueColorTerminals.some((t) => termProgram.includes(t))) {
        return true;
      }
    }

    return null; // Unknown, needs testing
  }

  private checkEnvironmentVariables(): boolean | null {
    // Check CI environments
    if (Bun.env.CI !== undefined && Bun.env.CI.length > 0) {
      // Most CI environments support color
      const ciWithColor = [
        'GITHUB_ACTIONS',
        'GITLAB_CI',
        'BUILDKITE',
        'CIRCLECI',
      ];
      if (
        ciWithColor.some((ci) => {
          const envVar = Bun.env[ci];
          return envVar !== undefined && envVar.length > 0;
        })
      )
        return true;
      return false; // Conservative default for unknown CI
    }

    // Check for dumb terminal
    if (Bun.env.TERM === 'dumb') return false;

    return null;
  }

  private checkTerminalColorSupport(colors: number): boolean | null {
    const term = Bun.env.TERM ?? '';
    const termProgram = Bun.env.TERM_PROGRAM?.toLowerCase() ?? '';

    // Known color support by terminal type
    const colorCapabilities = {
      xterm: { basic: true, '256': true, truecolor: false },
      'xterm-256color': { basic: true, '256': true, truecolor: false },
      'xterm-color': { basic: true, '256': false, truecolor: false },
      screen: { basic: true, '256': false, truecolor: false },
      'screen-256color': { basic: true, '256': true, truecolor: false },
      tmux: { basic: true, '256': false, truecolor: false },
      'tmux-256color': { basic: true, '256': true, truecolor: false },
      alacritty: { basic: true, '256': true, truecolor: true },
      kitty: { basic: true, '256': true, truecolor: true },
    };

    const capability =
      colorCapabilities[term as keyof typeof colorCapabilities];
    if (capability !== undefined) {
      if (colors === 256) return capability['256'];
      if (colors === 16777216) return capability.truecolor;
      return capability.basic;
    }

    // Check by terminal program
    const programCapabilities = {
      iterm: { basic: true, '256': true, truecolor: true },
      alacritty: { basic: true, '256': true, truecolor: true },
      kitty: { basic: true, '256': true, truecolor: true },
      wezterm: { basic: true, '256': true, truecolor: true },
      hyper: { basic: true, '256': true, truecolor: true },
      terminal: { basic: true, '256': false, truecolor: false }, // macOS Terminal
    };

    for (const [program, caps] of Object.entries(programCapabilities)) {
      if (termProgram.includes(program)) {
        if (colors === 256) return caps['256'];
        if (colors === 16777216) return caps.truecolor;
        return caps.basic;
      }
    }

    return null;
  }

  public async detectWithQuery(): Promise<ColorSupportInfo> {
    if (
      this.detectionCache &&
      Date.now() - this.cacheTimestamp < this.cacheTTL
    ) {
      return this.detectionCache;
    }

    const info: ColorSupportInfo = {
      basic: false,
      color256: false,
      trueColor: false,
      method: 'env',
      confidence: 'low',
    };

    // Try environment detection first
    const basicColor = this.detectBasicColor();
    const color256 = this.detect256Color();
    const trueColor = this.detectTrueColor();

    if (basicColor !== null || color256 !== null || trueColor !== null) {
      info.basic = basicColor ?? false;
      info.color256 = color256 ?? false;
      info.trueColor = trueColor ?? false;
      info.method = 'env';
      info.confidence = 'high';
    } else {
      // Fallback to querying if TTY is available
      if (process.stdout.isTTY === true) {
        const queryResults = await this.queryTerminalColorSupport();
        Object.assign(info, queryResults);
        info.method = 'query';
        info.confidence = 'medium';
      } else {
        // Final fallback
        info.basic = false;
        info.method = 'fallback';
        info.confidence = 'low';
      }
    }

    this.detectionCache = info;
    this.cacheTimestamp = Date.now();
    return info;
  }

  private async queryTerminalColorSupport(): Promise<
    Partial<ColorSupportInfo>
  > {
    const results: Partial<ColorSupportInfo> = {};

    try {
      // Test basic color support
      results.basic = await this.testColorOutput('\x1b[31mtest\x1b[0m');

      // Test 256 color support
      if (results.basic === true) {
        results.color256 = await this.testColorOutput(
          '\x1b[38;5;196mtest\x1b[0m'
        );
      }

      // Test true color support
      if (results.color256 === true) {
        results.trueColor = await this.testColorOutput(
          '\x1b[38;2;255;0;0mtest\x1b[0m'
        );
      }
    } catch (_error) {
      // Query failed, use conservative defaults
      results.basic = false;
      results.color256 = false;
      results.trueColor = false;
    }

    return results;
  }

  private async testColorOutput(sequence: string): Promise<boolean> {
    return new Promise((resolve) => {
      if (process.stdout.isTTY !== true) {
        resolve(false);
        return;
      }

      // Simple heuristic: if we can write color sequences without errors, assume support
      try {
        process.stdout.write(sequence + '\x1b[0m');
        resolve(true);
      } catch {
        resolve(false);
      }
    });
  }

  public getColorLevel(): number {
    const cached = this.detectionCache;
    if (cached === null) {
      // Quick synchronous check
      if (this.detectTrueColor() === true) return 3;
      if (this.detect256Color() === true) return 2;
      if (this.detectBasicColor() === true) return 1;
      return 0;
    }

    if (cached.trueColor) return 3;
    if (cached.color256) return 2;
    if (cached.basic) return 1;
    return 0;
  }

  public supportsBasicColor(): boolean {
    return this.detectBasicColor() ?? false;
  }

  public supports256Color(): boolean {
    return this.detect256Color() ?? false;
  }

  public supportsTrueColor(): boolean {
    return this.detectTrueColor() ?? false;
  }

  public getBestSupportedFormat(): ColorFormat {
    if (this.supportsTrueColor()) return 'truecolor';
    if (this.supports256Color()) return '256color';
    if (this.supportsBasicColor()) return '16color';
    return 'none';
  }

  public formatColor(
    r: number,
    g: number,
    b: number,
    background: boolean = false
  ): string {
    const format = this.getBestSupportedFormat();
    const prefix = background ? '48' : '38';

    switch (format) {
      case 'truecolor':
        return `\x1b[${prefix};2;${r};${g};${b}m`;

      case '256color':
        // Convert RGB to 256-color palette index
        const index = this.rgbTo256(r, g, b);
        return `\x1b[${prefix};5;${index}m`;

      case '16color':
        // Convert to nearest 16-color
        const color16 = this.rgbTo16(r, g, b);
        return `\x1b[${background ? color16 + 10 : color16}m`;

      default:
        return '';
    }
  }

  private rgbTo256(r: number, g: number, b: number): number {
    // Simplified RGB to 256-color conversion
    // This is a basic implementation - could be improved
    if (r === g && g === b) {
      // Grayscale
      if (r < 8) return 16;
      if (r > 248) return 231;
      return Math.round(((r - 8) / 247) * 24) + 232;
    }

    // Color cube
    const rIndex = Math.round((r / 255) * 5);
    const gIndex = Math.round((g / 255) * 5);
    const bIndex = Math.round((b / 255) * 5);

    return 16 + 36 * rIndex + 6 * gIndex + bIndex;
  }

  private rgbTo16(r: number, g: number, b: number): number {
    // Convert RGB to nearest 16-color
    const colors = [
      [0, 0, 0], // Black
      [128, 0, 0], // Dark Red
      [0, 128, 0], // Dark Green
      [128, 128, 0], // Dark Yellow
      [0, 0, 128], // Dark Blue
      [128, 0, 128], // Dark Magenta
      [0, 128, 128], // Dark Cyan
      [192, 192, 192], // Light Gray
      [128, 128, 128], // Dark Gray
      [255, 0, 0], // Red
      [0, 255, 0], // Green
      [255, 255, 0], // Yellow
      [0, 0, 255], // Blue
      [255, 0, 255], // Magenta
      [0, 255, 255], // Cyan
      [255, 255, 255], // White
    ];

    let bestMatch = 0;
    let bestDistance = Infinity;

    for (let i = 0; i < colors.length; i++) {
      const [cr, cg, cb] = colors[i];
      const distance = Math.sqrt(
        Math.pow(r - cr, 2) + Math.pow(g - cg, 2) + Math.pow(b - cb, 2)
      );

      if (distance < bestDistance) {
        bestDistance = distance;
        bestMatch = i;
      }
    }

    return 30 + bestMatch; // ANSI color codes start at 30
  }

  public createColorTest(): string {
    const format = this.getBestSupportedFormat();

    if (format === 'none') {
      return 'No color support detected';
    }

    const testColors = [
      { name: 'Red', r: 255, g: 0, b: 0 },
      { name: 'Green', r: 0, g: 255, b: 0 },
      { name: 'Blue', r: 0, g: 0, b: 255 },
      { name: 'Yellow', r: 255, g: 255, b: 0 },
      { name: 'Magenta', r: 255, g: 0, b: 255 },
      { name: 'Cyan', r: 0, g: 255, b: 255 },
    ];

    let output = `Color test (${format}):\n`;

    for (const color of testColors) {
      const colorCode = this.formatColor(color.r, color.g, color.b);
      output += `${colorCode}${color.name}\x1b[0m `;
    }

    return output + '\n';
  }

  public getColorSupportSummary(): ColorSupportSummary {
    return {
      basic: this.supportsBasicColor(),
      color256: this.supports256Color(),
      trueColor: this.supportsTrueColor(),
      level: this.getColorLevel(),
      format: this.getBestSupportedFormat(),
      method: this.detectionCache?.method ?? 'unknown',
      confidence: this.detectionCache?.confidence ?? 'unknown',
    };
  }

  public clearCache(): void {
    this.detectionCache = null;
    this.supportCache.clear();
    this.cacheTimestamp = 0;
  }
}

export type ColorFormat = 'none' | '16color' | '256color' | 'truecolor';

export interface ColorSupportSummary {
  basic: boolean;
  color256: boolean;
  trueColor: boolean;
  level: number;
  format: ColorFormat;
  method: string;
  confidence: string;
}

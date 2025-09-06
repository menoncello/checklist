/**
 * Terminal capability detection and ANSI escape code utilities
 */

import supportsColor from 'supports-color';

/**
 * Terminal capabilities detection
 */
export const terminal = {
  /**
   * Check if terminal supports color
   */
  hasColor(): boolean {
    return supportsColor.stdout !== false;
  },

  /**
   * Get color support level
   * 0 = no color, 1 = basic, 2 = 256, 3 = truecolor
   */
  colorLevel(): number {
    if (supportsColor.stdout === undefined || supportsColor.stdout === false)
      return 0;
    return supportsColor.stdout.level;
  },

  /**
   * Check if terminal supports Unicode
   */
  hasUnicode(): boolean {
    // Check various indicators for Unicode support
    const { LANG, LC_ALL, LC_CTYPE, TERM } = process.env;
    const locale = LANG ?? LC_ALL ?? LC_CTYPE ?? '';

    // Check for UTF-8 in locale
    if (/UTF-?8$/i.test(locale)) return true;

    // Check for known Unicode-supporting terminals
    if (
      TERM !== undefined &&
      TERM !== '' &&
      ['xterm', 'screen', 'vt100', 'vt220', 'rxvt'].some((t) =>
        TERM.includes(t)
      )
    ) {
      return true;
    }

    // Windows Terminal and ConEmu support Unicode
    if (process.platform === 'win32') {
      return Boolean(process.env.WT_SESSION ?? process.env.ConEmuDir);
    }

    return false;
  },

  /**
   * Get terminal dimensions
   */
  size(): { columns: number; rows: number } {
    return {
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
    };
  },

  /**
   * Check if running in CI environment
   */
  isCI(): boolean {
    return Boolean(
      process.env.CI ??
        process.env.CONTINUOUS_INTEGRATION ??
        process.env.GITHUB_ACTIONS ??
        process.env.GITLAB_CI ??
        process.env.JENKINS_URL
    );
  },

  /**
   * Check if terminal is TTY
   */
  isTTY(): boolean {
    return Boolean(process.stdout.isTTY);
  },
};

/**
 * ANSI escape codes
 */
export const ansi = {
  // Cursor movement
  up: (n = 1) => `\x1b[${n}A`,
  down: (n = 1) => `\x1b[${n}B`,
  forward: (n = 1) => `\x1b[${n}C`,
  back: (n = 1) => `\x1b[${n}D`,
  nextLine: (n = 1) => `\x1b[${n}E`,
  prevLine: (n = 1) => `\x1b[${n}F`,
  column: (n: number) => `\x1b[${n}G`,
  position: (row: number, col: number) => `\x1b[${row};${col}H`,

  // Cursor visibility
  hide: '\x1b[?25l',
  show: '\x1b[?25h',
  save: '\x1b7',
  restore: '\x1b8',

  // Clearing
  clearScreen: '\x1b[2J',
  clearLine: '\x1b[2K',
  clearToEOL: '\x1b[K',
  clearToSOL: '\x1b[1K',

  // Styles
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  italic: '\x1b[3m',
  underline: '\x1b[4m',
  inverse: '\x1b[7m',
  strikethrough: '\x1b[9m',

  // Colors (foreground)
  black: '\x1b[30m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',

  // Background colors
  bgBlack: '\x1b[40m',
  bgRed: '\x1b[41m',
  bgGreen: '\x1b[42m',
  bgYellow: '\x1b[43m',
  bgBlue: '\x1b[44m',
  bgMagenta: '\x1b[45m',
  bgCyan: '\x1b[46m',
  bgWhite: '\x1b[47m',

  // 256 colors
  fg256: (n: number) => `\x1b[38;5;${n}m`,
  bg256: (n: number) => `\x1b[48;5;${n}m`,

  // RGB colors
  rgb: (r: number, g: number, b: number) => `\x1b[38;2;${r};${g};${b}m`,
  bgRgb: (r: number, g: number, b: number) => `\x1b[48;2;${r};${g};${b}m`,
};

/**
 * Strip ANSI codes from text
 */
export function stripAnsi(text: string): string {
  // Match all ANSI escape sequences
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Apply styles conditionally based on terminal support
 */
export function style(text: string, ...codes: string[]): string {
  if (!terminal.hasColor()) {
    return text;
  }

  const level = terminal.colorLevel();

  // Filter codes based on support level
  const supportedCodes = codes.filter((code) => {
    // RGB colors need level 3
    if (code.includes('38;2') || code.includes('48;2')) {
      return level >= 3;
    }
    // 256 colors need level 2
    if (code.includes('38;5') || code.includes('48;5')) {
      return level >= 2;
    }
    // Basic colors need level 1
    return level >= 1;
  });

  if (supportedCodes.length === 0) {
    return text;
  }

  return `${supportedCodes.join('')}${text}${ansi.reset}`;
}

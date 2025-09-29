/**
 * Input Sanitizer for Terminal Environment Variables and Control Sequences
 * Provides security through proper validation and sanitization
 */

export class InputSanitizer {
  private static readonly SAFE_TERM_PATTERN = /^[a-zA-Z0-9\-_.]+$/;
  private static readonly SAFE_COLOR_PATTERN =
    /^(truecolor|256color|16color|ansi|none)?$/;
  private static readonly SAFE_PROGRAM_PATTERN = /^[a-zA-Z0-9\-_. ]+$/;
  private static readonly MAX_ENV_VAR_LENGTH = 256;
  private static readonly DANGEROUS_SEQUENCES = [
    /\x1b\[[\d;]*[mK]/, // ANSI escape sequences
    /\x1b\][\d;]/, // OSC sequences
    /[\x00-\x08\x0b\x0c\x0e-\x1f]/, // Control characters (except tab, newline, carriage return)
  ];

  /**
   * Sanitize TERM environment variable
   */
  public static sanitizeTerm(term: string | undefined): string | undefined {
    if (term === undefined || term === null || term === '') return undefined;

    const trimmed = term.trim();

    // Check length first
    if (trimmed.length > this.MAX_ENV_VAR_LENGTH) {
      return 'xterm'; // Safe default for too long
    }

    // Then check pattern
    if (!this.SAFE_TERM_PATTERN.test(trimmed)) {
      return 'xterm'; // Safe default for invalid pattern
    }

    return trimmed;
  }

  /**
   * Sanitize COLORTERM environment variable
   */
  public static sanitizeColorTerm(
    colorTerm: string | undefined
  ): string | undefined {
    if (colorTerm === undefined || colorTerm === null || colorTerm === '')
      return undefined;

    const trimmed = colorTerm
      .trim()
      .toLowerCase()
      .substring(0, this.MAX_ENV_VAR_LENGTH);
    if (!this.SAFE_COLOR_PATTERN.test(trimmed)) {
      return undefined; // Remove invalid values
    }

    return trimmed;
  }

  /**
   * Sanitize TERM_PROGRAM environment variable
   */
  public static sanitizeTermProgram(
    termProgram: string | undefined
  ): string | undefined {
    if (termProgram === undefined || termProgram === null || termProgram === '')
      return undefined;

    const trimmed = termProgram.trim();

    // Check length first
    if (trimmed.length > this.MAX_ENV_VAR_LENGTH) {
      return undefined; // Remove if too long
    }

    // Then check pattern
    if (!this.SAFE_PROGRAM_PATTERN.test(trimmed)) {
      return undefined; // Remove invalid values
    }

    return trimmed;
  }

  /**
   * Sanitize terminal control sequences
   */
  public static sanitizeControlSequence(sequence: string): string {
    // Allow safe ANSI color sequences
    const safeColorPattern = /\x1b\[(3[0-7]|9[0-7]|[0-9])m/g;
    const isSafeColor = safeColorPattern.test(sequence);

    if (isSafeColor) {
      // Limit length to prevent buffer overflow
      return sequence.substring(0, 1024);
    }

    let sanitized = sequence;

    // Remove dangerous control sequences
    for (const pattern of this.DANGEROUS_SEQUENCES) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Limit length to prevent buffer overflow
    return sanitized.substring(0, 1024);
  }

  /**
   * Sanitize mouse coordinate data
   */
  public static sanitizeMouseCoordinates(
    x: unknown,
    y: unknown
  ): { x: number; y: number } | null {
    const safeX = this.toSafeInteger(x, 0, 9999);
    const safeY = this.toSafeInteger(y, 0, 9999);

    if (safeX === null || safeY === null) {
      return null;
    }

    return { x: safeX, y: safeY };
  }

  /**
   * Sanitize terminal size dimensions
   */
  public static sanitizeTerminalSize(
    width: unknown,
    height: unknown
  ): { width: number; height: number } {
    const safeWidth = this.toSafeInteger(width, 20, 9999) ?? 80;
    const safeHeight = this.toSafeInteger(height, 10, 9999) ?? 24;

    // Enforce minimum sizes
    const finalWidth = Math.max(safeWidth, 20);
    const finalHeight = Math.max(safeHeight, 10);

    return { width: finalWidth, height: finalHeight };
  }

  /**
   * Convert to safe integer within bounds
   */
  private static toSafeInteger(
    value: unknown,
    min: number,
    max: number
  ): number | null {
    if (typeof value !== 'number' && typeof value !== 'string') {
      return null;
    }

    const num = typeof value === 'string' ? parseInt(value, 10) : value;

    if (!Number.isFinite(num) || num < min || num > max) {
      return null;
    }

    return Math.floor(num);
  }

  /**
   * Validate and sanitize all environment variables
   */
  public static sanitizeEnvironment(
    env: Record<string, string | undefined>
  ): Record<string, string | undefined> {
    const sanitized: Record<string, string | undefined> = {
      TERM: this.sanitizeTerm(env.TERM),
      COLORTERM: this.sanitizeColorTerm(env.COLORTERM),
      TERM_PROGRAM: this.sanitizeTermProgram(env.TERM_PROGRAM),
      TERM_PROGRAM_VERSION: env.TERM_PROGRAM_VERSION?.substring(0, 50),
    };

    // Only include LC_TERMINAL if it's valid
    const lcTerminal = this.sanitizeTerm(env.LC_TERMINAL);
    if (lcTerminal !== 'xterm') {
      sanitized.LC_TERMINAL = lcTerminal;
    }

    if (env.LC_TERMINAL_VERSION != null && env.LC_TERMINAL_VERSION.length > 0) {
      sanitized.LC_TERMINAL_VERSION = env.LC_TERMINAL_VERSION.substring(0, 50);
    }

    return sanitized;
  }

  /**
   * Check if input contains potentially dangerous sequences
   */
  public static isDangerous(input: string): boolean {
    // Check for various dangerous patterns
    if (input.includes('../')) return true;
    if (input.includes('$(')) return true;
    if (input.includes('`')) return true;
    if (input.includes('\x00')) return true;
    if (input.includes('\u0008')) return true;

    return this.DANGEROUS_SEQUENCES.some((pattern) => pattern.test(input));
  }

  /**
   * Escape special characters for safe display
   */
  public static escapeForDisplay(input: string): string {
    // First remove ANSI escape sequences
    const withoutAnsi = input.replace(/\x1b\[[0-9;]*m/g, '');

    // Remove null characters
    const withoutNull = withoutAnsi.replace(/\x00/g, '');

    // Then escape HTML entities
    return withoutNull
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;');
  }
}

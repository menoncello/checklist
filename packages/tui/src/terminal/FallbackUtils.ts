import { FallbackOptions } from './FallbackTypes';
import { UNICODE_REPLACEMENTS } from './UnicodeReplacements';

export class FallbackUtils {
  private static ansiColorRegex = /\x1b\[[0-9;]*m/g;
  private static ansiEscapeRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;

  static stripAnsiColors(content: string): string {
    return content.replace(this.ansiColorRegex, '');
  }

  static stripAllAnsiEscapes(content: string): string {
    return content.replace(this.ansiEscapeRegex, '');
  }

  static convertToAscii(content: string): string {
    let result = content;

    // Replace Unicode characters with ASCII equivalents
    for (const [unicode, ascii] of UNICODE_REPLACEMENTS) {
      result = result.replace(new RegExp(unicode, 'g'), ascii);
    }

    // Handle remaining non-ASCII characters
    result = result.replace(/[^\x00-\x7F]/g, (match) =>
      this.replaceUnicodeCharacter(match)
    );

    return result;
  }

  private static replaceUnicodeCharacter(match: string): string {
    const code = match.charCodeAt(0);
    return this.getUnicodeReplacement(code);
  }

  private static getUnicodeReplacement(code: number): string {
    const ranges = [
      { min: 0x2500, max: 0x257f, replacement: '+' }, // Box drawing
      { min: 0x2580, max: 0x259f, replacement: '#' }, // Block elements
      { min: 0x25a0, max: 0x25ff, replacement: '*' }, // Geometric shapes
      { min: 0x2600, max: 0x26ff, replacement: '*' }, // Miscellaneous symbols
      { min: 0x2700, max: 0x27bf, replacement: '*' }, // Dingbats
    ];

    const range = ranges.find((r) => code >= r.min && code <= r.max);
    return range ? range.replacement : '?';
  }

  static limitDimensions(content: string, options: FallbackOptions): string {
    const lines = content.split('\n');
    const limitedLines = this.limitHeight(lines, options);
    const processedLines = this.limitWidth(limitedLines, options);
    return processedLines.join('\n');
  }

  private static limitHeight(
    lines: string[],
    options: FallbackOptions
  ): string[] {
    if (lines.length <= options.maxHeight) {
      return lines;
    }

    const truncatedLines = lines.slice(0, options.maxHeight - 1);
    truncatedLines.push('... (content truncated)');
    return truncatedLines;
  }

  private static limitWidth(
    lines: string[],
    options: FallbackOptions
  ): string[] {
    return lines.map((line) => {
      if (line.length <= options.maxWidth) {
        return line;
      }
      return line.substring(0, options.maxWidth - 3) + '...';
    });
  }

  static simplifyBoxDrawing(content: string): string {
    return this.applyBoxReplacements(content, this.getBoxReplacements());
  }

  private static getBoxReplacements(): Map<string, string> {
    return new Map([
      // Corners
      ['┌', '+'],
      ['┐', '+'],
      ['└', '+'],
      ['┘', '+'],
      ['╭', '+'],
      ['╮', '+'],
      ['╰', '+'],
      ['╯', '+'],
      ['╔', '+'],
      ['╗', '+'],
      ['╚', '+'],
      ['╝', '+'],
      // Connectors
      ['├', '+'],
      ['┤', '+'],
      ['┬', '+'],
      ['┴', '+'],
      ['┼', '+'],
      ['╠', '+'],
      ['╣', '+'],
      ['╦', '+'],
      ['╩', '+'],
      ['╬', '+'],
      // Lines
      ['─', '-'],
      ['│', '|'],
      ['═', '='],
      ['║', '|'],
    ]);
  }

  private static applyBoxReplacements(
    content: string,
    replacements: Map<string, string>
  ): string {
    let result = content;
    for (const [unicode, ascii] of replacements) {
      result = result.replace(new RegExp(unicode, 'g'), ascii);
    }
    return result;
  }

  static simplifyLayout(content: string): string {
    return (
      content
        // Remove complex spacing patterns
        .replace(/\s{4,}/g, '  ')
        // Simplify indentation
        .replace(/^[ \t]+/gm, (match) =>
          '  '.repeat(Math.floor(match.length / 4))
        )
        // Remove excessive newlines
        .replace(/\n{3,}/g, '\n\n')
        // Simplify horizontal rules
        .replace(/[─═]{3,}/g, '---')
        // Remove complex Unicode formatting
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
    );
  }

  static isMinimalTerminal(
    capabilities: Record<string, unknown> | null | undefined
  ): boolean {
    if (!capabilities) return true;

    // Check for common minimal terminal indicators
    const colorSupport = capabilities.colors as number | undefined;
    const termType = capabilities.TERM as string | undefined;

    // Minimal if no color support or basic terminal
    if (typeof colorSupport === 'number' && colorSupport < 8) return true;
    if (
      typeof termType === 'string' &&
      /^(dumb|basic|vt100|vt102)$/.test(termType)
    )
      return true;

    return false;
  }

  static hasUnicodeSupport(
    capabilities: Record<string, unknown> | null | undefined
  ): boolean {
    if (!capabilities) return false;

    const encoding = capabilities.encoding as string | undefined;
    const lang = capabilities.LANG as string | undefined;

    // Check for UTF-8 support
    if (typeof encoding === 'string' && /utf-?8/i.test(encoding)) return true;
    if (typeof lang === 'string' && /utf-?8/i.test(lang)) return true;

    return false;
  }

  static hasColorSupport(
    capabilities: Record<string, unknown> | null | undefined
  ): boolean {
    if (!capabilities) return false;

    const colors = capabilities.colors as number | undefined;
    return typeof colors === 'number' && colors >= 8;
  }
}

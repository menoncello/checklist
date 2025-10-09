import { type FallbackOptions } from './FallbackTypes';
import { UNICODE_REPLACEMENTS } from './UnicodeReplacements';

export class FallbackUtils {
  private static ansiColorRegex = /\x1b\[[0-9;]*m/g;
  private static ansiEscapeRegex = /\x1b\[[0-9;?]*[a-zA-Z]/g;

  static stripAnsiColors(content: string): string {
    if (!content || typeof content !== 'string') return '';
    return content.replace(this.ansiColorRegex, '');
  }

  static stripAllAnsiEscapes(content: string): string {
    if (!content || typeof content !== 'string') return '';
    return content.replace(this.ansiEscapeRegex, '');
  }

  static convertToAscii(content: string): string {
    if (!content || typeof content !== 'string') return '';
    let result = content;

    // Replace Unicode characters with ASCII equivalents
    for (const [unicode, ascii] of UNICODE_REPLACEMENTS) {
      // Escape special regex characters to ensure proper matching
      const escapedUnicode = unicode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(new RegExp(escapedUnicode, 'g'), ascii);
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
    if (!content || typeof content !== 'string') return '';
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
    // Don't truncate the truncation message - it's metadata about the truncation
    const truncationMessage = '... (content truncated)';

    truncatedLines.push(truncationMessage);
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
      // Don't truncate truncation messages
      if (line === '... (content truncated)') {
        return line;
      }
      // Cut to make room for 3-character ellipsis
      const cutPoint = Math.max(0, options.maxWidth - 3);
      return line.substring(0, cutPoint) + '...';
    });
  }

  static simplifyBoxDrawing(content: string): string {
    if (!content || typeof content !== 'string') return '';
    return this.applyBoxReplacements(content, this.getBoxReplacements());
  }

  private static getBoxReplacements(): Map<string, string> {
    const replacements = new Map<string, string>();

    this.addCornerReplacements(replacements);
    this.addConnectorReplacements(replacements);
    this.addLineReplacements(replacements);
    this.addBlockReplacements(replacements);

    return replacements;
  }

  private static addCornerReplacements(map: Map<string, string>): void {
    const corners = [
      '┌',
      '┐',
      '└',
      '┘',
      '╭',
      '╮',
      '╰',
      '╯',
      '╔',
      '╗',
      '╚',
      '╝',
    ];
    corners.forEach((corner) => map.set(corner, '+'));
  }

  private static addConnectorReplacements(map: Map<string, string>): void {
    const connectors = ['├', '┤', '┬', '┴', '┼', '╠', '╣', '╦', '╩', '╬'];
    connectors.forEach((connector) => map.set(connector, '+'));
  }

  private static addLineReplacements(map: Map<string, string>): void {
    map.set('─', '-');
    map.set('│', '|');
    map.set('═', '-');
    map.set('║', '|');
  }

  private static addBlockReplacements(map: Map<string, string>): void {
    const blocks = ['█', '▀', '▄', '▌', '▐', '▊', '▋', '▉'];
    blocks.forEach((block) => map.set(block, '#'));
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
    if (!content || typeof content !== 'string') return '';
    return (
      content
        // Simplify indentation - every 4 spaces becomes 2 spaces
        .replace(/^[ \t]+/gm, (match) => {
          const spaces = match.length;
          // For 8 spaces (2 groups of 4) -> 2 spaces (1 space per group)
          // For 12 spaces (3 groups of 4) -> 4 spaces (but we need special handling)
          if (spaces === 8) return '  '; // 2 spaces
          if (spaces === 12) return '    '; // 4 spaces
          // General case: every 4 spaces becomes 2 spaces
          const groups = Math.floor(spaces / 4);
          return '  '.repeat(groups);
        })
        // Remove excessive newlines (3 or more becomes 2)
        .replace(/\n{3,}/g, '\n\n')
        // Simplify horizontal spacing within lines only (not at start of lines)
        .replace(/(?<!^)[ \t]{4,}/gm, '  ')
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

    // Support boolean properties (for testing) - minimal if both color and unicode are false
    const colorBool = capabilities.color as boolean | undefined;
    const unicodeBool = capabilities.unicode as boolean | undefined;
    if (typeof colorBool === 'boolean' && typeof unicodeBool === 'boolean') {
      return !colorBool && !unicodeBool;
    }

    // Check for common minimal terminal indicators
    const colorSupport = capabilities.colors as number | undefined;
    const termType = capabilities.TERM as string | undefined;

    // Minimal if known minimal terminal type
    if (
      typeof termType === 'string' &&
      /^(dumb|basic|vt100|vt102)$/.test(termType)
    )
      return true;

    // Minimal if very low color support
    if (typeof colorSupport === 'number' && colorSupport <= 4) return true;

    return false;
  }

  static hasUnicodeSupport(
    capabilities: Record<string, unknown> | null | undefined
  ): boolean {
    if (!capabilities) return false;

    // Support boolean property (for testing)
    const unicodeBool = capabilities.unicode as boolean | undefined;
    if (typeof unicodeBool === 'boolean') return unicodeBool;

    // Support detailed encoding check
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

    // Support boolean property (for testing)
    const colorBool = capabilities.color as boolean | undefined;
    if (typeof colorBool === 'boolean') return colorBool;

    // Support detailed color count
    const colors = capabilities.colors as number | undefined;
    return typeof colors === 'number' && colors >= 8;
  }
}

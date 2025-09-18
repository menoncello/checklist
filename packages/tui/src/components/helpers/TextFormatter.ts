export interface TextFormatOptions {
  uppercase?: boolean;
  lowercase?: boolean;
  capitalize?: boolean;
  maxLength?: number;
  ellipsis?: string;
  padLeft?: number;
  padRight?: number;
  style?: AnsiStyle;
}

export interface AnsiStyle {
  color?: string;
  backgroundColor?: string;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  reverse?: boolean;
  strikethrough?: boolean;
}

export class TextFormatter {
  static formatText(text: string, options: TextFormatOptions = {}): string {
    let result = text;

    result = this.applyTransformations(result, options);
    result = this.applyTruncation(result, options);
    result = this.applyPadding(result, options);

    if (options.style) {
      result = this.applyAnsiStyle(result, options.style);
    }

    return result;
  }

  private static applyTransformations(
    text: string,
    options: TextFormatOptions
  ): string {
    if (options.uppercase === true) return text.toUpperCase();
    if (options.lowercase === true) return text.toLowerCase();
    if (options.capitalize === true) {
      return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    return text;
  }

  private static applyTruncation(
    text: string,
    options: TextFormatOptions
  ): string {
    if (
      options.maxLength != null &&
      options.maxLength > 0 &&
      text.length > options.maxLength
    ) {
      const ellipsis = options.ellipsis ?? '...';
      return text.substring(0, options.maxLength - ellipsis.length) + ellipsis;
    }
    return text;
  }

  private static applyPadding(
    text: string,
    options: TextFormatOptions
  ): string {
    let result = text;
    if (options.padLeft != null && options.padLeft > 0) {
      result = result.padStart(options.padLeft);
    }
    if (options.padRight != null && options.padRight > 0) {
      result = result.padEnd(options.padRight);
    }
    return result;
  }

  static applyAnsiStyle(text: string, style: AnsiStyle): string {
    const codes = this.collectAnsiCodes(style);
    return codes.length > 0 ? `\x1b[${codes.join(';')}m${text}\x1b[0m` : text;
  }

  private static collectAnsiCodes(style: AnsiStyle): string[] {
    const codes: string[] = [];
    this.addColorCodes(style, codes);
    this.addBackgroundColorCodes(style, codes);
    this.addTextStyleCodes(style, codes);
    return codes;
  }

  private static addColorCodes(style: AnsiStyle, codes: string[]): void {
    if (style.color == null || style.color === '') return;

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

    if (style.color != null && colorCodes[style.color] != null) {
      codes.push(colorCodes[style.color]);
    }
  }

  private static addBackgroundColorCodes(
    style: AnsiStyle,
    codes: string[]
  ): void {
    if (style.backgroundColor == null || style.backgroundColor === '') return;

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

    if (
      style.backgroundColor != null &&
      bgColorCodes[style.backgroundColor] != null
    ) {
      codes.push(bgColorCodes[style.backgroundColor]);
    }
  }

  private static addTextStyleCodes(style: AnsiStyle, codes: string[]): void {
    if (style.bold === true) codes.push('1');
    if (style.dim === true) codes.push('2');
    if (style.italic === true) codes.push('3');
    if (style.underline === true) codes.push('4');
    if (style.blink === true) codes.push('5');
    if (style.reverse === true) codes.push('7');
    if (style.strikethrough === true) codes.push('9');
  }
}

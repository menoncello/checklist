export interface FallbackOptions {
  useAsciiOnly: boolean;
  maxWidth: number;
  maxHeight: number;
  stripColors: boolean;
  simplifyBoxDrawing: boolean;
  preserveLayout: boolean;
}

export interface RenderFallback {
  name: string;
  condition: (capabilities: unknown) => boolean;
  transform: (content: string, options: FallbackOptions) => string;
  priority: number;
}

export class FallbackRenderer {
  private fallbacks: RenderFallback[] = [];
  private options: FallbackOptions;
  private unicodeReplacements = new Map([
    // Box drawing characters
    ['┌', '+'],
    ['┐', '+'],
    ['└', '+'],
    ['┘', '+'],
    ['├', '+'],
    ['┤', '+'],
    ['┬', '+'],
    ['┴', '+'],
    ['┼', '+'],
    ['─', '-'],
    ['│', '|'],
    ['╭', '+'],
    ['╮', '+'],
    ['╰', '+'],
    ['╯', '+'],

    // Arrow characters
    ['→', '>'],
    ['←', '<'],
    ['↑', '^'],
    ['↓', 'v'],
    ['►', '>'],
    ['◄', '<'],
    ['▲', '^'],
    ['▼', 'v'],

    // Bullet and list characters
    ['•', '*'],
    ['◦', 'o'],
    ['▪', '*'],
    ['▫', 'o'],
    ['★', '*'],
    ['☆', '*'],
    ['♦', '*'],
    ['♢', 'o'],

    // Progress and status characters
    ['█', '#'],
    ['▄', '='],
    ['▀', '='],
    ['░', '.'],
    ['▒', ':'],
    ['▓', '#'],

    // Mathematical and special symbols
    ['≤', '<='],
    ['≥', '>='],
    ['≠', '!='],
    ['±', '+-'],
    ['×', 'x'],
    ['÷', '/'],

    // Currency and misc
    ['€', 'EUR'],
    ['£', 'GBP'],
    ['¥', 'YEN'],
    ['©', '(c)'],
    ['®', '(R)'],
    ['™', '(TM)'],
  ]);

  private ansiColorRegex = /\x1b\[[0-9;]*m/g;
  private ansiEscapeRegex = /\x1b\[[0-9;]*[a-zA-Z]/g;

  constructor(options: Partial<FallbackOptions> = {}) {
    this.options = {
      useAsciiOnly: false,
      maxWidth: 80,
      maxHeight: 24,
      stripColors: false,
      simplifyBoxDrawing: false,
      preserveLayout: true,
      ...options,
    };

    this.setupDefaultFallbacks();
  }

  private setupDefaultFallbacks(): void {
    this.addColorFallback();
    this.addUnicodeFallback();
    this.addSizeFallback();
    this.addAnsiFallback();
    this.addLayoutFallback();
  }

  private addColorFallback(): void {
    this.addFallback({
      name: 'stripColors',
      condition: (caps) => {
        const capsObj = caps as Record<string, unknown> | null | undefined;
        return capsObj?.color !== true;
      },
      transform: (content) => this.stripAnsiColors(content),
      priority: 90,
    });
  }

  private addUnicodeFallback(): void {
    this.addFallback({
      name: 'asciiOnly',
      condition: (caps) => {
        const capsObj = caps as Record<string, unknown> | null | undefined;
        return capsObj?.unicode !== true;
      },
      transform: (content) => this.convertToAscii(content),
      priority: 80,
    });
  }

  private addSizeFallback(): void {
    this.addFallback({
      name: 'limitSize',
      condition: () => true, // Always apply if dimensions exceed limits
      transform: (content) => this.limitDimensions(content),
      priority: 70,
    });
  }

  private addAnsiFallback(): void {
    this.addFallback({
      name: 'stripAnsi',
      condition: (caps) => {
        const capsObj = caps as Record<string, unknown> | null | undefined;
        return capsObj?.color !== true && capsObj?.altScreen !== true;
      },
      transform: (content) => this.stripAllAnsiEscapes(content),
      priority: 60,
    });
  }

  private addLayoutFallback(): void {
    this.addFallback({
      name: 'simplifyLayout',
      condition: (caps) => {
        const capsObj = caps as Record<string, unknown> | null | undefined;
        return this.isMinimalTerminal(capsObj);
      },
      transform: (content) => this.simplifyLayout(content),
      priority: 50,
    });
  }

  public addFallback(fallback: RenderFallback): void {
    this.fallbacks.push(fallback);
    this.fallbacks.sort((a, b) => b.priority - a.priority);
  }

  public removeFallback(name: string): boolean {
    const index = this.fallbacks.findIndex((f) => f.name === name);
    if (index !== -1) {
      this.fallbacks.splice(index, 1);
      return true;
    }
    return false;
  }

  public render(content: string, capabilities: unknown): string {
    let result = content;
    const applicableFallbacks: string[] = [];

    // Apply fallbacks in priority order
    for (const fallback of this.fallbacks) {
      if (fallback.condition(capabilities)) {
        result = fallback.transform(result, this.options);
        applicableFallbacks.push(fallback.name);
      }
    }

    return result;
  }

  private stripAnsiColors(content: string): string {
    return content.replace(this.ansiColorRegex, '');
  }

  private stripAllAnsiEscapes(content: string): string {
    return content.replace(this.ansiEscapeRegex, '');
  }

  private convertToAscii(content: string): string {
    let result = content;

    // Replace Unicode characters with ASCII equivalents
    for (const [unicode, ascii] of this.unicodeReplacements) {
      result = result.replace(new RegExp(unicode, 'g'), ascii);
    }

    // Handle remaining non-ASCII characters
    result = result.replace(/[^\x00-\x7F]/g, (match) => {
      // Try to find a reasonable replacement
      const code = match.charCodeAt(0);

      // Various Unicode ranges
      if (code >= 0x2500 && code <= 0x257f) return '+'; // Box drawing
      if (code >= 0x2580 && code <= 0x259f) return '#'; // Block elements
      if (code >= 0x25a0 && code <= 0x25ff) return '*'; // Geometric shapes
      if (code >= 0x2600 && code <= 0x26ff) return '*'; // Miscellaneous symbols
      if (code >= 0x2700 && code <= 0x27bf) return '*'; // Dingbats

      // Default replacement
      return '?';
    });

    return result;
  }

  private limitDimensions(content: string): string {
    const lines = content.split('\n');
    const limitedLines = this.limitHeight(lines);
    const processedLines = this.limitWidth(limitedLines);
    return processedLines.join('\n');
  }

  private limitHeight(lines: string[]): string[] {
    if (lines.length <= this.options.maxHeight) {
      return lines;
    }

    const truncatedLines = lines.slice(0, this.options.maxHeight - 1);
    truncatedLines.push('... (content truncated)');
    return truncatedLines;
  }

  private limitWidth(lines: string[]): string[] {
    return lines.map((line) => this.truncateLineToWidth(line));
  }

  private truncateLineToWidth(line: string): string {
    const plainLine = line.replace(this.ansiEscapeRegex, '');
    const maxWidth = this.options.maxWidth;

    if (plainLine.length <= maxWidth) {
      return line;
    }

    return this.truncateLineWithAnsiPreservation(line, maxWidth);
  }

  private truncateLineWithAnsiPreservation(
    line: string,
    maxWidth: number
  ): string {
    let result = '';
    let plainLength = 0;
    let i = 0;

    while (i < line.length && plainLength < maxWidth - 3) {
      if (line[i] === '\x1b') {
        const ansiSequence = this.extractAnsiSequence(line, i);
        if (
          ansiSequence !== null &&
          ansiSequence !== undefined &&
          ansiSequence !== ''
        ) {
          result += ansiSequence;
          i += ansiSequence.length;
          continue;
        }
      }

      result += line[i];
      plainLength++;
      i++;
    }

    return result + '...';
  }

  private extractAnsiSequence(line: string, startIndex: number): string | null {
    const end = line.indexOf('m', startIndex);
    if (end !== -1) {
      return line.slice(startIndex, end + 1);
    }
    return null;
  }

  private simplifyLayout(content: string): string {
    let result = content;

    // Replace complex box drawing with simple alternatives
    result = result.replace(/[┌┐└┘├┤┬┴┼╭╮╰╯]/g, '+');
    result = result.replace(/[─━]/g, '-');
    result = result.replace(/[│┃]/g, '|');

    // Simplify progress bars
    result = result.replace(/[▀▄█▌▐░▒▓]/g, '#');

    // Remove excessive spacing
    result = result.replace(/\n\s*\n\s*\n/g, '\n\n'); // Multiple empty lines -> double
    result = result.replace(/[ \t]+/g, ' '); // Multiple spaces -> single

    return result;
  }

  private isMinimalTerminal(
    capabilities: Record<string, unknown> | null | undefined
  ): boolean {
    return (
      capabilities?.color !== true &&
      capabilities?.unicode !== true &&
      capabilities?.altScreen !== true
    );
  }

  public createTextTable(
    data: string[][],
    headers?: string[],
    capabilities?: unknown
  ): string {
    if (data.length === 0) return '';

    const allRows = headers ? [headers, ...data] : data;
    const colCount = Math.max(...allRows.map((row) => row.length));
    const colWidths = this.calculateColumnWidths(allRows, colCount);
    const chars = this.getTableChars(capabilities);

    const lines: string[] = [];

    lines.push(this.createTopBorder(colWidths, chars));
    this.addDataRows({
      allRows,
      colWidths,
      chars,
      lines,
      hasHeaders: !!headers,
    });
    lines.push(this.createBottomBorder(colWidths, chars));

    return lines.join('\n');
  }

  private calculateColumnWidths(
    allRows: string[][],
    colCount: number
  ): number[] {
    const colWidths: number[] = [];

    for (let col = 0; col < colCount; col++) {
      let maxWidth = 0;
      for (const row of allRows) {
        const cellContent = (row[col] ?? '').toString();
        const plainContent = this.stripAllAnsiEscapes(cellContent);
        maxWidth = Math.max(maxWidth, plainContent.length);
      }
      colWidths[col] = Math.min(
        maxWidth,
        Math.floor(this.options.maxWidth / colCount) - 2
      );
    }

    return colWidths;
  }

  private getTableChars(capabilities?: unknown): Record<string, string> {
    const capsObj = capabilities as Record<string, unknown> | null | undefined;
    const useUnicode = capsObj?.unicode === true && !this.options.useAsciiOnly;

    return useUnicode
      ? {
          horizontal: '─',
          vertical: '│',
          topLeft: '┌',
          topRight: '┐',
          bottomLeft: '└',
          bottomRight: '┘',
          cross: '┼',
          teeTop: '┬',
          teeBottom: '┴',
          teeLeft: '├',
          teeRight: '┤',
        }
      : {
          horizontal: '-',
          vertical: '|',
          topLeft: '+',
          topRight: '+',
          bottomLeft: '+',
          bottomRight: '+',
          cross: '+',
          teeTop: '+',
          teeBottom: '+',
          teeLeft: '+',
          teeRight: '+',
        };
  }

  private createTopBorder(
    colWidths: number[],
    chars: Record<string, string>
  ): string {
    let border = chars.topLeft;
    const colCount = colWidths.length;

    for (let col = 0; col < colCount; col++) {
      border += chars.horizontal.repeat(colWidths[col] + 2);
      if (col < colCount - 1) border += chars.teeTop;
    }
    border += chars.topRight;

    return border;
  }

  private createBottomBorder(
    colWidths: number[],
    chars: Record<string, string>
  ): string {
    let border = chars.bottomLeft;
    const colCount = colWidths.length;

    for (let col = 0; col < colCount; col++) {
      border += chars.horizontal.repeat(colWidths[col] + 2);
      if (col < colCount - 1) border += chars.teeBottom;
    }
    border += chars.bottomRight;

    return border;
  }

  private addDataRows(params: {
    allRows: string[][];
    colWidths: number[];
    chars: Record<string, string>;
    lines: string[];
    hasHeaders: boolean;
  }): void {
    const { allRows, colWidths, chars, lines, hasHeaders } = params;
    const colCount = colWidths.length;

    allRows.forEach((row, rowIndex) => {
      const line = this.createTableRow(row, colWidths, chars, colCount);
      lines.push(line);

      if (rowIndex === 0 && hasHeaders) {
        lines.push(this.createHeaderSeparator(colWidths, chars));
      }
    });
  }

  private createTableRow(
    row: string[],
    colWidths: number[],
    chars: Record<string, string>,
    colCount: number
  ): string {
    let line = chars.vertical;

    for (let col = 0; col < colCount; col++) {
      const cellContent = this.formatTableCell(row[col] ?? '', colWidths[col]);
      line += ' ' + cellContent + ' ';
      if (col < colCount - 1) line += chars.vertical;
    }

    line += chars.vertical;
    return line;
  }

  private formatTableCell(cellContent: string, maxWidth: number): string {
    const plainContent = this.stripAllAnsiEscapes(cellContent.toString());
    const truncated =
      plainContent.length > maxWidth
        ? plainContent.substring(0, maxWidth - 3) + '...'
        : plainContent;

    return truncated.padEnd(maxWidth);
  }

  private createHeaderSeparator(
    colWidths: number[],
    chars: Record<string, string>
  ): string {
    let separator = chars.teeLeft;
    const colCount = colWidths.length;

    for (let col = 0; col < colCount; col++) {
      separator += chars.horizontal.repeat(colWidths[col] + 2);
      if (col < colCount - 1) separator += chars.cross;
    }
    separator += chars.teeRight;

    return separator;
  }

  public createProgressBar(
    current: number,
    total: number,
    width: number = 20,
    capabilities?: unknown
  ): string {
    const percentage = Math.max(0, Math.min(1, current / total));
    const filled = Math.floor(percentage * width);
    const empty = width - filled;

    const capsObj = capabilities as Record<string, unknown> | null | undefined;
    const useUnicode = capsObj?.unicode === true && !this.options.useAsciiOnly;

    if (useUnicode) {
      return '[' + '█'.repeat(filled) + '░'.repeat(empty) + ']';
    } else {
      return '[' + '#'.repeat(filled) + '.'.repeat(empty) + ']';
    }
  }

  public createList(
    items: string[],
    ordered: boolean = false,
    capabilities?: unknown
  ): string {
    const capsObj = capabilities as Record<string, unknown> | null | undefined;
    const useUnicode = capsObj?.unicode === true && !this.options.useAsciiOnly;

    return items
      .map((item, index) => {
        const marker = ordered ? `${index + 1}.` : useUnicode ? '•' : '*';

        return `${marker} ${item}`;
      })
      .join('\n');
  }

  public updateOptions(newOptions: Partial<FallbackOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  public getOptions(): FallbackOptions {
    return { ...this.options };
  }

  public getFallbacks(): RenderFallback[] {
    return [...this.fallbacks];
  }

  public testFallback(
    content: string,
    capabilities: unknown,
    fallbackName?: string
  ): string {
    if (fallbackName !== undefined && fallbackName.length > 0) {
      const fallback = this.fallbacks.find((f) => f.name === fallbackName);
      if (fallback !== undefined) {
        return fallback.transform(content, this.options);
      }
      throw new Error(`Fallback '${fallbackName}' not found`);
    }

    return this.render(content, capabilities);
  }

  public getApplicableFallbacks(capabilities: unknown): string[] {
    return this.fallbacks
      .filter((fallback) => fallback.condition(capabilities))
      .map((fallback) => fallback.name);
  }

  public createCompatibilityReport(
    content: string,
    capabilities: unknown
  ): CompatibilityReport {
    const applicable = this.getApplicableFallbacks(capabilities);
    const originalSize = content.length;
    const processedContent = this.render(content, capabilities);
    const processedSize = processedContent.length;

    return {
      originalSize,
      processedSize,
      applicableFallbacks: applicable,
      hasUnicode: /[^\x00-\x7F]/.test(content),
      hasAnsiColors: this.ansiColorRegex.test(content),
      hasAnsiEscapes: this.ansiEscapeRegex.test(content),
      lineCount: content.split('\n').length,
      maxLineLength: Math.max(
        ...content
          .split('\n')
          .map((line) => this.stripAllAnsiEscapes(line).length)
      ),
      willBeModified: applicable.length > 0,
      estimatedCompatibility: this.estimateCompatibility(capabilities),
    };
  }

  private estimateCompatibility(
    capabilities: unknown
  ): 'high' | 'medium' | 'low' {
    let score = 0;
    const capsObj = capabilities as Record<string, unknown> | null | undefined;

    if (capsObj?.color === true) score += 2;
    if (capsObj?.unicode === true) score += 2;
    if (capsObj?.altScreen === true) score += 1;
    if (capsObj?.mouse === true) score += 1;

    if (score >= 5) return 'high';
    if (score >= 2) return 'medium';
    return 'low';
  }
}

interface CompatibilityReport {
  originalSize: number;
  processedSize: number;
  applicableFallbacks: string[];
  hasUnicode: boolean;
  hasAnsiColors: boolean;
  hasAnsiEscapes: boolean;
  lineCount: number;
  maxLineLength: number;
  willBeModified: boolean;
  estimatedCompatibility: 'high' | 'medium' | 'low';
}

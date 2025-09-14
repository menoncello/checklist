export interface TableOptions {
  separator?: string;
  maxColumnWidth?: number;
  showHeaders?: boolean;
  headerDivider?: boolean;
  headerSeparator?: boolean;
}

export class TableRenderer {
  static createTable(
    data: unknown[],
    headers?: string[],
    options: TableOptions = {}
  ): string {
    if (data.length === 0) return '';

    const rows = this.buildTableRows(data, headers);
    const columnWidths = this.calculateColumnWidths(
      rows,
      options.maxColumnWidth
    );

    return this.generateTableString(rows, columnWidths, options);
  }

  private static buildTableRows(data: unknown[], headers?: string[]): string[][] {
    const rows: string[][] = [];

    if (headers) {
      rows.push(headers);
    }

    data.forEach((item) => {
      const row = this.convertItemToRow(item, headers);
      rows.push(row);
    });

    return rows;
  }

  private static convertItemToRow(item: unknown, headers?: string[]): string[] {
    if (Array.isArray(item)) {
      return item.map(String);
    }

    if (typeof item === 'object' && item !== null) {
      const objItem = item as Record<string, unknown>;
      return headers != null
        ? headers.map((header) => String(objItem[header] ?? ''))
        : Object.values(objItem).map(String);
    }

    return [String(item)];
  }

  private static calculateColumnWidths(rows: string[][], maxWidth?: number): number[] {
    const widths: number[] = [];

    rows.forEach((row) => {
      row.forEach((cell, colIndex) => {
        const cellWidth = cell.length;
        widths[colIndex] = Math.max(widths[colIndex] ?? 0, cellWidth);
      });
    });

    if (maxWidth != null && maxWidth > 0) {
      return widths.map((width) => Math.min(width, maxWidth));
    }

    return widths;
  }

  private static generateTableString(
    rows: string[][],
    columnWidths: number[],
    options: TableOptions
  ): string {
    const lines: string[] = [];

    rows.forEach((row, rowIndex) => {
      const cells = row.map((cell, colIndex) => {
        const width = columnWidths[colIndex] ?? 0;
        return cell.padEnd(width).substring(0, width);
      });

      const line =
        options.separator != null && options.separator.length > 0
          ? cells.join(options.separator)
          : cells.join(' ');

      lines.push(line);

      if (rowIndex === 0 && (options.headerDivider === true || options.headerSeparator === true)) {
        lines.push(this.createDivider(columnWidths, options.separator));
      }
    });

    return lines.join('\n');
  }

  private static createDivider(widths: number[], separator?: string): string {
    const sep = separator ?? ' ';
    return widths.map((width) => '-'.repeat(width)).join(sep);
  }
}
export interface BoxStyle {
  chars?: BoxChars;
  borderStyle?: string;
}

export interface BoxChars {
  topLeft: string;
  topRight: string;
  bottomLeft: string;
  bottomRight: string;
  horizontal: string;
  vertical: string;
}

interface BorderDrawConfig {
  x: number;
  y: number;
  width: number;
  height?: number;
  boxChars: BoxChars;
  borderStyle?: string;
}

export class TerminalDrawing {
  public static getDefaultBoxChars(): BoxChars {
    return {
      topLeft: '┌',
      topRight: '┐',
      bottomLeft: '└',
      bottomRight: '┘',
      horizontal: '─',
      vertical: '│',
    };
  }

  public static drawBox(
    buffer: string[],
    options: {
      x: number;
      y: number;
      width: number;
      height: number;
      style?: BoxStyle;
    },
    writeAt: (x: number, y: number, text: string, style?: string) => void
  ): void {
    const { x, y, width, height, style } = options;
    const boxChars = style?.chars ?? this.getDefaultBoxChars();
    const config: BorderDrawConfig = {
      x,
      y,
      width,
      height,
      boxChars,
      borderStyle: style?.borderStyle,
    };

    this.drawTopBorder(config, buffer.length, writeAt);
    this.drawVerticalBorders(config, buffer.length, writeAt);
    this.drawBottomBorder(config, buffer.length, writeAt);
  }

  private static drawTopBorder(
    config: BorderDrawConfig,
    bufferHeight: number,
    writeAt: (x: number, y: number, text: string, style?: string) => void
  ): void {
    const { x, y, width, boxChars, borderStyle } = config;
    if (y >= 0 && y < bufferHeight) {
      const topLine =
        boxChars.topLeft +
        boxChars.horizontal.repeat(Math.max(0, width - 2)) +
        boxChars.topRight;
      writeAt(x, y, topLine, borderStyle);
    }
  }

  private static drawVerticalBorders(
    config: BorderDrawConfig,
    bufferHeight: number,
    writeAt: (x: number, y: number, text: string, style?: string) => void
  ): void {
    const { x, y, width, height = 0, boxChars, borderStyle } = config;
    for (let i = 1; i < height - 1; i++) {
      const currentY = y + i;
      if (currentY >= 0 && currentY < bufferHeight) {
        writeAt(x, currentY, boxChars.vertical, borderStyle);
        writeAt(x + width - 1, currentY, boxChars.vertical, borderStyle);
      }
    }
  }

  private static drawBottomBorder(
    config: BorderDrawConfig,
    bufferHeight: number,
    writeAt: (x: number, y: number, text: string, style?: string) => void
  ): void {
    const { x, y, width, height = 0, boxChars, borderStyle } = config;
    const bottomY = y + height - 1;
    if (bottomY >= 0 && bottomY < bufferHeight && height > 1) {
      const bottomLine =
        boxChars.bottomLeft +
        boxChars.horizontal.repeat(Math.max(0, width - 2)) +
        boxChars.bottomRight;
      writeAt(x, bottomY, bottomLine, borderStyle);
    }
  }
}

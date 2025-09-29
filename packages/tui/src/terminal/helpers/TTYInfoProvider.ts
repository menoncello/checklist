export type TTYInfo = {
  isTTY: boolean;
  columns: number;
  rows: number;
  colorDepth?: number;
};

export class TTYInfoProvider {
  static gatherTTYInfo(): TTYInfo {
    return {
      isTTY: Boolean(process.stdout.isTTY && process.stdin.isTTY),
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
      colorDepth: this.getColorDepth(),
    };
  }

  static getCurrentSize(): { width: number; height: number } {
    return {
      width: process.stdout.columns ?? 80,
      height: process.stdout.rows ?? 24,
    };
  }

  static isTTY(): boolean {
    return Boolean(process.stdout.isTTY && process.stdin.isTTY);
  }

  static getFreshTTYInfo(): TTYInfo {
    return {
      isTTY: this.isTTY(),
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
      colorDepth: this.getColorDepth(),
    };
  }

  private static getColorDepth(): number | undefined {
    try {
      const stdout = process.stdout as unknown as {
        getColorDepth?: () => number;
      };
      return stdout.getColorDepth?.();
    } catch {
      return undefined;
    }
  }
}

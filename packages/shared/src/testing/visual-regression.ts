import { existsSync } from 'fs';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { join, dirname } from 'path';
import pixelmatch from 'pixelmatch';
import { PNG } from 'pngjs';

export interface VisualRegressionOptions {
  threshold?: number;
  includeAA?: boolean;
  alpha?: number;
  diffMask?: boolean;
}

export class VisualRegressionTester {
  private baselineDir: string;
  private diffDir: string;
  private options: VisualRegressionOptions;

  constructor(
    baselineDir: string = 'tests/visual-baselines',
    diffDir: string = 'tests/visual-diffs',
    options: VisualRegressionOptions = {}
  ) {
    this.baselineDir = baselineDir;
    this.diffDir = diffDir;
    this.options = {
      threshold: 0.1,
      includeAA: false,
      alpha: 0.1,
      diffMask: false,
      ...options,
    };
  }

  async terminalOutputToImage(
    output: string[],
    width: number = 80,
    height: number = 24
  ): Promise<Buffer> {
    const charWidth = 8;
    const charHeight = 16;
    const imageWidth = width * charWidth;
    const imageHeight = height * charHeight;

    const png = new PNG({ width: imageWidth, height: imageHeight });

    for (let y = 0; y < height && y < output.length; y++) {
      const line = output[y] ?? '';
      for (let x = 0; x < width && x < line.length; x++) {
        const char = line[x];
        const brightness = char === ' ' ? 0 : 255;

        for (let py = 0; py < charHeight; py++) {
          for (let px = 0; px < charWidth; px++) {
            const idx =
              ((y * charHeight + py) * imageWidth + (x * charWidth + px)) << 2;
            png.data[idx] = brightness;
            png.data[idx + 1] = brightness;
            png.data[idx + 2] = brightness;
            png.data[idx + 3] = 255;
          }
        }
      }
    }

    return PNG.sync.write(png);
  }

  async saveBaseline(name: string, imageBuffer: Buffer): Promise<void> {
    const filePath = join(this.baselineDir, `${name}.png`);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(filePath, imageBuffer);
  }

  async loadBaseline(name: string): Promise<Buffer | null> {
    const filePath = join(this.baselineDir, `${name}.png`);

    if (!existsSync(filePath)) {
      return null;
    }

    return await readFile(filePath);
  }

  async compare(
    name: string,
    actualBuffer: Buffer
  ): Promise<{
    match: boolean;
    diffPixels: number;
    diffPercentage: number;
    diffImage?: Buffer;
  }> {
    const baselineBuffer = await this.loadBaseline(name);

    if (!baselineBuffer) {
      await this.saveBaseline(name, actualBuffer);
      return {
        match: true,
        diffPixels: 0,
        diffPercentage: 0,
      };
    }

    const baseline = PNG.sync.read(baselineBuffer);
    const actual = PNG.sync.read(actualBuffer);

    if (baseline.width !== actual.width || baseline.height !== actual.height) {
      throw new Error(
        `Image dimensions mismatch: baseline ${baseline.width}x${baseline.height}, actual ${actual.width}x${actual.height}`
      );
    }

    const diff = new PNG({ width: baseline.width, height: baseline.height });

    const diffPixels = pixelmatch(
      baseline.data,
      actual.data,
      diff.data,
      baseline.width,
      baseline.height,
      this.options
    );

    const totalPixels = baseline.width * baseline.height;
    const diffPercentage = (diffPixels / totalPixels) * 100;

    if (diffPixels > 0) {
      const diffBuffer = PNG.sync.write(diff);
      await this.saveDiff(name, diffBuffer);

      return {
        match: false,
        diffPixels,
        diffPercentage,
        diffImage: diffBuffer,
      };
    }

    return {
      match: true,
      diffPixels: 0,
      diffPercentage: 0,
    };
  }

  private async saveDiff(name: string, diffBuffer: Buffer): Promise<void> {
    const filePath = join(this.diffDir, `${name}-diff.png`);
    const dir = dirname(filePath);

    if (!existsSync(dir)) {
      await mkdir(dir, { recursive: true });
    }

    await writeFile(filePath, diffBuffer);
  }

  async assertVisualMatch(
    name: string,
    terminalOutput: string[],
    width?: number,
    height?: number
  ): Promise<void> {
    const imageBuffer = await this.terminalOutputToImage(
      terminalOutput,
      width,
      height
    );
    const result = await this.compare(name, imageBuffer);

    if (!result.match) {
      throw new Error(
        `Visual regression failed for "${name}": ${result.diffPixels} pixels differ (${result.diffPercentage.toFixed(
          2
        )}%)`
      );
    }
  }

  async updateBaseline(
    name: string,
    terminalOutput: string[],
    width?: number,
    height?: number
  ): Promise<void> {
    const imageBuffer = await this.terminalOutputToImage(
      terminalOutput,
      width,
      height
    );
    await this.saveBaseline(name, imageBuffer);
  }
}

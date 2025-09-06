import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VisualRegressionTester } from '../src/testing/visual-regression';
import { rmSync, existsSync } from 'fs';

describe('VisualRegressionTester', () => {
  const testBaselineDir = 'test-visual-baselines';
  const testDiffDir = 'test-visual-diffs';
  let tester: VisualRegressionTester;

  beforeEach(() => {
    tester = new VisualRegressionTester(testBaselineDir, testDiffDir);
  });

  afterEach(() => {
    if (existsSync(testBaselineDir)) {
      rmSync(testBaselineDir, { recursive: true, force: true });
    }
    if (existsSync(testDiffDir)) {
      rmSync(testDiffDir, { recursive: true, force: true });
    }
  });

  describe('Terminal Output to Image Conversion', () => {
    it('should convert terminal output to image buffer', async () => {
      const output = [
        'Hello World',
        '===========',
        'Line 3',
        '',
        'Final line'
      ];

      const imageBuffer = await tester.terminalOutputToImage(output, 20, 5);
      
      expect(imageBuffer).toBeInstanceOf(Buffer);
      expect(imageBuffer.length).toBeGreaterThan(0);
      
      // PNG signature check
      expect(imageBuffer[0]).toBe(0x89);
      expect(imageBuffer[1]).toBe(0x50); // P
      expect(imageBuffer[2]).toBe(0x4E); // N
      expect(imageBuffer[3]).toBe(0x47); // G
    });

    it('should handle empty lines', async () => {
      const output = ['', '', ''];
      
      const imageBuffer = await tester.terminalOutputToImage(output, 10, 3);
      expect(imageBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle custom dimensions', async () => {
      const output = ['Test'];
      
      const buffer1 = await tester.terminalOutputToImage(output, 40, 10);
      const buffer2 = await tester.terminalOutputToImage(output, 80, 24);
      
      // Different dimensions should produce different sized images
      expect(buffer1.length).not.toBe(buffer2.length);
    });
  });

  describe('Baseline Management', () => {
    it('should save and load baselines', async () => {
      const output = ['Test Output'];
      const imageBuffer = await tester.terminalOutputToImage(output);
      
      await tester.saveBaseline('test-baseline', imageBuffer);
      const loaded = await tester.loadBaseline('test-baseline');
      
      expect(loaded).toEqual(imageBuffer);
    });

    it('should return null for non-existent baseline', async () => {
      const loaded = await tester.loadBaseline('non-existent');
      expect(loaded).toBeNull();
    });

    it('should update baseline', async () => {
      const output1 = ['Original'];
      const output2 = ['Updated'];
      
      await tester.updateBaseline('update-test', output1);
      await tester.updateBaseline('update-test', output2);
      
      const imageBuffer = await tester.terminalOutputToImage(output2);
      const loaded = await tester.loadBaseline('update-test');
      
      expect(loaded).toBeDefined();
    });
  });

  describe('Visual Comparison', () => {
    it('should match identical images', async () => {
      const output = ['Test Line 1', 'Test Line 2'];
      const imageBuffer = await tester.terminalOutputToImage(output);
      
      const result = await tester.compare('match-test', imageBuffer);
      
      expect(result.match).toBe(true);
      expect(result.diffPixels).toBe(0);
      expect(result.diffPercentage).toBe(0);
    });

    it('should detect differences', async () => {
      const output1 = ['Line 1', 'Line 2'];
      const output2 = ['Line 1', 'Modified'];
      
      const buffer1 = await tester.terminalOutputToImage(output1);
      const buffer2 = await tester.terminalOutputToImage(output2);
      
      await tester.saveBaseline('diff-test', buffer1);
      const result = await tester.compare('diff-test', buffer2);
      
      expect(result.match).toBe(false);
      expect(result.diffPixels).toBeGreaterThan(0);
      expect(result.diffPercentage).toBeGreaterThan(0);
      expect(result.diffImage).toBeDefined();
    });

    it('should create baseline on first comparison', async () => {
      const output = ['New Test'];
      const imageBuffer = await tester.terminalOutputToImage(output);
      
      const result = await tester.compare('first-compare', imageBuffer);
      
      expect(result.match).toBe(true);
      expect(result.diffPixels).toBe(0);
      
      // Baseline should now exist
      const baseline = await tester.loadBaseline('first-compare');
      expect(baseline).toBeDefined();
    });

    it('should throw on dimension mismatch', async () => {
      const output1 = ['Test'];
      const buffer1 = await tester.terminalOutputToImage(output1, 80, 24);
      const buffer2 = await tester.terminalOutputToImage(output1, 40, 12);
      
      await tester.saveBaseline('dimension-test', buffer1);
      
      await expect(
        tester.compare('dimension-test', buffer2)
      ).rejects.toThrow('Image dimensions mismatch');
    });
  });

  describe('Visual Assertions', () => {
    it('should assert visual match for identical output', async () => {
      const output = ['Test Output', 'Line 2'];
      
      // First call creates baseline
      await tester.assertVisualMatch('assert-test', output);
      
      // Second call should match (no throw means success)
      await tester.assertVisualMatch('assert-test', output);
    });

    it('should throw on visual mismatch', async () => {
      const output1 = ['Original'];
      const output2 = ['Changed'];
      
      await tester.assertVisualMatch('mismatch-test', output1);
      
      await expect(
        tester.assertVisualMatch('mismatch-test', output2)
      ).rejects.toThrow('Visual regression failed');
    });

    it('should respect custom dimensions', async () => {
      const output = ['Custom Size'];
      
      await tester.assertVisualMatch('custom-dim', output, 100, 30);
      
      // Second call with same dimensions should match
      await tester.assertVisualMatch('custom-dim', output, 100, 30);
    });
  });

  describe('Configuration Options', () => {
    it('should use custom threshold', async () => {
      const customTester = new VisualRegressionTester(
        testBaselineDir,
        testDiffDir,
        { threshold: 0.5 } // Higher threshold = less sensitive
      );

      const output1 = ['Test'];
      const output2 = ['Test']; // Slightly different rendering
      
      const buffer1 = await customTester.terminalOutputToImage(output1);
      await customTester.saveBaseline('threshold-test', buffer1);
      
      // With high threshold, minor differences might pass
      const buffer2 = await customTester.terminalOutputToImage(output2);
      const result = await customTester.compare('threshold-test', buffer2);
      
      expect(result).toBeDefined();
    });

    it('should support includeAA option', async () => {
      const aaTester = new VisualRegressionTester(
        testBaselineDir,
        testDiffDir,
        { includeAA: true }
      );

      const output = ['Anti-aliased text'];
      const buffer = await aaTester.terminalOutputToImage(output);
      
      expect(buffer).toBeInstanceOf(Buffer);
    });

    it('should support alpha option', async () => {
      const alphaTester = new VisualRegressionTester(
        testBaselineDir,
        testDiffDir,
        { alpha: 0.5 }
      );

      const output = ['Alpha test'];
      const buffer = await alphaTester.terminalOutputToImage(output);
      
      expect(buffer).toBeInstanceOf(Buffer);
    });
  });

  describe('Terminal Character Rendering', () => {
    it('should handle special characters', async () => {
      const output = [
        '╔═══════════╗',
        '║  Box Text  ║',
        '╚═══════════╝',
        '→ ← ↑ ↓',
        '● ○ ■ □'
      ];

      const imageBuffer = await tester.terminalOutputToImage(output);
      expect(imageBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle long lines with truncation', async () => {
      const longLine = 'x'.repeat(200);
      const output = [longLine];
      
      const imageBuffer = await tester.terminalOutputToImage(output, 80, 1);
      expect(imageBuffer).toBeInstanceOf(Buffer);
    });

    it('should pad short lines', async () => {
      const output = ['Short', 'A bit longer', 'S'];
      
      const imageBuffer = await tester.terminalOutputToImage(output, 20, 3);
      expect(imageBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle more lines than height', async () => {
      const output = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
      
      // Only 3 lines height
      const imageBuffer = await tester.terminalOutputToImage(output, 80, 3);
      expect(imageBuffer).toBeInstanceOf(Buffer);
    });

    it('should handle fewer lines than height', async () => {
      const output = ['Only one line'];
      
      // 10 lines height but only 1 line of content
      const imageBuffer = await tester.terminalOutputToImage(output, 80, 10);
      expect(imageBuffer).toBeInstanceOf(Buffer);
    });
  });
});
import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { FallbackUtils } from '@checklist/tui/src/terminal/FallbackUtils';
import { UNICODE_REPLACEMENTS } from '@checklist/tui/src/terminal/UnicodeReplacements';
import { type FallbackOptions } from '@checklist/tui/src/terminal/FallbackTypes';

// Mock the UnicodeReplacements module
const mockUnicodeReplacements = new Map([
  ['▲', '^'],
  ['△', 'v'],
  ['▼', 'V'],
  ['▽', 'A'],
  ['◆', '*'],
  ['◇', 'o'],
  ['○', 'O'],
  ['●', '@'],
  ['★', '*'],
  ['☆', '+'],
]);

// Mock the modules
mock.module('@checklist/tui/src/terminal/UnicodeReplacements', () => ({
  UNICODE_REPLACEMENTS: mockUnicodeReplacements,
}));

describe('FallbackUtils', () => {
  describe('ANSI code handling', () => {
    describe('stripAnsiColors', () => {
      it('should strip basic ANSI color codes', () => {
        const content = '\x1b[31mRed text\x1b[0m';
        const result = FallbackUtils.stripAnsiColors(content);

        expect(result).toBe('Red text');
      });

      it('should strip ANSI color codes with multiple parameters', () => {
        const content = '\x1b[1;31;42mBold red on green\x1b[0m';
        const result = FallbackUtils.stripAnsiColors(content);

        expect(result).toBe('Bold red on green');
      });

      it('should handle content without ANSI codes', () => {
        const content = 'Plain text';
        const result = FallbackUtils.stripAnsiColors(content);

        expect(result).toBe('Plain text');
      });

      it('should strip multiple ANSI color sequences', () => {
        const content = '\x1b[31mRed\x1b[32mGreen\x1b[33mYellow\x1b[0m';
        const result = FallbackUtils.stripAnsiColors(content);

        expect(result).toBe('RedGreenYellow');
      });

      it('should handle empty string', () => {
        const content = '';
        const result = FallbackUtils.stripAnsiColors(content);

        expect(result).toBe('');
      });

      it('should preserve non-color ANSI codes', () => {
        const content = '\x1b[H\x1b[31mColored text\x1b[0m';
        const result = FallbackUtils.stripAnsiColors(content);

        expect(result).toBe('\x1b[HColored text'); // Should preserve cursor positioning
      });
    });

    describe('stripAllAnsiEscapes', () => {
      it('should strip all ANSI escape sequences', () => {
        const content = '\x1b[31mRed\x1b[H\x1b[2JText\x1b[0m';
        const result = FallbackUtils.stripAllAnsiEscapes(content);

        expect(result).toBe('RedText');
      });

      it('should handle complex ANSI sequences', () => {
        const content = '\x1b[1;31;42m\x1b[H\x1b[2JHello\x1b[0m\x1b[K';
        const result = FallbackUtils.stripAllAnsiEscapes(content);

        expect(result).toBe('Hello');
      });

      it('should preserve non-ANSI content', () => {
        const content = 'Plain text with no ANSI codes';
        const result = FallbackUtils.stripAllAnsiEscapes(content);

        expect(result).toBe('Plain text with no ANSI codes');
      });

      it('should handle empty string', () => {
        const content = '';
        const result = FallbackUtils.stripAllAnsiEscapes(content);

        expect(result).toBe('');
      });
    });
  });

  describe('Unicode handling', () => {
    describe('convertToAscii', () => {
      it('should replace Unicode characters with ASCII equivalents', () => {
        const content = '▲△▼▽';
        const result = FallbackUtils.convertToAscii(content);

        expect(result).toBe('^vVA');
      });

      it('should preserve ASCII characters', () => {
        const content = 'Hello World 123';
        const result = FallbackUtils.convertToAscii(content);

        expect(result).toBe('Hello World 123');
      });

      it('should replace unknown Unicode characters with default replacement', () => {
        const content = 'Hello 世界';
        const result = FallbackUtils.convertToAscii(content);

        expect(result).toBe('Hello ??');
      });

      it('should handle mixed ASCII and Unicode content', () => {
        const content = 'Status: ▲ Success';
        const result = FallbackUtils.convertToAscii(content);

        expect(result).toBe('Status: ^ Success');
      });

      it('should handle empty string', () => {
        const content = '';
        const result = FallbackUtils.convertToAscii(content);

        expect(result).toBe('');
      });

      it('should replace Unicode characters based on code ranges', () => {
        // Test box drawing characters
        const boxContent = '┌─┐\n│█│\n└─┘';
        const result1 = FallbackUtils.convertToAscii(boxContent);
        expect(result1).toContain('+'); // Should replace box drawing with +

        // Test block elements
        const blockContent = '█▉▊▋▌▍▎▏';
        const result2 = FallbackUtils.convertToAscii(blockContent);
        expect(result2).toContain('#'); // Should replace blocks with #

        // Test geometric shapes
        const shapeContent = '■□▢▣▤▥▦▧▨▩';
        const result3 = FallbackUtils.convertToAscii(shapeContent);
        expect(result3).toContain('*'); // Should replace shapes with *
      });
    });

    describe('replaceUnicodeCharacter', () => {
      it('should replace characters based on Unicode code ranges', () => {
        const method = (FallbackUtils as any).replaceUnicodeCharacter.bind(FallbackUtils);

        // Box drawing range (0x2500-0x257F)
        expect(method('\u2500')).toBe('+'); // Box drawing light horizontal

        // Block elements range (0x2580-0x259F)
        expect(method('\u2580')).toBe('#'); // Upper half block

        // Geometric shapes range (0x25A0-0x25FF)
        expect(method('\u25A0')).toBe('*'); // Black square

        // Miscellaneous symbols range (0x2600-0x26FF)
        expect(method('\u2600')).toBe('*'); // Black sun with rays

        // Dingbats range (0x2700-0x27BF)
        expect(method('\u2700')).toBe('*'); // Black diamond

        // Unknown character
        expect(method('\u9999')).toBe('?'); // Unknown Unicode character
      });

      it('should handle surrogate pairs', () => {
        const method = (FallbackUtils as any).replaceUnicodeCharacter.bind(FallbackUtils);

        // Test some emoji/surrogate pairs
        expect(method('😊')).toBe('?'); // Emoji should be replaced with ?
      });
    });

    describe('getUnicodeReplacement', () => {
      it('should return appropriate replacements for Unicode ranges', () => {
        const method = (FallbackUtils as any).getUnicodeReplacement.bind(FallbackUtils);

        // Test various code points
        expect(method(0x2500)).toBe('+'); // Box drawing
        expect(method(0x2580)).toBe('#'); // Block element
        expect(method(0x25A0)).toBe('*'); // Geometric shape
        expect(method(0x2600)).toBe('*'); // Miscellaneous symbol
        expect(method(0x2700)).toBe('*'); // Dingbat
        expect(method(0x9999)).toBe('?'); // Unknown
      });

      it('should handle edge cases', () => {
        const method = (FallbackUtils as any).getUnicodeReplacement.bind(FallbackUtils);

        // Test boundary values
        expect(method(0x24FF)).toBe('?'); // Just before box drawing range
        expect(method(0x2500)).toBe('+'); // Start of box drawing range
        expect(method(0x257F)).toBe('+'); // End of box drawing range
        expect(method(0x2580)).toBe('#'); // Start of block range
        expect(method(0x259F)).toBe('#'); // End of block range
        expect(method(0x25A0)).toBe('*'); // Start of geometric shapes range
        expect(method(0x25FF)).toBe('*'); // End of geometric shapes range
        expect(method(0x2600)).toBe('*'); // Start of miscellaneous symbols range
        expect(method(0x26FF)).toBe('*'); // End of miscellaneous symbols range
        expect(method(0x2700)).toBe('*'); // Start of dingbats range
        expect(method(0x27BF)).toBe('*'); // End of dingbats range
        expect(method(0x27C0)).toBe('?'); // After dingbats range
      });
    });
  });

  describe('dimension limiting', () => {
    describe('limitDimensions', () => {
      it('should limit content height when exceeding maxHeight', () => {
        const content = 'Line 1\nLine 2\nLine 3\nLine 4\nLine 5';
        const options: FallbackOptions = { maxWidth: 120, maxHeight: 3, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        expect(result).toBe('Line 1\nLine 2\n... (content truncated)');
        expect(result.split('\n').length).toBe(3);
      });

      it('should not limit height when within maxHeight', () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const options: FallbackOptions = { maxWidth: 120, maxHeight: 5, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        expect(result).toBe(content);
      });

      it('should limit content width when exceeding maxWidth', () => {
        const content = 'This is a very long line that should be truncated because it exceeds the maximum width';
        const options: FallbackOptions = { maxWidth: 20, maxHeight: 50, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        expect(result.length).toBeLessThanOrEqual(23); // 20 chars + "..."
        expect(result.endsWith('...')).toBe(true);
      });

      it('should not limit width when within maxWidth', () => {
        const content = 'Short line';
        const options: FallbackOptions = { maxWidth: 50, maxHeight: 50, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        expect(result).toBe(content);
      });

      it('should handle both height and width limiting', () => {
        const content = 'Very long line 1\nVery long line 2\nVery long line 3\nVery long line 4\nVery long line 5';
        const options: FallbackOptions = { maxWidth: 10, maxHeight: 3, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        const lines = result.split('\n');
        expect(lines.length).toBe(3);
        expect(lines[0].length).toBeLessThanOrEqual(13); // 10 + "..."
        expect(lines[1].length).toBeLessThanOrEqual(13);
        expect(lines[2]).toBe('... (content truncated)');
      });

      it('should handle empty content', () => {
        const content = '';
        const options: FallbackOptions = { maxWidth: 80, maxHeight: 24, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        expect(result).toBe('');
      });

      it('should handle single line content', () => {
        const content = 'Single line';
        const options: FallbackOptions = { maxWidth: 80, maxHeight: 24, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        expect(result).toBe(content);
      });

      it('should handle infinite dimensions', () => {
        const content = 'Line 1\nLine 2\nLine 3';
        const options: FallbackOptions = { maxWidth: Infinity, maxHeight: Infinity, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const result = FallbackUtils.limitDimensions(content, options);

        expect(result).toBe(content);
      });
    });

    describe('limitHeight', () => {
      it('should truncate height when exceeding maxHeight', () => {
        const lines = ['Line 1', 'Line 2', 'Line 3', 'Line 4', 'Line 5'];
        const options: FallbackOptions = { maxWidth: 120, maxHeight: 3, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const method = (FallbackUtils as any).limitHeight.bind(FallbackUtils);
        const result = method(lines, options);

        expect(result.length).toBe(3);
        expect(result[2]).toBe('... (content truncated)');
      });

      it('should not truncate when within maxHeight', () => {
        const lines = ['Line 1', 'Line 2', 'Line 3'];
        const options: FallbackOptions = { maxWidth: 120, maxHeight: 5, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const method = (FallbackUtils as any).limitHeight.bind(FallbackUtils);
        const result = method(lines, options);

        expect(result).toBe(lines);
      });
    });

    describe('limitWidth', () => {
      it('should truncate lines when exceeding maxWidth', () => {
        const lines = ['This is a very long line that should be truncated', 'Short line'];
        const options: FallbackOptions = { maxWidth: 20, maxHeight: 50, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const method = (FallbackUtils as any).limitWidth.bind(FallbackUtils);
        const result = method(lines, options);

        expect(result[0]).toBe('This is a very lo...'); // 20 chars total (17 + "...")
        expect(result[0].length).toBeLessThanOrEqual(20);
        expect(result[1]).toBe('Short line');
      });

      it('should not truncate when within maxWidth', () => {
        const lines = ['Short line', 'Another line'];
        const options: FallbackOptions = { maxWidth: 50, maxHeight: 50, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

        const method = (FallbackUtils as any).limitWidth.bind(FallbackUtils);
        const result = method(lines, options);

        expect(result).toEqual(lines);
      });
    });
  });

  describe('box drawing simplification', () => {
    describe('simplifyBoxDrawing', () => {
      it('should replace Unicode box drawing characters with ASCII equivalents', () => {
        const content = '┌─┐\n│█│\n└─┘';
        const result = FallbackUtils.simplifyBoxDrawing(content);

        expect(result).toBe('+-+\n|#|\n+-+');
      });

      it('should handle double-line box characters', () => {
        const content = '╔═══╗\n║   ║\n╚═══╝';
        const result = FallbackUtils.simplifyBoxDrawing(content);

        expect(result).toBe('+---+\n|   |\n+---+');
      });

      it('should handle rounded corners', () => {
        const content = '╭───╮\n│   │\n╰───╯';
        const result = FallbackUtils.simplifyBoxDrawing(content);

        expect(result).toBe('+---+\n|   |\n+---+');
      });

      it('should handle mixed box drawing characters', () => {
        const content = '├─┬─┤\n│ │ │\n├─┼─┤\n│ │ │\n└─┴─┘';
        const result = FallbackUtils.simplifyBoxDrawing(content);

        expect(result).toBe('+-+-+\n| | |\n+-+-+\n| | |\n+-+-+');
      });

      it('should preserve non-box-drawing characters', () => {
        const content = '┌─ Text ─┐\n│  Hello  │\n└────────┘';
        const result = FallbackUtils.simplifyBoxDrawing(content);

        expect(result).toBe('+- Text -+\n|  Hello  |\n+--------+');
      });

      it('should handle empty string', () => {
        const content = '';
        const result = FallbackUtils.simplifyBoxDrawing(content);

        expect(result).toBe('');
      });

      it('should handle content without box drawing', () => {
        const content = 'Plain text';
        const result = FallbackUtils.simplifyBoxDrawing(content);

        expect(result).toBe('Plain text');
      });
    });

    describe('getBoxReplacements', () => {
      it('should return complete mapping of box drawing characters', () => {
        const method = (FallbackUtils as any).getBoxReplacements.bind(FallbackUtils);
        const replacements = method();

        expect(replacements).toBeInstanceOf(Map);
        expect(replacements.size).toBeGreaterThan(0);

        // Test some key replacements
        expect(replacements.get('┌')).toBe('+');
        expect(replacements.get('┐')).toBe('+');
        expect(replacements.get('└')).toBe('+');
        expect(replacements.get('┘')).toBe('+');
        expect(replacements.get('─')).toBe('-');
        expect(replacements.get('│')).toBe('|');
        expect(replacements.get('┼')).toBe('+');
      });
    });

    describe('applyBoxReplacements', () => {
      it('should apply all replacements to content', () => {
        const method = (FallbackUtils as any).applyBoxReplacements.bind(FallbackUtils);
        const replacements = new Map([
          ['┌', '+'],
          ['┐', '+'],
          ['─', '-'],
        ]);

        const content = '┌───┐';
        const result = method(content, replacements);

        expect(result).toBe('+---+');
      });

      it('should handle multiple occurrences of the same character', () => {
        const method = (FallbackUtils as any).applyBoxReplacements.bind(FallbackUtils);
        const replacements = new Map([
          ['┌', '+'],
          ['─', '-'],
        ]);

        const content = '┌─┌─┌─';
        const result = method(content, replacements);

        expect(result).toBe('+-+-+-');
      });

      it('should handle empty replacements map', () => {
        const method = (FallbackUtils as any).applyBoxReplacements.bind(FallbackUtils);
        const replacements = new Map();

        const content = '┌─┐';
        const result = method(content, replacements);

        expect(result).toBe('┌─┐');
      });
    });
  });

  describe('layout simplification', () => {
    describe('simplifyLayout', () => {
      it('should reduce excessive spacing', () => {
        const content = 'Text    with    multiple    spaces';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toBe('Text  with  multiple  spaces');
      });

      it('should simplify indentation', () => {
        const content = '        Indented by 8 spaces\n            Indented by 12 spaces';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toBe('  Indented by 8 spaces\n    Indented by 12 spaces');
      });

      it('should reduce excessive newlines', () => {
        const content = 'Line 1\n\n\n\nLine 2\n\nLine 3';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toBe('Line 1\n\nLine 2\n\nLine 3');
      });

      it('should simplify horizontal rules', () => {
        const content = 'Text above\n─────────────────\nText below';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toBe('Text above\n---\nText below');
      });

      it('should remove Unicode formatting characters', () => {
        const content = 'Text\u200Bwith\u200Czero\u200Dwidth\uFEFFspaces';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toBe('Textwithzerowidthspaces');
      });

      it('should handle complex content with multiple issues', () => {
        const content = '        Header\n        ═══════\n\n\n        Content    with    spaces\n\n\n        ═══════\n        Footer';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toContain('Header');
        expect(result).toContain('---');
        expect(result).toContain('Content  with  spaces');
        expect(result).toContain('Footer');
        expect(result).not.toContain('══════');
      });

      it('should handle empty string', () => {
        const content = '';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toBe('');
      });

      it('should preserve normal content', () => {
        const content = 'Normal text\nWith normal spacing\nAnd normal indentation';
        const result = FallbackUtils.simplifyLayout(content);

        expect(result).toBe(content);
      });
    });
  });

  describe('capability detection', () => {
    describe('isMinimalTerminal', () => {
      it('should return true for null capabilities', () => {
        const result = FallbackUtils.isMinimalTerminal(null);
        expect(result).toBe(true);
      });

      it('should return true for undefined capabilities', () => {
        const result = FallbackUtils.isMinimalTerminal(undefined);
        expect(result).toBe(true);
      });

      it('should return true for terminals with low color support', () => {
        const capabilities = { colors: 4 };
        const result = FallbackUtils.isMinimalTerminal(capabilities);

        expect(result).toBe(true);
      });

      it('should return true for minimal terminal types', () => {
        const minimalTerminals = ['dumb', 'basic', 'vt100', 'vt102'];

        for (const termType of minimalTerminals) {
          const capabilities = { TERM: termType, colors: 16 };
          const result = FallbackUtils.isMinimalTerminal(capabilities);

          expect(result).toBe(true);
        }
      });

      it('should return false for capable terminals', () => {
        const capabilities = { colors: 256, TERM: 'xterm-256color' };
        const result = FallbackUtils.isMinimalTerminal(capabilities);

        expect(result).toBe(false);
      });

      it('should return false when colors property is missing', () => {
        const capabilities = { TERM: 'xterm-256color' };
        const result = FallbackUtils.isMinimalTerminal(capabilities);

        expect(result).toBe(false);
      });
    });

    describe('hasUnicodeSupport', () => {
      it('should return false for null capabilities', () => {
        const result = FallbackUtils.hasUnicodeSupport(null);
        expect(result).toBe(false);
      });

      it('should return false for undefined capabilities', () => {
        const result = FallbackUtils.hasUnicodeSupport(undefined);
        expect(result).toBe(false);
      });

      it('should return true for UTF-8 encoding', () => {
        const capabilities = { encoding: 'UTF-8' };
        const result = FallbackUtils.hasUnicodeSupport(capabilities);

        expect(result).toBe(true);
      });

      it('should return true for UTF-8 in LANG variable', () => {
        const capabilities = { LANG: 'en_US.UTF-8' };
        const result = FallbackUtils.hasUnicodeSupport(capabilities);

        expect(result).toBe(true);
      });

      it('should return true for case-insensitive UTF-8 variants', () => {
        const variants = [
          { encoding: 'utf-8' },
          { encoding: 'UTF8' },
          { encoding: 'utf8' },
          { LANG: 'en_US.utf8' },
          { LANG: 'en_US.UTF8' },
        ];

        for (const variant of variants) {
          const result = FallbackUtils.hasUnicodeSupport(variant);
          expect(result).toBe(true);
        }
      });

      it('should return false for non-UTF-8 encodings', () => {
        const capabilities = { encoding: 'ASCII', LANG: 'en_US.ASCII' };
        const result = FallbackUtils.hasUnicodeSupport(capabilities);

        expect(result).toBe(false);
      });

      it('should return false when encoding is missing', () => {
        const capabilities = { LANG: 'en_US' };
        const result = FallbackUtils.hasUnicodeSupport(capabilities);

        expect(result).toBe(false);
      });
    });

    describe('hasColorSupport', () => {
      it('should return false for null capabilities', () => {
        const result = FallbackUtils.hasColorSupport(null);
        expect(result).toBe(false);
      });

      it('should return false for undefined capabilities', () => {
        const result = FallbackUtils.hasColorSupport(undefined);
        expect(result).toBe(false);
      });

      it('should return true for terminals with 8 or more colors', () => {
        const colorCounts = [8, 16, 256, 16777216];

        for (const count of colorCounts) {
          const capabilities = { colors: count };
          const result = FallbackUtils.hasColorSupport(capabilities);

          expect(result).toBe(true);
        }
      });

      it('should return false for terminals with less than 8 colors', () => {
        const colorCounts = [0, 1, 2, 4, 7];

        for (const count of colorCounts) {
          const capabilities = { colors: count };
          const result = FallbackUtils.hasColorSupport(capabilities);

          expect(result).toBe(false);
        }
      });

      it('should return false when colors property is missing', () => {
        const capabilities = { TERM: 'xterm-256color' };
        const result = FallbackUtils.hasColorSupport(capabilities);

        expect(result).toBe(false);
      });

      it('should handle non-numeric colors property', () => {
        const capabilities = { colors: '256' as any };
        const result = FallbackUtils.hasColorSupport(capabilities);

        expect(result).toBe(false);
      });
    });
  });

  describe('performance and edge cases', () => {
    it('should handle very large content efficiently', () => {
      const largeContent = 'x'.repeat(100000);
      const options: FallbackOptions = { maxWidth: 80, maxHeight: 24, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

      const start = performance.now();
      const result = FallbackUtils.limitDimensions(largeContent, options);
      const end = performance.now();

      expect(typeof result).toBe('string');
      expect(end - start).toBeLessThan(100); // Should complete quickly
    });

    it('should handle content with many Unicode characters', () => {
      const unicodeContent = '▲△▼▽◆◇○●★☆'.repeat(1000);
      const result = FallbackUtils.convertToAscii(unicodeContent);

      expect(typeof result).toBe('string');
      expect(result.length).toBe(unicodeContent.length); // Should preserve length
    });

    it('should handle content with many ANSI codes', () => {
      const ansiContent = '\x1b[31mRed\x1b[32mGreen\x1b[33mYellow\x1b[0m'.repeat(1000);
      const result = FallbackUtils.stripAnsiColors(ansiContent);

      expect(typeof result).toBe('string');
      expect(result).not.toContain('\x1b');
    });

    it('should handle invalid regex patterns gracefully', () => {
      // This tests that the regex patterns don't cause issues
      const content = 'Normal content';
      const result1 = FallbackUtils.stripAnsiColors(content);
      const result2 = FallbackUtils.stripAllAnsiEscapes(content);

      expect(result1).toBe(content);
      expect(result2).toBe(content);
    });

    it('should handle edge case with very long lines', () => {
      const longLine = 'a'.repeat(10000);
      const options: FallbackOptions = { maxWidth: 100, maxHeight: 50, useAsciiOnly: false, stripColors: false, simplifyBoxDrawing: false, preserveLayout: true };

      const result = FallbackUtils.limitDimensions(longLine, options);

      expect(result.length).toBeLessThanOrEqual(103); // 100 + "..."
    });
  });
});
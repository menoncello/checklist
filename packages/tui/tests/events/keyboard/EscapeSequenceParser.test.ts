import { beforeEach, describe, expect, test } from 'bun:test';
import { EscapeSequenceParser, ParsedSequence } from '../../../src/events/keyboard/EscapeSequenceParser';

describe('EscapeSequenceParser', () => {
  describe('parse', () => {
    test('should return null for non-escape character', () => {
      const result = EscapeSequenceParser.parse('a');
      expect(result).toBeNull();
    });

    test('should return null for empty string', () => {
      const result = EscapeSequenceParser.parse('');
      expect(result).toBeNull();
    });

    test('should return null when start index is out of bounds', () => {
      const result = EscapeSequenceParser.parse('\x1b[A', 10);
      expect(result).toBeNull();
    });

    test('should return null when character at start index is not escape', () => {
      const result = EscapeSequenceParser.parse('a\x1b[A', 0);
      expect(result).toBeNull();
    });

    test('should parse lone escape character', () => {
      const result = EscapeSequenceParser.parse('\x1b');

      expect(result).toEqual({
        key: 'escape',
        modifiers: {},
        sequence: '\x1b',
        consumed: 1,
      });
    });

    test('should parse escape with start index', () => {
      const result = EscapeSequenceParser.parse('ab\x1b', 2);

      expect(result).toEqual({
        key: 'escape',
        modifiers: {},
        sequence: '\x1b',
        consumed: 1,
      });
    });

    test('should parse CSI sequence', () => {
      const result = EscapeSequenceParser.parse('\x1b[A');

      expect(result).toEqual({
        key: 'up',
        modifiers: {},
        sequence: '\x1b[A',
        consumed: 3,
      });
    });

    test('should parse OSC sequence', () => {
      const result = EscapeSequenceParser.parse('\x1b]0;Title\x07');

      expect(result).toEqual({
        key: 'osc',
        modifiers: {},
        sequence: '\x1b]0;Title\x07',
        consumed: 10,
      });
    });

    test('should parse function key sequence', () => {
      const result = EscapeSequenceParser.parse('\x1bOP');

      expect(result).toEqual({
        key: 'f1',
        modifiers: {},
        sequence: '\x1bOP',
        consumed: 3,
      });
    });

    test('should parse alt sequence', () => {
      const result = EscapeSequenceParser.parse('\x1ba');

      expect(result).toEqual({
        key: 'a',
        modifiers: { alt: true },
        sequence: '\x1ba',
        consumed: 2,
      });
    });

    test('should return null for unknown escape sequence', () => {
      const result = EscapeSequenceParser.parse('\x1bZ');

      expect(result).toEqual({
        key: 'z',
        modifiers: { alt: true },
        sequence: '\x1bZ',
        consumed: 2,
      });
    });
  });

  describe('CSI sequences', () => {
    test('should parse arrow keys', () => {
      expect(EscapeSequenceParser.parse('\x1b[A')).toMatchObject({ key: 'up' });
      expect(EscapeSequenceParser.parse('\x1b[B')).toMatchObject({ key: 'down' });
      expect(EscapeSequenceParser.parse('\x1b[C')).toMatchObject({ key: 'right' });
      expect(EscapeSequenceParser.parse('\x1b[D')).toMatchObject({ key: 'left' });
    });

    test('should parse home and end keys', () => {
      expect(EscapeSequenceParser.parse('\x1b[H')).toMatchObject({ key: 'home' });
      expect(EscapeSequenceParser.parse('\x1b[F')).toMatchObject({ key: 'end' });
    });

    test('should parse special keys with tilde', () => {
      expect(EscapeSequenceParser.parse('\x1b[1~')).toMatchObject({ key: 'home' });
      expect(EscapeSequenceParser.parse('\x1b[2~')).toMatchObject({ key: 'insert' });
      expect(EscapeSequenceParser.parse('\x1b[3~')).toMatchObject({ key: 'delete' });
      expect(EscapeSequenceParser.parse('\x1b[4~')).toMatchObject({ key: 'end' });
      expect(EscapeSequenceParser.parse('\x1b[5~')).toMatchObject({ key: 'pageup' });
      expect(EscapeSequenceParser.parse('\x1b[6~')).toMatchObject({ key: 'pagedown' });
    });

    test('should parse function keys with tilde', () => {
      expect(EscapeSequenceParser.parse('\x1b[15~')).toMatchObject({ key: 'f5' });
      expect(EscapeSequenceParser.parse('\x1b[17~')).toMatchObject({ key: 'f6' });
      expect(EscapeSequenceParser.parse('\x1b[18~')).toMatchObject({ key: 'f7' });
      expect(EscapeSequenceParser.parse('\x1b[19~')).toMatchObject({ key: 'f8' });
      expect(EscapeSequenceParser.parse('\x1b[20~')).toMatchObject({ key: 'f9' });
      expect(EscapeSequenceParser.parse('\x1b[21~')).toMatchObject({ key: 'f10' });
      expect(EscapeSequenceParser.parse('\x1b[23~')).toMatchObject({ key: 'f11' });
      expect(EscapeSequenceParser.parse('\x1b[24~')).toMatchObject({ key: 'f12' });
    });

    test('should parse unknown special key numbers', () => {
      const result = EscapeSequenceParser.parse('\x1b[999~');
      expect(result).toMatchObject({ key: 'unknown' });
    });

    test('should parse keys with modifiers', () => {
      // Shift modifier (modifier code 2)
      const shiftUp = EscapeSequenceParser.parse('\x1b[1;2A');
      expect(shiftUp).toMatchObject({
        key: 'up',
        modifiers: { shift: true },
      });

      // Alt modifier (modifier code 3)
      const altUp = EscapeSequenceParser.parse('\x1b[1;3A');
      expect(altUp).toMatchObject({
        key: 'up',
        modifiers: { alt: true },
      });

      // Ctrl modifier (modifier code 5)
      const ctrlUp = EscapeSequenceParser.parse('\x1b[1;5A');
      expect(ctrlUp).toMatchObject({
        key: 'up',
        modifiers: { ctrl: true },
      });

      // Meta modifier (modifier code 9)
      const metaUp = EscapeSequenceParser.parse('\x1b[1;9A');
      expect(metaUp).toMatchObject({
        key: 'up',
        modifiers: { meta: true },
      });
    });

    test('should parse complex modifier combinations', () => {
      // Shift + Alt (modifier code 4)
      const shiftAlt = EscapeSequenceParser.parse('\x1b[1;4A');
      expect(shiftAlt).toMatchObject({
        key: 'up',
        modifiers: { shift: true, alt: true },
      });

      // Ctrl + Shift (modifier code 6)
      const ctrlShift = EscapeSequenceParser.parse('\x1b[1;6A');
      expect(ctrlShift).toMatchObject({
        key: 'up',
        modifiers: { ctrl: true, shift: true },
      });

      // All modifiers (modifier code 16: shift + alt + ctrl + meta)
      const allMods = EscapeSequenceParser.parse('\x1b[1;16A');
      expect(allMods).toMatchObject({
        key: 'up',
        modifiers: { shift: true, alt: true, ctrl: true, meta: true },
      });
    });

    test('should parse sequences without parameters', () => {
      const result = EscapeSequenceParser.parse('\x1b[A');
      expect(result).toMatchObject({
        key: 'up',
        modifiers: {},
        sequence: '\x1b[A',
        consumed: 3,
      });
    });

    test('should parse sequences with empty parameters', () => {
      const result = EscapeSequenceParser.parse('\x1b[;A');
      expect(result).toMatchObject({
        key: 'up',
        modifiers: {},
      });
    });

    test('should parse sequences with multiple semicolons', () => {
      const result = EscapeSequenceParser.parse('\x1b[1;2;3A');
      expect(result).toMatchObject({
        key: 'up',
        modifiers: { shift: true }, // Only second parameter is used for modifiers
      });
    });

    test('should return null for invalid CSI sequence', () => {
      const result = EscapeSequenceParser.parse('\x1b[');
      expect(result).toBeNull();
    });

    test('should return null for CSI without final character', () => {
      const result = EscapeSequenceParser.parse('\x1b[123');
      expect(result).toBeNull();
    });

    test('should handle unknown final characters', () => {
      const result = EscapeSequenceParser.parse('\x1b[1Z');
      expect(result).toMatchObject({
        key: 'Z',
        modifiers: {},
      });
    });

    test('should calculate consumed bytes correctly', () => {
      const result = EscapeSequenceParser.parse('prefix\x1b[1;2A', 6);
      expect(result).toMatchObject({
        consumed: 12, // 6 (base index) + 2 (\x1b[) + 4 (1;2A)
      });
    });
  });

  describe('OSC sequences', () => {
    test('should parse OSC sequence with BEL terminator', () => {
      const result = EscapeSequenceParser.parse('\x1b]0;Window Title\x07');

      expect(result).toEqual({
        key: 'osc',
        modifiers: {},
        sequence: '\x1b]0;Window Title\x07',
        consumed: 17,
      });
    });

    test('should parse empty OSC sequence', () => {
      const result = EscapeSequenceParser.parse('\x1b]\x07');

      expect(result).toEqual({
        key: 'osc',
        modifiers: {},
        sequence: '\x1b]\x07',
        consumed: 3,
      });
    });

    test('should return null for OSC without terminator', () => {
      const result = EscapeSequenceParser.parse('\x1b]0;Unterminated');
      expect(result).toBeNull();
    });

    test('should calculate consumed bytes correctly for OSC', () => {
      const result = EscapeSequenceParser.parse('prefix\x1b]test\x07', 6);
      expect(result).toMatchObject({
        consumed: 13, // 6 (base index) + 3 (\x1b]) + 4 (test) + 1 (\x07) - 1 (adjustment)
      });
    });
  });

  describe('Function key sequences', () => {
    test('should parse all function keys', () => {
      expect(EscapeSequenceParser.parse('\x1bOP')).toMatchObject({ key: 'f1' });
      expect(EscapeSequenceParser.parse('\x1bOQ')).toMatchObject({ key: 'f2' });
      expect(EscapeSequenceParser.parse('\x1bOR')).toMatchObject({ key: 'f3' });
      expect(EscapeSequenceParser.parse('\x1bOS')).toMatchObject({ key: 'f4' });
    });

    test('should parse home and end function keys', () => {
      expect(EscapeSequenceParser.parse('\x1bOH')).toMatchObject({ key: 'home' });
      expect(EscapeSequenceParser.parse('\x1bOF')).toMatchObject({ key: 'end' });
    });

    test('should return null for unknown function key', () => {
      const result = EscapeSequenceParser.parse('\x1bOZ');
      expect(result).toBeNull();
    });

    test('should return null for function key sequence without character', () => {
      const result = EscapeSequenceParser.parse('\x1bO');
      expect(result).toBeNull();
    });

    test('should calculate consumed bytes correctly for function keys', () => {
      const result = EscapeSequenceParser.parse('prefix\x1bOP', 6);
      expect(result).toMatchObject({
        consumed: 9, // 6 (base index) + 3 (\x1bOP)
      });
    });
  });

  describe('Alt sequences', () => {
    test('should parse alt + letter', () => {
      const result = EscapeSequenceParser.parse('\x1ba');

      expect(result).toEqual({
        key: 'a',
        modifiers: { alt: true },
        sequence: '\x1ba',
        consumed: 2,
      });
    });

    test('should parse alt + uppercase letter', () => {
      const result = EscapeSequenceParser.parse('\x1bA');

      expect(result).toEqual({
        key: 'a', // Converted to lowercase
        modifiers: { alt: true },
        sequence: '\x1bA',
        consumed: 2,
      });
    });

    test('should parse alt + number', () => {
      const result = EscapeSequenceParser.parse('\x1b1');

      expect(result).toEqual({
        key: '1',
        modifiers: { alt: true },
        sequence: '\x1b1',
        consumed: 2,
      });
    });

    test('should parse alt + symbol', () => {
      const result = EscapeSequenceParser.parse('\x1b!');

      expect(result).toEqual({
        key: '!',
        modifiers: { alt: true },
        sequence: '\x1b!',
        consumed: 2,
      });
    });

    test('should calculate consumed bytes correctly for alt sequences', () => {
      const result = EscapeSequenceParser.parse('prefix\x1ba', 6);
      expect(result).toMatchObject({
        consumed: 8, // 6 (base index) + 2 (\x1ba)
      });
    });
  });

  describe('edge cases', () => {
    test('should handle escape at end of string', () => {
      const result = EscapeSequenceParser.parse('test\x1b', 4);

      expect(result).toEqual({
        key: 'escape',
        modifiers: {},
        sequence: '\x1b',
        consumed: 1,
      });
    });

    test('should handle partial sequences', () => {
      const result = EscapeSequenceParser.parse('\x1b[');
      expect(result).toBeNull();
    });

    test('should handle partial CSI sequences with letters', () => {
      const result = EscapeSequenceParser.parse('\x1b[a');
      expect(result).toMatchObject({
        key: 'a',
        modifiers: {},
      });
    });

    test('should handle empty tilde parameter', () => {
      const result = EscapeSequenceParser.parse('\x1b[~');
      expect(result).toMatchObject({
        key: 'special', // Default for tilde
        modifiers: {},
      });
    });

    test('should handle CSI sequences with letters', () => {
      const result = EscapeSequenceParser.parse('\x1b[a');
      expect(result).toMatchObject({
        key: 'a', // Letters are valid final characters
      });
    });

    test('should handle modifier parsing edge cases', () => {
      // Empty parameters
      const result1 = EscapeSequenceParser.parse('\x1b[;A');
      expect(result1).toMatchObject({ modifiers: {} });

      // Single parameter (no modifier)
      const result2 = EscapeSequenceParser.parse('\x1b[1A');
      expect(result2).toMatchObject({ modifiers: {} });

      // Non-numeric modifier - CSI will match first letter
      const result3 = EscapeSequenceParser.parse('\x1b[1;a');
      expect(result3).toMatchObject({
        key: 'a',
        modifiers: {} // No modifier in second parameter
      });
    });

    test('should handle very long sequences', () => {
      const longSequence = '\x1b[1;2;3;4;5;6;7;8;9;10A';
      const result = EscapeSequenceParser.parse(longSequence);
      expect(result).toMatchObject({
        key: 'up',
        modifiers: { shift: true }, // Only second parameter matters
      });
    });

    test('should handle sequences with zero parameters', () => {
      const result = EscapeSequenceParser.parse('\x1b[0~');
      expect(result).toMatchObject({
        key: 'unknown', // No mapping for 0
      });
    });

    test('should preserve original sequence in result', () => {
      const originalSequence = '\x1b[1;2A';
      const result = EscapeSequenceParser.parse(originalSequence);
      expect(result?.sequence).toBe(originalSequence);
    });

    test('should handle mixed case letters', () => {
      const result = EscapeSequenceParser.parse('\x1bZ');
      expect(result).toEqual({
        key: 'z',
        modifiers: { alt: true },
        sequence: '\x1bZ',
        consumed: 2,
      });
    });
  });

  describe('complex scenarios', () => {
    test('should parse sequence in middle of string', () => {
      const data = 'prefix\x1b[Asuffix';
      const result = EscapeSequenceParser.parse(data, 6);

      expect(result).toMatchObject({
        key: 'up',
        consumed: 9, // 6 + 3
      });
    });

    test('should handle multiple escape sequences', () => {
      // Parse first sequence
      const data = '\x1b[A\x1b[B';
      const result1 = EscapeSequenceParser.parse(data, 0);
      expect(result1).toMatchObject({ key: 'up', consumed: 3 });

      // Parse second sequence
      const result2 = EscapeSequenceParser.parse(data, 3);
      expect(result2).toMatchObject({ key: 'down', consumed: 6 });
    });

    test('should handle unicode characters in sequences', () => {
      const result = EscapeSequenceParser.parse('\x1b→');
      expect(result).toEqual({
        key: '→',
        modifiers: { alt: true },
        sequence: '\x1b→',
        consumed: 2,
      });
    });

    test('should handle all modifier combinations systematically', () => {
      const testCases = [
        { code: 1, expected: {} },
        { code: 2, expected: { shift: true } },
        { code: 3, expected: { alt: true } },
        { code: 4, expected: { shift: true, alt: true } },
        { code: 5, expected: { ctrl: true } },
        { code: 6, expected: { shift: true, ctrl: true } },
        { code: 7, expected: { alt: true, ctrl: true } },
        { code: 8, expected: { shift: true, alt: true, ctrl: true } },
        { code: 9, expected: { meta: true } },
        { code: 10, expected: { shift: true, meta: true } },
      ];

      testCases.forEach(({ code, expected }) => {
        const result = EscapeSequenceParser.parse(`\x1b[1;${code}A`);
        expect(result).toMatchObject({ modifiers: expected });
      });
    });
  });
});
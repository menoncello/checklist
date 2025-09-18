import { describe, it, expect } from 'bun:test';
import { ControlCharacterParser, type ControlCharacter } from '../../../src/events/keyboard/ControlCharacterParser';

describe('ControlCharacterParser', () => {
  describe('parse', () => {
    it('should parse valid control characters', () => {
      const result = ControlCharacterParser.parse(1);
      expect(result).toEqual({
        key: 'ctrl+a',
        char: '\x01',
        ctrl: true
      });
    });

    it('should parse control characters with names', () => {
      const result = ControlCharacterParser.parse(3);
      expect(result).toEqual({
        key: 'ctrl+c',
        char: '\x03',
        ctrl: true,
        name: 'break'
      });
    });

    it('should parse non-control special characters', () => {
      const tab = ControlCharacterParser.parse(9);
      expect(tab).toEqual({
        key: 'tab',
        char: '\x09',
        ctrl: false,
        name: 'tab'
      });

      const backspace = ControlCharacterParser.parse(8);
      expect(backspace).toEqual({
        key: 'backspace',
        char: '\x08',
        ctrl: false,
        name: 'backspace'
      });
    });

    it('should parse enter characters (both variants)', () => {
      const linefeed = ControlCharacterParser.parse(10);
      expect(linefeed).toEqual({
        key: 'enter',
        char: '\x0a',
        ctrl: false,
        name: 'linefeed'
      });

      const carriageReturn = ControlCharacterParser.parse(13);
      expect(carriageReturn).toEqual({
        key: 'enter',
        char: '\x0d',
        ctrl: false,
        name: 'return'
      });
    });

    it('should parse escape character', () => {
      const result = ControlCharacterParser.parse(27);
      expect(result).toEqual({
        key: 'escape',
        char: '\x1b',
        ctrl: false,
        name: 'escape'
      });
    });

    it('should parse delete character', () => {
      const result = ControlCharacterParser.parse(127);
      expect(result).toEqual({
        key: 'delete',
        char: '\x7f',
        ctrl: false,
        name: 'delete'
      });
    });

    it('should return null for invalid character codes', () => {
      expect(ControlCharacterParser.parse(32)).toBeNull(); // Space
      expect(ControlCharacterParser.parse(65)).toBeNull(); // 'A'
      expect(ControlCharacterParser.parse(128)).toBeNull(); // Outside range
      expect(ControlCharacterParser.parse(-1)).toBeNull(); // Negative
      expect(ControlCharacterParser.parse(1000)).toBeNull(); // Large number
    });

    it('should parse all defined control characters', () => {
      const expectedCodes = [
        0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
        16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 127
      ];

      expectedCodes.forEach(code => {
        const result = ControlCharacterParser.parse(code);
        expect(result).not.toBeNull();
        expect(result?.char.charCodeAt(0)).toBe(code);
      });
    });
  });

  describe('isControlCharacter', () => {
    it('should return true for valid control character codes', () => {
      expect(ControlCharacterParser.isControlCharacter(1)).toBe(true); // Ctrl+A
      expect(ControlCharacterParser.isControlCharacter(3)).toBe(true); // Ctrl+C
      expect(ControlCharacterParser.isControlCharacter(8)).toBe(true); // Backspace
      expect(ControlCharacterParser.isControlCharacter(9)).toBe(true); // Tab
      expect(ControlCharacterParser.isControlCharacter(13)).toBe(true); // Enter
      expect(ControlCharacterParser.isControlCharacter(27)).toBe(true); // Escape
      expect(ControlCharacterParser.isControlCharacter(127)).toBe(true); // Delete
    });

    it('should return false for invalid character codes', () => {
      expect(ControlCharacterParser.isControlCharacter(32)).toBe(false); // Space
      expect(ControlCharacterParser.isControlCharacter(65)).toBe(false); // 'A'
      expect(ControlCharacterParser.isControlCharacter(128)).toBe(false); // Outside range
      expect(ControlCharacterParser.isControlCharacter(-1)).toBe(false); // Negative
      expect(ControlCharacterParser.isControlCharacter(1000)).toBe(false); // Large number
    });

    it('should return true for all defined control characters', () => {
      const allControlChars = ControlCharacterParser.getAllControlCharacters();
      allControlChars.forEach(char => {
        const code = char.char.charCodeAt(0);
        expect(ControlCharacterParser.isControlCharacter(code)).toBe(true);
      });
    });
  });

  describe('getControlCharacterName', () => {
    it('should return names for characters that have them', () => {
      expect(ControlCharacterParser.getControlCharacterName(0)).toBe('null');
      expect(ControlCharacterParser.getControlCharacterName(3)).toBe('break');
      expect(ControlCharacterParser.getControlCharacterName(4)).toBe('eof');
      expect(ControlCharacterParser.getControlCharacterName(7)).toBe('bell');
      expect(ControlCharacterParser.getControlCharacterName(8)).toBe('backspace');
      expect(ControlCharacterParser.getControlCharacterName(9)).toBe('tab');
      expect(ControlCharacterParser.getControlCharacterName(10)).toBe('linefeed');
      expect(ControlCharacterParser.getControlCharacterName(12)).toBe('formfeed');
      expect(ControlCharacterParser.getControlCharacterName(13)).toBe('return');
      expect(ControlCharacterParser.getControlCharacterName(17)).toBe('xon');
      expect(ControlCharacterParser.getControlCharacterName(19)).toBe('xoff');
      expect(ControlCharacterParser.getControlCharacterName(26)).toBe('suspend');
      expect(ControlCharacterParser.getControlCharacterName(27)).toBe('escape');
      expect(ControlCharacterParser.getControlCharacterName(127)).toBe('delete');
    });

    it('should return undefined for characters without names', () => {
      expect(ControlCharacterParser.getControlCharacterName(1)).toBeUndefined(); // Ctrl+A
      expect(ControlCharacterParser.getControlCharacterName(2)).toBeUndefined(); // Ctrl+B
      expect(ControlCharacterParser.getControlCharacterName(5)).toBeUndefined(); // Ctrl+E
    });

    it('should return undefined for invalid character codes', () => {
      expect(ControlCharacterParser.getControlCharacterName(32)).toBeUndefined(); // Space
      expect(ControlCharacterParser.getControlCharacterName(65)).toBeUndefined(); // 'A'
      expect(ControlCharacterParser.getControlCharacterName(-1)).toBeUndefined(); // Negative
      expect(ControlCharacterParser.getControlCharacterName(1000)).toBeUndefined(); // Large
    });
  });

  describe('getAllControlCharacters', () => {
    it('should return all control characters', () => {
      const allChars = ControlCharacterParser.getAllControlCharacters();

      expect(allChars).toBeInstanceOf(Array);
      expect(allChars.length).toBe(33); // 32 control chars (0-31) + delete (127)

      // Verify structure of returned characters
      allChars.forEach(char => {
        expect(char).toHaveProperty('key');
        expect(char).toHaveProperty('char');
        expect(char).toHaveProperty('ctrl');
        expect(typeof char.key).toBe('string');
        expect(typeof char.char).toBe('string');
        expect(typeof char.ctrl).toBe('boolean');
        if (char.name !== undefined) {
          expect(typeof char.name).toBe('string');
        }
      });
    });

    it('should return a copy of the internal array', () => {
      const allChars1 = ControlCharacterParser.getAllControlCharacters();
      const allChars2 = ControlCharacterParser.getAllControlCharacters();

      // Should be equal but not the same reference
      expect(allChars1).toEqual(allChars2);
      expect(allChars1).not.toBe(allChars2);

      // Modifying the returned array should not affect subsequent calls
      allChars1.push({
        key: 'test',
        char: 'test',
        ctrl: false
      });

      const allChars3 = ControlCharacterParser.getAllControlCharacters();
      expect(allChars3.length).toBe(33); // Should still be original length
    });

    it('should include specific expected characters', () => {
      const allChars = ControlCharacterParser.getAllControlCharacters();

      // Check for some key characters
      const charMap = new Map(allChars.map(char => [char.char.charCodeAt(0), char]));

      expect(charMap.get(0)?.name).toBe('null');
      expect(charMap.get(3)?.name).toBe('break');
      expect(charMap.get(8)?.name).toBe('backspace');
      expect(charMap.get(9)?.name).toBe('tab');
      expect(charMap.get(13)?.name).toBe('return');
      expect(charMap.get(27)?.name).toBe('escape');
      expect(charMap.get(127)?.name).toBe('delete');
    });
  });

  describe('parseFromString', () => {
    it('should parse control character from string at default index', () => {
      const str = '\x01hello'; // Ctrl+A followed by text
      const result = ControlCharacterParser.parseFromString(str);

      expect(result).toEqual({
        key: 'ctrl+a',
        char: '\x01',
        ctrl: true
      });
    });

    it('should parse control character from string at specified index', () => {
      const str = 'hello\x03world'; // Text, Ctrl+C, more text
      const result = ControlCharacterParser.parseFromString(str, 5);

      expect(result).toEqual({
        key: 'ctrl+c',
        char: '\x03',
        ctrl: true,
        name: 'break'
      });
    });

    it('should return null for out of bounds index', () => {
      const str = 'hello';
      expect(ControlCharacterParser.parseFromString(str, 5)).toBeNull();
      expect(ControlCharacterParser.parseFromString(str, 10)).toBeNull();
      expect(ControlCharacterParser.parseFromString(str, -1)).toBeNull();
    });

    it('should return null for empty string', () => {
      expect(ControlCharacterParser.parseFromString('')).toBeNull();
      expect(ControlCharacterParser.parseFromString('', 0)).toBeNull();
    });

    it('should return null for non-control characters', () => {
      const str = 'Hello World';
      expect(ControlCharacterParser.parseFromString(str, 0)).toBeNull(); // 'H'
      expect(ControlCharacterParser.parseFromString(str, 5)).toBeNull(); // ' ' (space)
      expect(ControlCharacterParser.parseFromString(str, 6)).toBeNull(); // 'W'
    });

    it('should handle strings with mixed control and regular characters', () => {
      const str = 'A\x09B\x0dC'; // A, Tab, B, Enter, C

      expect(ControlCharacterParser.parseFromString(str, 0)).toBeNull(); // 'A'

      const tab = ControlCharacterParser.parseFromString(str, 1);
      expect(tab?.name).toBe('tab');

      expect(ControlCharacterParser.parseFromString(str, 2)).toBeNull(); // 'B'

      const enter = ControlCharacterParser.parseFromString(str, 3);
      expect(enter?.name).toBe('return');

      expect(ControlCharacterParser.parseFromString(str, 4)).toBeNull(); // 'C'
    });

    it('should use default index when not specified', () => {
      const str = '\x1bhello'; // Escape followed by text
      const withoutIndex = ControlCharacterParser.parseFromString(str);
      const withZeroIndex = ControlCharacterParser.parseFromString(str, 0);

      expect(withoutIndex).toEqual(withZeroIndex);
      expect(withoutIndex?.name).toBe('escape');
    });
  });

  describe('isSpecialKey', () => {
    it('should return true for special keys', () => {
      expect(ControlCharacterParser.isSpecialKey('backspace')).toBe(true);
      expect(ControlCharacterParser.isSpecialKey('tab')).toBe(true);
      expect(ControlCharacterParser.isSpecialKey('enter')).toBe(true);
      expect(ControlCharacterParser.isSpecialKey('escape')).toBe(true);
      expect(ControlCharacterParser.isSpecialKey('delete')).toBe(true);
    });

    it('should return false for non-special keys', () => {
      expect(ControlCharacterParser.isSpecialKey('ctrl+a')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('ctrl+c')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('a')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('space')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('shift')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('alt')).toBe(false);
    });

    it('should be case sensitive', () => {
      expect(ControlCharacterParser.isSpecialKey('Tab')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('ENTER')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('Escape')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('DELETE')).toBe(false);
    });

    it('should handle empty string and edge cases', () => {
      expect(ControlCharacterParser.isSpecialKey('')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey(' tab')).toBe(false);
      expect(ControlCharacterParser.isSpecialKey('tab ')).toBe(false);
    });
  });

  describe('formatKeyName', () => {
    it('should return name when it exists and is not empty', () => {
      const controlWithName: ControlCharacter = {
        key: 'ctrl+c',
        char: '\x03',
        ctrl: true,
        name: 'break'
      };

      expect(ControlCharacterParser.formatKeyName(controlWithName)).toBe('break');
    });

    it('should return key when name does not exist', () => {
      const controlWithoutName: ControlCharacter = {
        key: 'ctrl+a',
        char: '\x01',
        ctrl: true
      };

      expect(ControlCharacterParser.formatKeyName(controlWithoutName)).toBe('ctrl+a');
    });

    it('should return key when name is empty string', () => {
      const controlWithEmptyName: ControlCharacter = {
        key: 'ctrl+b',
        char: '\x02',
        ctrl: true,
        name: ''
      };

      expect(ControlCharacterParser.formatKeyName(controlWithEmptyName)).toBe('ctrl+b');
    });

    it('should return key when name is null', () => {
      const controlWithNullName: ControlCharacter = {
        key: 'ctrl+d',
        char: '\x04',
        ctrl: true,
        name: undefined
      };

      expect(ControlCharacterParser.formatKeyName(controlWithNullName)).toBe('ctrl+d');
    });

    it('should work with special keys that have names', () => {
      const tab: ControlCharacter = {
        key: 'tab',
        char: '\x09',
        ctrl: false,
        name: 'tab'
      };

      const escape: ControlCharacter = {
        key: 'escape',
        char: '\x1b',
        ctrl: false,
        name: 'escape'
      };

      expect(ControlCharacterParser.formatKeyName(tab)).toBe('tab');
      expect(ControlCharacterParser.formatKeyName(escape)).toBe('escape');
    });

    it('should handle whitespace-only names', () => {
      const controlWithWhitespaceName: ControlCharacter = {
        key: 'ctrl+e',
        char: '\x05',
        ctrl: true,
        name: '   '
      };

      // Whitespace is not considered empty, so should return the name
      expect(ControlCharacterParser.formatKeyName(controlWithWhitespaceName)).toBe('   ');
    });
  });

  describe('integration tests', () => {
    it('should work together for complete workflow', () => {
      const testString = 'Hello\x03\x09World\x1b';

      // Check each character
      for (let i = 0; i < testString.length; i++) {
        const charCode = testString.charCodeAt(i);
        const isControl = ControlCharacterParser.isControlCharacter(charCode);
        const parsed = ControlCharacterParser.parseFromString(testString, i);

        if (isControl) {
          expect(parsed).not.toBeNull();
          const formatted = ControlCharacterParser.formatKeyName(parsed!);
          expect(typeof formatted).toBe('string');
          expect(formatted.length).toBeGreaterThan(0);
        } else {
          expect(parsed).toBeNull();
        }
      }
    });

    it('should handle all control characters consistently', () => {
      const allChars = ControlCharacterParser.getAllControlCharacters();

      allChars.forEach(expectedChar => {
        const charCode = expectedChar.char.charCodeAt(0);

        // Should be recognized as control character
        expect(ControlCharacterParser.isControlCharacter(charCode)).toBe(true);

        // Should parse correctly
        const parsed = ControlCharacterParser.parse(charCode);
        expect(parsed).toEqual(expectedChar);

        // Name should be consistent
        const name = ControlCharacterParser.getControlCharacterName(charCode);
        expect(name).toBe(expectedChar.name);

        // Formatting should work
        const formatted = ControlCharacterParser.formatKeyName(expectedChar);
        expect(typeof formatted).toBe('string');
        expect(formatted.length).toBeGreaterThan(0);

        // Special key detection should be consistent
        const isSpecial = ControlCharacterParser.isSpecialKey(expectedChar.key);
        const specialKeys = ['backspace', 'tab', 'enter', 'escape', 'delete'];
        expect(isSpecial).toBe(specialKeys.includes(expectedChar.key));
      });
    });
  });
});
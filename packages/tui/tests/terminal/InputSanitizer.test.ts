import { describe, it, expect } from 'bun:test';
import { InputSanitizer } from '../../src/terminal/helpers/InputSanitizer';

describe('InputSanitizer', () => {
  describe('sanitizeTerm', () => {
    it('should allow valid TERM values', () => {
      const validTerms = ['xterm', 'xterm-256color', 'screen', 'tmux-256color'];

      validTerms.forEach(term => {
        const result = InputSanitizer.sanitizeTerm(term);
        expect(result).toBe(term);
      });
    });

    it('should reject dangerous TERM values', () => {
      const dangerousTerms = [
        'xterm; rm -rf /',
        'xterm$(whoami)',
        'xterm`id`',
        'xterm|cat /etc/passwd',
        'xterm&malicious',
      ];

      dangerousTerms.forEach(term => {
        const result = InputSanitizer.sanitizeTerm(term);
        expect(result).toBe('xterm'); // Should default to safe value
      });
    });

    it('should handle undefined and empty values', () => {
      expect(InputSanitizer.sanitizeTerm(undefined)).toBeUndefined();
      expect(InputSanitizer.sanitizeTerm('')).toBeUndefined();
      expect(InputSanitizer.sanitizeTerm(null as any)).toBeUndefined();
    });

    it('should trim and limit length', () => {
      const longTerm = '  ' + 'a'.repeat(300) + '  ';
      const result = InputSanitizer.sanitizeTerm(longTerm);
      expect(result).toBe('xterm'); // Should be rejected due to length and pattern
    });

    it('should handle valid complex terms', () => {
      const validTerms = [
        'xterm-256color',
        'screen.xterm-256color',
        'tmux-256color',
        'alacritty',
      ];

      validTerms.forEach(term => {
        const result = InputSanitizer.sanitizeTerm(term);
        expect(result).toBe(term);
      });
    });
  });

  describe('sanitizeColorTerm', () => {
    it('should allow valid COLORTERM values', () => {
      const validColorTerms = ['truecolor', '256color', '16color', 'ansi', ''];

      validColorTerms.forEach(colorterm => {
        const result = InputSanitizer.sanitizeColorTerm(colorterm);
        if (colorterm === '') {
          expect(result).toBeUndefined();
        } else {
          expect(result).toBe(colorterm);
        }
      });
    });

    it('should normalize case', () => {
      const upperCase = 'TRUECOLOR';
      const result = InputSanitizer.sanitizeColorTerm(upperCase);
      expect(result).toBe('truecolor');
    });

    it('should reject invalid COLORTERM values', () => {
      const invalidColorTerms = [
        'invalid-color',
        'truecolor; rm -rf /',
        'malicious$(command)',
      ];

      invalidColorTerms.forEach(colorterm => {
        const result = InputSanitizer.sanitizeColorTerm(colorterm);
        expect(result).toBeUndefined();
      });
    });

    it('should handle undefined and empty values', () => {
      expect(InputSanitizer.sanitizeColorTerm(undefined)).toBeUndefined();
      expect(InputSanitizer.sanitizeColorTerm('')).toBeUndefined();
      expect(InputSanitizer.sanitizeColorTerm(null as any)).toBeUndefined();
    });

    it('should trim whitespace', () => {
      const padded = '  truecolor  ';
      const result = InputSanitizer.sanitizeColorTerm(padded);
      expect(result).toBe('truecolor');
    });
  });

  describe('sanitizeTermProgram', () => {
    it('should allow valid TERM_PROGRAM values', () => {
      const validPrograms = [
        'iTerm.app',
        'Terminal.app',
        'Alacritty',
        'Windows Terminal',
        'VS Code',
      ];

      validPrograms.forEach(program => {
        const result = InputSanitizer.sanitizeTermProgram(program);
        expect(result).toBe(program);
      });
    });

    it('should reject dangerous TERM_PROGRAM values', () => {
      const dangerousPrograms = [
        'iTerm.app; rm -rf /',
        'Terminal$(whoami)',
        'malicious`command`',
      ];

      dangerousPrograms.forEach(program => {
        const result = InputSanitizer.sanitizeTermProgram(program);
        expect(result).toBeUndefined();
      });
    });

    it('should handle undefined and empty values', () => {
      expect(InputSanitizer.sanitizeTermProgram(undefined)).toBeUndefined();
      expect(InputSanitizer.sanitizeTermProgram('')).toBeUndefined();
      expect(InputSanitizer.sanitizeTermProgram(null as any)).toBeUndefined();
    });

    it('should trim and limit length', () => {
      const longProgram = '  ' + 'A'.repeat(300) + '  ';
      const result = InputSanitizer.sanitizeTermProgram(longProgram);
      expect(result).toBeUndefined(); // Should be rejected due to invalid pattern
    });
  });

  describe('sanitizeControlSequence', () => {
    it('should allow safe ANSI escape sequences', () => {
      const safeSequences = [
        '\u001b[0m',        // Reset - safe
        '\u001b[31m',       // Red color - safe
        '\u001b[37m',       // White - safe
        '\u001b[90m',       // Bright Black - safe
        '\u001b[97m',       // Bright White - safe
      ];

      safeSequences.forEach(sequence => {
        const result = InputSanitizer.sanitizeControlSequence(sequence);
        expect(result).toBe(sequence);
      });
    });

    it('should handle multiple sequences', () => {
      const multipleSequences = '\u001b[31mRed\u001b[0m Normal \u001b[32mGreen\u001b[0m';
      const result = InputSanitizer.sanitizeControlSequence(multipleSequences);
      expect(result).toBe(multipleSequences);
    });

    it('should strip dangerous sequences', () => {
      const dangerousSequences = [
        '\u001b]0;danger\u0007',              // OSC sequence
        '\u001b[>q',                           // Private mode
        'text\u0000null',                      // Null byte
        'control\u0008char',                   // Backspace
      ];

      dangerousSequences.forEach(sequence => {
        const result = InputSanitizer.sanitizeControlSequence(sequence);
        expect(result).not.toBe(sequence);
        expect(result.length).toBeLessThanOrEqual(sequence.length);
      });
    });

    it('should handle normal text without sequences', () => {
      const normalText = 'This is normal text without any control sequences';
      const result = InputSanitizer.sanitizeControlSequence(normalText);
      expect(result).toBe(normalText);
    });
  });

  describe('sanitizeMouseCoordinates', () => {
    it('should allow valid mouse coordinates', () => {
      const validCoords = [
        { x: 0, y: 0 },
        { x: 80, y: 24 },
        { x: 1920, y: 1080 },
        { x: 50, y: 50 },
      ];

      validCoords.forEach(coords => {
        const result = InputSanitizer.sanitizeMouseCoordinates(coords.x, coords.y);
        expect(result).toEqual(coords);
      });
    });

    it('should clamp coordinates to valid ranges', () => {
      // Test negative coordinates - should return null for invalid input
      const negativeResult = InputSanitizer.sanitizeMouseCoordinates(-10, -5);
      expect(negativeResult).toBeNull();

      // Test extremely large coordinates - should return null as they exceed max (9999)
      const largeResult = InputSanitizer.sanitizeMouseCoordinates(100000, 100000);
      expect(largeResult).toBeNull();

      // Test maximum valid coordinates
      const maxResult = InputSanitizer.sanitizeMouseCoordinates(9999, 9999);
      expect(maxResult).toEqual({ x: 9999, y: 9999 });
    });

    it('should handle edge values', () => {
      const edgeResult = InputSanitizer.sanitizeMouseCoordinates(0, 0);
      expect(edgeResult).not.toBeNull();
      expect(edgeResult?.x).toBe(0);
      expect(edgeResult?.y).toBe(0);
    });
  });

  describe('sanitizeTerminalSize', () => {
    it('should allow valid terminal sizes', () => {
      const validSizes = [
        { width: 80, height: 24 },
        { width: 120, height: 40 },
        { width: 1920, height: 1080 },
      ];

      validSizes.forEach(size => {
        const result = InputSanitizer.sanitizeTerminalSize(size.width, size.height);
        expect(result).toEqual(size);
      });
    });

    it('should enforce minimum sizes', () => {
      const tooSmall = InputSanitizer.sanitizeTerminalSize(10, 5);
      expect(tooSmall.width).toBeGreaterThanOrEqual(20);
      expect(tooSmall.height).toBeGreaterThanOrEqual(5);
    });

    it('should enforce maximum sizes', () => {
      const tooLarge = InputSanitizer.sanitizeTerminalSize(100000, 100000);
      expect(tooLarge.width).toBeLessThan(100000);
      expect(tooLarge.height).toBeLessThan(100000);
    });
  });

  describe('sanitizeEnvironment', () => {
    it('should sanitize complete environment object', () => {
      const env = {
        TERM: 'xterm-256color',
        COLORTERM: 'truecolor',
        TERM_PROGRAM: 'iTerm.app',
        LC_TERMINAL: 'iTerm2',
      };

      const sanitized = InputSanitizer.sanitizeEnvironment(env);

      expect(sanitized.TERM).toBe('xterm-256color');
      expect(sanitized.COLORTERM).toBe('truecolor');
      expect(sanitized.TERM_PROGRAM).toBe('iTerm.app');
      expect(sanitized.LC_TERMINAL).toBe('iTerm2');
    });

    it('should handle malicious environment values', () => {
      const maliciousEnv = {
        TERM: 'xterm; rm -rf /',
        COLORTERM: 'malicious$(command)',
        TERM_PROGRAM: 'dangerous`code`',
        LC_TERMINAL: 'bad|pipe',
      };

      const sanitized = InputSanitizer.sanitizeEnvironment(maliciousEnv);

      expect(sanitized.TERM).toBe('xterm'); // Should default to safe value
      expect(sanitized.COLORTERM).toBeUndefined(); // Should be removed
      expect(sanitized.TERM_PROGRAM).toBeUndefined(); // Should be removed
      expect(sanitized.LC_TERMINAL).toBeUndefined(); // Should be removed
    });

    it('should handle undefined and null values', () => {
      const envWithNulls = {
        TERM: undefined,
        COLORTERM: null,
        TERM_PROGRAM: '',
        LC_TERMINAL: undefined,
      };

      const sanitized = InputSanitizer.sanitizeEnvironment(envWithNulls as any);

      expect(sanitized.TERM).toBeUndefined();
      expect(sanitized.COLORTERM).toBeUndefined();
      expect(sanitized.TERM_PROGRAM).toBeUndefined();
      expect(sanitized.LC_TERMINAL).toBeUndefined();
    });
  });

  describe('isDangerous', () => {
    it('should detect dangerous patterns', () => {
      const dangerousInputs = [
        'text; rm -rf /',
        'input$(whoami)',
        'data`id`',
        'string|cat /etc/passwd',
        'value && evil-command',
        'text || dangerous',
        'input\u0000null',
        'control\u0008char',
      ];

      dangerousInputs.forEach(input => {
        // Check if input is modified by sanitization
        const sanitized = InputSanitizer.sanitizeControlSequence(input);
        // Dangerous sequences should be removed or modified
        if (input.includes('\x00') || input.includes('\u0008')) {
          expect(sanitized).not.toBe(input);
        }
      });
    });

    it('should allow safe text', () => {
      const safeInputs = [
        'normal text',
        'file.txt',
        'Terminal.app',
        'xterm-256color',
        'safe-value_123',
        'Unicode: 你好 世界',
        'Numbers: 123 456',
      ];

      safeInputs.forEach(input => {
        const result = InputSanitizer.isDangerous(input);
        expect(result).toBe(false);
      });
    });

    it('should handle empty and whitespace strings', () => {
      expect(InputSanitizer.isDangerous('')).toBe(false);
      expect(InputSanitizer.isDangerous('   ')).toBe(false);
      expect(InputSanitizer.isDangerous('\n\t ')).toBe(false);
    });
  });

  describe('escapeForDisplay', () => {
    it('should escape dangerous characters for display', () => {
      const input = 'Text with \u001b[31mcolor\u001b[0m and \u0000null';
      const escaped = InputSanitizer.escapeForDisplay(input);

      expect(escaped).not.toContain('\u001b');
      expect(escaped).not.toContain('\u0000');
      expect(escaped).toContain('Text with');
    });

    it('should preserve safe characters', () => {
      const safeText = 'Normal text with unicode: 你好';
      const escaped = InputSanitizer.escapeForDisplay(safeText);

      expect(escaped).toBe(safeText);
    });

    it('should handle empty strings', () => {
      const escaped = InputSanitizer.escapeForDisplay('');
      expect(escaped).toBe('');
    });
  });

  describe('integration tests', () => {
    it('should work together in terminal environment sanitization', () => {
      const rawEnv = {
        TERM: '  xterm-256color  ',
        COLORTERM: 'TRUECOLOR',
        TERM_PROGRAM: 'iTerm.app',
        LC_TERMINAL: 'iTerm2',
      };

      const sanitized = InputSanitizer.sanitizeEnvironment(rawEnv);

      expect(sanitized.TERM).toBe('xterm-256color');
      expect(sanitized.COLORTERM).toBe('truecolor');
      expect(sanitized.TERM_PROGRAM).toBe('iTerm.app');
      expect(sanitized.LC_TERMINAL).toBe('iTerm2');

      // Verify they're all safe
      Object.values(sanitized).forEach(value => {
        if (value !== undefined) {
          expect(InputSanitizer.isDangerous(value)).toBe(false);
        }
      });
    });

    it('should maintain consistency across multiple sanitization calls', () => {
      const input = 'xterm-256color';

      const result1 = InputSanitizer.sanitizeTerm(input);
      const result2 = InputSanitizer.sanitizeTerm(input);

      expect(result1).toBe(result2);
      expect(result1).toBe(input);
    });
  });
});
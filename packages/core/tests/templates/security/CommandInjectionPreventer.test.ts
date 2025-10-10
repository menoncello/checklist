/**
 * Tests for CommandInjectionPreventer
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { CommandInjectionPreventer } from '../../../src/templates/security/CommandInjectionPreventer';

describe('CommandInjectionPreventer', () => {
  let preventer: CommandInjectionPreventer;

  beforeEach(() => {
    preventer = new CommandInjectionPreventer();
  });

  describe('variable sanitization', () => {
    test('should remove semicolons', () => {
      const result = preventer.sanitizeVariable('value; rm -rf /');

      expect(result).not.toContain(';');
      expect(result).toBe('value rm -rf /');
    });

    test('should remove pipes', () => {
      const result = preventer.sanitizeVariable('value | cat');

      expect(result).not.toContain('|');
    });

    test('should remove ampersands', () => {
      const result = preventer.sanitizeVariable('value & background');

      expect(result).not.toContain('&');
    });

    test('should remove dollar signs', () => {
      const result = preventer.sanitizeVariable('value $VAR');

      expect(result).not.toContain('$');
    });

    test('should remove backticks', () => {
      const result = preventer.sanitizeVariable('value `whoami`');

      expect(result).not.toContain('`');
    });

    test('should remove parentheses', () => {
      const result = preventer.sanitizeVariable('value $(cmd)');

      expect(result).not.toContain('(');
      expect(result).not.toContain(')');
    });

    test('should remove braces', () => {
      const result = preventer.sanitizeVariable('value ${var}');

      expect(result).not.toContain('{');
      expect(result).not.toContain('}');
    });

    test('should remove angle brackets', () => {
      const result = preventer.sanitizeVariable('value > file');

      expect(result).not.toContain('>');
      expect(result).not.toContain('<');
    });

    test('should remove backslashes', () => {
      const result = preventer.sanitizeVariable('value\\escape');

      expect(result).not.toContain('\\');
    });

    test('should remove newlines', () => {
      const result = preventer.sanitizeVariable('value\nline2');

      expect(result).not.toContain('\n');
    });

    test('should allow safe characters', () => {
      const safe = 'Hello World 123';
      const result = preventer.sanitizeVariable(safe);

      expect(result).toBe(safe);
    });
  });

  describe('command chaining detection', () => {
    test('should detect && chaining', () => {
      const result = preventer.detectCommandChaining('ls && rm file');

      expect(result).toBe(true);
    });

    test('should detect || chaining', () => {
      const result = preventer.detectCommandChaining('ls || echo fail');

      expect(result).toBe(true);
    });

    test('should detect ; chaining', () => {
      const result = preventer.detectCommandChaining('ls ; pwd');

      expect(result).toBe(true);
    });

    test('should detect | piping', () => {
      const result = preventer.detectCommandChaining('ls | grep file');

      expect(result).toBe(true);
    });

    test('should not detect safe commands', () => {
      const result = preventer.detectCommandChaining('echo "hello world"');

      expect(result).toBe(false);
    });
  });

  describe('redirection detection', () => {
    test('should detect > redirection', () => {
      const result = preventer.detectRedirection('echo test > file');

      expect(result).toBe(true);
    });

    test('should detect >> append', () => {
      const result = preventer.detectRedirection('echo test >> file');

      expect(result).toBe(true);
    });

    test('should detect < input', () => {
      const result = preventer.detectRedirection('cmd < input');

      expect(result).toBe(true);
    });

    test('should detect 2>&1 stderr redirect', () => {
      const result = preventer.detectRedirection('cmd 2>&1');

      expect(result).toBe(true);
    });

    test('should detect &> redirect', () => {
      const result = preventer.detectRedirection('cmd &> output');

      expect(result).toBe(true);
    });

    test('should not detect safe commands', () => {
      const result = preventer.detectRedirection('echo "test"');

      expect(result).toBe(false);
    });
  });

  describe('process substitution detection', () => {
    test('should detect $(command) substitution', () => {
      const result = preventer.detectProcessSubstitution('echo $(whoami)');

      expect(result).toBe(true);
    });

    test('should detect `command` substitution', () => {
      const result = preventer.detectProcessSubstitution('echo `whoami`');

      expect(result).toBe(true);
    });

    test('should detect ${var} substitution', () => {
      const result = preventer.detectProcessSubstitution('echo ${HOME}');

      expect(result).toBe(true);
    });

    test('should not detect safe commands', () => {
      const result = preventer.detectProcessSubstitution('echo test');

      expect(result).toBe(false);
    });
  });

  describe('comprehensive injection detection', () => {
    test('should detect multiple injection patterns', () => {
      const command = 'echo $(whoami) && rm file > /dev/null';
      const result = preventer.detectInjection(command);

      expect(result.detected).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(0);
      expect(result.patterns).toContain('Process substitution');
      expect(result.patterns).toContain('Command chaining');
      expect(result.patterns).toContain('Redirection');
    });

    test('should not detect injection in safe commands', () => {
      const result = preventer.detectInjection('echo "hello world"');

      expect(result.detected).toBe(false);
      expect(result.patterns.length).toBe(0);
    });
  });

  describe('safe interpolation', () => {
    test('should safely interpolate variables', () => {
      const template = 'echo ${name}';
      const variables = { name: 'test; rm -rf /' };
      const result = preventer.safeInterpolate(template, variables);

      expect(result).not.toContain(';');
      expect(result).toContain('test rm -rf /');
    });

    test('should interpolate multiple variables', () => {
      const template = 'echo ${var1} and ${var2}';
      const variables = {
        var1: 'value1',
        var2: 'value2 | danger',
      };
      const result = preventer.safeInterpolate(template, variables);

      expect(result).toContain('value1');
      expect(result).not.toContain('|');
    });

    test('should handle missing variables', () => {
      const template = 'echo ${missing}';
      const variables = {};
      const result = preventer.safeInterpolate(template, variables);

      expect(result).toBe(template);
    });
  });

  describe('command validation', () => {
    test('should validate and flag dangerous commands', () => {
      const dangerous = 'ls && rm file';
      const result = preventer.validateCommand(dangerous);

      expect(result.detected).toBe(true);
      expect(result.patterns.length).toBeGreaterThan(0);
    });

    test('should validate and approve safe commands', () => {
      const safe = 'echo "test"';
      const result = preventer.validateCommand(safe);

      expect(result.detected).toBe(false);
      expect(result.patterns.length).toBe(0);
    });
  });

  describe('command processing', () => {
    test('should process safe command', () => {
      const template = 'echo ${msg}';
      const variables = { msg: 'hello' };
      const result = preventer.processCommand(template, variables);

      expect(result.safe).toBe(true);
      expect(result.issues.length).toBe(0);
      expect(result.command).toContain('hello');
    });

    test('should flag dangerous command', () => {
      const template = 'echo ${msg} && rm file';
      const variables = { msg: 'test' };
      const result = preventer.processCommand(template, variables);

      expect(result.safe).toBe(false);
      expect(result.issues.length).toBeGreaterThan(0);
    });

    test('should sanitize dangerous variable values', () => {
      const template = 'echo ${msg}';
      const variables = { msg: 'test; rm -rf /' };
      const result = preventer.processCommand(template, variables);

      expect(result.command).not.toContain(';');
    });
  });

  describe('strict mode', () => {
    test('should apply strict sanitization', () => {
      const strict = new CommandInjectionPreventer({ strictMode: true });
      const result = strict.sanitizeVariable('test@#$%^');

      // Strict mode only allows alphanumeric and safe punctuation
      expect(result).toBe('test');
    });

    test('should allow safe punctuation in strict mode', () => {
      const strict = new CommandInjectionPreventer({ strictMode: true });
      const result = strict.sanitizeVariable('test-file_name.txt');

      expect(result).toBe('test-file_name.txt');
    });
  });

  describe('configuration', () => {
    test('should disable sanitization when configured', () => {
      const disabled = new CommandInjectionPreventer({
        enableSanitization: false,
      });
      const result = disabled.sanitizeVariable('test; dangerous');

      expect(result).toBe('test; dangerous');
    });

    test('should disable detection when configured', () => {
      const disabled = new CommandInjectionPreventer({
        enableDetection: false,
      });
      const result = disabled.detectCommandChaining('ls && rm');

      expect(result).toBe(false);
    });

    test('should get configuration', () => {
      const config = preventer.getConfig();

      expect(config.enableSanitization).toBe(true);
      expect(config.enableDetection).toBe(true);
      expect(config.strictMode).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle empty string', () => {
      const result = preventer.sanitizeVariable('');

      expect(result).toBe('');
    });

    test('should handle very long strings', () => {
      const long = 'a'.repeat(10000) + '; rm -rf /';
      const result = preventer.sanitizeVariable(long);

      expect(result).not.toContain(';');
      expect(result.length).toBeLessThan(long.length);
    });

    test('should handle unicode characters', () => {
      const unicode = 'test 你好 世界';
      const result = preventer.sanitizeVariable(unicode);

      expect(result).toContain('你好');
    });

    test('should handle special shell characters', () => {
      const special = 'test!@#$%^&*()';
      const result = preventer.sanitizeVariable(special);

      // Should remove dangerous ones but keep safe ones
      expect(result).not.toContain('&');
      expect(result).not.toContain('(');
    });
  });
});

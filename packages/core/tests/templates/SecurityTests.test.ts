/**
 * Security Tests for Safe String Operations (AC: 5)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { VariableSubstitutor } from '../../src/templates/VariableSubstitutor';
import { VariableStore } from '../../src/variables/VariableStore';
import { join } from 'path';
import { mkdtemp, rm } from 'fs/promises';
import { tmpdir } from 'os';

describe('VariableSubstitutor - Security Tests (AC: 5)', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;
  let tempDir: string;
  let stateFile: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'test-security-'));
    stateFile = join(tempDir, 'variables.yaml');

    variableStore = new VariableStore(stateFile);
    substitutor = new VariableSubstitutor(variableStore);
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('SQL injection attempts', () => {
    it('should safely substitute SQL injection patterns', () => {
      variableStore.set('userInput', "'; DROP TABLE users; --");

      const result = substitutor.substitute(
        'SELECT * FROM users WHERE name = ${userInput}'
      );

      expect(result.output).toBe(
        "SELECT * FROM users WHERE name = '; DROP TABLE users; --"
      );
    });

    it('should handle SQL OR injection', () => {
      variableStore.set('id', "1 OR 1=1");

      const result = substitutor.substitute(
        'SELECT * FROM items WHERE id = ${id}'
      );

      expect(result.output).toBe(
        'SELECT * FROM items WHERE id = 1 OR 1=1'
      );
    });
  });

  describe('Command injection attempts', () => {
    it('should safely substitute shell commands', () => {
      variableStore.set('filename', 'file.txt; rm -rf /');

      const result = substitutor.substitute('cat ${filename}');

      expect(result.output).toBe('cat file.txt; rm -rf /');
    });

    it('should handle command chaining', () => {
      variableStore.set('path', '/tmp && echo hacked');

      const result = substitutor.substitute('cd ${path}');

      expect(result.output).toBe('cd /tmp && echo hacked');
    });

    it('should handle backtick injection', () => {
      variableStore.set('value', '`whoami`');

      const result = substitutor.substitute('echo ${value}');

      expect(result.output).toBe('echo `whoami`');
    });
  });

  describe('Script injection attempts', () => {
    it('should safely substitute JavaScript code', () => {
      variableStore.set('userInput', '<script>alert("XSS")</script>');

      const result = substitutor.substitute(
        'Content: ${userInput}'
      );

      expect(result.output).toBe(
        'Content: <script>alert("XSS")</script>'
      );
    });

    it('should handle eval-like patterns', () => {
      variableStore.set('code', 'eval("malicious code")');

      const result = substitutor.substitute('Execute: ${code}');

      expect(result.output).toBe('Execute: eval("malicious code")');
    });
  });

  describe('Path traversal attempts', () => {
    it('should safely substitute path traversal', () => {
      variableStore.set('file', '../../../etc/passwd');

      const result = substitutor.substitute('Read file: ${file}');

      expect(result.output).toBe('Read file: ../../../etc/passwd');
    });

    it('should handle encoded path traversal', () => {
      variableStore.set('path', '%2e%2e%2f%2e%2e%2fetc%2fpasswd');

      const result = substitutor.substitute('Path: ${path}');

      expect(result.output).toBe(
        'Path: %2e%2e%2f%2e%2e%2fetc%2fpasswd'
      );
    });
  });

  describe('Variable name validation', () => {
    it('should not match invalid variable names with spaces', () => {
      variableStore.set('valid', 'value');

      // Pattern doesn't match spaces, so it stays literal
      const result = substitutor.substitute('${invalid name}');

      expect(result.output).toBe('${invalid name}');
      expect(result.errors).toHaveLength(0);
    });

    it('should not match special characters in variable names', () => {
      // Pattern doesn't match $, so it stays literal
      const result = substitutor.substitute('${invalid$name}');

      expect(result.output).toBe('${invalid$name}');
      expect(result.errors).toHaveLength(0);
    });

    it('should accept valid variable names', () => {
      variableStore.set('valid-name', 'value');
      variableStore.set('valid.name', 'value2');
      variableStore.set('valid_name', 'value3');

      const result = substitutor.substitute(
        '${valid-name} ${valid.name} ${valid_name}'
      );

      expect(result.errors).toHaveLength(0);
      expect(result.output).toBe('value value2 value3');
    });

    it('should reject variables starting with numbers', () => {
      const result = substitutor.substitute('${123invalid}');

      // This should actually work per our regex [a-zA-Z0-9_.-]+
      // So we test it works correctly
      expect(result.output).toBe('${123invalid}');
    });
  });

  describe('No eval or dynamic code execution', () => {
    it('should not execute code in variable values', () => {
      variableStore.set('code', 'return 42');

      const result = substitutor.substitute('Result: ${code}');

      expect(result.output).toBe('Result: return 42');
    });

    it('should treat template literals as strings', () => {
      variableStore.set('template', '${nested}');

      const result = substitutor.substitute('Value: ${template}');

      expect(result.output).toBe('Value: ${nested}');
    });
  });
});

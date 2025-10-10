/**
 * EnvironmentVariableResolver Tests
 * Tests for secure environment variable access
 */

import { describe, expect, it, beforeEach } from 'bun:test';
import { EnvironmentVariableResolver } from '../../src/variables/EnvironmentVariableResolver';
import { VariableSecurityError } from '../../src/variables/errors';

describe('EnvironmentVariableResolver', () => {
  let resolver: EnvironmentVariableResolver;

  beforeEach(() => {
    resolver = new EnvironmentVariableResolver();
  });

  describe('Allowlist Enforcement (SECURITY CRITICAL)', () => {
    it('should allow access to default allowed variables', () => {
      // Set test environment variable
      Bun.env.HOME = '/home/test';

      const result = resolver.resolve('HOME');

      expect(result).toBe('/home/test');
    });

    it('should block access to AWS_SECRET_ACCESS_KEY', () => {
      Bun.env.AWS_SECRET_ACCESS_KEY = 'secret-key';

      expect(() => resolver.resolve('AWS_SECRET_ACCESS_KEY')).toThrow(
        VariableSecurityError
      );
    });

    it('should block access to DATABASE_PASSWORD', () => {
      Bun.env.DATABASE_PASSWORD = 'db-password';

      expect(() => resolver.resolve('DATABASE_PASSWORD')).toThrow(
        VariableSecurityError
      );
    });

    it('should block access to GITHUB_TOKEN', () => {
      Bun.env.GITHUB_TOKEN = 'github-token';

      expect(() => resolver.resolve('GITHUB_TOKEN')).toThrow(
        VariableSecurityError
      );
    });

    it('should block access to API_KEY', () => {
      Bun.env.API_KEY = 'api-key';

      expect(() => resolver.resolve('API_KEY')).toThrow(
        VariableSecurityError
      );
    });

    it('should throw VariableSecurityError with proper message', () => {
      expect(() => resolver.resolve('AWS_SECRET_ACCESS_KEY')).toThrow(
        "Security violation: Environment variable 'AWS_SECRET_ACCESS_KEY' is not in the allowed list"
      );
    });

    it('should include variable name in error context', () => {
      try {
        resolver.resolve('DANGEROUS_VAR');
      } catch (error) {
        expect(error).toBeInstanceOf(VariableSecurityError);
        const secError = error as VariableSecurityError;
        expect(secError.context?.variable).toBe('DANGEROUS_VAR');
      }
    });
  });

  describe('$ENV: Prefix Parsing', () => {
    it('should handle $ENV: prefix correctly', () => {
      Bun.env.HOME = '/home/test';

      const result = resolver.resolve('$ENV:HOME');

      expect(result).toBe('/home/test');
    });

    it('should handle variable without $ENV: prefix', () => {
      Bun.env.USER = 'testuser';

      const result = resolver.resolve('USER');

      expect(result).toBe('testuser');
    });

    it('should enforce allowlist even with $ENV: prefix', () => {
      Bun.env.SECRET = 'secret-value';

      expect(() => resolver.resolve('$ENV:SECRET')).toThrow(
        VariableSecurityError
      );
    });
  });

  describe('Type Conversion', () => {
    it('should convert numeric string to number', () => {
      Bun.env.PORT = '3000';
      resolver.allow('PORT');

      const result = resolver.resolve('PORT');

      expect(result).toBe(3000);
      expect(typeof result).toBe('number');
    });

    it('should convert "true" to boolean true', () => {
      Bun.env.ENABLED = 'true';
      resolver.allow('ENABLED');

      const result = resolver.resolve('ENABLED');

      expect(result).toBe(true);
      expect(typeof result).toBe('boolean');
    });

    it('should convert "false" to boolean false', () => {
      Bun.env.DISABLED = 'false';
      resolver.allow('DISABLED');

      const result = resolver.resolve('DISABLED');

      expect(result).toBe(false);
      expect(typeof result).toBe('boolean');
    });

    it('should handle "TRUE" (uppercase) as boolean', () => {
      Bun.env.FLAG = 'TRUE';
      resolver.allow('FLAG');

      const result = resolver.resolve('FLAG');

      expect(result).toBe(true);
    });

    it('should return string for non-numeric, non-boolean values', () => {
      Bun.env.HOME = '/home/test';

      const result = resolver.resolve('HOME');

      expect(result).toBe('/home/test');
      expect(typeof result).toBe('string');
    });

    it('should return string for empty value', () => {
      Bun.env.EMPTY = '';
      resolver.allow('EMPTY');

      const result = resolver.resolve('EMPTY');

      expect(result).toBe('');
      expect(typeof result).toBe('string');
    });
  });

  describe('Default Value Fallback', () => {
    it('should return default value when env var not found', () => {
      delete Bun.env.HOME;

      const result = resolver.resolve('HOME', 'default-value');

      expect(result).toBe('default-value');
    });

    it('should return undefined when env var not found and no default', () => {
      delete Bun.env.HOME;

      const result = resolver.resolve('HOME');

      expect(result).toBeUndefined();
    });

    it('should use env var value over default when available', () => {
      Bun.env.HOME = '/home/test';

      const result = resolver.resolve('HOME', '/default/home');

      expect(result).toBe('/home/test');
    });

    it('should support number as default value', () => {
      delete Bun.env.HOME;

      const result = resolver.resolve('HOME', 8080);

      expect(result).toBe(8080);
    });

    it('should support boolean as default value', () => {
      delete Bun.env.USER;

      const result = resolver.resolve('USER', true);

      expect(result).toBe(true);
    });
  });

  describe('isAllowed Method', () => {
    it('should return true for allowed variables', () => {
      expect(resolver.isAllowed('HOME')).toBe(true);
      expect(resolver.isAllowed('USER')).toBe(true);
      expect(resolver.isAllowed('PATH')).toBe(true);
    });

    it('should return false for blocked variables', () => {
      expect(resolver.isAllowed('AWS_SECRET_KEY')).toBe(false);
      expect(resolver.isAllowed('DATABASE_PASSWORD')).toBe(false);
    });

    it('should handle $ENV: prefix in isAllowed', () => {
      expect(resolver.isAllowed('$ENV:HOME')).toBe(true);
      expect(resolver.isAllowed('$ENV:SECRET')).toBe(false);
    });
  });

  describe('allow/disallow Methods', () => {
    it('should allow adding new variables to allowlist', () => {
      resolver.allow('CUSTOM_VAR');

      expect(resolver.isAllowed('CUSTOM_VAR')).toBe(true);
    });

    it('should resolve newly allowed variable', () => {
      Bun.env.CUSTOM_VAR = 'custom-value';
      resolver.allow('CUSTOM_VAR');

      const result = resolver.resolve('CUSTOM_VAR');

      expect(result).toBe('custom-value');
    });

    it('should disallow removing custom variables', () => {
      resolver.allow('CUSTOM_VAR');
      resolver.disallow('CUSTOM_VAR');

      expect(resolver.isAllowed('CUSTOM_VAR')).toBe(false);
    });

    it('should prevent disallowing default variables', () => {
      resolver.disallow('HOME');

      expect(resolver.isAllowed('HOME')).toBe(true);
    });

    it('should prevent disallowing USER', () => {
      resolver.disallow('USER');

      expect(resolver.isAllowed('USER')).toBe(true);
    });
  });

  describe('getAllowed Method', () => {
    it('should return all allowed variables sorted', () => {
      const allowed = resolver.getAllowed();

      expect(allowed).toContain('HOME');
      expect(allowed).toContain('USER');
      expect(allowed).toContain('PATH');
      expect(allowed.length).toBeGreaterThanOrEqual(10);

      // Verify sorted
      const sorted = [...allowed].sort();
      expect(allowed).toEqual(sorted);
    });

    it('should include custom allowed variables', () => {
      resolver.allow('CUSTOM_VAR');

      const allowed = resolver.getAllowed();

      expect(allowed).toContain('CUSTOM_VAR');
    });
  });

  describe('resolveMultiple Method', () => {
    it('should resolve multiple allowed variables', () => {
      Bun.env.HOME = '/home/test';
      Bun.env.USER = 'testuser';

      const result = resolver.resolveMultiple(['HOME', 'USER']);

      expect(result.HOME).toBe('/home/test');
      expect(result.USER).toBe('testuser');
    });

    it('should skip blocked variables without throwing', () => {
      Bun.env.HOME = '/home/test';
      Bun.env.SECRET = 'secret';

      const result = resolver.resolveMultiple(['HOME', 'SECRET']);

      expect(result.HOME).toBe('/home/test');
      expect(result.SECRET).toBeUndefined();
    });

    it('should use defaults for missing variables', () => {
      delete Bun.env.HOME;

      const result = resolver.resolveMultiple(
        ['HOME'],
        { HOME: 'default' }
      );

      expect(result.HOME).toBe('default');
    });

    it('should handle $ENV: prefix in multiple resolution', () => {
      Bun.env.HOME = '/home/test';

      const result = resolver.resolveMultiple(['$ENV:HOME']);

      expect(result.HOME).toBe('/home/test');
    });

    it('should return empty object for all blocked variables', () => {
      const result = resolver.resolveMultiple([
        'AWS_SECRET_KEY',
        'DATABASE_PASSWORD',
      ]);

      expect(Object.keys(result).length).toBe(0);
    });
  });

  describe('Constructor with Custom Allowlist', () => {
    it('should allow custom variables in constructor', () => {
      const customResolver = new EnvironmentVariableResolver(['CUSTOM_VAR']);
      Bun.env.CUSTOM_VAR = 'custom-value';

      const result = customResolver.resolve('CUSTOM_VAR');

      expect(result).toBe('custom-value');
    });

    it('should merge custom variables with defaults', () => {
      const customResolver = new EnvironmentVariableResolver(['CUSTOM_VAR']);

      expect(customResolver.isAllowed('HOME')).toBe(true);
      expect(customResolver.isAllowed('CUSTOM_VAR')).toBe(true);
    });

    it('should not allow variables not in custom or default list', () => {
      const customResolver = new EnvironmentVariableResolver(['CUSTOM_VAR']);

      expect(() => customResolver.resolve('SECRET')).toThrow(
        VariableSecurityError
      );
    });
  });

  describe('Edge Cases', () => {
    it('should handle undefined environment variable', () => {
      delete Bun.env.HOME;

      const result = resolver.resolve('HOME');

      expect(result).toBeUndefined();
    });

    it('should handle empty string environment variable', () => {
      Bun.env.EMPTY = '';
      resolver.allow('EMPTY');

      const result = resolver.resolve('EMPTY');

      expect(result).toBe('');
    });

    it('should handle whitespace-only numeric string', () => {
      Bun.env.WHITESPACE = '   ';
      resolver.allow('WHITESPACE');

      const result = resolver.resolve('WHITESPACE');

      expect(result).toBe('   ');
      expect(typeof result).toBe('string');
    });

    it('should handle "0" as number', () => {
      Bun.env.ZERO = '0';
      resolver.allow('ZERO');

      const result = resolver.resolve('ZERO');

      expect(result).toBe(0);
      expect(typeof result).toBe('number');
    });

    it('should handle negative numbers', () => {
      Bun.env.NEGATIVE = '-42';
      resolver.allow('NEGATIVE');

      const result = resolver.resolve('NEGATIVE');

      expect(result).toBe(-42);
      expect(typeof result).toBe('number');
    });

    it('should handle floating point numbers', () => {
      Bun.env.FLOAT = '3.14';
      resolver.allow('FLOAT');

      const result = resolver.resolve('FLOAT');

      expect(result).toBe(3.14);
      expect(typeof result).toBe('number');
    });
  });

  describe('All Default Allowed Variables', () => {
    it('should allow HOME', () => {
      expect(resolver.isAllowed('HOME')).toBe(true);
    });

    it('should allow USER', () => {
      expect(resolver.isAllowed('USER')).toBe(true);
    });

    it('should allow PATH', () => {
      expect(resolver.isAllowed('PATH')).toBe(true);
    });

    it('should allow PWD', () => {
      expect(resolver.isAllowed('PWD')).toBe(true);
    });

    it('should allow SHELL', () => {
      expect(resolver.isAllowed('SHELL')).toBe(true);
    });

    it('should allow LANG', () => {
      expect(resolver.isAllowed('LANG')).toBe(true);
    });

    it('should allow TERM', () => {
      expect(resolver.isAllowed('TERM')).toBe(true);
    });

    it('should allow TMPDIR', () => {
      expect(resolver.isAllowed('TMPDIR')).toBe(true);
    });

    it('should allow EDITOR', () => {
      expect(resolver.isAllowed('EDITOR')).toBe(true);
    });

    it('should allow VISUAL', () => {
      expect(resolver.isAllowed('VISUAL')).toBe(true);
    });
  });
});

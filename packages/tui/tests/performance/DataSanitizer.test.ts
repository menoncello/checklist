import { describe, it, expect, beforeEach } from 'bun:test';
import { DataSanitizer } from '../../src/performance/DataSanitizer';

describe('DataSanitizer', () => {
  let sanitizer: DataSanitizer;

  beforeEach(() => {
    sanitizer = new DataSanitizer({
      enabled: true,
      sanitizeStackTraces: true,
      sanitizeMetadata: true,
    });
  });

  describe('constructor', () => {
    it('should initialize with default config', () => {
      const s = new DataSanitizer();
      const config = s.getConfig();

      expect(config.enabled).toBe(true);
      expect(config.sanitizeStackTraces).toBe(true);
      expect(config.sanitizeMetadata).toBe(true);
      expect(config.redactPatterns.length).toBeGreaterThan(0);
    });

    it('should override default config with provided values', () => {
      const s = new DataSanitizer({
        enabled: false,
        sanitizeStackTraces: false,
      });

      const config = s.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.sanitizeStackTraces).toBe(false);
      expect(config.sanitizeMetadata).toBe(true); // Default value
    });
  });

  describe('sanitizeString', () => {
    it('should redact passwords', () => {
      const input = 'Setting value: password: "mySecret123"';
      const result = sanitizer.sanitizeString(input);
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('mySecret123');
    });

    it('should redact API keys', () => {
      const input = 'api_key: "abc123def456ghi789"';
      const result = sanitizer.sanitizeString(input);
      expect(result).toBe('api_key: "[REDACTED]"');
      expect(result).not.toContain('abc123def456ghi789');
    });

    it('should redact email addresses', () => {
      const input = 'Contact user@example.com for support';
      const result = sanitizer.sanitizeString(input);
      expect(result).toContain('Contact');
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('for support');
      expect(result).not.toContain('user@example.com');
    });

    it('should redact JWT tokens', () => {
      const input = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9';
      const result = sanitizer.sanitizeString(input);
      expect(result).toContain('Bearer');
      expect(result).toContain('[REDACTED]');
      expect(result).not.toContain('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
    });

    it('should redact database URLs', () => {
      const input = 'mongodb://user:pass@localhost/db';
      const result = sanitizer.sanitizeString(input);
      expect(result).toContain('mongodb://');
      expect(result).toContain('[REDACTED]');
      expect(result).toContain('localhost/db');
      expect(result).not.toContain('user:pass');
    });

    it('should return original string when disabled', () => {
      sanitizer.updateConfig({ enabled: false });
      const input = 'password: "secret"';
      const result = sanitizer.sanitizeString(input);
      expect(result).toBe(input);
    });
  });

  describe('sanitizeStackTrace', () => {
    it('should sanitize stack traces with sensitive data', () => {
      const stack = `
Error: Something went wrong
    at /Users/john/secret-project/src/index.ts:42:10
    at processTicksAndRejections (internal/process/task_queues.js:97:5)
    at Database.query (/Users/john/password-manager/db.ts:123:45)
      `;
      const result = sanitizer.sanitizeStackTrace(stack);

      expect(result).not.toContain('/Users/john/');
      expect(result).toContain('/[FILE]');
      expect(result).not.toContain('john');
    });

    it('should return original stack trace when disabled', () => {
      sanitizer.updateConfig({ sanitizeStackTraces: false });
      const stack = 'Error at /home/user/file.ts:1:1';
      const result = sanitizer.sanitizeStackTrace(stack);
      expect(result).toBe(stack);
    });
  });

  describe('sanitizeMetadata', () => {
    it('should sanitize sensitive keys', () => {
      const metadata = {
        name: 'test',
        password: 'secret123',
        user: 'john',
        normalValue: 'keep this',
        apiKey: 'abc123',
      };

      const result = sanitizer.sanitizeMetadata(metadata);

      expect(result.name).toBe('test');
      expect(result.password).toBe('[REDACTED]');
      expect(result.user).toBe('[REDACTED]');
      expect(result.normalValue).toBe('keep this');
      expect(result.apiKey).toBe('[REDACTED]');
    });

    it('should recursively sanitize nested objects', () => {
      const metadata = {
        level1: {
          password: 'secret',
          level2: {
            apiKey: '12345',
            normal: 'value',
          },
        },
        normal: 'keep',
      };

      const result = sanitizer.sanitizeMetadata(metadata) as any;

      expect(result.level1.password).toBe('[REDACTED]');
      expect(result.level1.level2.apiKey).toBe('[REDACTED]');
      expect(result.level1.level2.normal).toBe('value');
      expect(result.normal).toBe('keep');
    });

    it('should sanitize arrays of strings', () => {
      const metadata = {
        tags: ['user@example.com', 'normal-tag', 'password123'],
      };

      const result = sanitizer.sanitizeMetadata(metadata) as any;

      expect(result.tags[0]).toBe('[REDACTED]');
      expect(result.tags[1]).toBe('normal-tag');
      expect(result.tags[2]).toBe('[REDACTED]');
    });
  });

  describe('sanitizeMetricData', () => {
    it('should sanitize metric tags and metadata', () => {
      const metricData = {
        name: 'test-metric',
        tags: {
          user: 'john@example.com',
          env: 'test',
        },
        metadata: {
          password: 'secret',
          traceId: 'abc123',
        },
      };

      sanitizer.sanitizeMetricData(metricData);

      expect(metricData.name).toBe('test-metric');
      expect(metricData.tags.user).toBe('[REDACTED]');
      expect(metricData.tags.env).toBe('test');
      expect(metricData.metadata.password).toBe('[REDACTED]');
      expect(metricData.metadata.traceId).toBe('abc123');
    });
  });

  describe('custom patterns and redactors', () => {
    it('should add custom redaction patterns', () => {
      sanitizer.addCustomPattern(/custom-secret-\d+/gi);

      const result = sanitizer.sanitizeString('Here is custom-secret-12345');
      expect(result).toBe('Here is [REDACTED]');
    });

    it('should add custom redactor functions', () => {
      sanitizer.addCustomRedactor((text) => {
        return text.replace(/custom-redactor/gi, '[CUSTOM]');
      });

      const result = sanitizer.sanitizeString('Use custom-redactor here');
      expect(result).toBe('Use [CUSTOM] here');
    });
  });

  describe('testing and validation', () => {
    it('should detect if data contains sensitive information', () => {
      expect(sanitizer.isDataSensitive('password: secret')).toBe(true);
      expect(sanitizer.isDataSensitive('normal text')).toBe(false);
      expect(sanitizer.isDataSensitive('user@example.com')).toBe(true);
    });

    it('should provide sanitization test results', () => {
      const result = sanitizer.testSanitization('password: secret123');

      expect(result.original).toBe('password: secret123');
      expect(result.sanitized).toBe('[REDACTED]');
      expect(result.changesDetected).toBe(true);
    });

    it('should return all sensitive patterns', () => {
      const patterns = sanitizer.getSensitivePatterns();
      expect(Array.isArray(patterns)).toBe(true);
      expect(patterns.length).toBeGreaterThan(0);
    });
  });

  describe('configuration updates', () => {
    it('should update configuration correctly', () => {
      sanitizer.updateConfig({
        enabled: false,
        sanitizeStackTraces: false,
      });

      const config = sanitizer.getConfig();
      expect(config.enabled).toBe(false);
      expect(config.sanitizeStackTraces).toBe(false);
      expect(config.sanitizeMetadata).toBe(true);
    });

    it('should preserve existing patterns when updating config', () => {
      const originalPatternCount = sanitizer.getConfig().redactPatterns.length;
      sanitizer.updateConfig({ enabled: false });

      const newConfig = sanitizer.getConfig();
      expect(newConfig.redactPatterns.length).toBe(originalPatternCount);
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      const result = sanitizer.sanitizeString('');
      expect(result).toBe('');
    });

    it('should handle null and undefined metadata', () => {
      // @ts-expect-error - Testing null input
      const result = sanitizer.sanitizeMetadata(null);
      expect(result).toBeNull();

      // @ts-expect-error - Testing undefined input
      const result2 = sanitizer.sanitizeMetadata(undefined);
      expect(result2).toBeUndefined();
    });

    it('should handle invalid regex patterns gracefully', () => {
      // @ts-expect-error - Testing invalid pattern
      expect(() => sanitizer.addCustomPattern(null)).not.toThrow();
    });
  });
});
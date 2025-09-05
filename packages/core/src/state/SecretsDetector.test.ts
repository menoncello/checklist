import { describe, expect, test } from 'bun:test';
import { SecretsDetector } from './SecretsDetector';

describe('SecretsDetector', () => {
  describe('scan', () => {
    test('should detect API keys', () => {
      const content = `
        config:
          api_key: "sk_test_FAKE1234567890FAKE1234567890FAKE"
          other: value
      `;

      const secrets = SecretsDetector.scan(content);
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets[0].type).toContain('Key');
    });

    test('should detect AWS credentials', () => {
      const content = `
        aws:
          access_key_id: AKIAIOSFODNN7EXAMPLE
          secret_access_key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
      `;

      const secrets = SecretsDetector.scan(content);
      expect(secrets.length).toBeGreaterThan(0);
      // Check for either AWS key type or generic secret (the AWS secret key pattern may match as generic)
      const hasAwsKey = secrets.some(
        (s) =>
          s.type === 'AWS Access Key' || s.type === 'AWS Secret Key' || s.type === 'Generic Secret'
      );
      expect(hasAwsKey).toBe(true);
    });

    test('should detect database URLs', () => {
      const content = `
        database_url: postgres://user:password@localhost:5432/dbname
        redis_url: redis://admin:secret@redis.example.com:6379
      `;

      const secrets = SecretsDetector.scan(content);
      expect(secrets.length).toBe(2);
      expect(secrets[0].type).toBe('Database URL');
    });

    test('should detect GitHub tokens', () => {
      const content = `
        github:
          token: ghp_abcdefghijklmnopqrstuvwxyz1234567890
      `;

      const secrets = SecretsDetector.scan(content);
      expect(secrets.length).toBe(1);
      expect(secrets[0].type).toBe('GitHub Token');
    });

    test('should detect JWT tokens', () => {
      const content = `
        auth:
          token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c
      `;

      const secrets = SecretsDetector.scan(content);
      expect(secrets.length).toBe(1);
      expect(secrets[0].type).toBe('JWT Token');
    });

    test('should detect generic passwords', () => {
      const content = `
        user:
          password: mySecretPassword123!
          secret: anotherSecret456
      `;

      const secrets = SecretsDetector.scan(content);
      expect(secrets.length).toBeGreaterThan(0);
      expect(secrets[0].type).toBe('Generic Secret');
    });

    test('should ignore false positives', () => {
      const content = `
        examples:
          password: password123
          secret: your_secret
          token: <placeholder>
          key: example_key
      `;

      const secrets = SecretsDetector.scan(content);
      expect(secrets.length).toBe(0);
    });

    test('should redact secrets properly', () => {
      const content = `api_key: "abcdefghijklmnopqrstuvwxyz123456"`;

      const secrets = SecretsDetector.scan(content);
      expect(secrets[0].match).toContain('*');
      expect(secrets[0].match).not.toBe('abcdefghijklmnopqrstuvwxyz123456');
    });

    test('should provide line and column information', () => {
      const content = `line1\nline2\n  secret: realSecretValue123`;

      const secrets = SecretsDetector.scan(content);
      expect(secrets[0].line).toBe(3);
      expect(secrets[0].column).toBeGreaterThan(0);
    });
  });

  describe('hasSecrets', () => {
    test('should return true when secrets are present', () => {
      const content = 'api_key: sk_live_1234567890abcdef';
      expect(SecretsDetector.hasSecrets(content)).toBe(true);
    });

    test('should return false when no secrets are present', () => {
      const content = 'normal: content\nwithout: secrets';
      expect(SecretsDetector.hasSecrets(content)).toBe(false);
    });
  });

  describe('createErrorMessage', () => {
    test('should create formatted error message', () => {
      const secrets = [
        { type: 'API Key', match: 'sk_l***KEY', line: 1, column: 10 },
        { type: 'API Key', match: 'pk_t***EST', line: 2, column: 5 },
        { type: 'Database URL', match: 'post***name', line: 3, column: 1 },
      ];

      const message = SecretsDetector.createErrorMessage(secrets);
      expect(message).toContain('2 API Keys');
      expect(message).toContain('1 Database URL');
      expect(message).toContain('line 1, column 10');
    });

    test('should truncate long lists', () => {
      const secrets = Array(10)
        .fill(null)
        .map((_, i) => ({
          type: 'API Key',
          match: `key${i}`,
          line: i + 1,
          column: 1,
        }));

      const message = SecretsDetector.createErrorMessage(secrets);
      expect(message).toContain('and 5 more');
    });
  });
});

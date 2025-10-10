/**
 * Tests for FileSystemRestrictor
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { FileSystemRestrictor } from '../../../src/templates/security/FileSystemRestrictor';

describe('FileSystemRestrictor', () => {
  let restrictor: FileSystemRestrictor;

  beforeEach(() => {
    restrictor = new FileSystemRestrictor();
  });

  describe('path traversal prevention', () => {
    test('should detect path traversal with ../', () => {
      const result = restrictor.validatePath('../etc/passwd', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Path traversal detected');
    });

    test('should detect path traversal in middle of path', () => {
      const result = restrictor.validatePath('/home/../etc/passwd', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Path traversal');
    });

    test('should allow path traversal when configured', () => {
      const permissive = new FileSystemRestrictor({
        allowPathTraversal: true,
      });

      const result = permissive.validatePath('../file.txt', 'read');

      // Should not fail on traversal check
      expect(result.valid).toBe(true);
    });
  });

  describe('system path blocking', () => {
    test('should block /etc access', () => {
      const result = restrictor.validatePath('/etc/passwd', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('System path access denied');
    });

    test('should block /sys access', () => {
      const result = restrictor.validatePath('/sys/kernel', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('System path access denied');
    });

    test('should block /proc access', () => {
      const result = restrictor.validatePath('/proc/self', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('System path access denied');
    });

    test('should block /root access', () => {
      const result = restrictor.validatePath('/root/.ssh', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('System path access denied');
    });

    test('should block /boot access', () => {
      const result = restrictor.validatePath('/boot/vmlinuz', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('System path access denied');
    });

    test('should block /dev access', () => {
      const result = restrictor.validatePath('/dev/null', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('System path access denied');
    });
  });

  describe('file extension validation', () => {
    test('should allow .md files', () => {
      const result = restrictor.validatePath('/tmp/file.md', 'read');

      expect(result.valid).toBe(true);
    });

    test('should allow .txt files', () => {
      const result = restrictor.validatePath('/tmp/file.txt', 'read');

      expect(result.valid).toBe(true);
    });

    test('should allow .json files', () => {
      const result = restrictor.validatePath('/tmp/file.json', 'read');

      expect(result.valid).toBe(true);
    });

    test('should allow .yaml files', () => {
      const result = restrictor.validatePath('/tmp/file.yaml', 'read');

      expect(result.valid).toBe(true);
    });

    test('should allow .js files', () => {
      const result = restrictor.validatePath('/tmp/file.js', 'read');

      expect(result.valid).toBe(true);
    });

    test('should allow .ts files', () => {
      const result = restrictor.validatePath('/tmp/file.ts', 'read');

      expect(result.valid).toBe(true);
    });

    test('should block .exe files', () => {
      const result = restrictor.validatePath('/tmp/malware.exe', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    test('should block .sh files by default', () => {
      const result = restrictor.validatePath('/tmp/script.sh', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    test('should allow directories (no extension)', () => {
      const result = restrictor.validatePath('/tmp/directory', 'read');

      expect(result.valid).toBe(true);
    });

    test('should be case-insensitive', () => {
      const result = restrictor.validatePath('/tmp/FILE.MD', 'read');

      expect(result.valid).toBe(true);
    });
  });

  describe('allowed paths configuration', () => {
    test('should allow paths in allowlist', () => {
      const restricted = new FileSystemRestrictor({
        allowedPaths: ['/home/user/projects'],
      });

      const result = restricted.validatePath(
        '/home/user/projects/file.txt',
        'read'
      );

      expect(result.valid).toBe(true);
    });

    test('should block paths not in allowlist', () => {
      const restricted = new FileSystemRestrictor({
        allowedPaths: ['/home/user/projects'],
      });

      const result = restricted.validatePath('/tmp/file.txt', 'read');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('not in allowed list');
    });

    test('should allow adding paths dynamically', () => {
      restrictor.addAllowedPath('/home/user/safe');

      const result = restrictor.validatePath(
        '/home/user/safe/file.txt',
        'read'
      );

      expect(result.valid).toBe(true);
    });
  });

  describe('denied paths configuration', () => {
    test('should block paths in denylist', () => {
      const restricted = new FileSystemRestrictor({
        deniedPaths: ['/tmp/dangerous'],
      });

      const result = restricted.validatePath(
        '/tmp/dangerous/file.txt',
        'read'
      );

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('Access denied to path');
    });

    test('should allow adding denied paths dynamically', () => {
      restrictor.addDeniedPath('/tmp/unsafe');

      const result = restrictor.validatePath('/tmp/unsafe/file.txt', 'read');

      expect(result.valid).toBe(false);
    });
  });

  describe('write restrictions', () => {
    test('should block writing to hidden files', () => {
      const result = restrictor.validatePath('/tmp/.hidden', 'write');

      expect(result.valid).toBe(false);
      expect(result.reason).toContain('hidden files');
    });

    test('should allow writing to normal files', () => {
      const result = restrictor.validatePath('/tmp/file.txt', 'write');

      expect(result.valid).toBe(true);
    });

    test('should allow reading hidden files', () => {
      const result = restrictor.validatePath('/tmp/.hidden', 'read');

      // Should pass read check (hidden file restriction is write-only)
      expect(result.valid).toBe(true);
    });
  });

  describe('custom extensions', () => {
    test('should allow custom extensions', () => {
      const custom = new FileSystemRestrictor({
        allowedExtensions: ['.custom', '.special'],
      });

      const result = custom.validatePath('/tmp/file.custom', 'read');

      expect(result.valid).toBe(true);
    });

    test('should allow adding extensions dynamically', () => {
      restrictor.addAllowedExtension('.custom');

      const result = restrictor.validatePath('/tmp/file.custom', 'read');

      expect(result.valid).toBe(true);
    });

    test('should normalize extension with or without dot', () => {
      restrictor.addAllowedExtension('custom');

      const result = restrictor.validatePath('/tmp/file.custom', 'read');

      expect(result.valid).toBe(true);
    });
  });

  describe('path normalization', () => {
    test('should normalize paths consistently', () => {
      const result1 = restrictor.validatePath('/tmp//file.txt', 'read');
      const result2 = restrictor.validatePath('/tmp/file.txt', 'read');

      expect(result1.valid).toBe(result2.valid);
    });

    test('should handle backslashes on Windows', () => {
      const result = restrictor.validatePath('C:\\tmp\\file.txt', 'read');

      // Should normalize and validate
      expect(result).toBeDefined();
    });
  });

  describe('configuration retrieval', () => {
    test('should get current configuration', () => {
      restrictor.addAllowedPath('/home/user');
      restrictor.addDeniedPath('/tmp/bad');
      restrictor.addAllowedExtension('.custom');

      const config = restrictor.getConfig();

      expect(config.allowedPaths).toContain('/home/user');
      expect(config.deniedPaths).toContain('/tmp/bad');
      expect(config.allowedExtensions).toContain('.custom');
      expect(config.allowPathTraversal).toBe(false);
    });
  });

  describe('read vs write operations', () => {
    test('should apply same restrictions to read and write for most checks', () => {
      const path = '/tmp/file.txt';
      const readResult = restrictor.validatePath(path, 'read');
      const writeResult = restrictor.validatePath(path, 'write');

      expect(readResult.valid).toBe(writeResult.valid);
    });

    test('should have different results for hidden files', () => {
      const path = '/tmp/.hidden';
      const readResult = restrictor.validatePath(path, 'read');
      const writeResult = restrictor.validatePath(path, 'write');

      expect(readResult.valid).toBe(true);
      expect(writeResult.valid).toBe(false);
    });
  });

  describe('edge cases', () => {
    test('should handle empty path', () => {
      const result = restrictor.validatePath('', 'read');

      expect(result).toBeDefined();
    });

    test('should handle root path', () => {
      const result = restrictor.validatePath('/', 'read');

      expect(result).toBeDefined();
    });

    test('should handle very long paths', () => {
      const longPath = '/tmp/' + 'a'.repeat(1000) + '.txt';
      const result = restrictor.validatePath(longPath, 'read');

      expect(result).toBeDefined();
    });

    test('should handle paths with special characters', () => {
      const result = restrictor.validatePath('/tmp/file-with-dash.txt', 'read');

      expect(result.valid).toBe(true);
    });

    test('should handle paths with spaces', () => {
      const result = restrictor.validatePath('/tmp/file with spaces.txt', 'read');

      expect(result.valid).toBe(true);
    });
  });
});

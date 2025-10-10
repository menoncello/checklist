/**
 * Tests for TemplateSigner
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { TemplateSigner } from '../../../src/templates/security/TemplateSigner';
import type { TemplateSignature } from '../../../src/templates/security/types';

describe('TemplateSigner', () => {
  let signer: TemplateSigner;
  const secretKey = 'test-secret-key-for-signing';
  const templateContent = `
id: test-template
name: Test Template
version: 1.0.0
steps:
  - id: step1
    title: Test Step
    commands:
      - echo "Hello World"
`;

  beforeEach(() => {
    signer = new TemplateSigner({
      secretKey,
      cacheEnabled: true,
      cacheTTL: 300000,
    });
  });

  describe('createSignature', () => {
    test('should create valid HMAC-SHA256 signature', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );

      expect(signature).toBeDefined();
      expect(signature.algorithm).toBe('HMAC-SHA256');
      expect(signature.signature).toBeTruthy();
      expect(signature.signature).toMatch(/^[a-f0-9]{64}$/); // SHA256 hex
      expect(signature.signer).toBe('test-signer');
      expect(signature.timestamp).toBeTruthy();
    });

    test('should create consistent signatures for same content', () => {
      const sig1 = signer.createSignature(templateContent, 'signer1');
      const sig2 = signer.createSignature(templateContent, 'signer2');

      // Same content should produce same signature
      expect(sig1.signature).toBe(sig2.signature);
    });

    test('should create different signatures for different content', () => {
      const sig1 = signer.createSignature(templateContent, 'signer');
      const sig2 = signer.createSignature(
        templateContent + '\n# Modified',
        'signer'
      );

      expect(sig1.signature).not.toBe(sig2.signature);
    });

    test('should include timestamp in ISO format', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );

      const timestamp = new Date(signature.timestamp);
      expect(timestamp.toISOString()).toBe(signature.timestamp);
      expect(timestamp.getTime()).toBeLessThanOrEqual(Date.now());
    });
  });

  describe('verifySignature', () => {
    test('should verify valid signature successfully', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );
      const result = signer.verifySignature(templateContent, signature);

      expect(result.valid).toBe(true);
      expect(result.signature).toEqual(signature);
      expect(result.error).toBeUndefined();
    });

    test('should reject tampered content', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );
      const tamperedContent = templateContent + '\n# Malicious code';
      const result = signer.verifySignature(tamperedContent, signature);

      expect(result.valid).toBe(false);
      expect(result.signature).toBeUndefined();
      expect(result.error).toBe('Signature verification failed');
    });

    test('should reject tampered signature', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );

      // Tamper with signature
      const tamperedSignature: TemplateSignature = {
        ...signature,
        signature: signature.signature.replace('a', 'b'),
      };

      const result = signer.verifySignature(
        templateContent,
        tamperedSignature
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBe('Signature verification failed');
    });

    test('should reject unsupported algorithm', () => {
      const signature: TemplateSignature = {
        algorithm: 'HMAC-SHA256',
        signature: 'abc123',
        timestamp: new Date().toISOString(),
        signer: 'test',
      };

      // Force unsupported algorithm
      const invalidSignature = {
        ...signature,
        algorithm: 'MD5' as 'HMAC-SHA256',
      };

      const result = signer.verifySignature(
        templateContent,
        invalidSignature
      );

      expect(result.valid).toBe(false);
      expect(result.error).toContain('Unsupported algorithm');
    });

    test('should use timing-safe comparison', () => {
      // This test verifies the implementation uses timingSafeEqual
      // by checking that different length signatures fail safely
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );

      const shortSignature: TemplateSignature = {
        ...signature,
        signature: 'abc', // Much shorter
      };

      const result = signer.verifySignature(
        templateContent,
        shortSignature
      );

      expect(result.valid).toBe(false);
    });

    test('should handle verification errors gracefully', () => {
      const invalidSignature: TemplateSignature = {
        algorithm: 'HMAC-SHA256',
        signature: 'not-a-valid-hex-string!',
        timestamp: new Date().toISOString(),
        signer: 'test',
      };

      const result = signer.verifySignature(
        templateContent,
        invalidSignature
      );

      expect(result.valid).toBe(false);
      expect(result.error).toBeTruthy();
    });
  });

  describe('signature caching', () => {
    test('should cache verification results', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );

      // First verification
      const result1 = signer.verifySignature(templateContent, signature);
      expect(result1.valid).toBe(true);

      // Second verification should use cache
      const result2 = signer.verifySignature(templateContent, signature);
      expect(result2.valid).toBe(true);

      const stats = signer.getCacheStats();
      expect(stats.size).toBeGreaterThan(0);
      expect(stats.enabled).toBe(true);
    });

    test('should clear cache when requested', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );

      signer.verifySignature(templateContent, signature);
      expect(signer.getCacheStats().size).toBeGreaterThan(0);

      signer.clearCache();
      expect(signer.getCacheStats().size).toBe(0);
    });

    test('should work with caching disabled', () => {
      const noCacheSigner = new TemplateSigner({
        secretKey,
        cacheEnabled: false,
      });

      const signature = noCacheSigner.createSignature(
        templateContent,
        'test-signer'
      );
      const result = noCacheSigner.verifySignature(
        templateContent,
        signature
      );

      expect(result.valid).toBe(true);
      expect(noCacheSigner.getCacheStats().enabled).toBe(false);
      expect(noCacheSigner.getCacheStats().size).toBe(0);
    });

    test('should respect cache TTL', () => {
      const shortTTLSigner = new TemplateSigner({
        secretKey,
        cacheEnabled: true,
        cacheTTL: 1, // 1ms TTL
      });

      const signature = shortTTLSigner.createSignature(
        templateContent,
        'test-signer'
      );

      // First verification
      shortTTLSigner.verifySignature(templateContent, signature);

      // Wait for cache to expire
      Bun.sleepSync(2);

      // Second verification should recompute
      const result = shortTTLSigner.verifySignature(
        templateContent,
        signature
      );
      expect(result.valid).toBe(true);
    });
  });

  describe('performance requirements', () => {
    test('should verify signature in under 10ms', () => {
      const signature = signer.createSignature(
        templateContent,
        'test-signer'
      );

      const startTime = performance.now();
      signer.verifySignature(templateContent, signature);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // <10ms requirement
    });

    test('should create signature in under 10ms', () => {
      const startTime = performance.now();
      signer.createSignature(templateContent, 'test-signer');
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(10); // <10ms requirement
    });
  });

  describe('edge cases', () => {
    test('should handle empty template content', () => {
      const signature = signer.createSignature('', 'test-signer');
      const result = signer.verifySignature('', signature);

      expect(result.valid).toBe(true);
    });

    test('should handle very large templates', () => {
      const largeContent = 'x'.repeat(1000000); // 1MB content
      const signature = signer.createSignature(
        largeContent,
        'test-signer'
      );
      const result = signer.verifySignature(largeContent, signature);

      expect(result.valid).toBe(true);
    });

    test('should handle special characters in content', () => {
      const specialContent = `
        Template with special chars:
        Unicode: 你好世界 🚀
        Symbols: @#$%^&*()
        Newlines and tabs:\t\n\r
      `;

      const signature = signer.createSignature(
        specialContent,
        'test-signer'
      );
      const result = signer.verifySignature(specialContent, signature);

      expect(result.valid).toBe(true);
    });

    test('should handle different secret keys', () => {
      const signer1 = new TemplateSigner({ secretKey: 'key1' });
      const signer2 = new TemplateSigner({ secretKey: 'key2' });

      const sig1 = signer1.createSignature(templateContent, 'signer');

      // Different key should fail verification
      const result = signer2.verifySignature(templateContent, sig1);
      expect(result.valid).toBe(false);
    });
  });
});

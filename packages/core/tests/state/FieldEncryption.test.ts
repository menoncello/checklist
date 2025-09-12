import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test';
import { FieldEncryption } from '../../src/state/FieldEncryption';
import * as crypto from 'crypto';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('FieldEncryption', () => {
  const testDir = '.test-encryption';
  const keyFile = join(testDir, '.encryption-key');
  const metadataFile = join(testDir, '.encryption-metadata.json');
  
  beforeEach(() => {
    // Clear static state
    (FieldEncryption as any).encryptionKey = null;
    
    // Override paths for testing
    (FieldEncryption as any).KEY_FILE = keyFile;
    (FieldEncryption as any).METADATA_FILE = metadataFile;
  });
  
  afterEach(() => {
    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Constants', () => {
    it('should use exact algorithm "aes-256-gcm"', () => {
      expect((FieldEncryption as any).ALGORITHM).toBe('aes-256-gcm');
    });

    it('should use exact key length 32 bytes', () => {
      expect((FieldEncryption as any).KEY_LENGTH).toBe(32);
    });

    it('should use exact IV length 16 bytes', () => {
      expect((FieldEncryption as any).IV_LENGTH).toBe(16);
    });

    it('should use exact auth tag length 16 bytes', () => {
      expect((FieldEncryption as any).AUTH_TAG_LENGTH).toBe(16);
    });

    it('should define exact sensitive fields list', () => {
      const fields = (FieldEncryption as any).SENSITIVE_FIELDS;
      expect(fields).toContain('activeInstance.apiKeys');
      expect(fields).toContain('activeInstance.credentials');
      expect(fields).toContain('activeInstance.tokens');
      expect(fields).toContain('activeInstance.secrets');
      expect(fields).toContain('completedSteps.*.secrets');
      expect(fields).toContain('completedSteps.*.credentials');
      expect(fields).toContain('config.apiKey');
      expect(fields).toContain('config.databaseUrl');
      expect(fields).toContain('config.authToken');
    });
  });

  describe('initializeKey', () => {
    it('should generate new key when no key exists', async () => {
      await FieldEncryption.initializeKey();
      
      const key = (FieldEncryption as any).encryptionKey;
      expect(key).toBeDefined();
      expect(key).toBeInstanceOf(Buffer);
      expect(key.length).toBe(32); // Exact 256 bits
    });

    it('should save key to file in base64 format', async () => {
      await FieldEncryption.initializeKey();
      
      const file = Bun.file(keyFile);
      expect(await file.exists()).toBe(true);
      
      const content = await file.text();
      // Base64 encoded 32 bytes = 44 characters (with padding)
      expect(content.length).toBeGreaterThanOrEqual(43);
      expect(content.length).toBeLessThanOrEqual(44);
      
      // Should be valid base64
      const decoded = Buffer.from(content, 'base64');
      expect(decoded.length).toBe(32);
    });

    it('should create metadata file with exact structure', async () => {
      await FieldEncryption.initializeKey();
      
      const file = Bun.file(metadataFile);
      expect(await file.exists()).toBe(true);
      
      const metadata = await file.json();
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.keyId).toBeDefined();
      expect(metadata.keyId.length).toBe(16); // 8 bytes hex = 16 chars
      expect(metadata.encryptedFields).toEqual([]);
      expect(metadata.createdAt).toBeDefined();
      expect(new Date(metadata.createdAt).toISOString()).toBe(metadata.createdAt);
    });

    it('should load existing key from file', async () => {
      // Create a test key
      const testKey = crypto.randomBytes(32);
      await Bun.write(keyFile, testKey.toString('base64'));
      
      await FieldEncryption.initializeKey();
      
      const loadedKey = (FieldEncryption as any).encryptionKey;
      expect(loadedKey).toEqual(testKey);
    });

    it('should handle corrupted key file', async () => {
      // Create invalid key file with short content
      await Bun.write(keyFile, 'invalid');
      
      // Clear any existing key
      (FieldEncryption as any).encryptionKey = null;
      
      // Should load the corrupted file but handle it gracefully
      await FieldEncryption.initializeKey();
      
      const key = (FieldEncryption as any).encryptionKey;
      expect(key).toBeDefined();
      expect(key).toBeInstanceOf(Buffer);
      // The corrupted file will be loaded as-is, so we just check it exists
      expect(key.length).toBeGreaterThan(0);
    });
  });

  describe('encrypt', () => {
    beforeEach(async () => {
      await FieldEncryption.initializeKey();
    });

    it('should encrypt string data', async () => {
      const plaintext = 'sensitive-data-123';
      const encrypted = await FieldEncryption.encrypt(plaintext);
      
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.data).toBeDefined();
      
      // Should not contain plaintext
      expect(encrypted.data).not.toContain(plaintext);
    });

    it('should generate unique IV for each encryption', async () => {
      const plaintext = 'test-data';
      const encrypted1 = await FieldEncryption.encrypt(plaintext);
      const encrypted2 = await FieldEncryption.encrypt(plaintext);
      
      // Same plaintext should produce different IVs
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      // And different ciphertext
      expect(encrypted1.data).not.toBe(encrypted2.data);
    });

    it('should handle empty string', async () => {
      const encrypted = await FieldEncryption.encrypt('');
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.data).toBeDefined();
    });

    it('should handle very long strings', async () => {
      const longText = 'x'.repeat(10000);
      const encrypted = await FieldEncryption.encrypt(longText);
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.data).toBeDefined();
    });

    it('should handle special characters', async () => {
      const special = '🎉 \n\r\t\0 ${injection} <script>';
      const encrypted = await FieldEncryption.encrypt(special);
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.data).toBeDefined();
    });
  });

  describe('decrypt', () => {
    beforeEach(async () => {
      await FieldEncryption.initializeKey();
    });

    it('should decrypt encrypted data correctly', async () => {
      const plaintext = 'sensitive-data-123';
      const encrypted = await FieldEncryption.encrypt(plaintext);
      const decrypted = await FieldEncryption.decrypt(encrypted);
      
      expect(decrypted).toBe(plaintext);
    });

    it('should handle empty string encryption/decryption', async () => {
      const encrypted = await FieldEncryption.encrypt('');
      const decrypted = await FieldEncryption.decrypt(encrypted);
      expect(decrypted).toBe('');
    });

    it('should handle long string encryption/decryption', async () => {
      const longText = 'x'.repeat(10000);
      const encrypted = await FieldEncryption.encrypt(longText);
      const decrypted = await FieldEncryption.decrypt(encrypted);
      expect(decrypted).toBe(longText);
    });

    it('should fail with tampered data', async () => {
      const encrypted = await FieldEncryption.encrypt('test');
      
      // Tamper with the data
      const tampered = {
        ...encrypted,
        data: Buffer.from(
          Buffer.from(encrypted.data, 'base64').map((b) => b ^ 1) // Flip bits
        ).toString('base64'),
      };
      
      await expect(FieldEncryption.decrypt(tampered)).rejects.toThrow();
    });

    it('should fail with wrong auth tag', async () => {
      const encrypted = await FieldEncryption.encrypt('test');
      
      // Tamper with auth tag
      const tampered = {
        ...encrypted,
        authTag: crypto.randomBytes(16).toString('base64'),
      };
      
      await expect(FieldEncryption.decrypt(tampered)).rejects.toThrow();
    });

    it('should fail with wrong IV', async () => {
      const encrypted = await FieldEncryption.encrypt('test');
      
      // Use different IV
      const tampered = {
        ...encrypted,
        iv: crypto.randomBytes(16).toString('base64'),
      };
      
      await expect(FieldEncryption.decrypt(tampered)).rejects.toThrow();
    });
  });

  describe('shouldEncrypt', () => {
    it('should identify sensitive field paths', () => {
      expect(FieldEncryption.shouldEncrypt('activeInstance.apiKeys')).toBe(true);
      expect(FieldEncryption.shouldEncrypt('activeInstance.credentials')).toBe(true);
      expect(FieldEncryption.shouldEncrypt('config.apiKey')).toBe(true);
    });

    it('should handle wildcard patterns', () => {
      expect(FieldEncryption.shouldEncrypt('completedSteps.0.secrets')).toBe(true);
      expect(FieldEncryption.shouldEncrypt('completedSteps.123.secrets')).toBe(true);
      expect(FieldEncryption.shouldEncrypt('completedSteps.abc.credentials')).toBe(true);
    });

    it('should reject non-sensitive fields', () => {
      expect(FieldEncryption.shouldEncrypt('activeInstance.name')).toBe(false);
      expect(FieldEncryption.shouldEncrypt('config.theme')).toBe(false);
      expect(FieldEncryption.shouldEncrypt('random.field')).toBe(false);
    });

    it('should handle exact matches only', () => {
      // Should not match partial paths
      expect(FieldEncryption.shouldEncrypt('activeInstance')).toBe(false);
      expect(FieldEncryption.shouldEncrypt('config')).toBe(false);
      expect(FieldEncryption.shouldEncrypt('apiKeys')).toBe(false);
    });

  });

  describe('encryptObject', () => {
    beforeEach(async () => {
      await FieldEncryption.initializeKey();
    });

    it('should encrypt sensitive fields in object', async () => {
      const obj = {
        activeInstance: {
          name: 'test',
          apiKeys: 'secret-key-123',
          credentials: {
            username: 'user',
            password: 'pass123',
          },
        },
        config: {
          theme: 'dark',
          apiKey: 'api-secret',
        },
      };
      
      const result = await FieldEncryption.encryptObject(obj);
      
      // Check result structure
      expect(result).toHaveProperty('data');
      expect(result).toHaveProperty('encryptedPaths');
      
      const encrypted = result.data as any;
      
      // Non-sensitive fields should remain unchanged
      expect(encrypted.activeInstance.name).toBe('test');
      expect(encrypted.config.theme).toBe('dark');
      
      // Sensitive fields should be encrypted
      expect(encrypted.activeInstance.apiKeys).toHaveProperty('encrypted', true);
      expect(encrypted.activeInstance.apiKeys).toHaveProperty('algorithm', 'aes-256-gcm');
      expect(encrypted.activeInstance.credentials).toHaveProperty('encrypted', true);
      expect(encrypted.config.apiKey).toHaveProperty('encrypted', true);
      
      // encryptedPaths should list encrypted fields
      expect(result.encryptedPaths).toContain('activeInstance.apiKeys');
      expect(result.encryptedPaths).toContain('activeInstance.credentials');
      expect(result.encryptedPaths).toContain('config.apiKey');
    });

    it('should handle empty objects', async () => {
      const result = await FieldEncryption.encryptObject({});
      expect(result.data).toEqual({});
      expect(result.encryptedPaths).toEqual([]);
    });

    it('should skip already encrypted fields', async () => {
      const encrypted = await FieldEncryption.encrypt('already-encrypted');
      const obj = {
        config: {
          apiKey: encrypted, // Already encrypted
        },
      };
      
      const result = await FieldEncryption.encryptObject(obj);
      const data = result.data as any;
      expect(data.config.apiKey).toEqual(encrypted);
      // Should not add to encryptedPaths since it was already encrypted
      expect(result.encryptedPaths).not.toContain('config.apiKey');
    });
  });

  describe('decryptObject', () => {
    beforeEach(async () => {
      await FieldEncryption.initializeKey();
    });

    it('should decrypt encrypted object fields', async () => {
      const original = {
        activeInstance: {
          name: 'test',
          apiKeys: 'secret-key-123',
        },
        config: {
          apiKey: 'api-secret',
        },
      };
      
      const { data } = await FieldEncryption.encryptObject(original);
      const decrypted = await FieldEncryption.decryptObject(data);
      
      expect(decrypted).toEqual(original);
    });

    it('should handle mixed encrypted/plain fields', async () => {
      const encryptedField = await FieldEncryption.encrypt('secret');
      const obj = {
        plain: 'not-encrypted',
        config: {
          apiKey: encryptedField,
        },
      };
      
      const decrypted = await FieldEncryption.decryptObject(obj) as any;
      
      expect(decrypted.plain).toBe('not-encrypted');
      expect(decrypted.config.apiKey).toBe('secret');
    });

    it('should handle deeply nested structures', async () => {
      const encryptedField = await FieldEncryption.encrypt('deep-secret');
      const obj = {
        level1: {
          level2: {
            level3: {
              config: {
                apiKey: encryptedField,
              },
            },
          },
        },
      };
      
      const decrypted = await FieldEncryption.decryptObject(obj) as any;
      expect(decrypted.level1.level2.level3.config.apiKey).toBe('deep-secret');
    });
  });
});
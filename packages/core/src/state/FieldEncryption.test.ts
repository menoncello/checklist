import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import * as fs from 'fs/promises';
import * as path from 'path';
import { FieldEncryption, type EncryptedField } from './FieldEncryption';
import { STATE_DIR } from './constants';

describe('FieldEncryption', () => {
  const testDir = path.join(process.cwd(), '.test-encryption');

  beforeEach(async () => {
    // Create test directory
    await fs.mkdir(testDir, { recursive: true });
    // Override STATE_DIR for tests
    Object.defineProperty(FieldEncryption, 'KEY_FILE', {
      value: path.join(testDir, '.encryption-key'),
      configurable: true,
    });
    Object.defineProperty(FieldEncryption, 'METADATA_FILE', {
      value: path.join(testDir, '.encryption-metadata.json'),
      configurable: true,
    });
  });

  afterEach(async () => {
    // Clean up test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('initializeKey', () => {
    test('should generate and save a new encryption key', async () => {
      await FieldEncryption.initializeKey();

      const keyFile = path.join(testDir, '.encryption-key');
      const keyExists = await fs
        .access(keyFile)
        .then(() => true)
        .catch(() => false);
      expect(keyExists).toBe(true);

      const keyContent = await fs.readFile(keyFile, 'utf8');
      const keyBuffer = Buffer.from(keyContent, 'base64');
      expect(keyBuffer.length).toBe(32); // 256 bits
    });

    test('should reuse existing key if present', async () => {
      // First initialization
      await FieldEncryption.initializeKey();
      const keyFile = path.join(testDir, '.encryption-key');
      const firstKey = await fs.readFile(keyFile, 'utf8');

      // Second initialization
      await FieldEncryption.initializeKey();
      const secondKey = await fs.readFile(keyFile, 'utf8');

      expect(secondKey).toBe(firstKey);
    });

    test('should create metadata file', async () => {
      await FieldEncryption.initializeKey();

      const metadataFile = path.join(testDir, '.encryption-metadata.json');
      const metadataExists = await fs
        .access(metadataFile)
        .then(() => true)
        .catch(() => false);
      expect(metadataExists).toBe(true);

      const metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.keyId).toBeDefined();
      expect(metadata.encryptedFields).toEqual([]);
    });
  });

  describe('encrypt and decrypt', () => {
    test('should encrypt and decrypt a string', async () => {
      const plaintext = 'my-secret-api-key';

      const encrypted = await FieldEncryption.encrypt(plaintext);
      expect(encrypted.encrypted).toBe(true);
      expect(encrypted.algorithm).toBe('aes-256-gcm');
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.authTag).toBeDefined();
      expect(encrypted.data).toBeDefined();
      expect(encrypted.data).not.toBe(plaintext);

      const decrypted = await FieldEncryption.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    test('should encrypt and decrypt an object', async () => {
      const plainObject = {
        apiKey: 'secret-key',
        config: { nested: 'value' },
        array: [1, 2, 3],
      };

      const encrypted = await FieldEncryption.encrypt(plainObject);
      expect(encrypted.encrypted).toBe(true);

      const decrypted = await FieldEncryption.decrypt(encrypted);
      expect(decrypted).toEqual(plainObject);
    });

    test('should throw on invalid encrypted field', async () => {
      const invalidField = {
        encrypted: false,
        data: 'invalid',
      } as unknown as EncryptedField;

      await expect(FieldEncryption.decrypt(invalidField)).rejects.toThrow();
    });

    test('should throw on tampered auth tag', async () => {
      const plaintext = 'test-data';
      const encrypted = await FieldEncryption.encrypt(plaintext);

      // Tamper with auth tag
      encrypted.authTag = Buffer.from('tampered').toString('base64');

      await expect(FieldEncryption.decrypt(encrypted)).rejects.toThrow();
    });
  });

  describe('shouldEncrypt', () => {
    test('should identify sensitive field paths', () => {
      expect(FieldEncryption.shouldEncrypt('activeInstance.apiKeys')).toBe(
        true
      );
      expect(FieldEncryption.shouldEncrypt('activeInstance.credentials')).toBe(
        true
      );
      expect(FieldEncryption.shouldEncrypt('config.apiKey')).toBe(true);
      expect(FieldEncryption.shouldEncrypt('config.databaseUrl')).toBe(true);
    });

    test('should match wildcard patterns', () => {
      expect(FieldEncryption.shouldEncrypt('completedSteps.0.secrets')).toBe(
        true
      );
      expect(
        FieldEncryption.shouldEncrypt('completedSteps.123.credentials')
      ).toBe(true);
    });

    test('should not encrypt non-sensitive fields', () => {
      expect(FieldEncryption.shouldEncrypt('activeInstance.id')).toBe(false);
      expect(FieldEncryption.shouldEncrypt('activeInstance.status')).toBe(
        false
      );
      expect(FieldEncryption.shouldEncrypt('completedSteps.0.stepId')).toBe(
        false
      );
    });
  });

  describe('encryptObject', () => {
    test('should encrypt sensitive fields in nested object', async () => {
      const obj = {
        activeInstance: {
          id: 'instance-1',
          apiKeys: ['key1', 'key2'],
          status: 'active',
          credentials: {
            username: 'admin',
            password: 'secret',
          },
        },
        config: {
          apiKey: 'config-secret',
          debug: true,
        },
      };

      const { data, encryptedPaths } = await FieldEncryption.encryptObject(obj);

      // Check encrypted paths
      expect(encryptedPaths).toContain('activeInstance.apiKeys');
      expect(encryptedPaths).toContain('activeInstance.credentials');
      expect(encryptedPaths).toContain('config.apiKey');

      // Check that sensitive fields are encrypted (cast to any for testing)
      const result = data as any;
      expect(result.activeInstance.apiKeys.encrypted).toBe(true);
      expect(result.activeInstance.credentials.encrypted).toBe(true);
      expect(result.config.apiKey.encrypted).toBe(true);

      // Check that non-sensitive fields are not encrypted
      expect(result.activeInstance.id).toBe('instance-1');
      expect(result.activeInstance.status).toBe('active');
      expect(result.config.debug).toBe(true);
    });

    test('should handle arrays with sensitive data', async () => {
      const obj = {
        completedSteps: [
          { stepId: 'step-1', secrets: { key: 'value' } },
          { stepId: 'step-2', result: 'success' },
          { stepId: 'step-3', credentials: { user: 'admin' } },
        ],
      };

      const { data, encryptedPaths } = await FieldEncryption.encryptObject(obj);

      expect(encryptedPaths).toContain('completedSteps.0.secrets');
      expect(encryptedPaths).toContain('completedSteps.2.credentials');

      const result = data as any;
      expect(result.completedSteps[0].secrets.encrypted).toBe(true);
      expect(result.completedSteps[2].credentials.encrypted).toBe(true);
      expect(result.completedSteps[1].result).toBe('success');
    });

    test('should skip already encrypted fields', async () => {
      const alreadyEncrypted = await FieldEncryption.encrypt('secret');
      const obj = {
        config: {
          apiKey: alreadyEncrypted,
        },
      };

      const { data, encryptedPaths } = await FieldEncryption.encryptObject(obj);

      expect(encryptedPaths).toEqual([]);
      const result = data as any;
      expect(result.config.apiKey).toEqual(alreadyEncrypted);
    });
  });

  describe('decryptObject', () => {
    test('should decrypt all encrypted fields', async () => {
      const original = {
        activeInstance: {
          id: 'instance-1',
          apiKeys: ['key1', 'key2'],
          credentials: { username: 'admin', password: 'secret' },
        },
        config: {
          apiKey: 'config-secret',
          debug: true,
        },
      };

      const { data: encrypted } = await FieldEncryption.encryptObject(original);
      const decrypted = await FieldEncryption.decryptObject(encrypted);

      expect(decrypted).toEqual(original);
    });

    test('should handle mixed encrypted and plain fields', async () => {
      const encryptedField = await FieldEncryption.encrypt('secret-value');
      const obj = {
        encrypted: encryptedField,
        plain: 'plain-value',
        nested: {
          encrypted: await FieldEncryption.encrypt({ key: 'value' }),
          plain: 'another-plain',
        },
      };

      const decrypted = await FieldEncryption.decryptObject(obj);

      const result = decrypted as any;
      expect(result.encrypted).toBe('secret-value');
      expect(result.plain).toBe('plain-value');
      expect(result.nested.encrypted).toEqual({ key: 'value' });
      expect(result.nested.plain).toBe('another-plain');
    });
  });

  describe('updateMetadata', () => {
    test('should update encrypted fields list', async () => {
      await FieldEncryption.initializeKey();

      const paths1 = ['field1', 'field2'];
      await FieldEncryption.updateMetadata(paths1);

      const metadataFile = path.join(testDir, '.encryption-metadata.json');
      let metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
      expect(metadata.encryptedFields).toEqual(paths1);

      const paths2 = ['field2', 'field3'];
      await FieldEncryption.updateMetadata(paths2);

      metadata = JSON.parse(await fs.readFile(metadataFile, 'utf8'));
      expect(metadata.encryptedFields.sort()).toEqual([
        'field1',
        'field2',
        'field3',
      ]);
    });
  });
});

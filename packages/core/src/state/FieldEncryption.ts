/**
 * Field-level encryption for sensitive data in state files
 * Uses Bun's crypto APIs for AES-256-GCM encryption
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { STATE_DIR } from './constants';

const logger = createLogger('checklist:encryption');

export interface EncryptedField {
  encrypted: true;
  algorithm: 'aes-256-gcm';
  iv: string; // Base64 encoded initialization vector
  authTag: string; // Base64 encoded auth tag
  data: string; // Base64 encoded encrypted data
}

export interface EncryptionMetadata {
  version: '1.0.0';
  keyId: string;
  encryptedFields: string[]; // Dot-notation paths to encrypted fields
  createdAt: string;
  rotatedAt?: string;
}

export class FieldEncryption {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly AUTH_TAG_LENGTH = 16; // 128 bits
  private static readonly KEY_FILE = path.join(STATE_DIR, '.encryption-key');
  private static readonly METADATA_FILE = path.join(
    STATE_DIR,
    '.encryption-metadata.json'
  );

  private static encryptionKey: Buffer | null = null;

  /**
   * Fields that should be encrypted (dot-notation paths)
   */
  private static readonly SENSITIVE_FIELDS = [
    'activeInstance.apiKeys',
    'activeInstance.credentials',
    'activeInstance.tokens',
    'activeInstance.secrets',
    'completedSteps.*.secrets',
    'completedSteps.*.credentials',
    'config.apiKey',
    'config.databaseUrl',
    'config.authToken',
  ];

  /**
   * Initialize or load the encryption key
   */
  public static async initializeKey(): Promise<void> {
    try {
      // Try to load existing key
      const keyFile = Bun.file(this.KEY_FILE);
      if (await keyFile.exists()) {
        const keyData = await keyFile.text();
        this.encryptionKey = Buffer.from(keyData, 'base64');
        return;
      }
    } catch {
      // Key doesn't exist or is corrupted, generate new one
    }

    // Generate new key
    this.encryptionKey = crypto.randomBytes(this.KEY_LENGTH);

    // Save key with restricted permissions
    await Bun.write(this.KEY_FILE, this.encryptionKey.toString('base64'));

    // Try to set restrictive permissions (owner read-only)
    try {
      const { chmod } = await import('fs/promises');
      await chmod(this.KEY_FILE, 0o400);
    } catch {
      // Permission setting might fail on some systems, continue anyway
    }

    // Create initial metadata
    const metadata: EncryptionMetadata = {
      version: '1.0.0',
      keyId: crypto.randomBytes(8).toString('hex'),
      encryptedFields: [],
      createdAt: new Date().toISOString(),
    };

    await Bun.write(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
  }

  /**
   * Get the encryption key, initializing if necessary
   */
  private static async getKey(): Promise<Buffer> {
    if (!this.encryptionKey) {
      await this.initializeKey();
    }

    if (!this.encryptionKey) {
      throw new Error('Failed to initialize encryption key');
    }

    return this.encryptionKey;
  }

  /**
   * Encrypt a value
   */
  public static async encrypt(value: unknown): Promise<EncryptedField> {
    const key = await this.getKey();

    // Convert value to JSON string
    const plaintext = JSON.stringify(value);

    // Generate random IV
    const iv = crypto.randomBytes(this.IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(this.ALGORITHM, key, iv);

    // Encrypt data
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);

    // Get auth tag
    const authTag = cipher.getAuthTag();

    return {
      encrypted: true,
      algorithm: 'aes-256-gcm',
      iv: iv.toString('base64'),
      authTag: authTag.toString('base64'),
      data: encrypted.toString('base64'),
    };
  }

  /**
   * Decrypt a value
   */
  public static async decrypt(
    encryptedField: EncryptedField
  ): Promise<unknown> {
    if (
      !encryptedField.encrypted ||
      encryptedField.algorithm !== 'aes-256-gcm'
    ) {
      throw new Error('Invalid encrypted field format');
    }

    const key = await this.getKey();

    // Decode from base64
    const iv = Buffer.from(encryptedField.iv, 'base64');
    const authTag = Buffer.from(encryptedField.authTag, 'base64');
    const encrypted = Buffer.from(encryptedField.data, 'base64');

    // Create decipher with explicit authTagLength to avoid deprecation warning
    const decipher = crypto.createDecipheriv(this.ALGORITHM, key, iv, {
      authTagLength: 16, // 16 bytes = 128 bits
    } as crypto.CipherGCMOptions);
    decipher.setAuthTag(authTag);

    // Decrypt data
    const decrypted = Buffer.concat([
      decipher.update(encrypted),
      decipher.final(),
    ]);

    // Parse JSON
    return JSON.parse(decrypted.toString('utf8'));
  }

  /**
   * Check if a field path should be encrypted
   */
  public static shouldEncrypt(fieldPath: string): boolean {
    return this.SENSITIVE_FIELDS.some((pattern) => {
      // Convert pattern to regex (*.credentials becomes .*\.credentials)
      const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');

      const regex = new RegExp(`^${regexPattern}$`);
      return regex.test(fieldPath);
    });
  }

  /**
   * Encrypt sensitive fields in an object
   */
  public static async encryptObject(
    obj: unknown,
    path: string = ''
  ): Promise<{ data: unknown; encryptedPaths: string[] }> {
    const encryptedPaths: string[] = [];

    const processValue = async (
      value: unknown,
      currentPath: string
    ): Promise<unknown> => {
      // Skip if already encrypted
      if (
        value !== null &&
        value !== undefined &&
        typeof value === 'object' &&
        'encrypted' in value &&
        (value as Record<string, unknown>).encrypted === true
      ) {
        return value;
      }

      // Check if this path should be encrypted
      if (currentPath && this.shouldEncrypt(currentPath)) {
        encryptedPaths.push(currentPath);
        return await this.encrypt(value);
      }

      // Recursively process objects and arrays
      if (Array.isArray(value)) {
        return await Promise.all(
          value.map((item, index) =>
            processValue(
              item,
              currentPath ? `${currentPath}.${index}` : `${index}`
            )
          )
        );
      } else if (
        value !== null &&
        value !== undefined &&
        typeof value === 'object'
      ) {
        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) {
          const newPath = currentPath ? `${currentPath}.${key}` : key;
          result[key] = await processValue(val, newPath);
        }

        return result;
      }

      return value;
    };

    const data = await processValue(obj, path);
    return { data, encryptedPaths };
  }

  /**
   * Decrypt sensitive fields in an object
   */
  public static async decryptObject(obj: unknown): Promise<unknown> {
    const processValue = async (value: unknown): Promise<unknown> => {
      // Check if this is an encrypted field
      if (
        value !== null &&
        value !== undefined &&
        typeof value === 'object' &&
        'encrypted' in value &&
        (value as Record<string, unknown>).encrypted === true
      ) {
        return await this.decrypt(value as EncryptedField);
      }

      // Recursively process objects and arrays
      if (Array.isArray(value)) {
        return await Promise.all(value.map((item) => processValue(item)));
      } else if (
        value !== null &&
        value !== undefined &&
        typeof value === 'object'
      ) {
        const result: Record<string, unknown> = {};

        for (const [key, val] of Object.entries(value)) {
          result[key] = await processValue(val);
        }

        return result;
      }

      return value;
    };

    return await processValue(obj);
  }

  /**
   * Update encryption metadata
   */
  public static async updateMetadata(encryptedPaths: string[]): Promise<void> {
    try {
      const metadataFile = Bun.file(this.METADATA_FILE);
      const existing = (await metadataFile.exists())
        ? (JSON.parse(await metadataFile.text()) as EncryptionMetadata)
        : null;

      const metadata: EncryptionMetadata = existing ?? {
        version: '1.0.0',
        keyId: crypto.randomBytes(8).toString('hex'),
        encryptedFields: [],
        createdAt: new Date().toISOString(),
      };

      // Update encrypted fields list
      metadata.encryptedFields = Array.from(
        new Set([...metadata.encryptedFields, ...encryptedPaths])
      );

      await Bun.write(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
    } catch (error) {
      // Metadata update is non-critical, log and continue
      logger.warn({ msg: 'Failed to update encryption metadata', error });
    }
  }

  /**
   * Rotate the encryption key (re-encrypt all data with new key)
   */
  public static async rotateKey(
    decryptFn: () => Promise<unknown>,
    encryptFn: (data: unknown) => Promise<void>
  ): Promise<void> {
    // Decrypt all data with current key
    const decryptedData = await decryptFn();

    // Generate new key
    this.encryptionKey = crypto.randomBytes(this.KEY_LENGTH);

    // Save new key
    await Bun.write(this.KEY_FILE, this.encryptionKey.toString('base64'));

    // Re-encrypt data with new key
    await encryptFn(decryptedData);

    // Update metadata
    const metadataFile = Bun.file(this.METADATA_FILE);
    if (await metadataFile.exists()) {
      const metadata = JSON.parse(
        await metadataFile.text()
      ) as EncryptionMetadata;
      metadata.rotatedAt = new Date().toISOString();
      metadata.keyId = crypto.randomBytes(8).toString('hex');
      await Bun.write(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
    }
  }
}

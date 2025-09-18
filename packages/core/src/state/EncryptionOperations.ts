/**
 * Core encryption and decryption operations
 */

import * as crypto from 'crypto';

export interface EncryptedField {
  encrypted: true;
  algorithm: 'aes-256-gcm';
  iv: string; // Base64 encoded initialization vector
  authTag: string; // Base64 encoded auth tag
  data: string; // Base64 encoded encrypted data
}

export class EncryptionOperations {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly IV_LENGTH = 16; // 128 bits

  /**
   * Encrypt a value using AES-256-GCM
   */
  public static encrypt(value: unknown, key: Buffer): EncryptedField {
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
   * Decrypt a value using AES-256-GCM
   */
  public static decrypt(encryptedField: EncryptedField, key: Buffer): unknown {
    if (
      !encryptedField.encrypted ||
      encryptedField.algorithm !== 'aes-256-gcm'
    ) {
      throw new Error('Invalid encrypted field format');
    }

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
   * Check if a value is already encrypted
   */
  public static isEncryptedField(value: unknown): boolean {
    return (
      value !== null &&
      value !== undefined &&
      typeof value === 'object' &&
      'encrypted' in value &&
      (value as Record<string, unknown>).encrypted === true
    );
  }
}

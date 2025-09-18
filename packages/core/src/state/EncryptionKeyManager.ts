/**
 * Encryption key management
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { STATE_DIR } from './constants';

export class EncryptionKeyManager {
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly KEY_FILE = path.join(STATE_DIR, '.encryption-key');
  private static encryptionKey: Buffer | null = null;

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
    await this.generateNewKey();
  }

  /**
   * Generate a new encryption key
   */
  public static async generateNewKey(): Promise<void> {
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
  }

  /**
   * Get the encryption key, initializing if necessary
   */
  public static async getKey(): Promise<Buffer> {
    if (!this.encryptionKey) {
      await this.initializeKey();
    }

    if (!this.encryptionKey) {
      throw new Error('Failed to initialize encryption key');
    }

    return this.encryptionKey;
  }

  /**
   * Replace the current key with a new one
   */
  public static async rotateKey(): Promise<void> {
    await this.generateNewKey();
  }

  /**
   * Get the current key synchronously (for testing)
   */
  public static getCurrentKey(): Buffer | null {
    return this.encryptionKey;
  }
}

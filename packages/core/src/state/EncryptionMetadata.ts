/**
 * Encryption metadata management
 */

import * as crypto from 'crypto';
import * as path from 'path';
import { createLogger } from '../utils/logger';
import { STATE_DIR } from './constants';

const logger = createLogger('checklist:encryption-metadata');

export interface EncryptionMetadata {
  version: '1.0.0';
  keyId: string;
  encryptedFields: string[]; // Dot-notation paths to encrypted fields
  createdAt: string;
  rotatedAt?: string;
}

export class EncryptionMetadataManager {
  private static readonly METADATA_FILE = path.join(
    STATE_DIR,
    '.encryption-metadata.json'
  );

  /**
   * Create initial metadata
   */
  public static async createInitialMetadata(): Promise<EncryptionMetadata> {
    const metadata: EncryptionMetadata = {
      version: '1.0.0',
      keyId: crypto.randomBytes(8).toString('hex'),
      encryptedFields: [],
      createdAt: new Date().toISOString(),
    };

    await Bun.write(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
    return metadata;
  }

  /**
   * Load existing metadata
   */
  public static async loadMetadata(): Promise<EncryptionMetadata | null> {
    try {
      const metadataFile = Bun.file(this.METADATA_FILE);
      if (await metadataFile.exists()) {
        return JSON.parse(await metadataFile.text()) as EncryptionMetadata;
      }
    } catch (error) {
      logger.warn({ msg: 'Failed to load encryption metadata', error });
    }
    return null;
  }

  /**
   * Update metadata with encrypted paths
   */
  public static async updateMetadata(encryptedPaths: string[]): Promise<void> {
    try {
      const existing = await this.loadMetadata();

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
   * Update metadata after key rotation
   */
  public static async updateRotationMetadata(): Promise<void> {
    const metadata = await this.loadMetadata();
    if (metadata) {
      metadata.rotatedAt = new Date().toISOString();
      metadata.keyId = crypto.randomBytes(8).toString('hex');
      await Bun.write(this.METADATA_FILE, JSON.stringify(metadata, null, 2));
    }
  }
}

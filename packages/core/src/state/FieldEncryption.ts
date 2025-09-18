/**
 * Field-level encryption for sensitive data in state files
 * Uses Bun's crypto APIs for AES-256-GCM encryption
 */

import { EncryptionKeyManager } from './EncryptionKeyManager';
import { EncryptionMetadataManager } from './EncryptionMetadata';
import {
  EncryptionOperations,
  type EncryptedField,
} from './EncryptionOperations';

export { type EncryptedField } from './EncryptionOperations';
export { type EncryptionMetadata } from './EncryptionMetadata';

export class FieldEncryption {
  /**
   * Encryption algorithm
   */
  private static readonly ALGORITHM = 'aes-256-gcm';

  /**
   * Key length in bytes (32 bytes = 256 bits)
   */
  private static readonly KEY_LENGTH = 32;

  /**
   * IV length in bytes (16 bytes = 128 bits)
   */
  private static readonly IV_LENGTH = 16;

  /**
   * Authentication tag length in bytes
   */
  private static readonly AUTH_TAG_LENGTH = 16;

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
    await EncryptionKeyManager.initializeKey();
    await EncryptionMetadataManager.createInitialMetadata();
  }

  /**
   * Get the current encryption key (for testing)
   */
  public static getEncryptionKey(): Buffer | null {
    return EncryptionKeyManager.getCurrentKey();
  }

  /**
   * Getter/setter for compatibility with existing tests
   */
  public static get encryptionKey(): Buffer | null {
    return EncryptionKeyManager.getCurrentKey();
  }

  public static set encryptionKey(key: Buffer | null) {
    // This is for test compatibility - normally you shouldn't set the key directly
    (EncryptionKeyManager as unknown as Record<string, unknown>).encryptionKey =
      key;
  }

  /**
   * Set the key file path (for testing)
   */
  public static set KEY_FILE(path: string) {
    (EncryptionKeyManager as unknown as Record<string, unknown>).KEY_FILE =
      path;
  }

  /**
   * Set the metadata file path (for testing)
   */
  public static set METADATA_FILE(path: string) {
    (
      EncryptionMetadataManager as unknown as Record<string, unknown>
    ).METADATA_FILE = path;
  }

  /**
   * Encrypt a value
   */
  public static async encrypt(value: unknown): Promise<EncryptedField> {
    const key = await EncryptionKeyManager.getKey();
    return EncryptionOperations.encrypt(value, key);
  }

  /**
   * Decrypt a value
   */
  public static async decrypt(
    encryptedField: EncryptedField
  ): Promise<unknown> {
    const key = await EncryptionKeyManager.getKey();
    return EncryptionOperations.decrypt(encryptedField, key);
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
      if (this.isAlreadyEncrypted(value)) {
        return value;
      }

      if (this.shouldEncryptPath(currentPath)) {
        encryptedPaths.push(currentPath);
        return await this.encrypt(value);
      }

      return await this.processValueRecursively(
        value,
        currentPath,
        processValue
      );
    };

    const data = await processValue(obj, path);
    return { data, encryptedPaths };
  }

  private static isAlreadyEncrypted(value: unknown): boolean {
    return EncryptionOperations.isEncryptedField(value);
  }

  private static shouldEncryptPath(currentPath: string): boolean {
    return currentPath.length > 0 && this.shouldEncrypt(currentPath);
  }

  private static async processValueRecursively(
    value: unknown,
    currentPath: string,
    processValue: (value: unknown, path: string) => Promise<unknown>
  ): Promise<unknown> {
    if (Array.isArray(value)) {
      return await this.processArray(value, currentPath, processValue);
    }

    if (this.isPlainObject(value)) {
      return await this.processObject(
        value as Record<string, unknown>,
        currentPath,
        processValue
      );
    }

    return value;
  }

  private static async processArray(
    array: unknown[],
    currentPath: string,
    processValue: (value: unknown, path: string) => Promise<unknown>
  ): Promise<unknown[]> {
    return await Promise.all(
      array.map((item, index) =>
        processValue(item, currentPath ? `${currentPath}.${index}` : `${index}`)
      )
    );
  }

  private static async processObject(
    obj: Record<string, unknown>,
    currentPath: string,
    processValue: (value: unknown, path: string) => Promise<unknown>
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      const newPath = currentPath ? `${currentPath}.${key}` : key;
      result[key] = await processValue(val, newPath);
    }

    return result;
  }

  private static isPlainObject(value: unknown): boolean {
    return value !== null && value !== undefined && typeof value === 'object';
  }

  /**
   * Decrypt sensitive fields in an object
   */
  public static async decryptObject(obj: unknown): Promise<unknown> {
    const processValue = async (value: unknown): Promise<unknown> => {
      if (this.isEncryptedField(value)) {
        return await this.decrypt(value as EncryptedField);
      }

      return await this.processDecryptionRecursively(value, processValue);
    };

    return await processValue(obj);
  }

  private static isEncryptedField(value: unknown): boolean {
    return EncryptionOperations.isEncryptedField(value);
  }

  private static async processDecryptionRecursively(
    value: unknown,
    processValue: (value: unknown) => Promise<unknown>
  ): Promise<unknown> {
    if (Array.isArray(value)) {
      return await Promise.all(value.map((item) => processValue(item)));
    }

    if (this.isPlainObject(value)) {
      return await this.processObjectForDecryption(
        value as Record<string, unknown>,
        processValue
      );
    }

    return value;
  }

  private static async processObjectForDecryption(
    obj: Record<string, unknown>,
    processValue: (value: unknown) => Promise<unknown>
  ): Promise<Record<string, unknown>> {
    const result: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(obj)) {
      result[key] = await processValue(val);
    }

    return result;
  }

  /**
   * Update encryption metadata
   */
  public static async updateMetadata(encryptedPaths: string[]): Promise<void> {
    await EncryptionMetadataManager.updateMetadata(encryptedPaths);
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
    await EncryptionKeyManager.rotateKey();

    // Re-encrypt data with new key
    await encryptFn(decryptedData);

    // Update metadata
    await EncryptionMetadataManager.updateRotationMetadata();
  }

  async encryptSensitiveFields(data: unknown): Promise<unknown> {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const result = JSON.parse(JSON.stringify(data));
    await this.encryptObjectFields(result);
    return result;
  }

  private async encryptObjectFields(
    obj: Record<string, unknown>
  ): Promise<void> {
    const sensitiveFields = this.getSensitiveFieldNames();

    for (const key in obj) {
      if (this.isSensitiveField(key, sensitiveFields)) {
        if (typeof obj[key] === 'string') {
          obj[key] = await FieldEncryption.encrypt(obj[key]);
        }
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        await this.encryptObjectFields(obj[key] as Record<string, unknown>);
      }
    }
  }

  private getSensitiveFieldNames(): string[] {
    return ['password', 'secret', 'token', 'apiKey', 'privateKey'];
  }

  private isSensitiveField(key: string, sensitiveFields: string[]): boolean {
    return sensitiveFields.some((field) =>
      key.toLowerCase().includes(field.toLowerCase())
    );
  }
}

import type { StatePreservationConfig } from './StateStorage';

export class StatePreservationConfigManager {
  static createDefaultConfig(
    config: Partial<StatePreservationConfig> = {}
  ): StatePreservationConfig {
    return {
      maxStorageSize: 50 * 1024 * 1024,
      compressionThreshold: 1024,
      defaultTTL: 3600000,
      enableCompression: true,
      enableEncryption: false,
      storageBackend: 'memory',
      ...config,
    };
  }

  static validateConfig(config: StatePreservationConfig): void {
    if (config.maxStorageSize <= 0) {
      throw new Error('maxStorageSize must be positive');
    }
    if (config.compressionThreshold < 0) {
      throw new Error('compressionThreshold must be non-negative');
    }
    if (config.defaultTTL <= 0) {
      throw new Error('defaultTTL must be positive');
    }
  }
}

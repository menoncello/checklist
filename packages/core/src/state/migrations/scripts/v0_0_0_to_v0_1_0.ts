import { Migration } from '../types';

export const migration_v0_0_0_to_v0_1_0: Migration = {
  fromVersion: '0.0.0',
  toVersion: '0.1.0',
  description: 'Add metadata fields for tracking creation and modification times',
  
  up: (state: unknown) => {
    const now = new Date().toISOString();
    const s = state as Record<string, unknown>;
    
    return {
      ...s,
      version: '0.1.0',
      schemaVersion: '0.1.0',
      metadata: {
        created: (s.created as string | undefined) ?? (s.createdAt as string | undefined) ?? now,
        modified: (s.modified as string | undefined) ?? (s.modifiedAt as string | undefined) ?? (s.lastModified as string | undefined) ?? now,
        migrationHistory: []
      },
      checklists: Array.isArray(s.checklists) ? s.checklists : [],
      settings: (s.settings as Record<string, unknown> | undefined) ?? {},
      lastModified: now
    };
  },
  
  down: (state: unknown) => {
    const { metadata: _metadata, schemaVersion: _schemaVersion, ...rest } = state as Record<string, unknown>;
    
    return {
      ...rest,
      version: '0.0.0'
    };
  },
  
  validate: (state: unknown): boolean => {
    const s = state as Record<string, unknown>;
    if (s.metadata == null) return false;
    if (typeof s.metadata !== 'object') return false;
    const metadata = s.metadata as Record<string, unknown>;
    if (metadata.created == null) return false;
    if (metadata.modified == null) return false;
    if (s.version !== '0.1.0') return false;
    
    return true;
  }
};
import { Migration } from '../types';

export const migration_v0_0_0_to_v0_1_0: Migration = {
  fromVersion: '0.0.0',
  toVersion: '0.1.0',
  description: 'Add metadata fields for tracking creation and modification times',
  
  up: (state: any) => {
    const now = new Date().toISOString();
    
    return {
      ...state,
      version: '0.1.0',
      schemaVersion: '0.1.0',
      metadata: {
        created: (state.created as string | undefined) ?? (state.createdAt as string | undefined) ?? now,
        modified: (state.modified as string | undefined) ?? (state.modifiedAt as string | undefined) ?? (state.lastModified as string | undefined) ?? now,
        migrationHistory: []
      },
      checklists: Array.isArray(state.checklists) ? state.checklists : [],
      settings: (state.settings as Record<string, unknown> | undefined) ?? {},
      lastModified: now
    };
  },
  
  down: (state: any) => {
    const { metadata, schemaVersion, ...rest } = state;
    
    return {
      ...rest,
      version: '0.0.0'
    };
  },
  
  validate: (state: any): boolean => {
    if (!state.metadata) return false;
    if (typeof state.metadata !== 'object') return false;
    if (!state.metadata.created) return false;
    if (!state.metadata.modified) return false;
    if (!state.version || state.version !== '0.1.0') return false;
    
    return true;
  }
};
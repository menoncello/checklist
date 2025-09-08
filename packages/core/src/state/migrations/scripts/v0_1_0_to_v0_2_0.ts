import { Migration } from '../types';

export const migration_v0_1_0_to_v0_2_0: Migration = {
  fromVersion: '0.1.0',
  toVersion: '0.2.0',
  description: 'Add support for templates and variables',
  
  up: (state: any) => {
    const now = new Date().toISOString();
    
    return {
      ...state,
      version: '0.2.0',
      schemaVersion: '0.2.0',
      templates: (state.templates as unknown[] | undefined) ?? [],
      variables: (state.variables as Record<string, unknown> | undefined) ?? {},
      metadata: {
        ...state.metadata,
        modified: now,
        templatesAdded: now
      },
      lastModified: now
    };
  },
  
  down: (state: any) => {
    const { templates, variables, ...rest } = state;
    
    if (rest.metadata?.templatesAdded) {
      delete rest.metadata.templatesAdded;
    }
    
    return {
      ...rest,
      version: '0.1.0',
      schemaVersion: '0.1.0',
      lastModified: new Date().toISOString()
    };
  },
  
  validate: (state: any): boolean => {
    if (!Array.isArray(state.templates)) return false;
    if (typeof state.variables !== 'object' || state.variables === null) return false;
    if (!state.version || state.version !== '0.2.0') return false;
    if (!state.metadata || typeof state.metadata !== 'object') return false;
    
    return true;
  }
};
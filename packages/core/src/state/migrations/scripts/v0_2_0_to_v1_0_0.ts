import * as crypto from 'crypto';
import { Migration } from '../types';

export const migration_v0_2_0_to_v1_0_0: Migration = {
  fromVersion: '0.2.0',
  toVersion: '1.0.0',
  description: 'Major release: Add recovery, conflicts, and enhanced step tracking',
  
  up: (state: any) => {
    const now = new Date().toISOString();
    
    const enhancedState = {
      ...state,
      version: '1.0.0',
      schemaVersion: '1.0.0',
      recovery: (state.recovery as unknown | undefined) ?? null,
      conflicts: (state.conflicts as unknown[] | undefined) ?? [],
      lastModified: now
    };
    
    if (state.activeInstance) {
      enhancedState.activeInstance = {
        ...state.activeInstance,
        completedSteps: ((state.activeInstance.completedSteps as unknown[]) ?? []).map((step: any) => {
          if (typeof step === 'string') {
            return {
              id: step,
              completedAt: now,
              completedBy: 'migration',
              commandResults: []
            };
          }
          
          return {
            ...step,
            commandResults: step.commandResults || []
          };
        })
      };
    }
    
    if (state.checklists && Array.isArray(state.checklists)) {
      enhancedState.checklists = state.checklists.map((checklist: any) => ({
        ...checklist,
        version: checklist.version || '1.0.0',
        checksum: checklist.checksum || generateChecksum(checklist)
      }));
    }
    
    enhancedState.metadata = {
      ...state.metadata,
      modified: now,
      lastMigration: now,
      majorVersionUpgrade: '1.0.0'
    };
    
    enhancedState.checksum = generateChecksum(enhancedState);
    
    return enhancedState;
  },
  
  down: (state: any) => {
    const { recovery, conflicts, checksum, ...rest } = state;
    
    if (rest.activeInstance?.completedSteps) {
      rest.activeInstance.completedSteps = rest.activeInstance.completedSteps.map((step: any) => {
        if (step.commandResults) {
          const { commandResults, ...stepRest } = step;
          return stepRest;
        }
        return step;
      });
    }
    
    if (rest.checklists && Array.isArray(rest.checklists)) {
      rest.checklists = rest.checklists.map((checklist: any) => {
        const { checksum, ...checklistRest } = checklist;
        return checklistRest;
      });
    }
    
    if (rest.metadata?.majorVersionUpgrade) {
      delete rest.metadata.majorVersionUpgrade;
    }
    
    return {
      ...rest,
      version: '0.2.0',
      schemaVersion: '0.2.0',
      lastModified: new Date().toISOString()
    };
  },
  
  validate: (state: any): boolean => {
    if (!state.version || state.version !== '1.0.0') return false;
    if (!state.schemaVersion || state.schemaVersion !== '1.0.0') return false;
    if (state.recovery !== null && typeof state.recovery !== 'object') return false;
    if (!Array.isArray(state.conflicts)) return false;
    if (!state.checksum || typeof state.checksum !== 'string') return false;
    
    if (state.activeInstance?.completedSteps) {
      for (const step of state.activeInstance.completedSteps) {
        if (typeof step === 'object' && !Array.isArray(step.commandResults)) {
          return false;
        }
      }
    }
    
    return true;
  }
};

function generateChecksum(data: any): string {
  const hash = crypto.createHash('sha256');
  const content = JSON.stringify(data, Object.keys(data).sort());
  hash.update(content);
  return `sha256:${hash.digest('hex').substring(0, 16)}`;
}
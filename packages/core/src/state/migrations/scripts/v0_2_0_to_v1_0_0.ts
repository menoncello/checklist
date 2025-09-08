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
    
    if (state.activeInstance !== null && state.activeInstance !== undefined) {
      enhancedState.activeInstance = {
        ...state.activeInstance,
        completedSteps: ((state.activeInstance.completedSteps as unknown[]) ?? []).map((step: any) => {
          if (typeof step === 'string') {
            return {
              id: step,
              completedAt: now,
              result: 'success',
              notes: ''
            };
          }
          return {
            ...step,
            completedAt: (step.completedAt as string | undefined) ?? now,
            result: (step.result as string | undefined) ?? 'success',
            notes: (step.notes as string | undefined) ?? ''
          };
        })
      };
    }
    
    if (state.checklists !== null && state.checklists !== undefined && Array.isArray(state.checklists)) {
      enhancedState.checklists = state.checklists.map((checklist: any) => ({
        ...checklist,
        conditions: (checklist.conditions as string | undefined) ?? '',
        commandResults: (checklist.commandResults as Record<string, unknown> | undefined) ?? {}
      }));
    }
    
    enhancedState.recovery ??= {
      enabled: false,
      checkpoints: []
    };
    
    return enhancedState;
  },
  
  down: (state: any) => {
    const { 
      recovery: _recovery, 
      conflicts: _conflicts, 
      checksum: _checksum, 
      ...rest 
    } = state;
    
    if (rest.activeInstance?.completedSteps !== undefined && Array.isArray(rest.activeInstance.completedSteps)) {
      rest.activeInstance.completedSteps = rest.activeInstance.completedSteps.map((step: any) => {
        if (typeof step === 'object' && step !== null) {
          const { 
            completedAt: _completedAt, 
            result: _result, 
            notes: _notes, 
            ...stepRest 
          } = step;
          return stepRest.id ?? stepRest;
        }
        return step;
      });
    }
    
    if (rest.checklists !== undefined && Array.isArray(rest.checklists)) {
      rest.checklists = rest.checklists.map((checklist: any) => {
        const { 
          conditions: _conditions, 
          commandResults: _commandResults, 
          checksum: _checksum2, 
          ...checklistRest 
        } = checklist;
        return checklistRest;
      });
    }
    
    return {
      ...rest,
      version: '0.2.0',
      schemaVersion: '0.2.0',
      lastModified: new Date().toISOString()
    };
  },
  
  validate: (state: any): boolean => {
    if (state.recovery === null || state.recovery === undefined) return false;
    if (!Array.isArray(state.conflicts)) return false;
    if (typeof state.recovery !== 'object') return false;
    if (state.recovery.enabled === undefined) return false;
    if (!Array.isArray(state.recovery.checkpoints)) return false;
    if (state.version === null || state.version === undefined || state.version !== '1.0.0') return false;
    if (state.schemaVersion === null || state.schemaVersion === undefined || state.schemaVersion !== '1.0.0') return false;
    
    return true;
  }
};
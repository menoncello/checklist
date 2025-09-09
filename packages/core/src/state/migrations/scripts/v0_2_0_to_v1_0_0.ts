import { Migration } from '../types';

export const migration_v0_2_0_to_v1_0_0: Migration = {
  fromVersion: '0.2.0',
  toVersion: '1.0.0',
  description: 'Major release: Add recovery, conflicts, and enhanced step tracking',
  
  up: (state: unknown) => {
    const s = state as Record<string, unknown>;
    const now = new Date().toISOString();
    
    const enhancedState: Record<string, unknown> = {
      ...s,
      version: '1.0.0',
      schemaVersion: '1.0.0',
      recovery: s.recovery ?? null,
      conflicts: (s.conflicts as unknown[] | undefined) ?? [],
      lastModified: now
    };
    
    if (s.activeInstance !== null && s.activeInstance !== undefined) {
      enhancedState.activeInstance = {
        ...(s.activeInstance as Record<string, unknown>),
        completedSteps: (((s.activeInstance as Record<string, unknown>).completedSteps as unknown[]) ?? []).map((step: unknown) => {
          if (typeof step === 'string') {
            return {
              id: step,
              completedAt: now,
              result: 'success',
              notes: ''
            };
          }
          return {
            ...(step as Record<string, unknown>),
            completedAt: ((step as Record<string, unknown>).completedAt as string | undefined) ?? now,
            result: ((step as Record<string, unknown>).result as string | undefined) ?? 'success',
            notes: ((step as Record<string, unknown>).notes as string | undefined) ?? ''
          };
        })
      };
    }
    
    if (s.checklists !== null && s.checklists !== undefined && Array.isArray(s.checklists)) {
      enhancedState.checklists = s.checklists.map((checklist: unknown) => ({
        ...(checklist as Record<string, unknown>),
        conditions: ((checklist as Record<string, unknown>).conditions as string | undefined) ?? '',
        commandResults: ((checklist as Record<string, unknown>).commandResults as Record<string, unknown> | undefined) ?? {}
      }));
    }
    
    enhancedState.recovery ??= {
      enabled: false,
      checkpoints: []
    };
    
    return enhancedState;
  },
  
  down: (state: unknown) => {
    const s = state as Record<string, unknown>;
    const { 
      recovery: _recovery, 
      conflicts: _conflicts, 
      checksum: _checksum, 
      ...rest 
    } = s;
    
    if ((rest.activeInstance as Record<string, unknown>)?.completedSteps !== undefined && Array.isArray((rest.activeInstance as Record<string, unknown>).completedSteps)) {
      (rest.activeInstance as Record<string, unknown>).completedSteps = ((rest.activeInstance as Record<string, unknown>).completedSteps as unknown[]).map((step: unknown) => {
        if (typeof step === 'object' && step !== null) {
          const { 
            completedAt: _completedAt, 
            result: _result, 
            notes: _notes, 
            ...stepRest 
          } = step as Record<string, unknown>;
          return (stepRest as Record<string, unknown>).id ?? stepRest;
        }
        return step;
      });
    }
    
    if (rest.checklists !== undefined && Array.isArray(rest.checklists)) {
      rest.checklists = (rest.checklists as unknown[]).map((checklist: unknown) => {
        const { 
          conditions: _conditions, 
          commandResults: _commandResults, 
          checksum: _checksum2, 
          ...checklistRest 
        } = checklist as Record<string, unknown>;
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
  
  validate: (state: unknown): boolean => {
    const s = state as Record<string, unknown>;
    if (s.recovery === null || s.recovery === undefined) return false;
    if (!Array.isArray(s.conflicts)) return false;
    if (typeof s.recovery !== 'object') return false;
    const recovery = s.recovery as Record<string, unknown>;
    if (recovery.enabled === undefined) return false;
    if (!Array.isArray(recovery.checkpoints)) return false;
    if (s.version === null || s.version === undefined || s.version !== '1.0.0') return false;
    if (s.schemaVersion === null || s.schemaVersion === undefined || s.schemaVersion !== '1.0.0') return false;
    
    return true;
  }
};
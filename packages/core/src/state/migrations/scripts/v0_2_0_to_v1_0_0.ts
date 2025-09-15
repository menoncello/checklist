import { Migration } from '../types';

// Helper functions for up migration
function createBaseState(s: Record<string, unknown>, now: string): Record<string, unknown> {
  // Generate a placeholder checksum (in real scenario, this would be calculated from the state)
  const placeholderChecksum = 'sha256:' + '0'.repeat(64);

  return {
    ...s,
    version: '1.0.0',
    schemaVersion: '1.0.0',
    checksum: (s.checksum as string | undefined) ?? placeholderChecksum,
    completedSteps: (s.completedSteps as unknown[] | undefined) ?? [],
    recovery: s.recovery ?? {
      enabled: false,
      checkpoints: [],
      dataLoss: false,
    },
    conflicts: (s.conflicts as unknown | undefined) ?? {
      resolutions: [],
    },
    lastModified: now,
  };
}

function upgradeActiveInstance(
  s: Record<string, unknown>,
  enhancedState: Record<string, unknown>,
  now: string
): void {
  if (s.activeInstance === null || s.activeInstance === undefined) return;

  const instance = s.activeInstance as Record<string, unknown>;
  enhancedState.activeInstance = {
    ...instance,
    completedSteps: upgradeCompletedSteps(instance.completedSteps, now),
  };
}

function upgradeCompletedSteps(steps: unknown, now: string): unknown[] {
  const stepArray = (steps as unknown[]) ?? [];
  return stepArray.map((step: unknown) => {
    if (typeof step === 'string') {
      return {
        id: step,
        completedAt: now,
        result: 'success',
        notes: '',
      };
    }
    const stepObj = step as Record<string, unknown>;
    return {
      ...stepObj,
      completedAt: stepObj.completedAt ?? now,
      result: stepObj.result ?? 'success',
      notes: stepObj.notes ?? '',
    };
  });
}

function upgradeChecklists(s: Record<string, unknown>, enhancedState: Record<string, unknown>): void {
  if (s.checklists === null || s.checklists === undefined || !Array.isArray(s.checklists)) {
    return;
  }

  enhancedState.checklists = s.checklists.map((checklist: unknown) => {
    const checklistObj = checklist as Record<string, unknown>;
    return {
      ...checklistObj,
      conditions: checklistObj.conditions ?? '',
      commandResults: checklistObj.commandResults ?? {},
    };
  });
}

function ensureRecoveryFields(enhancedState: Record<string, unknown>): void {
  enhancedState.recovery ??= {
    enabled: false,
    checkpoints: [],
  };
}

// Helper functions for down migration
function removeV1Fields(s: Record<string, unknown>): Record<string, unknown> {
  const {
    recovery: _recovery,
    conflicts: _conflicts,
    checksum: _checksum,
    ...rest
  } = s;
  return rest;
}

function downgradeActiveInstance(rest: Record<string, unknown>): void {
  const instance = rest.activeInstance as Record<string, unknown> | undefined;
  if (instance?.completedSteps === undefined || !Array.isArray(instance.completedSteps)) {
    return;
  }

  instance.completedSteps = instance.completedSteps.map((step: unknown) => {
    if (typeof step === 'object' && step !== null) {
      const stepObj = step as Record<string, unknown>;
      const {
        completedAt: _completedAt,
        result: _result,
        notes: _notes,
        ...stepRest
      } = stepObj;
      return stepRest.id ?? stepRest;
    }
    return step;
  });
}

function downgradeChecklists(rest: Record<string, unknown>): void {
  if (rest.checklists === undefined || !Array.isArray(rest.checklists)) {
    return;
  }

  rest.checklists = rest.checklists.map((checklist: unknown) => {
    const {
      conditions: _conditions,
      commandResults: _commandResults,
      checksum: _checksum2,
      ...checklistRest
    } = checklist as Record<string, unknown>;
    return checklistRest;
  });
}

// Helper functions for validation
function validateRecoveryField(s: Record<string, unknown>): boolean {
  if (s.recovery === null || s.recovery === undefined) return false;
  if (typeof s.recovery !== 'object') return false;

  const recovery = s.recovery as Record<string, unknown>;
  return recovery.enabled !== undefined && Array.isArray(recovery.checkpoints);
}

function validateConflictsField(s: Record<string, unknown>): boolean {
  if (s.conflicts === null || s.conflicts === undefined) return false;
  if (typeof s.conflicts !== 'object') return false;
  const conflicts = s.conflicts as Record<string, unknown>;
  return Array.isArray(conflicts.resolutions);
}

function validateVersionFields(s: Record<string, unknown>): boolean {
  return s.version === '1.0.0' && s.schemaVersion === '1.0.0';
}

export const migration_v0_2_0_to_v1_0_0: Migration = {
  fromVersion: '0.2.0',
  toVersion: '1.0.0',
  description:
    'Major release: Add recovery, conflicts, and enhanced step tracking',

  up: (state: unknown) => {
    const s = state as Record<string, unknown>;
    const now = new Date().toISOString();

    const enhancedState = createBaseState(s, now);
    upgradeActiveInstance(s, enhancedState, now);
    upgradeChecklists(s, enhancedState);
    ensureRecoveryFields(enhancedState);

    return enhancedState;
  },

  down: (state: unknown) => {
    const s = state as Record<string, unknown>;
    const rest = removeV1Fields(s);
    downgradeActiveInstance(rest);
    downgradeChecklists(rest);

    return {
      ...rest,
      version: '0.2.0',
      schemaVersion: '0.2.0',
      lastModified: new Date().toISOString(),
    };
  },

  validate: (state: unknown): boolean => {
    const s = state as Record<string, unknown>;
    return (
      validateRecoveryField(s) &&
      validateConflictsField(s) &&
      validateVersionFields(s)
    );
  },
};
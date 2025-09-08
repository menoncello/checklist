import { StateSchema, VersionDetectionError } from './types';

export async function detectVersion(state: any): Promise<string> {
  if (state === null || state === undefined || typeof state !== 'object') {
    throw new VersionDetectionError('Invalid state object');
  }

  if (
    state.schemaVersion !== undefined &&
    typeof state.schemaVersion === 'string'
  ) {
    return state.schemaVersion;
  }

  if (state.version !== undefined && typeof state.version === 'string') {
    return state.version;
  }

  if (state.templates !== undefined && state.variables !== undefined) {
    if (state.recovery !== undefined || state.conflicts !== undefined) {
      return '1.0.0';
    }
    return '0.2.0';
  }

  if (
    state.metadata !== null &&
    state.metadata !== undefined &&
    typeof state.metadata === 'object'
  ) {
    if (
      (state.metadata.created !== null &&
        state.metadata.created !== undefined) ||
      (state.metadata.modified !== null &&
        state.metadata.modified !== undefined)
    ) {
      return '0.1.0';
    }
  }

  if (
    state.checklists !== null &&
    state.checklists !== undefined &&
    Array.isArray(state.checklists)
  ) {
    return '0.0.0';
  }

  if (
    (state.activeInstance !== null && state.activeInstance !== undefined) ||
    (state.completedSteps !== null && state.completedSteps !== undefined) ||
    (state.currentStepId !== null && state.currentStepId !== undefined)
  ) {
    return '0.0.0';
  }

  return '0.0.0';
}

export function isCompatibleVersion(
  currentVersion: string,
  requiredVersion: string,
  allowNewer: boolean = true
): boolean {
  const current = parseVersionParts(currentVersion);
  const required = parseVersionParts(requiredVersion);

  if (current.major < required.major) {
    return false;
  }

  if (current.major > required.major) {
    return allowNewer;
  }

  if (current.minor < required.minor) {
    return false;
  }

  if (current.minor > required.minor) {
    return allowNewer;
  }

  if (current.patch < required.patch) {
    return false;
  }

  return true;
}

export function parseVersionParts(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
} {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)(?:-(.+))?$/);

  if (!match) {
    throw new VersionDetectionError(`Invalid version format: ${version}`);
  }

  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
    prerelease: match[4],
  };
}

export function needsMigration(
  stateVersion: string,
  applicationVersion: string
): boolean {
  if (stateVersion === applicationVersion) {
    return false;
  }

  const state = parseVersionParts(stateVersion);
  const app = parseVersionParts(applicationVersion);

  if (state.major !== app.major) {
    return true;
  }

  if (state.minor !== app.minor) {
    return true;
  }

  if (state.patch !== app.patch) {
    return true;
  }

  return false;
}

export function getMigrationDirection(
  fromVersion: string,
  toVersion: string
): 'upgrade' | 'downgrade' | 'none' {
  if (fromVersion === toVersion) {
    return 'none';
  }

  const from = parseVersionParts(fromVersion);
  const to = parseVersionParts(toVersion);

  if (from.major < to.major) return 'upgrade';
  if (from.major > to.major) return 'downgrade';

  if (from.minor < to.minor) return 'upgrade';
  if (from.minor > to.minor) return 'downgrade';

  if (from.patch < to.patch) return 'upgrade';
  if (from.patch > to.patch) return 'downgrade';

  return 'none';
}

export function getVersionRange(versions: string[]): {
  min: string;
  max: string;
} {
  if (versions.length === 0) {
    throw new VersionDetectionError('No versions provided');
  }

  const sorted = versions.sort((a, b) => {
    const aVer = parseVersionParts(a);
    const bVer = parseVersionParts(b);

    if (aVer.major !== bVer.major) {
      return aVer.major - bVer.major;
    }
    if (aVer.minor !== bVer.minor) {
      return aVer.minor - bVer.minor;
    }
    return aVer.patch - bVer.patch;
  });

  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
  };
}

export function inferStateStructure(state: any): {
  hasChecklists: boolean;
  hasTemplates: boolean;
  hasVariables: boolean;
  hasMetadata: boolean;
  hasRecovery: boolean;
  hasConflicts: boolean;
  hasMigrations: boolean;
  estimatedVersion: string;
} {
  const structure = {
    hasChecklists:
      state.checklists !== undefined && Array.isArray(state.checklists),
    hasTemplates:
      state.templates !== undefined && Array.isArray(state.templates),
    hasVariables:
      state.variables !== undefined && typeof state.variables === 'object',
    hasMetadata:
      state.metadata !== undefined && typeof state.metadata === 'object',
    hasRecovery: state.recovery !== undefined,
    hasConflicts:
      state.conflicts !== undefined && Array.isArray(state.conflicts),
    hasMigrations:
      state.migrations !== undefined && Array.isArray(state.migrations),
    estimatedVersion: '0.0.0',
  };

  if (
    structure.hasMigrations &&
    structure.hasRecovery &&
    structure.hasConflicts
  ) {
    structure.estimatedVersion = '1.0.0';
  } else if (structure.hasTemplates && structure.hasVariables) {
    structure.estimatedVersion = '0.2.0';
  } else if (structure.hasMetadata) {
    structure.estimatedVersion = '0.1.0';
  } else if (structure.hasChecklists) {
    structure.estimatedVersion = '0.0.0';
  }

  return structure;
}

export async function validateStateIntegrity(state: StateSchema): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!state.version && !state.schemaVersion) {
    errors.push('State file missing version information');
  }

  if (
    state.version &&
    state.schemaVersion &&
    state.version !== state.schemaVersion
  ) {
    warnings.push(
      `Version mismatch: version=${state.version}, schemaVersion=${state.schemaVersion}`
    );
  }

  if (!state.lastModified) {
    warnings.push('State file missing lastModified timestamp');
  }

  if (state.migrations && !Array.isArray(state.migrations)) {
    errors.push('Invalid migrations field: must be an array');
  }

  if (state.checklists && !Array.isArray(state.checklists)) {
    errors.push('Invalid checklists field: must be an array');
  }

  if (state.templates && !Array.isArray(state.templates)) {
    errors.push('Invalid templates field: must be an array');
  }

  if (
    state.variables !== undefined &&
    (typeof state.variables !== 'object' || Array.isArray(state.variables))
  ) {
    errors.push('Invalid variables field: must be an object');
  }

  if (state.conflicts && !Array.isArray(state.conflicts)) {
    errors.push('Invalid conflicts field: must be an array');
  }

  if (state.metadata) {
    if (typeof state.metadata !== 'object') {
      errors.push('Invalid metadata field: must be an object');
    } else {
      if (state.metadata.created && !isValidDate(state.metadata.created)) {
        warnings.push('Invalid metadata.created timestamp');
      }
      if (state.metadata.modified && !isValidDate(state.metadata.modified)) {
        warnings.push('Invalid metadata.modified timestamp');
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

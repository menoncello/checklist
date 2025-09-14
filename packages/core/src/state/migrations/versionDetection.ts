import { StateSchema, VersionDetectionError } from './types';

export async function detectVersion(state: unknown): Promise<string> {
  validateStateObject(state);

  const s = state as Record<string, unknown>;

  const explicitVersion = getExplicitVersion(s);
  if (explicitVersion !== null) return explicitVersion;

  const inferredVersion = inferVersionFromStructure(s);
  return inferredVersion;
}

function validateStateObject(state: unknown): void {
  if (state === null || state === undefined || typeof state !== 'object') {
    throw new VersionDetectionError('Invalid state object');
  }
}

function getExplicitVersion(s: Record<string, unknown>): string | null {
  if (s.schemaVersion !== undefined && typeof s.schemaVersion === 'string') {
    return s.schemaVersion;
  }
  if (s.version !== undefined && typeof s.version === 'string') {
    return s.version;
  }
  return null;
}

function inferVersionFromStructure(s: Record<string, unknown>): string {
  if (hasTemplatesAndVariables(s)) {
    return hasRecoveryOrConflicts(s) ? '1.0.0' : '0.2.0';
  }

  if (hasMetadataWithTimestamps(s)) {
    return '0.1.0';
  }

  if (hasChecklistsArray(s) || hasWorkflowFields(s)) {
    return '0.0.0';
  }

  return '0.0.0';
}

function hasTemplatesAndVariables(s: Record<string, unknown>): boolean {
  return s.templates !== undefined && s.variables !== undefined;
}

function hasRecoveryOrConflicts(s: Record<string, unknown>): boolean {
  return s.recovery !== undefined || s.conflicts !== undefined;
}

function hasMetadataWithTimestamps(s: Record<string, unknown>): boolean {
  if (s.metadata === null || s.metadata === undefined || typeof s.metadata !== 'object') {
    return false;
  }
  const metadata = s.metadata as Record<string, unknown>;
  return (
    (metadata.created !== null && metadata.created !== undefined) ||
    (metadata.modified !== null && metadata.modified !== undefined)
  );
}

function hasChecklistsArray(s: Record<string, unknown>): boolean {
  return s.checklists !== null && s.checklists !== undefined && Array.isArray(s.checklists);
}

function hasWorkflowFields(s: Record<string, unknown>): boolean {
  return (
    (s.activeInstance !== null && s.activeInstance !== undefined) ||
    (s.completedSteps !== null && s.completedSteps !== undefined) ||
    (s.currentStepId !== null && s.currentStepId !== undefined)
  );
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

export function inferStateStructure(state: unknown): {
  hasChecklists: boolean;
  hasTemplates: boolean;
  hasVariables: boolean;
  hasMetadata: boolean;
  hasRecovery: boolean;
  hasConflicts: boolean;
  hasMigrations: boolean;
  estimatedVersion: string;
} {
  const s = state as Record<string, unknown>;
  const structure = detectStateComponents(s);
  structure.estimatedVersion = determineStateVersion(structure);
  return structure;
}

function detectStateComponents(s: Record<string, unknown>) {
  return {
    hasChecklists: s.checklists !== undefined && Array.isArray(s.checklists),
    hasTemplates: s.templates !== undefined && Array.isArray(s.templates),
    hasVariables: s.variables !== undefined && typeof s.variables === 'object',
    hasMetadata: s.metadata !== undefined && typeof s.metadata === 'object',
    hasRecovery: s.recovery !== undefined,
    hasConflicts: s.conflicts !== undefined && Array.isArray(s.conflicts),
    hasMigrations: s.migrations !== undefined && Array.isArray(s.migrations),
    estimatedVersion: '0.0.0',
  };
}

function determineStateVersion(structure: {
  hasChecklists: boolean;
  hasTemplates: boolean;
  hasVariables: boolean;
  hasMetadata: boolean;
  hasRecovery: boolean;
  hasConflicts: boolean;
  hasMigrations: boolean;
}): string {
  if (structure.hasMigrations && structure.hasRecovery && structure.hasConflicts) {
    return '1.0.0';
  }
  if (structure.hasTemplates && structure.hasVariables) {
    return '0.2.0';
  }
  if (structure.hasMetadata) {
    return '0.1.0';
  }
  if (structure.hasChecklists) {
    return '0.0.0';
  }
  return '0.0.0';
}

export async function validateStateIntegrity(state: StateSchema): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];
  const s = state as unknown as Record<string, unknown>;

  validateVersionFields(s, errors, warnings);
  validateArrayFields(s, errors);
  validateObjectFields(s, errors);
  validateMetadata(s, errors, warnings);

  if (s.lastModified === undefined) {
    warnings.push('State file missing lastModified timestamp');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

function validateVersionFields(
  s: Record<string, unknown>,
  errors: string[],
  warnings: string[]
): void {
  if (s.version === undefined && s.schemaVersion === undefined) {
    errors.push('State file missing version information');
  }

  if (
    s.version !== undefined &&
    s.schemaVersion !== undefined &&
    s.version !== s.schemaVersion
  ) {
    warnings.push(
      `Version mismatch: version=${s.version}, schemaVersion=${s.schemaVersion}`
    );
  }
}

function validateArrayFields(s: Record<string, unknown>, errors: string[]): void {
  const arrayFields = [
    { name: 'migrations', value: s.migrations },
    { name: 'checklists', value: s.checklists },
    { name: 'templates', value: s.templates },
    { name: 'conflicts', value: s.conflicts },
  ];

  arrayFields.forEach(({ name, value }) => {
    if (value !== undefined && !Array.isArray(value)) {
      errors.push(`Invalid ${name} field: must be an array`);
    }
  });
}

function validateObjectFields(s: Record<string, unknown>, errors: string[]): void {
  if (
    s.variables !== undefined &&
    (typeof s.variables !== 'object' || Array.isArray(s.variables))
  ) {
    errors.push('Invalid variables field: must be an object');
  }
}

function validateMetadata(
  s: Record<string, unknown>,
  errors: string[],
  warnings: string[]
): void {
  if (s.metadata === undefined) return;

  if (typeof s.metadata !== 'object') {
    errors.push('Invalid metadata field: must be an object');
    return;
  }

  const metadata = s.metadata as Record<string, unknown>;
  if (metadata.created !== undefined && !isValidDate(metadata.created as string)) {
    warnings.push('Invalid metadata.created timestamp');
  }
  if (metadata.modified !== undefined && !isValidDate(metadata.modified as string)) {
    warnings.push('Invalid metadata.modified timestamp');
  }
}

function isValidDate(dateString: string): boolean {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

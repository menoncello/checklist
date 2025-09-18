import { SchemaValidator } from './SchemaValidator';
import { VersionDetector } from './VersionDetector';
import { StateSchema } from './types';

export async function detectVersion(state: unknown): Promise<string> {
  VersionDetector.validateStateObject(state);

  const s = state as Record<string, unknown>;

  const explicitVersion = VersionDetector.getExplicitVersion(s);
  if (explicitVersion !== null) return explicitVersion;

  const inferredVersion = VersionDetector.inferVersionFromStructure(s);
  return inferredVersion;
}

export function validateStateSchema(
  state: StateSchema,
  version: string
): boolean {
  // Parse version to handle minor and patch versions
  const [major, minor] = version.split('.').map(Number);

  // For 1.x.x versions, use v1.0.0 validator
  if (major === 1) {
    return SchemaValidator.validateV100(state);
  }

  // For 0.x.x versions, check minor version
  if (major === 0) {
    if (minor === 0) return SchemaValidator.validateV000(state);
    if (minor === 1) return SchemaValidator.validateV010(state);
    if (minor === 2) return SchemaValidator.validateV020(state);
  }

  return false;
}

export function isCompatibleVersion(
  current: string,
  target: string,
  allowNewer: boolean = false
): boolean {
  const currentNumber = getVersionNumber(current);
  const targetNumber = getVersionNumber(target);
  const currentParts = current.split('.').map(Number);
  const targetParts = target.split('.').map(Number);

  // Major version mismatch
  if (currentParts[0] !== targetParts[0]) {
    return currentParts[0] > targetParts[0] ? allowNewer : false;
  }

  // Same major version - newer or equal minor/patch versions are compatible
  return currentNumber >= targetNumber;
}

export function getVersionNumber(version: string): number {
  const parts = version.split('.').map(Number);
  return parts[0] * 10000 + parts[1] * 100 + parts[2];
}

export function compareVersions(v1: string, v2: string): number {
  const n1 = getVersionNumber(v1);
  const n2 = getVersionNumber(v2);
  return n1 - n2;
}

// Re-export utilities for backward compatibility
export { VersionDetector, SchemaValidator };

// Additional utility functions
export function parseVersionParts(version: string): {
  major: number;
  minor: number;
  patch: number;
  prerelease?: string;
} {
  const [versionPart, prerelease] = version.split('-');
  const parts = versionPart.split('.');

  if (parts.length < 3) throw new Error('Invalid version format');

  const [major, minor, patch] = parts.map((p) => parseInt(p, 10));
  if (isNaN(major) || isNaN(minor) || isNaN(patch)) {
    throw new Error('Invalid version format');
  }

  return prerelease
    ? { major, minor, patch, prerelease }
    : { major, minor, patch };
}

export function needsMigration(current: string, target: string): boolean {
  return compareVersions(current, target) < 0;
}

export function getMigrationDirection(
  current: string,
  target: string
): 'upgrade' | 'downgrade' | 'none' {
  const comparison = compareVersions(current, target);
  if (comparison < 0) return 'upgrade';
  if (comparison > 0) return 'downgrade';
  return 'none';
}

export function getVersionRange(versions: string[]): {
  min: string;
  max: string;
} {
  if (versions.length === 0) {
    throw new Error('No versions provided');
  }
  const sorted = [...versions].sort((a, b) => compareVersions(a, b));
  return { min: sorted[0], max: sorted[sorted.length - 1] };
}

export function inferStateStructure(state: unknown): {
  hasChecklists?: boolean;
  hasTemplates?: boolean;
  hasVariables?: boolean;
  hasMetadata?: boolean;
  hasRecovery?: boolean;
  hasConflicts?: boolean;
  hasMigrations?: boolean;
  estimatedVersion: string;
} {
  if (typeof state !== 'object' || state === null) {
    return { estimatedVersion: 'unknown' };
  }

  const s = state as Record<string, unknown>;
  const features = analyzeFeatures(s);
  const estimatedVersion = estimateVersion(features);
  return { ...features, estimatedVersion };
}

function analyzeFeatures(s: Record<string, unknown>): Record<string, boolean> {
  const fields = [
    'checklists',
    'templates',
    'variables',
    'metadata',
    'recovery',
    'conflicts',
    'migrations',
  ];
  return fields.reduce(
    (acc, field) => {
      if (field in s)
        acc[`has${field.charAt(0).toUpperCase()}${field.slice(1)}`] = true;
      return acc;
    },
    {} as Record<string, boolean>
  );
}

function estimateVersion(f: Record<string, boolean>): string {
  if (hasAllFields(f)) return '1.0.0';
  if (f.hasTemplates && f.hasVariables) return '0.2.0';
  if (f.hasMetadata) return '0.1.0';
  if (f.hasChecklists) return '0.0.0';
  return 'unknown';
}

function hasAllFields(f: Record<string, boolean>): boolean {
  return Boolean(
    f.hasChecklists &&
      f.hasTemplates &&
      f.hasVariables &&
      f.hasMetadata &&
      f.hasRecovery &&
      f.hasConflicts &&
      f.hasMigrations
  );
}

function checkRequiredFieldsForVersion(
  state: Record<string, unknown>,
  version: string
): boolean {
  const [major] = version.split('.').map(Number);

  // For v1.x.x, require all fields
  if (major === 1) {
    return (
      'checklists' in state &&
      'templates' in state &&
      'variables' in state &&
      'metadata' in state
    );
  }

  // For v0.2.x, require templates and variables
  if (major === 0) {
    const [, minor] = version.split('.').map(Number);
    if (minor === 2) {
      return 'templates' in state && 'variables' in state;
    }
    if (minor === 1) {
      return 'metadata' in state;
    }
    if (minor === 0) {
      return 'checklists' in state;
    }
  }

  return false;
}

export async function validateStateIntegrity(state: unknown): Promise<{
  valid: boolean;
  errors: string[];
  warnings: string[];
}> {
  const errors: string[] = [];
  const warnings: string[] = [];

  try {
    if (typeof state !== 'object' || state === null) {
      return { valid: false, errors: ['State must be an object'], warnings };
    }

    const s = state as Record<string, unknown>;
    checkVersion(s, errors, warnings);
    checkFields(s, errors);
    checkTimestamps(s, warnings);

    if (errors.length === 0) {
      await validateSchemaForState(state, s, errors);
    }

    return { valid: errors.length === 0, errors, warnings };
  } catch (error) {
    errors.push('Unexpected error: ' + (error as Error).message);
    return { valid: false, errors, warnings };
  }
}

async function validateSchemaForState(
  state: unknown,
  s: Record<string, unknown>,
  errors: string[]
): Promise<void> {
  const version = await detectVersion(state);
  if (checkRequiredFieldsForVersion(s, version)) {
    if (!validateStateSchema(state as StateSchema, version)) {
      errors.push('Schema validation failed for version ' + version);
    }
  }
}

function checkVersion(
  s: Record<string, unknown>,
  e: string[],
  w: string[]
): void {
  if (!('version' in s || 'schemaVersion' in s)) {
    e.push('State file missing version information');
  } else if (
    'version' in s &&
    'schemaVersion' in s &&
    s.version !== s.schemaVersion
  ) {
    w.push(
      `Version mismatch: version=${s.version}, schemaVersion=${s.schemaVersion}`
    );
  }
}

function checkFields(s: Record<string, unknown>, e: string[]): void {
  ['checklists', 'templates', 'conflicts'].forEach((f) => {
    if (f in s && !Array.isArray(s[f]))
      e.push(`Invalid ${f} field: must be an array`);
  });
  ['variables', 'metadata'].forEach((f) => {
    if (f in s && (typeof s[f] !== 'object' || Array.isArray(s[f]))) {
      e.push(`Invalid ${f} field: must be an object`);
    }
  });
}

function checkTimestamps(s: Record<string, unknown>, w: string[]): void {
  if (
    'metadata' in s &&
    typeof s.metadata === 'object' &&
    !Array.isArray(s.metadata)
  ) {
    const m = s.metadata as Record<string, unknown>;
    ['created', 'modified'].forEach((f) => {
      if (
        f in m &&
        typeof m[f] === 'string' &&
        isNaN(new Date(m[f] as string).getTime())
      ) {
        w.push(`Invalid metadata.${f} timestamp`);
      }
    });
  }
}

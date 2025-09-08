export interface Migration {
  fromVersion: string;
  toVersion: string;
  description: string;
  up: (state: any) => any;
  down: (state: any) => any;
  validate?: (state: any) => boolean;
}

export interface MigrationOptions {
  dryRun?: boolean;
  createBackup?: boolean;
  verbose?: boolean;
  signal?: AbortSignal;
}

export interface MigrationResult {
  success: boolean;
  fromVersion: string;
  toVersion: string;
  backupPath?: string;
  error?: Error;
  appliedMigrations: string[];
}

export interface MigrationPath {
  migrations: Migration[];
  fromVersion: string;
  toVersion: string;
  totalSteps: number;
}

export interface MigrationProgress {
  currentStep: number;
  totalSteps: number;
  currentMigration: string;
  percentage: number;
}

export interface BackupInfo {
  path: string;
  version: string;
  timestamp: string;
  size: number;
}

export interface StateSchema {
  schemaVersion: string;
  migrations?: MigrationRecord[];
  version: string;
  checksum?: string;
  lastModified: string;
  activeInstance?: any;
  checklists?: any[];
  templates?: any[];
  variables?: Record<string, any>;
  settings?: any;
  metadata?: {
    created: string;
    modified: string;
    lastMigration?: string;
  };
  recovery?: any;
  conflicts?: any[];
}

export interface MigrationRecord {
  from: string;
  to: string;
  applied: string;
  changes?: string[];
}

export type MigrationEventType =
  | 'migration:start'
  | 'migration:progress'
  | 'migration:complete'
  | 'migration:error'
  | 'backup:created'
  | 'rollback:start'
  | 'rollback:complete';

export interface MigrationEvent {
  type: MigrationEventType;
  data: any;
  timestamp: string;
}

export class MigrationError extends Error {
  constructor(
    message: string,
    public fromVersion: string,
    public toVersion: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'MigrationError';
  }
}

export class VersionDetectionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'VersionDetectionError';
  }
}

export function compareVersions(v1: string, v2: string): number {
  const parts1 = v1.split('.').map(Number);
  const parts2 = v2.split('.').map(Number);

  for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
    const p1 = parts1[i] || 0;
    const p2 = parts2[i] || 0;

    if (p1 < p2) return -1;
    if (p1 > p2) return 1;
  }

  return 0;
}

export function formatVersion(
  major: number,
  minor: number,
  patch: number
): string {
  return `${major}.${minor}.${patch}`;
}

export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const [major = 0, minor = 0, patch = 0] = version.split('.').map(Number);
  return { major, minor, patch };
}

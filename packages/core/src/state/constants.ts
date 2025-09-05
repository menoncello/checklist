import { join } from 'node:path';

export const STATE_DIR = '.checklist';
export const BACKUP_DIR = join(STATE_DIR, 'backups');
export const LOCK_DIR = join(STATE_DIR, '.locks');
export const CACHE_DIR = join(STATE_DIR, '.cache');
export const LOG_DIR = join(STATE_DIR, 'logs');

export const STATE_FILE = 'state.yaml';
export const MANIFEST_FILE = 'manifest.yaml';
export const AUDIT_LOG_FILE = 'audit.log';
export const CONFIG_FILE = 'config.yaml';
export const HISTORY_FILE = 'history.yaml';
export const METRICS_FILE = 'metrics.yaml';

export const LOCK_TIMEOUT = 5000;
export const LOCK_RETRY_INTERVAL = 100;
export const LOCK_EXPIRY_TIME = 30000;
export const MAX_BACKUP_COUNT = 3;

export const SCHEMA_VERSION = '1.0.0';

export const FILE_PERMISSIONS = {
  DIRECTORY: 0o755,
  FILE: 0o644,
} as const;

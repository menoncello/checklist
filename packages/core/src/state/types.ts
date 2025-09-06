export type WorkflowStatus = 'active' | 'paused' | 'completed' | 'failed';
export type StepResult = 'success' | 'failure' | 'skipped';
export type CorruptionType =
  | 'checksum_mismatch'
  | 'schema_invalid'
  | 'parse_error';
export type RecoveryMethod = 'backup' | 'reset' | 'manual';
export type ConflictResolution = 'local' | 'remote' | 'merge';
export type OperationType = 'read' | 'write' | 'delete';
export type TransactionStatus = 'active' | 'committed' | 'rolled-back';

export interface CommandResult {
  command: string;
  exitCode: number;
  stdout: string;
  stderr: string;
  duration: number;
}

export interface CompletedStep {
  stepId: string;
  completedAt: string;
  executionTime: number;
  result: StepResult;
  commandResults: CommandResult[];
}

export interface ActiveInstance {
  id: string;
  templateId: string;
  templateVersion: string;
  projectPath: string;
  status: WorkflowStatus;
  currentStepId?: string;
  startedAt: string;
  lastModifiedAt: string;
  completedAt?: string;
}

export interface Recovery {
  lastCorruption?: string;
  corruptionType?: CorruptionType;
  recoveryMethod?: RecoveryMethod;
  dataLoss: boolean;
}

export interface Conflicts {
  detected?: string;
  resolution?: ConflictResolution;
}

export interface ChecklistState {
  schemaVersion: string;
  checksum: string;
  activeInstance?: ActiveInstance;
  completedSteps: CompletedStep[];
  recovery: Recovery;
  conflicts: Conflicts;
}

export interface LockMetadata {
  pid: number;
  ppid?: number;
  hostname: string;
  user: string;
}

export interface LockTiming {
  acquiredAt: string;
  expiresAt: string;
  renewedAt?: string;
}

export interface LockOperation {
  type: OperationType;
  stackTrace?: string;
}

export interface WaitingProcess {
  pid: number;
  since: string;
}

export interface LockConcurrency {
  waitingProcesses: WaitingProcess[];
}

export interface LockFile {
  version: string;
  lockId: string;
  metadata: LockMetadata;
  timing: LockTiming;
  operation: LockOperation;
  concurrency: LockConcurrency;
}

export interface Operation {
  id: string;
  type: string;
  path: string;
  data?: unknown;
  timestamp: string;
}

export interface Transaction {
  id: string;
  startedAt: Date;
  operations: Operation[];
  snapshot: ChecklistState;
  status: TransactionStatus;
}

export interface BackupManifestEntry {
  filename: string;
  createdAt: string;
  checksum: string;
  size: number;
  schemaVersion: string;
}

export interface BackupManifest {
  version: string;
  backups: BackupManifestEntry[];
  rotationPolicy: {
    maxCount: number;
    maxAge?: number;
  };
}

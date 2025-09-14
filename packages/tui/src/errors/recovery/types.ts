export interface CrashState {
  crashed: boolean;
  crashReason: string;
  crashTimestamp: number;
  recoveryAttempts: number;
  lastRecoveryAttempt: number;
  canRecover: boolean;
  gracefulShutdownCompleted: boolean;
}

export interface RecoveryStrategy {
  name: string;
  condition: (crashState: CrashState) => boolean;
  execute: () => Promise<boolean>;
  priority: number;
  timeoutMs?: number;
  description?: string;
}

export interface CrashRecoveryConfig {
  maxRecoveryAttempts: number;
  recoveryDelay: number;
  enableAutoRecovery: boolean;
  gracefulShutdownTimeout: number;
  stateBackupInterval: number;
  enableStateBackups: boolean;
  disableProcessHandlers?: boolean; // For test environments
  onCrash?: (crashState: CrashState) => void;
  onRecovery?: (success: boolean, attempt: number) => void;
  onGracefulShutdown?: () => void;
}

export interface StateBackup {
  id: string;
  timestamp: number;
  data: unknown;
  size: number;
  compressed: boolean;
  integrity: string;
}

export interface CrashRecoveryMetrics {
  totalCrashes: number;
  totalRecoveries: number;
  averageRecoveryTime: number;
  lastCrashTime: number | null;
  lastRecoveryTime: number | null;
  crashFrequency: number;
  successfulRecoveryRate: number;
  currentCrashState: CrashState;
  backupCount: number;
  uptime: number;
}
export class StateError extends Error {
  constructor(
    message: string,
    public readonly code: string
  ) {
    super(message);
    this.name = 'StateError';
  }
}

export class StateCorruptedError extends StateError {
  constructor(
    message: string,
    public readonly corruptionType: 'checksum_mismatch' | 'schema_invalid' | 'parse_error'
  ) {
    super(message, 'STATE_CORRUPTED');
    this.name = 'StateCorruptedError';
  }
}

export class LockAcquisitionError extends StateError {
  constructor(
    message: string,
    public readonly timeout: number
  ) {
    super(message, 'LOCK_ACQUISITION_FAILED');
    this.name = 'LockAcquisitionError';
  }
}

export class TransactionError extends StateError {
  constructor(
    message: string,
    public readonly transactionId: string
  ) {
    super(message, 'TRANSACTION_FAILED');
    this.name = 'TransactionError';
  }
}

export class BackupError extends StateError {
  constructor(message: string) {
    super(message, 'BACKUP_FAILED');
    this.name = 'BackupError';
  }
}

export class RecoveryError extends StateError {
  constructor(
    message: string,
    public readonly dataLoss: boolean = false
  ) {
    super(message, 'RECOVERY_FAILED');
    this.name = 'RecoveryError';
  }
}

export class StatePreservationRecovery {
  constructor(
    private preserve: (key: string, data: unknown) => string,
    private exists: (key: string) => boolean,
    private getKeys: () => string[],
    private deleteKey: (key: string) => boolean
  ) {}

  createRecoveryCheckpoint(checkpointId: string, state: unknown): void {
    this.preserve(`checkpoint_${checkpointId}`, state);
  }

  hasRecoveryCheckpoint(checkpointId: string): boolean {
    return this.exists(`checkpoint_${checkpointId}`);
  }

  listRecoveryCheckpoints(): string[] {
    return this.getKeys().filter((key) => key.startsWith('checkpoint_'));
  }

  clearRecoveryCheckpoint(): void {
    const checkpoints = this.listRecoveryCheckpoints();
    checkpoints.forEach((checkpoint) => {
      this.deleteKey(checkpoint);
    });
  }
}

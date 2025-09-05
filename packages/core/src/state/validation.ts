import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { createHash } from 'node:crypto';
import stateSchema from './schemas/state.schema.json';
import { ChecklistState } from './types';
import { StateCorruptedError } from './errors';

export class StateValidator {
  private ajv: Ajv;
  private validateSchema: ReturnType<Ajv['compile']>;

  constructor() {
    this.ajv = new Ajv({ allErrors: true, verbose: true });
    addFormats(this.ajv);
    this.validateSchema = this.ajv.compile(stateSchema);
  }

  async validateStateSchema(state: unknown): Promise<ChecklistState> {
    if (!this.validateSchema(state)) {
      const errors = this.validateSchema.errors
        ?.map((e) => `${e.instancePath} ${e.message}`)
        .join(', ');
      throw new StateCorruptedError(`State validation failed: ${errors}`, 'schema_invalid');
    }
    return state as ChecklistState;
  }

  calculateChecksum(state: ChecklistState): string {
    const stateWithoutChecksum = { ...state };
    delete (stateWithoutChecksum as Record<string, unknown>).checksum;

    const sortObject = (obj: unknown): unknown => {
      if (obj === null || typeof obj !== 'object') return obj;
      if (Array.isArray(obj)) return obj.map(sortObject);

      const sorted: Record<string, unknown> = {};
      Object.keys(obj)
        .sort()
        .forEach((key) => {
          sorted[key] = sortObject((obj as Record<string, unknown>)[key]);
        });
      return sorted;
    };

    const sortedState = sortObject(stateWithoutChecksum);
    const jsonString = JSON.stringify(sortedState);
    const hash = createHash('sha256').update(jsonString).digest('hex');
    return `sha256:${hash}`;
  }

  async verifyChecksum(state: ChecklistState): Promise<void> {
    const expectedChecksum = state.checksum;
    const actualChecksum = this.calculateChecksum(state);

    if (expectedChecksum !== actualChecksum) {
      throw new StateCorruptedError(
        `Checksum mismatch: expected ${expectedChecksum}, got ${actualChecksum}`,
        'checksum_mismatch'
      );
    }
  }

  async validate(state: unknown): Promise<ChecklistState> {
    const validatedState = await this.validateStateSchema(state);

    if (
      validatedState.checksum &&
      validatedState.checksum !==
        'sha256:0000000000000000000000000000000000000000000000000000000000000000'
    ) {
      await this.verifyChecksum(validatedState);
    }

    return validatedState;
  }

  isValidSchemaVersion(version: string, supportedVersions: string[]): boolean {
    return supportedVersions.includes(version);
  }

  canMigrate(fromVersion: string, toVersion: string): boolean {
    const [fromMajor] = fromVersion.split('.').map(Number);
    const [toMajor] = toVersion.split('.').map(Number);

    return fromMajor === toMajor || fromMajor + 1 === toMajor;
  }
}

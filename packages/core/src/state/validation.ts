import { createHash } from 'node:crypto';
import Ajv, { type ValidateFunction } from 'ajv';
import addFormats from 'ajv-formats';
import { StateCorruptedError } from './errors';
import stateSchema from './schemas/state.schema.json';
import { ChecklistState } from './types';

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

export class StateValidator {
  private ajv: Ajv;
  private validateSchema: ValidateFunction;

  constructor() {
    this.ajv = new Ajv({
      allErrors: true,
      verbose: true,
      code: { optimize: false }, // Required for ajv v8
    });
    addFormats(this.ajv);
    this.validateSchema = this.ajv.compile(
      stateSchema as Record<string, unknown>
    );
  }

  async validateStateSchema(state: unknown): Promise<ChecklistState> {
    if (this.validateSchema(state) !== true) {
      const errors = this.validateSchema.errors
        ?.map((e) => `${e.instancePath} ${e.message}`)
        .join(', ');
      throw new StateCorruptedError(
        `State validation failed: ${errors}`,
        'schema_invalid'
      );
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
      validatedState.checksum !== undefined &&
      validatedState.checksum !== null &&
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

  validateState(state: ChecklistState): ValidationResult {
    try {
      // Basic schema validation
      if (this.validateSchema(state) !== true) {
        const errors =
          this.validateSchema.errors
            ?.map((e) => `${e.instancePath} ${e.message}`)
            .filter(Boolean) ?? [];
        return { isValid: false, errors };
      }
      return { isValid: true, errors: [] };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown validation error';
      return { isValid: false, errors: [message] };
    }
  }
}

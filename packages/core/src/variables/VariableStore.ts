/**
 * Variable Management System - Variable Store
 * Handles variable storage, persistence, and retrieval
 */

import * as yaml from 'js-yaml';
import { createLogger } from '../utils/logger';
import { VariableNotFoundError } from './errors';
import type { VariableValue, VariableState } from './types';

const logger = createLogger('checklist:variables:store');

/**
 * Manages variable storage and persistence
 */
export class VariableStore {
  private state: {
    global: Map<string, VariableValue>;
    steps: Map<string, Map<string, VariableValue>>;
  };

  constructor(private readonly stateFile: string) {
    this.state = {
      global: new Map(),
      steps: new Map(),
    };
  }

  /**
   * Get variable value with scope resolution
   */
  get(name: string, stepId?: string): VariableValue | undefined {
    // Step scope takes precedence
    if (stepId !== undefined && stepId !== '') {
      const stepVars = this.state.steps.get(stepId);
      if (stepVars?.has(name) === true) {
        const value = stepVars.get(name);
        logger.debug({
          msg: 'Variable resolved from step scope',
          name,
          stepId,
        });
        return value;
      }
    }

    // Fall back to global scope
    const value = this.state.global.get(name);
    if (value !== undefined) {
      logger.debug({
        msg: 'Variable resolved from global scope',
        name,
      });
    }
    return value;
  }

  /**
   * Set variable value
   */
  set(name: string, value: VariableValue, stepId?: string): void {
    if (stepId !== undefined && stepId !== '') {
      this.setStepVariable(stepId, name, value);
    } else {
      this.setGlobalVariable(name, value);
    }
  }

  /**
   * Set global variable
   */
  private setGlobalVariable(name: string, value: VariableValue): void {
    this.state.global.set(name, value);
    logger.debug({
      msg: 'Variable set in global scope',
      name,
    });
  }

  /**
   * Set step variable
   */
  private setStepVariable(
    stepId: string,
    name: string,
    value: VariableValue
  ): void {
    if (!this.state.steps.has(stepId)) {
      this.state.steps.set(stepId, new Map());
    }
    const stepVars = this.state.steps.get(stepId);
    if (stepVars !== undefined) {
      stepVars.set(name, value);
    }
    logger.debug({
      msg: 'Variable set in step scope',
      name,
      stepId,
    });
  }

  /**
   * Check if variable exists
   */
  has(name: string, stepId?: string): boolean {
    if (stepId !== undefined && stepId !== '') {
      const stepVars = this.state.steps.get(stepId);
      if (stepVars?.has(name) === true) return true;
    }
    return this.state.global.has(name);
  }

  /**
   * Delete variable
   */
  delete(name: string, stepId?: string): void {
    if (stepId !== undefined && stepId !== '') {
      this.deleteStepVariable(stepId, name);
    } else {
      this.deleteGlobalVariable(name);
    }
  }

  /**
   * Delete global variable
   */
  private deleteGlobalVariable(name: string): void {
    this.state.global.delete(name);
    logger.debug({
      msg: 'Variable deleted from global scope',
      name,
    });
  }

  /**
   * Delete step variable
   */
  private deleteStepVariable(stepId: string, name: string): void {
    const stepVars = this.state.steps.get(stepId);
    if (stepVars !== undefined) {
      stepVars.delete(name);
      logger.debug({
        msg: 'Variable deleted from step scope',
        name,
        stepId,
      });
    }
  }

  /**
   * Get all variables for scope
   */
  getAll(stepId?: string): Record<string, VariableValue> {
    const result: Record<string, VariableValue> = {};

    // Start with global variables
    for (const [key, value] of this.state.global) {
      result[key] = value;
    }

    // Override with step-specific variables
    if (stepId !== undefined && stepId !== '') {
      const stepVars = this.state.steps.get(stepId);
      if (stepVars !== undefined) {
        for (const [key, value] of stepVars) {
          result[key] = value;
        }
      }
    }

    return result;
  }

  /**
   * Clear variables
   */
  clear(stepId?: string): void {
    if (stepId !== undefined && stepId !== '') {
      this.state.steps.delete(stepId);
      logger.info({
        msg: 'Step variables cleared',
        stepId,
      });
    } else {
      this.state.global.clear();
      this.state.steps.clear();
      logger.info({
        msg: 'All variables cleared',
      });
    }
  }

  /**
   * Persist variables to YAML file
   */
  async persist(): Promise<void> {
    const startTime = performance.now();

    try {
      await this.createBackup();
      const stateData = this.serializeState();
      const yamlContent = this.toYaml(stateData);

      await Bun.write(this.stateFile, yamlContent);

      this.logPersistSuccess(startTime);
    } catch (error) {
      this.logPersistError(error as Error);
      throw error;
    }
  }

  /**
   * Serialize internal state to plain objects
   */
  private serializeState(): VariableState {
    return {
      global: Object.fromEntries(this.state.global),
      steps: Object.fromEntries(
        Array.from(this.state.steps.entries()).map(([stepId, vars]) => [
          stepId,
          Object.fromEntries(vars),
        ])
      ),
    };
  }

  /**
   * Convert state to YAML string
   */
  private toYaml(stateData: VariableState): string {
    return yaml.dump(stateData, {
      indent: 2,
      noRefs: true,
      sortKeys: true,
    });
  }

  /**
   * Log successful persist operation
   */
  private logPersistSuccess(startTime: number): void {
    const duration = performance.now() - startTime;
    logger.info({
      msg: 'Variables persisted to file',
      file: this.stateFile,
      duration,
      globalCount: this.state.global.size,
      stepCount: this.state.steps.size,
    });
  }

  /**
   * Log persist error
   */
  private logPersistError(error: Error): void {
    logger.error({
      msg: 'Failed to persist variables',
      file: this.stateFile,
      error: error.message,
    });
  }

  /**
   * Load variables from YAML file
   */
  async load(): Promise<void> {
    try {
      const file = Bun.file(this.stateFile);

      if (!(await file.exists())) {
        this.logFileNotFound();
        return;
      }

      const data = await this.readStateFile(file);
      this.deserializeState(data);
      this.logLoadSuccess();
    } catch (error) {
      this.logLoadError(error as Error);
      throw error;
    }
  }

  /**
   * Read and parse state file
   */
  private async readStateFile(
    file: ReturnType<typeof Bun.file>
  ): Promise<VariableState> {
    const content = await file.text();
    return yaml.load(content) as VariableState;
  }

  /**
   * Deserialize state into internal Maps
   */
  private deserializeState(data: VariableState): void {
    this.state.global = new Map(Object.entries(data.global ?? {}));
    this.state.steps = new Map(
      Object.entries(data.steps ?? {}).map(
        ([stepId, vars]: [string, Record<string, VariableValue>]) => [
          stepId,
          new Map(Object.entries(vars)),
        ]
      )
    );
  }

  /**
   * Log when state file is not found
   */
  private logFileNotFound(): void {
    logger.info({
      msg: 'State file does not exist',
      file: this.stateFile,
    });
  }

  /**
   * Log successful load operation
   */
  private logLoadSuccess(): void {
    logger.info({
      msg: 'Variables loaded from file',
      file: this.stateFile,
      globalCount: this.state.global.size,
      stepCount: this.state.steps.size,
    });
  }

  /**
   * Log load error
   */
  private logLoadError(error: Error): void {
    logger.error({
      msg: 'Failed to load variables',
      file: this.stateFile,
      error: error.message,
    });
  }

  /**
   * Create backup of current state file
   */
  private async createBackup(): Promise<void> {
    try {
      const file = Bun.file(this.stateFile);
      if (await file.exists()) {
        const backupFile = `${this.stateFile}.backup`;
        const content = await file.text();
        await Bun.write(backupFile, content);
        logger.debug({
          msg: 'Backup created',
          file: backupFile,
        });
      }
    } catch (error) {
      logger.warn({
        msg: 'Failed to create backup',
        error: (error as Error).message,
      });
      // Don't throw - backup failure shouldn't prevent persistence
    }
  }

  /**
   * Get variable or throw error
   */
  getOrThrow(name: string, stepId?: string): VariableValue {
    const value = this.get(name, stepId);
    if (value === undefined) {
      throw new VariableNotFoundError(name, stepId);
    }
    return value;
  }

  /**
   * Get internal state (for testing)
   */
  getState(): VariableState {
    return {
      global: Object.fromEntries(this.state.global),
      steps: Object.fromEntries(
        Array.from(this.state.steps.entries()).map(([stepId, vars]) => [
          stepId,
          Object.fromEntries(vars),
        ])
      ),
    };
  }
}

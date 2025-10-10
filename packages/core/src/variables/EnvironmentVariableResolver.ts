/**
 * Variable Management System - Environment Variable Resolver
 * Provides secure access to environment variables
 */

import { createLogger } from '../utils/logger';
import { VariableSecurityError } from './errors';
import type { VariableValue } from './types';

const logger = createLogger('checklist:variables:env');

/**
 * Default allowed environment variables (safe list)
 */
const DEFAULT_ALLOWED_ENV_VARS = new Set([
  'HOME',
  'USER',
  'PATH',
  'PWD',
  'SHELL',
  'LANG',
  'TERM',
  'TMPDIR',
  'EDITOR',
  'VISUAL',
]);

/**
 * Resolves environment variables with security controls
 */
export class EnvironmentVariableResolver {
  private readonly allowedEnvVars: Set<string>;

  constructor(allowedVars?: string[]) {
    this.allowedEnvVars = new Set([
      ...DEFAULT_ALLOWED_ENV_VARS,
      ...(allowedVars ?? []),
    ]);
  }

  /**
   * Resolve environment variable by name
   */
  resolve(
    name: string,
    defaultValue?: VariableValue
  ): VariableValue | undefined {
    const envVarName = this.extractEnvVarName(name);
    this.validateEnvVarAccess(envVarName);
    return this.getEnvValue(envVarName, defaultValue);
  }

  /**
   * Extract environment variable name (remove $ENV: prefix)
   */
  private extractEnvVarName(name: string): string {
    return name.startsWith('$ENV:') ? name.slice(5) : name;
  }

  /**
   * Validate environment variable access against allowlist
   */
  private validateEnvVarAccess(envVarName: string): void {
    if (!this.allowedEnvVars.has(envVarName)) {
      logger.warn({
        msg: 'Attempted access to non-allowed environment variable',
        variable: envVarName,
      });
      throw new VariableSecurityError(
        `Environment variable '${envVarName}' is not in the allowed list`,
        { variable: envVarName }
      );
    }
  }

  /**
   * Get environment variable value with default fallback
   */
  private getEnvValue(
    envVarName: string,
    defaultValue?: VariableValue
  ): VariableValue | undefined {
    const value = Bun.env[envVarName];

    logger.debug({
      msg: 'Environment variable accessed',
      variable: envVarName,
      found: value !== undefined,
    });

    if (value === undefined) {
      logger.debug({
        msg: 'Environment variable not found, using default',
        variable: envVarName,
        hasDefault: defaultValue !== undefined,
      });
      return defaultValue;
    }

    return this.convertType(value);
  }

  /**
   * Convert string value to appropriate VariableValue type
   */
  private convertType(value: string): VariableValue {
    // Try to parse as number
    const num = Number(value);
    if (!isNaN(num) && value.trim() !== '') {
      return num;
    }

    // Try to parse as boolean
    const lower = value.toLowerCase();
    if (lower === 'true') return true;
    if (lower === 'false') return false;

    // Return as string
    return value;
  }

  /**
   * Check if environment variable is allowed
   */
  isAllowed(name: string): boolean {
    const envVarName = name.startsWith('$ENV:') ? name.slice(5) : name;
    return this.allowedEnvVars.has(envVarName);
  }

  /**
   * Add environment variable to allowed list
   */
  allow(name: string): void {
    this.allowedEnvVars.add(name);
    logger.info({
      msg: 'Environment variable added to allowed list',
      variable: name,
    });
  }

  /**
   * Remove environment variable from allowed list
   */
  disallow(name: string): void {
    if (DEFAULT_ALLOWED_ENV_VARS.has(name)) {
      logger.warn({
        msg: 'Attempted to disallow default environment variable',
        variable: name,
      });
      return;
    }

    this.allowedEnvVars.delete(name);
    logger.info({
      msg: 'Environment variable removed from allowed list',
      variable: name,
    });
  }

  /**
   * Get all allowed environment variables
   */
  getAllowed(): string[] {
    return Array.from(this.allowedEnvVars).sort();
  }

  /**
   * Resolve multiple environment variables
   */
  resolveMultiple(
    names: string[],
    defaults?: Record<string, VariableValue>
  ): Record<string, VariableValue> {
    const result: Record<string, VariableValue> = {};

    for (const name of names) {
      const envVarName = name.startsWith('$ENV:') ? name.slice(5) : name;
      const defaultValue = defaults?.[envVarName];

      try {
        const value = this.resolve(name, defaultValue);
        if (value !== undefined) {
          result[envVarName] = value;
        }
      } catch (error) {
        logger.warn({
          msg: 'Failed to resolve environment variable',
          variable: envVarName,
          error: (error as Error).message,
        });
        // Continue with other variables
      }
    }

    return result;
  }
}

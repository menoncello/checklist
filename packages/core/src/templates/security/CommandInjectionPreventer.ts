/**
 * Command injection prevention for template security
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger(
  'checklist:templates:security:command-injection-preventer'
);

/**
 * Configuration for CommandInjectionPreventer
 */
export interface CommandInjectionPreventerConfig {
  enableSanitization?: boolean;
  enableDetection?: boolean;
  strictMode?: boolean;
}

/**
 * Detection result for command injection patterns
 */
export interface InjectionDetectionResult {
  detected: boolean;
  patterns: string[];
  sanitized?: string;
}

/**
 * Prevents command injection in template variables
 */
export class CommandInjectionPreventer {
  private readonly enableSanitization: boolean;
  private readonly enableDetection: boolean;
  private readonly strictMode: boolean;
  private readonly dangerousCharacters: Set<string>;
  private readonly chainingPatterns: string[];
  private readonly redirectionPatterns: string[];
  private readonly substitutionPatterns: RegExp[];

  constructor(config: CommandInjectionPreventerConfig = {}) {
    this.enableSanitization = config.enableSanitization ?? true;
    this.enableDetection = config.enableDetection ?? true;
    this.strictMode = config.strictMode ?? false;

    this.dangerousCharacters = this.initDangerousCharacters();
    this.chainingPatterns = ['&&', '||', ';', '|'];
    this.redirectionPatterns = ['>', '>>', '<', '2>&1', '&>'];
    this.substitutionPatterns = [/\$\(/, /`/, /\$\{/];

    logger.debug({
      msg: 'CommandInjectionPreventer initialized',
      enableSanitization: this.enableSanitization,
      enableDetection: this.enableDetection,
      strictMode: this.strictMode,
    });
  }

  /**
   * Sanitize variable value for safe shell use
   */
  sanitizeVariable(value: string): string {
    if (!this.enableSanitization) {
      return value;
    }

    let sanitized = value;

    // Remove dangerous shell metacharacters
    for (const char of this.dangerousCharacters) {
      const escaped = this.escapeRegExp(char);
      sanitized = sanitized.replace(new RegExp(escaped, 'g'), '');
    }

    // In strict mode, also remove other potentially dangerous chars
    if (this.strictMode) {
      sanitized = this.strictSanitize(sanitized);
    }

    logger.debug({
      msg: 'Variable sanitized',
      original: value,
      sanitized,
      removed: value.length - sanitized.length,
    });

    return sanitized;
  }

  /**
   * Detect command chaining in command string
   */
  detectCommandChaining(command: string): boolean {
    if (!this.enableDetection) {
      return false;
    }

    for (const pattern of this.chainingPatterns) {
      if (command.includes(pattern)) {
        logger.warn({
          msg: 'Command chaining detected',
          pattern,
          command: command.substring(0, 100),
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Detect redirection operators in command
   */
  detectRedirection(command: string): boolean {
    if (!this.enableDetection) {
      return false;
    }

    for (const pattern of this.redirectionPatterns) {
      if (command.includes(pattern)) {
        logger.warn({
          msg: 'Redirection operator detected',
          pattern,
          command: command.substring(0, 100),
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Detect process substitution patterns
   */
  detectProcessSubstitution(command: string): boolean {
    if (!this.enableDetection) {
      return false;
    }

    for (const pattern of this.substitutionPatterns) {
      if (pattern.test(command)) {
        logger.warn({
          msg: 'Process substitution detected',
          pattern: pattern.source,
          command: command.substring(0, 100),
        });
        return true;
      }
    }

    return false;
  }

  /**
   * Comprehensive injection detection
   */
  detectInjection(command: string): InjectionDetectionResult {
    const patterns: string[] = [];

    if (this.detectCommandChaining(command)) {
      patterns.push('Command chaining');
    }

    if (this.detectRedirection(command)) {
      patterns.push('Redirection');
    }

    if (this.detectProcessSubstitution(command)) {
      patterns.push('Process substitution');
    }

    return {
      detected: patterns.length > 0,
      patterns,
    };
  }

  /**
   * Safe variable interpolation
   */
  safeInterpolate(template: string, variables: Record<string, string>): string {
    let result = template;

    for (const [key, value] of Object.entries(variables)) {
      const sanitized = this.sanitizeVariable(value);
      const placeholder = `\${${key}}`;

      result = result.replace(
        new RegExp(this.escapeRegExp(placeholder), 'g'),
        sanitized
      );
    }

    return result;
  }

  /**
   * Validate command for injection attempts
   */
  validateCommand(command: string): InjectionDetectionResult {
    const detection = this.detectInjection(command);

    if (detection.detected) {
      logger.error({
        msg: 'Command injection attempt detected',
        patterns: detection.patterns,
        command: command.substring(0, 100),
      });
    }

    return detection;
  }

  /**
   * Sanitize and validate command with variables
   */
  processCommand(
    template: string,
    variables: Record<string, string>
  ): { command: string; safe: boolean; issues: string[] } {
    const interpolated = this.safeInterpolate(template, variables);
    const detection = this.validateCommand(interpolated);

    return {
      command: interpolated,
      safe: !detection.detected,
      issues: detection.patterns,
    };
  }

  /**
   * Initialize dangerous characters set
   */
  private initDangerousCharacters(): Set<string> {
    return new Set([
      ';',
      '|',
      '&',
      '$',
      '`',
      '(',
      ')',
      '{',
      '}',
      '[',
      ']',
      '<',
      '>',
      '\\',
      '\n',
      '\r',
    ]);
  }

  /**
   * Strict sanitization for extra safety
   */
  private strictSanitize(value: string): string {
    // Only allow alphanumeric, spaces, and safe punctuation
    return value.replace(/[^a-zA-Z0-9\s._\-]/g, '');
  }

  /**
   * Escape regular expression special characters
   */
  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Get configuration
   */
  getConfig(): {
    enableSanitization: boolean;
    enableDetection: boolean;
    strictMode: boolean;
  } {
    return {
      enableSanitization: this.enableSanitization,
      enableDetection: this.enableDetection,
      strictMode: this.strictMode,
    };
  }
}

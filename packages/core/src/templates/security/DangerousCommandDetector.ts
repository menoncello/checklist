/**
 * Dangerous command pattern detection for template security
 */

import { createLogger } from '../../utils/logger';
import type { DangerousCommand } from './types';

const logger = createLogger(
  'checklist:templates:security:dangerous-command-detector'
);

/**
 * Configuration for DangerousCommandDetector
 */
export interface DangerousCommandDetectorConfig {
  enableDetection?: boolean;
  customPatterns?: CommandPattern[];
}

/**
 * Command pattern definition
 */
export interface CommandPattern {
  pattern: string | RegExp;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  suggestion?: string;
  category: string;
}

/**
 * Scans templates for dangerous command patterns
 */
export class DangerousCommandDetector {
  private readonly enabled: boolean;
  private readonly patterns: CommandPattern[];

  constructor(config: DangerousCommandDetectorConfig = {}) {
    this.enabled = config.enableDetection ?? true;
    this.patterns = this.initializePatterns(config.customPatterns);

    logger.debug({
      msg: 'DangerousCommandDetector initialized',
      enabled: this.enabled,
      patternCount: this.patterns.length,
    });
  }

  /**
   * Scan template for dangerous commands
   */
  scanTemplate(template: {
    steps?: { commands?: string[] }[];
  }): DangerousCommand[] {
    if (!this.enabled || !template.steps) {
      return [];
    }

    const dangerous: DangerousCommand[] = [];
    const startTime = Date.now();

    template.steps.forEach((step, stepIndex) => {
      const stepId = `step-${stepIndex}`;
      if (!step.commands) return;

      step.commands.forEach((command, cmdIndex) => {
        const matches = this.detectDangerousPatterns(
          command,
          `${stepId}-cmd-${cmdIndex}`
        );
        dangerous.push(...matches);
      });
    });

    const duration = Date.now() - startTime;
    logger.info({
      msg: 'Template scan complete',
      dangerousCount: dangerous.length,
      duration,
    });

    return dangerous;
  }

  /**
   * Scan single command for dangerous patterns
   */
  scanCommand(command: string, commandId: string): DangerousCommand[] {
    return this.detectDangerousPatterns(command, commandId);
  }

  /**
   * Detect dangerous patterns in command
   */
  private detectDangerousPatterns(
    command: string,
    commandId: string
  ): DangerousCommand[] {
    const matches: DangerousCommand[] = [];

    for (const pattern of this.patterns) {
      if (this.matchesPattern(command, pattern)) {
        matches.push({
          commandId,
          stepId: commandId.split('-cmd')[0],
          pattern: this.getPatternString(pattern),
          severity: pattern.severity,
          reason: pattern.reason,
          suggestion: pattern.suggestion,
        });
      }
    }

    return matches;
  }

  /**
   * Check if command matches pattern
   */
  private matchesPattern(command: string, pattern: CommandPattern): boolean {
    if (pattern.pattern instanceof RegExp) {
      return pattern.pattern.test(command);
    }
    return command.includes(pattern.pattern);
  }

  /**
   * Get pattern as string for reporting
   */
  private getPatternString(pattern: CommandPattern): string {
    if (pattern.pattern instanceof RegExp) {
      return pattern.pattern.source;
    }
    return pattern.pattern;
  }

  /**
   * Initialize default dangerous command patterns
   */
  private initializePatterns(
    customPatterns?: CommandPattern[]
  ): CommandPattern[] {
    const defaults: CommandPattern[] = [
      ...this.getDestructivePatterns(),
      ...this.getPrivilegePatterns(),
      ...this.getPermissionPatterns(),
      ...this.getProcessPatterns(),
      ...this.getNetworkPatterns(),
      ...this.getEvaluationPatterns(),
      ...this.getMetacharPatterns(),
    ];

    return customPatterns ? [...defaults, ...customPatterns] : defaults;
  }

  /**
   * Get destructive command patterns
   */
  private getDestructivePatterns(): CommandPattern[] {
    return [
      {
        pattern: /\brm\s+-rf\s+\//,
        severity: 'critical',
        reason: 'Recursive deletion from root directory',
        suggestion: 'Use specific paths instead of root directory',
        category: 'destructive',
      },
      {
        pattern: /\b(rm|rmdir|del)\b/,
        severity: 'high',
        reason: 'File deletion command detected',
        suggestion: 'Verify deletion target before executing',
        category: 'destructive',
      },
      {
        pattern: /\b(format|mkfs)\b/,
        severity: 'critical',
        reason: 'Filesystem format command detected',
        suggestion: 'Never format filesystems in templates',
        category: 'destructive',
      },
    ];
  }

  /**
   * Get privilege escalation patterns
   */
  private getPrivilegePatterns(): CommandPattern[] {
    return [
      {
        pattern: /\b(sudo|su|runas|doas)\b/,
        severity: 'critical',
        reason: 'Privilege escalation command detected',
        suggestion: 'Templates should not require elevated privileges',
        category: 'privilege',
      },
    ];
  }

  /**
   * Get permission change patterns
   */
  private getPermissionPatterns(): CommandPattern[] {
    return [
      {
        pattern: /\b(chmod|chown|chgrp)\b/,
        severity: 'medium',
        reason: 'Permission modification command detected',
        suggestion: 'Verify permission changes are necessary',
        category: 'permissions',
      },
      {
        pattern: /\b(icacls|takeown)\b/,
        severity: 'medium',
        reason: 'Windows permission modification detected',
        suggestion: 'Verify permission changes are necessary',
        category: 'permissions',
      },
    ];
  }

  /**
   * Get process control patterns
   */
  private getProcessPatterns(): CommandPattern[] {
    return [
      {
        pattern: /\b(kill|killall|taskkill|pkill)\b/,
        severity: 'medium',
        reason: 'Process termination command detected',
        suggestion: 'Specify exact process IDs instead of patterns',
        category: 'process',
      },
    ];
  }

  /**
   * Get network access patterns
   */
  private getNetworkPatterns(): CommandPattern[] {
    return [
      {
        pattern: /\b(curl|wget)\b.*\|\s*(bash|sh|zsh)/,
        severity: 'critical',
        reason: 'Pipe to shell from network detected',
        suggestion: 'Never pipe network content directly to shell',
        category: 'network',
      },
      {
        pattern: /\b(curl|wget|nc|netcat|telnet|ssh|ftp)\b/,
        severity: 'high',
        reason: 'Network access command detected',
        suggestion: 'Templates should not access network',
        category: 'network',
      },
    ];
  }

  /**
   * Get code evaluation patterns
   */
  private getEvaluationPatterns(): CommandPattern[] {
    return [
      {
        pattern: /\b(eval|exec)\b/,
        severity: 'critical',
        reason: 'Code evaluation command detected',
        suggestion: 'Never use eval or exec',
        category: 'evaluation',
      },
      {
        pattern: /\b(source|\.)(\s+)/,
        severity: 'medium',
        reason: 'Script sourcing detected',
        suggestion: 'Verify sourced script content',
        category: 'evaluation',
      },
    ];
  }

  /**
   * Get shell metacharacter patterns
   */
  private getMetacharPatterns(): CommandPattern[] {
    return [
      {
        pattern: /&&|\|\||;/,
        severity: 'low',
        reason: 'Command chaining detected',
        suggestion: 'Break into separate commands for clarity',
        category: 'chaining',
      },
      {
        pattern: /\$\(|\`/,
        severity: 'medium',
        reason: 'Command substitution detected',
        suggestion: 'Use variables instead of command substitution',
        category: 'substitution',
      },
      {
        pattern: />|>>|<|2>&1|&>/,
        severity: 'low',
        reason: 'Redirection operator detected',
        suggestion: 'Verify redirection is necessary',
        category: 'redirection',
      },
    ];
  }

  /**
   * Get all pattern categories
   */
  getCategories(): string[] {
    return Array.from(new Set(this.patterns.map((p) => p.category)));
  }

  /**
   * Get patterns by category
   */
  getPatternsByCategory(category: string): CommandPattern[] {
    return this.patterns.filter((p) => p.category === category);
  }

  /**
   * Get patterns by severity
   */
  getPatternsBySeverity(
    severity: 'low' | 'medium' | 'high' | 'critical'
  ): CommandPattern[] {
    return this.patterns.filter((p) => p.severity === severity);
  }
}

export interface InputValidationResult {
  isValid: boolean;
  sanitized: string;
  warnings: string[];
  errors: string[];
  metadata?: Record<string, unknown>;
}

export interface ValidationRule {
  name: string;
  pattern?: RegExp;
  validator?: (input: string) => boolean;
  sanitizer?: (input: string) => string;
  errorMessage?: string;
  priority?: number;
}

export interface InputValidatorConfig {
  enableAnsiSanitization: boolean;
  enableLengthLimits: boolean;
  maxLength: number;
  allowedCharsets: string[];
  blockedPatterns: RegExp[];
  enableLogging: boolean;
}

interface ValidationHistoryEntry {
  timestamp: number;
  input: string;
  result: InputValidationResult;
  duration: number;
}

export class InputValidatorCore {
  protected config: InputValidatorConfig;
  protected validationRules = new Map<string, ValidationRule>();
  protected eventHandlers = new Map<string, Set<Function>>();
  protected validationHistory: ValidationHistoryEntry[] = [];
  protected maxHistorySize = 200;
  protected validationMetrics = {
    totalValidations: 0,
    validInputs: 0,
    invalidInputs: 0,
    sanitizedInputs: 0,
    averageValidationTime: 0,
    totalValidationTime: 0,
  };

  // Dangerous ANSI escape sequences
  protected readonly dangerousAnsiPatterns = [
    /\x1b\]0;/g, // Set window title
    /\x1b\]1;/g, // Set icon name
    /\x1b\]2;/g, // Set window title
    /\x1b\[6n/g, // Device Status Report
    /\x1b\[c/g, // Device Attributes
    /\x1b\[>c/g, // Secondary Device Attributes
    /\x1bc/g, // Full reset
    /\x1b#8/g, // Screen alignment test
    /\x1b\[\?1049[hl]/g, // Alternative screen buffer
    /\x1b\[\?2004[hl]/g, // Bracketed paste mode
    /\x1b\[\?25[hl]/g, // Show/hide cursor
  ];

  // Safe ANSI escape sequences
  protected readonly safeAnsiPatterns = [
    /\x1b\[[\d;]*m/g, // Color and style sequences
    /\x1b\[[\d;]*[ABCD]/g, // Cursor movement
    /\x1b\[[\d;]*[HfA-Z]/g, // Basic cursor positioning
    /\x1b\[[\d]*[JK]/g, // Erase sequences
  ];

  constructor(config: Partial<InputValidatorConfig> = {}) {
    this.config = {
      enableAnsiSanitization: true,
      enableLengthLimits: true,
      maxLength: 1000,
      allowedCharsets: ['ascii', 'latin1', 'utf8'],
      blockedPatterns: [],
      enableLogging: false,
      ...config,
    };
  }

  public addRule(rule: ValidationRule): void {
    this.validationRules.set(rule.name, rule);
  }

  public removeRule(name: string): boolean {
    return this.validationRules.delete(name);
  }

  public getRules(): ValidationRule[] {
    return Array.from(this.validationRules.values()).sort(
      (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
    );
  }

  protected validateAnsiSequences(input: string): boolean {
    if (!this.config.enableAnsiSanitization) return true;

    for (const pattern of this.dangerousAnsiPatterns) {
      if (pattern.test(input)) return false;
    }
    return true;
  }

  protected sanitizeAnsiSequences(input: string): string {
    if (!this.config.enableAnsiSanitization) return input;

    let sanitized = input;
    for (const pattern of this.dangerousAnsiPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }
    return sanitized;
  }

  protected hasControlChars(input: string): boolean {
    return /[\x00-\x08\x0B\x0C\x0E-\x1A\x7F]/g.test(input);
  }

  protected removeControlChars(input: string): string {
    return input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1A\x7F]/g, '');
  }

  protected recordValidation(
    input: string,
    result: InputValidationResult,
    duration: number
  ): void {
    // Update metrics
    this.validationMetrics.totalValidations++;
    this.validationMetrics.totalValidationTime += duration;
    this.validationMetrics.averageValidationTime =
      this.validationMetrics.totalValidationTime /
      this.validationMetrics.totalValidations;

    if (result.isValid) {
      this.validationMetrics.validInputs++;
    } else {
      this.validationMetrics.invalidInputs++;
    }

    if (result.sanitized !== input) {
      this.validationMetrics.sanitizedInputs++;
    }

    // Record in history
    if (this.validationHistory.length >= this.maxHistorySize) {
      this.validationHistory.shift();
    }

    this.validationHistory.push({
      timestamp: Date.now(),
      input: input.slice(0, 100), // Limit stored input size
      result,
      duration,
    });
  }

  public getMetrics() {
    return { ...this.validationMetrics };
  }

  public getHistory(limit?: number) {
    const history = [...this.validationHistory];
    return limit != null && limit > 0 ? history.slice(-limit) : history;
  }

  public clearHistory(): void {
    this.validationHistory = [];
  }

  public resetMetrics(): void {
    this.validationMetrics = {
      totalValidations: 0,
      validInputs: 0,
      invalidInputs: 0,
      sanitizedInputs: 0,
      averageValidationTime: 0,
      totalValidationTime: 0,
    };
  }
}

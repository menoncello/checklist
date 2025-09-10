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

export class InputValidator {
  private config: InputValidatorConfig;
  private validationRules = new Map<string, ValidationRule>();
  private eventHandlers = new Map<string, Set<Function>>();
  private validationHistory: ValidationHistoryEntry[] = [];
  private maxHistorySize = 200;
  private validationMetrics = {
    totalValidations: 0,
    validInputs: 0,
    invalidInputs: 0,
    sanitizedInputs: 0,
    averageValidationTime: 0,
    totalValidationTime: 0,
  };

  // Dangerous ANSI escape sequences
  private readonly dangerousAnsiPatterns = [
    /\x1b\]0;/g, // Set window title
    /\x1b\]1;/g, // Set icon name
    /\x1b\]2;/g, // Set window title
    /\x1b\[6n/g, // Device Status Report (cursor position)
    /\x1b\[c/g, // Device Attributes
    /\x1b\[>c/g, // Secondary Device Attributes
    /\x1bc/g, // Full reset
    /\x1b#8/g, // Screen alignment test
    /\x1b\[\?1049[hl]/g, // Alternative screen buffer
    /\x1b\[\?2004[hl]/g, // Bracketed paste mode
    /\x1b\[\?25[hl]/g, // Show/hide cursor (when not intended)
  ];

  // Safe ANSI escape sequences (allowed)
  private readonly safeAnsiPatterns = [
    /\x1b\[[\d;]*m/g, // Color and style sequences
    /\x1b\[[\d;]*[ABCD]/g, // Cursor movement (arrow keys)
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

    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    // Basic length validation
    this.addRule({
      name: 'maxLength',
      validator: (input: string) =>
        !this.config.enableLengthLimits ||
        input.length <= this.config.maxLength,
      errorMessage: `Input exceeds maximum length of ${this.config.maxLength} characters`,
      priority: 100,
    });

    // ANSI escape sequence validation
    this.addRule({
      name: 'ansiValidation',
      validator: (input: string) => this.validateAnsiSequences(input),
      sanitizer: (input: string) => this.sanitizeAnsiSequences(input),
      errorMessage: 'Contains dangerous ANSI escape sequences',
      priority: 90,
    });

    // Control character validation
    this.addRule({
      name: 'controlChars',
      validator: (input: string) => this.validateControlCharacters(input),
      sanitizer: (input: string) => this.sanitizeControlCharacters(input),
      errorMessage: 'Contains dangerous control characters',
      priority: 80,
    });

    // Null byte validation
    this.addRule({
      name: 'nullBytes',
      validator: (input: string) => !input.includes('\x00'),
      sanitizer: (input: string) => input.replace(/\x00/g, ''),
      errorMessage: 'Contains null bytes',
      priority: 95,
    });

    // Unicode validation
    this.addRule({
      name: 'unicode',
      validator: (input: string) => this.validateUnicode(input),
      sanitizer: (input: string) => this.sanitizeUnicode(input),
      errorMessage: 'Contains invalid Unicode sequences',
      priority: 70,
    });
  }

  public validate(input: string): InputValidationResult {
    const startTime = performance.now();

    const result: InputValidationResult = {
      isValid: true,
      sanitized: input,
      warnings: [],
      errors: [],
    };

    try {
      // Get rules sorted by priority (highest first)
      const sortedRules = Array.from(this.validationRules.values()).sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      );

      for (const rule of sortedRules) {
        const ruleResult = this.applyRule(rule, result.sanitized);

        if (!ruleResult.isValid) {
          result.isValid = false;
          if (rule.errorMessage != null && rule.errorMessage.length > 0) {
            result.errors.push(rule.errorMessage);
          }
        }

        if (ruleResult.sanitized !== result.sanitized) {
          result.sanitized = ruleResult.sanitized;
          this.validationMetrics.sanitizedInputs++;
        }

        // Add any rule-specific warnings
        if (ruleResult.warnings) {
          result.warnings.push(...ruleResult.warnings);
        }
      }

      // Apply blocked patterns
      for (const pattern of this.config.blockedPatterns) {
        if (pattern.test(result.sanitized)) {
          result.isValid = false;
          result.errors.push(
            `Input matches blocked pattern: ${pattern.source}`
          );
        }
      }

      const endTime = performance.now();
      this.updateMetrics(result.isValid, endTime - startTime);

      this.recordValidation(input, result, endTime - startTime);

      if (this.config.enableLogging) {
        this.logValidation(input, result);
      }

      this.emit('validation', { input, result });
    } catch (error) {
      result.isValid = false;
      result.errors.push(`Validation error: ${(error as Error).message}`);
      this.emit('validationError', { input, error });
    }

    return result;
  }

  private applyRule(
    rule: ValidationRule,
    input: string
  ): { isValid: boolean; sanitized: string; warnings?: string[] } {
    let isValid = true;
    let sanitized = input;
    const warnings: string[] = [];

    try {
      // Apply pattern matching if provided
      if (rule.pattern?.test(input) === true) {
        isValid = false;
      }

      // Apply custom validator if provided
      if (rule.validator) {
        isValid = rule.validator(input);
      }

      // Apply sanitizer if provided
      if (rule.sanitizer) {
        const originalLength = input.length;
        sanitized = rule.sanitizer(input);

        if (sanitized.length !== originalLength) {
          warnings.push(
            `Rule '${rule.name}' modified input length: ${originalLength} -> ${sanitized.length}`
          );
        }
      }
    } catch (error) {
      isValid = false;
      warnings.push(
        `Error in rule '${rule.name}': ${(error as Error).message}`
      );
    }

    return { isValid, sanitized, warnings };
  }

  private validateAnsiSequences(input: string): boolean {
    if (!this.config.enableAnsiSanitization) return true;

    // Check for dangerous ANSI sequences
    for (const pattern of this.dangerousAnsiPatterns) {
      if (pattern.test(input)) {
        return false;
      }
    }

    return true;
  }

  private sanitizeAnsiSequences(input: string): string {
    if (!this.config.enableAnsiSanitization) return input;

    let sanitized = input;

    // Remove dangerous ANSI sequences
    for (const pattern of this.dangerousAnsiPatterns) {
      sanitized = sanitized.replace(pattern, '');
    }

    // Optionally, we could also remove ALL ANSI sequences except safe ones
    // For now, we only remove dangerous ones

    return sanitized;
  }

  private validateControlCharacters(input: string): boolean {
    // Allow some common control characters
    const allowedControlChars = [
      0x09, // Tab
      0x0a, // Line Feed
      0x0d, // Carriage Return
      0x1b, // Escape (for ANSI sequences)
    ];

    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);

      // Check for control characters (0x00-0x1F and 0x7F-0x9F)
      if (
        (charCode < 0x20 || (charCode >= 0x7f && charCode <= 0x9f)) &&
        !allowedControlChars.includes(charCode)
      ) {
        return false;
      }
    }

    return true;
  }

  private sanitizeControlCharacters(input: string): string {
    const allowedControlChars = [0x09, 0x0a, 0x0d, 0x1b];
    let sanitized = '';

    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      const charCode = char.charCodeAt(0);

      if (
        (charCode < 0x20 || (charCode >= 0x7f && charCode <= 0x9f)) &&
        !allowedControlChars.includes(charCode)
      ) {
        // Replace with space or remove
        continue;
      }

      sanitized += char;
    }

    return sanitized;
  }

  private validateUnicode(input: string): boolean {
    try {
      // Check for valid UTF-8 encoding
      const encoded = Buffer.from(input, 'utf8');
      const decoded = encoded.toString('utf8');
      return decoded === input;
    } catch {
      return false;
    }
  }

  private sanitizeUnicode(input: string): string {
    try {
      // Attempt to clean invalid Unicode
      return Buffer.from(input, 'utf8').toString('utf8');
    } catch {
      // Fallback: remove non-ASCII characters
      return input.replace(/[^\x00-\x7F]/g, '');
    }
  }

  private updateMetrics(isValid: boolean, validationTime: number): void {
    this.validationMetrics.totalValidations++;

    if (isValid) {
      this.validationMetrics.validInputs++;
    } else {
      this.validationMetrics.invalidInputs++;
    }

    this.validationMetrics.totalValidationTime += validationTime;
    this.validationMetrics.averageValidationTime =
      this.validationMetrics.totalValidationTime /
      this.validationMetrics.totalValidations;
  }

  private recordValidation(
    input: string,
    result: InputValidationResult,
    duration: number
  ): void {
    const entry: ValidationHistoryEntry = {
      timestamp: Date.now(),
      inputLength: input.length,
      isValid: result.isValid,
      sanitized: result.sanitized !== input,
      errorCount: result.errors.length,
      warningCount: result.warnings.length,
      duration,
    };

    this.validationHistory.push(entry);

    if (this.validationHistory.length > this.maxHistorySize) {
      this.validationHistory = this.validationHistory.slice(
        -this.maxHistorySize
      );
    }
  }

  private logValidation(input: string, result: InputValidationResult): void {
    if (result.isValid) {
      console.log(
        `Input validation passed: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`
      );
    } else {
      console.warn(`Input validation failed: ${result.errors.join(', ')}`);
      console.warn(
        `Original: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`
      );
      console.warn(
        `Sanitized: ${result.sanitized.substring(0, 50)}${result.sanitized.length > 50 ? '...' : ''}`
      );
    }
  }

  public addRule(rule: ValidationRule): void {
    this.validationRules.set(rule.name, rule);
    this.emit('ruleAdded', { rule });
  }

  public removeRule(name: string): boolean {
    const removed = this.validationRules.delete(name);
    if (removed) {
      this.emit('ruleRemoved', { name });
    }
    return removed;
  }

  public getRules(): ValidationRule[] {
    return Array.from(this.validationRules.values());
  }

  public updateConfig(newConfig: Partial<InputValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', { config: this.config });
  }

  public getConfig(): InputValidatorConfig {
    return { ...this.config };
  }

  public getMetrics() {
    return {
      ...this.validationMetrics,
      validationRate:
        this.validationMetrics.totalValidations > 0
          ? this.validationMetrics.validInputs /
            this.validationMetrics.totalValidations
          : 0,
      sanitizationRate:
        this.validationMetrics.totalValidations > 0
          ? this.validationMetrics.sanitizedInputs /
            this.validationMetrics.totalValidations
          : 0,
      ruleCount: this.validationRules.size,
      historySize: this.validationHistory.length,
    };
  }

  public getValidationHistory(limit?: number): ValidationHistoryEntry[] {
    const history = [...this.validationHistory];
    return limit != null && limit !== 0 ? history.slice(-limit) : history;
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

  public validateBatch(inputs: string[]): InputValidationResult[] {
    return inputs.map((input) => this.validate(input));
  }

  public isInputSafe(input: string): boolean {
    const result = this.validate(input);
    return result.isValid;
  }

  public sanitizeInput(input: string): string {
    const result = this.validate(input);
    return result.sanitized;
  }

  public validateAndSanitize(input: string): {
    isValid: boolean;
    sanitized: string;
  } {
    const result = this.validate(input);
    return {
      isValid: result.isValid,
      sanitized: result.sanitized,
    };
  }

  public debug(): InputValidatorDebugInfo {
    return {
      config: this.getConfig(),
      metrics: this.getMetrics(),
      rules: this.getRules().map((rule) => ({
        name: rule.name,
        hasPattern: Boolean(rule.pattern),
        hasValidator: Boolean(rule.validator),
        hasSanitizer: Boolean(rule.sanitizer),
        priority: rule.priority ?? 0,
      })),
      recentValidations: this.getValidationHistory(10),
    };
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          console.error(
            `Error in input validator event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

interface ValidationHistoryEntry {
  timestamp: number;
  inputLength: number;
  isValid: boolean;
  sanitized: boolean;
  errorCount: number;
  warningCount: number;
  duration: number;
}

interface InputValidatorDebugInfo {
  config: InputValidatorConfig;
  metrics: ReturnType<InputValidator['getMetrics']>;
  rules: Array<{
    name: string;
    hasPattern: boolean;
    hasValidator: boolean;
    hasSanitizer: boolean;
    priority: number;
  }>;
  recentValidations: ValidationHistoryEntry[];
}

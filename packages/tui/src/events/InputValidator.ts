import { InputValidatorCore } from './InputValidatorCore';
import type {
  InputValidationResult,
  ValidationRule,
  InputValidatorConfig,
} from './InputValidatorCore';
import { InputValidatorEvents } from './InputValidatorEvents';

export type { InputValidationResult, ValidationRule, InputValidatorConfig };

interface _InputValidatorDebugHistoryEntry {
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
  recentValidations: ReturnType<InputValidatorCore['getHistory']>;
}

export class InputValidator extends InputValidatorCore {
  private events = new InputValidatorEvents();

  constructor(config: Partial<InputValidatorConfig> = {}) {
    super(config);
    this.setupDefaultRules();
  }

  private setupDefaultRules(): void {
    [
      this.createMaxLengthRule(),
      this.createAnsiValidationRule(),
      this.createNullBytesRule(),
      this.createControlCharsRule(),
      this.createUnicodeRule(),
    ].forEach((rule) => this.addRule(rule));
  }

  private createMaxLengthRule(): ValidationRule {
    return {
      name: 'maxLength',
      validator: (input: string) =>
        !this.config.enableLengthLimits ||
        input.length <= this.config.maxLength,
      errorMessage: `Input exceeds maximum length of ${this.config.maxLength} characters`,
      priority: 100,
    };
  }

  private createAnsiValidationRule(): ValidationRule {
    return {
      name: 'ansiValidation',
      validator: (input: string) => this.validateAnsiSequences(input),
      sanitizer: (input: string) => this.sanitizeAnsiSequences(input),
      errorMessage: 'Contains dangerous ANSI escape sequences',
      priority: 90,
    };
  }

  private createNullBytesRule(): ValidationRule {
    return {
      name: 'nullBytes',
      validator: (input: string) => !input.includes('\x00'),
      sanitizer: (input: string) => input.replace(/\x00/g, ''),
      errorMessage: 'Contains null bytes',
      priority: 95,
    };
  }

  private createControlCharsRule(): ValidationRule {
    return {
      name: 'controlChars',
      validator: (input: string) => this.validateControlCharacters(input),
      sanitizer: (input: string) => this.sanitizeControlCharacters(input),
      errorMessage: 'Contains dangerous control characters',
      priority: 80,
    };
  }

  private createUnicodeRule(): ValidationRule {
    return {
      name: 'unicode',
      validator: (input: string) => this.validateUnicode(input),
      sanitizer: (input: string) => this.sanitizeUnicode(input),
      errorMessage: 'Contains invalid Unicode sequences',
      priority: 70,
    };
  }

  public validate(input: string): InputValidationResult {
    const startTime = performance.now();
    const result = this.createInitialResult(input);
    try {
      this.applyValidationRules(result);
      this.applyBlockedPatterns(result);
      const duration = performance.now() - startTime;
      this.finalizeValidation(input, result, duration);
    } catch (error) {
      this.handleValidationError(result, error as Error, input);
    }
    return result;
  }

  private createInitialResult(input: string): InputValidationResult {
    return { isValid: true, sanitized: input, warnings: [], errors: [] };
  }

  private applyValidationRules(result: InputValidationResult): void {
    const sortedRules = this.getRules();
    for (const rule of sortedRules) {
      this.processValidationRule(rule, result);
    }
  }

  private applyBlockedPatterns(result: InputValidationResult): void {
    for (const pattern of this.config.blockedPatterns) {
      if (pattern.test(result.sanitized)) {
        result.isValid = false;
        result.errors.push(`Input matches blocked pattern: ${pattern.source}`);
      }
    }
  }

  private finalizeValidation(
    input: string,
    result: InputValidationResult,
    duration: number
  ): void {
    this.recordValidation(input, result, duration);
    if (this.config.enableLogging) {
      this.logValidation(input, result);
    }
    this.events.emit('validation', { input, result });
  }

  private handleValidationError(
    result: InputValidationResult,
    error: Error,
    input: string
  ): void {
    result.isValid = false;
    result.errors.push(`Validation error: ${error.message}`);
    this.events.emit('validationError', { input, error });
  }

  private applyRule(
    rule: ValidationRule,
    input: string
  ): { isValid: boolean; sanitized: string; warnings?: string[] } {
    const warnings: string[] = [];
    try {
      const isValid = this.checkRuleValidity(rule, input);
      const sanitized = this.applySanitizer(rule, input, warnings);
      return { isValid, sanitized, warnings };
    } catch (error) {
      warnings.push(
        `Error in rule '${rule.name}': ${(error as Error).message}`
      );
      return { isValid: false, sanitized: input, warnings };
    }
  }

  private checkRuleValidity(rule: ValidationRule, input: string): boolean {
    if (rule.pattern?.test(input) === true) return false;
    if (rule.validator) return rule.validator(input);
    return true;
  }

  private applySanitizer(
    rule: ValidationRule,
    input: string,
    warnings: string[]
  ): string {
    if (!rule.sanitizer) return input;
    const originalLength = input.length;
    const sanitized = rule.sanitizer(input);
    if (sanitized.length !== originalLength) {
      warnings.push(
        `Rule '${rule.name}' modified input length: ${originalLength} -> ${sanitized.length}`
      );
    }
    return sanitized;
  }

  private processValidationRule(
    rule: ValidationRule,
    result: InputValidationResult
  ): void {
    const ruleResult = this.applyRule(rule, result.sanitized);
    if (!ruleResult.isValid) {
      result.isValid = false;
      if (rule.errorMessage != null && rule.errorMessage !== '') {
        result.errors.push(rule.errorMessage);
      }
    }
    if (ruleResult.sanitized !== result.sanitized) {
      result.sanitized = ruleResult.sanitized;
      this.validationMetrics.sanitizedInputs++;
    }
    if (ruleResult.warnings) {
      result.warnings.push(...ruleResult.warnings);
    }
  }

  private validateControlCharacters(input: string): boolean {
    return !this.hasControlChars(input);
  }
  private sanitizeControlCharacters(input: string): string {
    return this.removeControlChars(input);
  }

  private validateUnicode(input: string): boolean {
    try {
      return Buffer.from(input, 'utf8').toString('utf8') === input;
    } catch {
      return false;
    }
  }

  private sanitizeUnicode(input: string): string {
    try {
      return Buffer.from(input, 'utf8').toString('utf8');
    } catch {
      return input.replace(/[^\x00-\x7F]/g, '');
    }
  }

  protected recordValidation(
    input: string,
    result: InputValidationResult,
    duration: number
  ): void {
    super.recordValidation(input, result, duration);
  }

  private logValidation(input: string, result: InputValidationResult): void {
    const preview = input.substring(0, 50) + (input.length > 50 ? '...' : '');
    if (result.isValid) {
      console.log(`Input validation passed: ${preview}`);
    } else {
      console.warn(`Input validation failed: ${result.errors.join(', ')}`);
      console.warn(`Original: ${preview}`);
      const sanitizedPreview =
        result.sanitized.substring(0, 50) +
        (result.sanitized.length > 50 ? '...' : '');
      console.warn(`Sanitized: ${sanitizedPreview}`);
    }
  }

  public addRule(rule: ValidationRule): void {
    super.addRule(rule);
    this.events.emit('ruleAdded', { rule });
  }
  public removeRule(name: string): boolean {
    const removed = super.removeRule(name);
    if (removed) this.events.emit('ruleRemoved', { name });
    return removed;
  }
  public updateConfig(newConfig: Partial<InputValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.events.emit('configUpdated', { config: this.config });
  }

  public getMetrics() {
    const baseMetrics = super.getMetrics();
    return {
      ...baseMetrics,
      validationRate:
        baseMetrics.totalValidations > 0
          ? baseMetrics.validInputs / baseMetrics.totalValidations
          : 0,
      sanitizationRate:
        baseMetrics.totalValidations > 0
          ? baseMetrics.sanitizedInputs / baseMetrics.totalValidations
          : 0,
      ruleCount: this.getRules().length,
      historySize: this.getHistory().length,
    };
  }

  public debug(): InputValidatorDebugInfo {
    return {
      config: { ...this.config },
      metrics: this.getMetrics(),
      rules: this.getRules().map((rule) => ({
        name: rule.name,
        hasPattern: Boolean(rule.pattern),
        hasValidator: Boolean(rule.validator),
        hasSanitizer: Boolean(rule.sanitizer),
        priority: rule.priority ?? 0,
      })),
      recentValidations: this.getHistory(10),
    };
  }

  public on(event: string, handler: Function): void {
    this.events.on(event, handler);
  }
  public off(event: string, handler: Function): void {
    this.events.off(event, handler);
  }
  private emit(event: string, data?: unknown): void {
    this.events.emit(event, data);
  }
  public validateAndSanitize(input: string): InputValidationResult {
    return this.validate(input);
  }
  public isInputSafe(input: string): boolean {
    return this.validate(input).isValid;
  }
  public sanitizeInput(input: string): string {
    return this.validate(input).sanitized;
  }
}

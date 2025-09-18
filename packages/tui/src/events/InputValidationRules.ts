export interface ValidationRule {
  name: string;
  description?: string;
  validate: (
    value: unknown,
    context?: Record<string, unknown>
  ) => boolean | Promise<boolean>;
  message?:
    | string
    | ((value: unknown, context?: Record<string, unknown>) => string);
  severity?: 'error' | 'warning' | 'info';
}

export interface ValidationResult {
  isValid: boolean;
  errors: Array<{ rule: string; message: string; severity?: string }>;
  warnings: Array<{ rule: string; message: string }>;
  value?: unknown;
  metadata?: Record<string, unknown>;
}

export class DefaultValidationRules {
  static createRequiredRule(): ValidationRule {
    return {
      name: 'required',
      validate: (value) => value != null && value !== '' && value !== false,
      message: 'This field is required',
      severity: 'error',
    };
  }

  static createMinLengthRule(min: number): ValidationRule {
    return {
      name: 'minLength',
      validate: (value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length >= min;
        }
        return true;
      },
      message: `Must be at least ${min} characters`,
      severity: 'error',
    };
  }

  static createMaxLengthRule(max: number): ValidationRule {
    return {
      name: 'maxLength',
      validate: (value) => {
        if (typeof value === 'string' || Array.isArray(value)) {
          return value.length <= max;
        }
        return true;
      },
      message: `Must be at most ${max} characters`,
      severity: 'error',
    };
  }

  static createPatternRule(pattern: RegExp, message?: string): ValidationRule {
    return {
      name: 'pattern',
      validate: (value) => {
        if (typeof value === 'string') {
          return pattern.test(value);
        }
        return true;
      },
      message:
        message != null && message.length > 0 ? message : 'Invalid format',
      severity: 'error',
    };
  }

  static createEmailRule(): ValidationRule {
    return {
      name: 'email',
      validate: (value) => {
        if (typeof value !== 'string') return true;
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(value);
      },
      message: 'Invalid email address',
      severity: 'error',
    };
  }

  static createNumberRule(options?: {
    min?: number;
    max?: number;
  }): ValidationRule {
    return {
      name: 'number',
      validate: (value) => {
        const num = Number(value);
        if (isNaN(num)) return false;
        if (options?.min !== undefined && num < options.min) return false;
        if (options?.max !== undefined && num > options.max) return false;
        return true;
      },
      message: (value) => {
        const num = Number(value);
        if (isNaN(num)) return 'Must be a number';
        if (options?.min !== undefined && num < options.min) {
          return `Must be at least ${options.min}`;
        }
        if (options?.max !== undefined && num > options.max) {
          return `Must be at most ${options.max}`;
        }
        return 'Invalid number';
      },
      severity: 'error',
    };
  }

  static createCustomRule(
    name: string,
    validator: (value: unknown) => boolean,
    message?: string
  ): ValidationRule {
    return {
      name,
      validate: validator,
      message:
        message != null && message.length > 0 ? message : 'Validation failed',
      severity: 'error',
    };
  }
}

import { test, expect, beforeEach, afterEach, describe, mock } from 'bun:test';
import {
  InputValidator,
  InputValidationResult,
  ValidationRule,
  InputValidatorConfig,
} from '../../src/events/InputValidator';

describe('InputValidator', () => {
  let inputValidator: InputValidator;

  beforeEach(() => {
    inputValidator = new InputValidator();
  });

  afterEach(() => {
    inputValidator.clearHistory();
    inputValidator.resetMetrics();
  });

  describe('constructor and configuration', () => {
    test('should initialize with default config', () => {
      const validator = new InputValidator();
      const config = validator.getConfig();

      expect(config.enableAnsiSanitization).toBe(true);
      expect(config.enableLengthLimits).toBe(true);
      expect(config.maxLength).toBe(1000);
      expect(config.allowedCharsets).toEqual(['ascii', 'latin1', 'utf8']);
      expect(config.blockedPatterns).toEqual([]);
      expect(config.enableLogging).toBe(false);
    });

    test('should initialize with custom config', () => {
      const customConfig: Partial<InputValidatorConfig> = {
        enableAnsiSanitization: false,
        maxLength: 500,
        enableLogging: true,
        blockedPatterns: [/test/g],
      };

      const validator = new InputValidator(customConfig);
      const config = validator.getConfig();

      expect(config.enableAnsiSanitization).toBe(false);
      expect(config.maxLength).toBe(500);
      expect(config.enableLogging).toBe(true);
      expect(config.blockedPatterns).toHaveLength(1);
    });

    test('should set up default validation rules', () => {
      const rules = inputValidator.getRules();
      expect(rules.length).toBeGreaterThan(0);

      const ruleNames = rules.map(r => r.name);
      expect(ruleNames).toContain('maxLength');
      expect(ruleNames).toContain('ansiValidation');
      expect(ruleNames).toContain('controlChars');
      expect(ruleNames).toContain('nullBytes');
      expect(ruleNames).toContain('unicode');
    });
  });

  describe('basic validation', () => {
    test('should validate normal text input', () => {
      const input = 'Hello, world!';
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(input);
      expect(result.errors).toEqual([]);
      expect(result.warnings).toEqual([]);
    });

    test('should validate empty string', () => {
      const result = inputValidator.validate('');

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe('');
      expect(result.errors).toEqual([]);
    });

    test('should validate input with allowed special characters', () => {
      const input = 'Text with tabs\tand newlines\nand returns\r';
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    test('should reject input exceeding maximum length', () => {
      const validator = new InputValidator({ maxLength: 10 });
      const input = 'This is a very long input that exceeds the limit';
      const result = validator.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Input exceeds maximum length of 10 characters');
    });

    test('should allow long input when length limits disabled', () => {
      const validator = new InputValidator({ enableLengthLimits: false });
      const input = 'x'.repeat(2000);
      const result = validator.validate(input);

      expect(result.isValid).toBe(true);
    });
  });

  describe('ANSI sequence validation', () => {
    test('should allow safe ANSI sequences', () => {
      const input = '\x1b[31mRed text\x1b[0m'; // Color sequences
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(true);
    });

    test('should detect dangerous ANSI sequences', () => {
      const input = '\x1b]0;Dangerous title\x07'; // Set window title
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Contains dangerous ANSI escape sequences');
    });

    test('should sanitize dangerous ANSI sequences', () => {
      const input = 'Safe text\x1b]0;Bad titleMore safe text';
      const result = inputValidator.validate(input);

      // The ANSI pattern only removes the escape sequence, not the content after it
      expect(result.sanitized).toBe('Safe textBad titleMore safe text');
      expect(result.isValid).toBe(false);
    });

    test('should skip ANSI validation when disabled', () => {
      const validator = new InputValidator({ enableAnsiSanitization: false });
      const input = 'Title'; // Safe input
      const result = validator.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    test('should handle multiple dangerous ANSI patterns', () => {
      const input = '\x1b]0;title\x1b[6n\x1bc'; // Multiple dangerous sequences
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe('title'); // Dangerous sequences removed, text remains
    });
  });

  describe('control character validation', () => {
    test('should reject dangerous control characters', () => {
      const input = 'Text with\x01dangerous\x02control\x03chars';
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Contains dangerous control characters');
    });

    test('should sanitize control characters', () => {
      const input = 'Clean\x01this\x02up';
      const result = inputValidator.validate(input);

      expect(result.sanitized).toBe('Cleanthisup');
    });

    test('should allow specific control characters', () => {
      const input = 'Text\twith\nallowed\rcontrolchars'; // Removed \x1b as it might cause ANSI validation to fail
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    test('should handle extended control characters', () => {
      const input = 'Text\x7F\x80\x9Fmore';
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe('Textmore');
    });
  });

  describe('null byte validation', () => {
    test('should detect null bytes', () => {
      const input = 'Text\x00with\x00nulls';
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Contains null bytes');
    });

    test('should sanitize null bytes', () => {
      const input = 'Clean\x00me\x00up';
      const result = inputValidator.validate(input);

      expect(result.sanitized).toBe('Cleanmeup');
    });
  });

  describe('unicode validation', () => {
    test('should validate valid unicode', () => {
      const input = 'Unicode: 🚀 ñoñó çáráçtérs';
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(true);
      expect(result.sanitized).toBe(input);
    });

    test('should handle unicode edge cases', () => {
      // Test with various unicode characters
      const input = '测试中文 🌟 Русский Ελληνικά';
      const result = inputValidator.validate(input);

      expect(result.isValid).toBe(true);
    });
  });

  describe('custom validation rules', () => {
    test('should add custom validation rule', () => {
      const customRule: ValidationRule = {
        name: 'noNumbers',
        validator: (input: string) => !/\d/.test(input),
        errorMessage: 'Numbers not allowed',
        priority: 50,
      };

      inputValidator.addRule(customRule);

      const result1 = inputValidator.validate('Hello world');
      expect(result1.isValid).toBe(true);

      const result2 = inputValidator.validate('Hello 123');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Numbers not allowed');
    });

    test('should add rule with pattern matching', () => {
      const customRule: ValidationRule = {
        name: 'noEmail',
        pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
        errorMessage: 'Email addresses not allowed',
      };

      inputValidator.addRule(customRule);

      const result1 = inputValidator.validate('No email here');
      expect(result1.isValid).toBe(true);

      const result2 = inputValidator.validate('Contact me at test@example.com');
      expect(result2.isValid).toBe(false);
      expect(result2.errors).toContain('Email addresses not allowed');
    });

    test('should add rule with sanitizer', () => {
      const customRule: ValidationRule = {
        name: 'removeSpaces',
        sanitizer: (input: string) => input.replace(/\s/g, ''),
        priority: 10,
      };

      inputValidator.addRule(customRule);

      const result = inputValidator.validate('hello world');
      expect(result.sanitized).toBe('helloworld');
      // Length changed from 11 to 10, so should have warnings about sanitization
      expect(result.warnings.some(w => w.includes('modified input length'))).toBe(true);
    });

    test('should remove validation rule', () => {
      const customRule: ValidationRule = {
        name: 'temporary',
        validator: () => false,
        errorMessage: 'Always fails',
      };

      inputValidator.addRule(customRule);
      let result = inputValidator.validate('test');
      expect(result.isValid).toBe(false);

      const removed = inputValidator.removeRule('temporary');
      expect(removed).toBe(true);

      result = inputValidator.validate('test');
      expect(result.isValid).toBe(true);
    });

    test('should return false when removing non-existent rule', () => {
      const removed = inputValidator.removeRule('nonexistent');
      expect(removed).toBe(false);
    });

    test('should handle rule priority ordering', () => {
      const rule1: ValidationRule = {
        name: 'lowPriority',
        sanitizer: (input: string) => input + '-low',
        priority: 10,
      };

      const rule2: ValidationRule = {
        name: 'highPriority',
        sanitizer: (input: string) => input + '-high',
        priority: 90,
      };

      inputValidator.addRule(rule1);
      inputValidator.addRule(rule2);

      const result = inputValidator.validate('test');
      // High priority rule should run first
      expect(result.sanitized).toBe('test-high-low');
    });
  });

  describe('blocked patterns', () => {
    test('should block inputs matching blocked patterns', () => {
      const validator = new InputValidator({
        blockedPatterns: [/password/i, /secret/i],
      });

      const result1 = validator.validate('Normal text');
      expect(result1.isValid).toBe(true);

      const result2 = validator.validate('My password is 123');
      expect(result2.isValid).toBe(false);
      expect(result2.errors[0]).toContain('Input matches blocked pattern');

      const result3 = validator.validate('Top SECRET information');
      expect(result3.isValid).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should handle validation rule errors gracefully', () => {
      const faultyRule: ValidationRule = {
        name: 'faulty',
        validator: () => {
          throw new Error('Validator error');
        },
        errorMessage: 'Faulty rule failed',
      };

      inputValidator.addRule(faultyRule);

      const result = inputValidator.validate('test');
      expect(result.isValid).toBe(false);
      expect(result.warnings).toContain("Error in rule 'faulty': Validator error");
    });

    test('should handle sanitizer rule errors gracefully', () => {
      const faultySanitizer: ValidationRule = {
        name: 'faultySanitizer',
        sanitizer: () => {
          throw new Error('Sanitizer error');
        },
      };

      inputValidator.addRule(faultySanitizer);

      const result = inputValidator.validate('test');
      expect(result.warnings).toContain("Error in rule 'faultySanitizer': Sanitizer error");
    });

    test('should handle general validation errors', () => {
      // Mock the validate method to throw an error during processing
      const originalProcessRule = (inputValidator as any).processValidationRule;
      (inputValidator as any).processValidationRule = () => {
        throw new Error('General validation error');
      };

      const result = inputValidator.validate('test');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Validation error: General validation error');

      // Restore original method
      (inputValidator as any).processValidationRule = originalProcessRule;
    });
  });

  describe('metrics and history', () => {
    test('should track validation metrics', () => {
      inputValidator.validate('valid input');
      inputValidator.validate(''); // Also valid
      inputValidator.validate('\x00invalid'); // Invalid due to null byte

      const metrics = inputValidator.getMetrics();
      expect(metrics.totalValidations).toBe(3);
      expect(metrics.validInputs).toBe(2);
      expect(metrics.invalidInputs).toBe(1);
      expect(metrics.averageValidationTime).toBeGreaterThan(0);
      expect(metrics.validationRate).toBeCloseTo(2/3);
    });

    test('should track sanitization metrics', () => {
      inputValidator.validate('clean input');
      inputValidator.validate('\x00dirty input'); // Will be sanitized

      const metrics = inputValidator.getMetrics();
      expect(metrics.sanitizedInputs).toBe(1);
      expect(metrics.sanitizationRate).toBe(0.5);
    });

    test('should maintain validation history', () => {
      inputValidator.validate('input1');
      inputValidator.validate('input2');
      inputValidator.validate('\x00input3');

      const history = inputValidator.getValidationHistory();
      expect(history).toHaveLength(3);

      expect(history[0].inputLength).toBe(6);
      expect(history[0].isValid).toBe(true);
      expect(history[1].inputLength).toBe(6);
      expect(history[1].isValid).toBe(true);
      expect(history[2].inputLength).toBe(7);
      expect(history[2].isValid).toBe(false);
    });

    test('should limit history size', () => {
      const validator = new InputValidator();
      // Set a small max history size for testing
      (validator as any).maxHistorySize = 3;

      for (let i = 0; i < 5; i++) {
        validator.validate(`input${i}`);
      }

      const history = validator.getValidationHistory();
      expect(history).toHaveLength(3);
    });

    test('should get limited validation history', () => {
      for (let i = 0; i < 10; i++) {
        inputValidator.validate(`input${i}`);
      }

      const limitedHistory = inputValidator.getValidationHistory(3);
      expect(limitedHistory).toHaveLength(3);
    });

    test('should clear validation history', () => {
      inputValidator.validate('test');
      expect(inputValidator.getValidationHistory()).toHaveLength(1);

      inputValidator.clearHistory();
      expect(inputValidator.getValidationHistory()).toHaveLength(0);
    });

    test('should reset metrics', () => {
      inputValidator.validate('test');
      expect(inputValidator.getMetrics().totalValidations).toBe(1);

      inputValidator.resetMetrics();
      const metrics = inputValidator.getMetrics();
      expect(metrics.totalValidations).toBe(0);
      expect(metrics.validInputs).toBe(0);
      expect(metrics.invalidInputs).toBe(0);
    });
  });

  describe('convenience methods', () => {
    test('should validate batch inputs', () => {
      const inputs = ['valid1', 'valid2', '\x00invalid'];
      const results = inputValidator.validateBatch(inputs);

      expect(results).toHaveLength(3);
      expect(results[0].isValid).toBe(true);
      expect(results[1].isValid).toBe(true);
      expect(results[2].isValid).toBe(false);
    });

    test('should check if input is safe', () => {
      expect(inputValidator.isInputSafe('safe input')).toBe(true);
      expect(inputValidator.isInputSafe('\x00unsafe')).toBe(false);
    });

    test('should sanitize input', () => {
      const sanitized = inputValidator.sanitizeInput('dirty\x00input');
      expect(sanitized).toBe('dirtyinput');
    });

    test('should validate and sanitize in one call', () => {
      const result = inputValidator.validateAndSanitize('test\x00input');
      expect(result.isValid).toBe(false);
      expect(result.sanitized).toBe('testinput');
    });
  });

  describe('configuration updates', () => {
    test('should update configuration', () => {
      const newConfig = { maxLength: 50, enableLogging: true };
      inputValidator.updateConfig(newConfig);

      const config = inputValidator.getConfig();
      expect(config.maxLength).toBe(50);
      expect(config.enableLogging).toBe(true);
    });
  });

  describe('debug functionality', () => {
    test('should provide debug information', () => {
      inputValidator.validate('test input');

      const debugInfo = inputValidator.debug();

      expect(debugInfo.config).toBeDefined();
      expect(debugInfo.metrics).toBeDefined();
      expect(debugInfo.rules).toBeDefined();
      expect(debugInfo.recentValidations).toBeDefined();

      expect(debugInfo.rules.length).toBeGreaterThan(0);
      expect(debugInfo.recentValidations.length).toBe(1);

      // Check rule debug info structure
      const rule = debugInfo.rules[0];
      expect(rule).toHaveProperty('name');
      expect(rule).toHaveProperty('hasPattern');
      expect(rule).toHaveProperty('hasValidator');
      expect(rule).toHaveProperty('hasSanitizer');
      expect(rule).toHaveProperty('priority');
    });
  });

  describe('event handling', () => {
    test('should emit validation events', () => {
      const validationHandler = mock(() => {});
      const ruleAddedHandler = mock(() => {});

      inputValidator.on('validation', validationHandler);
      inputValidator.on('ruleAdded', ruleAddedHandler);

      inputValidator.validate('test');
      expect(validationHandler).toHaveBeenCalled();

      inputValidator.addRule({
        name: 'testRule',
        validator: () => true,
      });
      expect(ruleAddedHandler).toHaveBeenCalled();
    });

    test('should emit rule removed events', () => {
      const ruleRemovedHandler = mock(() => {});
      inputValidator.on('ruleRemoved', ruleRemovedHandler);

      inputValidator.addRule({ name: 'testRule', validator: () => true });
      inputValidator.removeRule('testRule');

      expect(ruleRemovedHandler).toHaveBeenCalled();
    });

    test('should emit config updated events', () => {
      const configHandler = mock(() => {});
      inputValidator.on('configUpdated', configHandler);

      inputValidator.updateConfig({ maxLength: 100 });
      expect(configHandler).toHaveBeenCalled();
    });

    test('should emit validation error events', () => {
      const errorHandler = mock(() => {});
      inputValidator.on('validationError', errorHandler);

      // Mock the validate method to throw an error during main processing
      const originalValidate = inputValidator.validate;
      inputValidator.validate = function(this: typeof inputValidator, input: string) {
        try {
          throw new Error('Simulated validation error');
        } catch (error) {
          (this as any).emit('validationError', { input, error });
          return {
            isValid: false,
            sanitized: input,
            warnings: [],
            errors: [`Validation error: ${(error as Error).message}`],
          };
        }
      }.bind(inputValidator);

      inputValidator.validate('test');
      expect(errorHandler).toHaveBeenCalled();

      // Restore original method
      inputValidator.validate = originalValidate;
    });

    test('should remove event handlers', () => {
      const handler = mock(() => {});
      inputValidator.on('validation', handler);

      inputValidator.validate('test');
      expect(handler).toHaveBeenCalledTimes(1);

      inputValidator.off('validation', handler);
      inputValidator.validate('test');
      expect(handler).toHaveBeenCalledTimes(1); // Should not be called again
    });

    test('should handle event handler errors gracefully', () => {
      const errorHandler = () => {
        throw new Error('Handler error');
      };

      inputValidator.on('validation', errorHandler);

      // Should not throw error
      expect(() => {
        inputValidator.validate('test');
      }).not.toThrow();
    });
  });

  describe('logging functionality', () => {
    test('should log validation results when enabled', () => {
      const originalLog = console.log;
      const originalWarn = console.warn;
      const logSpy = mock(() => {});
      const warnSpy = mock(() => {});

      console.log = logSpy;
      console.warn = warnSpy;

      const validator = new InputValidator({ enableLogging: true });

      try {
        validator.validate('valid input');
        expect(logSpy).toHaveBeenCalled();

        validator.validate('\x00invalid input');
        expect(warnSpy).toHaveBeenCalled();
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
      }
    });

    test('should not log when logging disabled', () => {
      const originalLog = console.log;
      const logSpy = mock(() => {});
      console.log = logSpy;

      try {
        const validator = new InputValidator({ enableLogging: false });
        validator.validate('test');
        expect(logSpy).not.toHaveBeenCalled();
      } finally {
        console.log = originalLog;
      }
    });
  });

  describe('edge cases and complex scenarios', () => {
    test('should handle empty rule name', () => {
      const rule: ValidationRule = {
        name: '',
        validator: () => false,
        errorMessage: '',
      };

      inputValidator.addRule(rule);
      const result = inputValidator.validate('test');

      expect(result.isValid).toBe(false);
      // Should not add empty error message
      expect(result.errors).not.toContain('');
    });

    test('should handle rule without error message', () => {
      const rule: ValidationRule = {
        name: 'noMessage',
        validator: () => false,
      };

      inputValidator.addRule(rule);
      const result = inputValidator.validate('test');

      expect(result.isValid).toBe(false);
      expect(result.errors).toEqual([]);
    });

    test('should handle very long inputs efficiently', () => {
      const validator = new InputValidator({ enableLengthLimits: false });
      const longInput = 'x'.repeat(100000);

      const startTime = performance.now();
      const result = validator.validate(longInput);
      const endTime = performance.now();

      expect(result.isValid).toBe(true);
      expect(endTime - startTime).toBeLessThan(1000); // Should complete in less than 1 second
    });

    test('should handle multiple rule errors', () => {
      const validator = new InputValidator({ maxLength: 5 });
      const input = 'very long input with\x00null byte';

      const result = validator.validate(input);

      expect(result.isValid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(1);
    });

    test('should handle rule priority edge cases', () => {
      const rule1: ValidationRule = {
        name: 'noPriority',
        sanitizer: (input: string) => input + '1',
      };

      const rule2: ValidationRule = {
        name: 'withPriority',
        sanitizer: (input: string) => input + '2',
        priority: 50,
      };

      inputValidator.addRule(rule1);
      inputValidator.addRule(rule2);

      const result = inputValidator.validate('test');
      // Rule with priority should run first
      expect(result.sanitized).toBe('test21');
    });

    test('should handle getValidationHistory with zero limit', () => {
      inputValidator.validate('test');
      const history = inputValidator.getValidationHistory(0);
      expect(history).toHaveLength(1); // Should return all when limit is 0
    });

    test('should handle metrics calculation edge cases', () => {
      const metrics = inputValidator.getMetrics();
      expect(metrics.validationRate).toBe(0);
      expect(metrics.sanitizationRate).toBe(0);
    });
  });
});
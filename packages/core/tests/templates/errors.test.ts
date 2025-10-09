import { describe, expect, test } from 'bun:test';
import {
  TemplateLoadError,
  TemplateValidationError,
  SandboxViolationError,
  TimeoutError,
  MemoryLimitError,
  TemplateInheritanceError,
  TemplateCacheError,
  ResourceLimitError,
  createTemplateError,
  isTemplateError,
  getRecoverySuggestion,
} from '../../src/templates/errors';

describe('Template Error Classes', () => {
  describe('TemplateLoadError', () => {
    test('should create error with correct message and context', () => {
      const error = new TemplateLoadError(
        '/templates/test.yaml',
        'File not found'
      );

      expect(error.message).toBe(
        'Failed to load template from "/templates/test.yaml": File not found'
      );
      expect(error.code).toBe('TEMPLATE_LOAD_ERROR');
      expect(error.recoverable).toBe(true);
      expect(error.context?.templatePath).toBe('/templates/test.yaml');
      expect(error.context?.recovery).toContain('template file exists');
    });

    test('should provide recovery strategy for file not found', () => {
      const error = new TemplateLoadError(
        '/templates/test.yaml',
        'ENOENT: no such file or directory'
      );

      expect(error.context?.recovery).toContain(
        'Ensure the template file exists'
      );
    });

    test('should provide recovery strategy for permission errors', () => {
      const error = new TemplateLoadError(
        '/templates/test.yaml',
        'EACCES: permission denied'
      );

      expect(error.context?.recovery).toContain('Check file permissions');
    });

    test('should provide recovery strategy for parse errors', () => {
      const error = new TemplateLoadError(
        '/templates/test.yaml',
        'YAML parse error on line 5'
      );

      expect(error.context?.recovery).toContain('valid YAML syntax');
    });

    test('should include original error in context', () => {
      const originalError = new Error('Original error message');
      const error = new TemplateLoadError(
        '/templates/test.yaml',
        'Parse failed',
        originalError
      );

      expect(error.context?.details).toHaveProperty('originalError');
      expect(error.context?.details?.originalError).toBe(
        'Original error message'
      );
    });
  });

  describe('TemplateValidationError', () => {
    test('should create error with violations list', () => {
      const violations = [
        'Missing required field: id',
        'Invalid variable type: age',
        'Step "step-1" has circular dependency',
      ];
      const error = new TemplateValidationError(
        'test-template',
        violations
      );

      expect(error.message).toContain('Template validation failed');
      expect(error.message).toContain('Missing required field: id');
      expect(error.message).toContain('Invalid variable type: age');
      expect(error.code).toBe('TEMPLATE_VALIDATION_ERROR');
      expect(error.recoverable).toBe(true);
    });

    test('should include violations in context', () => {
      const violations = ['Error 1', 'Error 2'];
      const error = new TemplateValidationError(
        'test-template',
        violations
      );

      expect(error.context?.details?.violations).toEqual(violations);
    });

    test('should provide recovery suggestion', () => {
      const error = new TemplateValidationError('test-template', [
        'Error',
      ]);

      expect(error.context?.recovery).toContain('Review and fix');
    });
  });

  describe('SandboxViolationError', () => {
    test('should create error for security violation', () => {
      const error = new SandboxViolationError(
        'test-template',
        'Attempted to access process.env'
      );

      expect(error.message).toContain('Sandbox security violation');
      expect(error.message).toContain('Attempted to access process.env');
      expect(error.code).toBe('SANDBOX_VIOLATION_ERROR');
      expect(error.recoverable).toBe(false);
    });

    test('should include violation details in context', () => {
      const details = { line: 42, expression: 'eval("code")' };
      const error = new SandboxViolationError(
        'test-template',
        'eval() usage detected',
        details
      );

      expect(error.context?.details).toMatchObject(details);
    });

    test('should provide recovery suggestion', () => {
      const error = new SandboxViolationError(
        'test-template',
        'Dangerous operation'
      );

      expect(error.context?.recovery).toContain(
        'Remove the dangerous operation'
      );
    });
  });

  describe('TimeoutError', () => {
    test('should create error with timeout details', () => {
      const error = new TimeoutError('test-template', 5000);

      expect(error.message).toContain('execution timeout');
      expect(error.message).toContain('5000ms');
      expect(error.code).toBe('TIMEOUT_ERROR');
      expect(error.recoverable).toBe(false);
    });

    test('should include operation in message when provided', () => {
      const error = new TimeoutError(
        'test-template',
        5000,
        'variable substitution'
      );

      expect(error.message).toContain('during variable substitution');
    });

    test('should include timeout and operation in context', () => {
      const error = new TimeoutError('test-template', 5000, 'parsing');

      expect(error.context?.details?.timeoutMs).toBe(5000);
      expect(error.context?.details?.operation).toBe('parsing');
    });
  });

  describe('MemoryLimitError', () => {
    test('should create error with memory details', () => {
      const error = new MemoryLimitError(
        'test-template',
        15 * 1024 * 1024,
        10 * 1024 * 1024
      );

      expect(error.message).toContain('exceeded memory limit');
      expect(error.message).toContain('15.00MB');
      expect(error.message).toContain('10.00MB');
      expect(error.code).toBe('MEMORY_LIMIT_ERROR');
      expect(error.recoverable).toBe(false);
    });

    test('should include memory values in context', () => {
      const error = new MemoryLimitError(
        'test-template',
        15000000,
        10000000
      );

      expect(error.context?.details?.memoryUsed).toBe(15000000);
      expect(error.context?.details?.memoryLimit).toBe(10000000);
    });
  });

  describe('TemplateInheritanceError', () => {
    test('should create error with inheritance issue', () => {
      const error = new TemplateInheritanceError(
        'child-template',
        'Circular dependency detected'
      );

      expect(error.message).toContain('Template inheritance error');
      expect(error.message).toContain('Circular dependency detected');
      expect(error.code).toBe('TEMPLATE_INHERITANCE_ERROR');
      expect(error.recoverable).toBe(true);
    });

    test('should include inheritance chain in message', () => {
      const chain = ['grandparent', 'parent', 'child', 'grandparent'];
      const error = new TemplateInheritanceError(
        'child',
        'Circular dependency',
        { chain }
      );

      expect(error.message).toContain(
        'grandparent → parent → child → grandparent'
      );
      expect(error.context?.details?.chain).toEqual(chain);
    });
  });

  describe('TemplateCacheError', () => {
    test('should create error with cache operation details', () => {
      const error = new TemplateCacheError(
        'invalidation',
        'Cache entry not found'
      );

      expect(error.message).toContain('Template cache invalidation failed');
      expect(error.message).toContain('Cache entry not found');
      expect(error.code).toBe('TEMPLATE_CACHE_ERROR');
      expect(error.recoverable).toBe(true);
    });

    test('should include context in details', () => {
      const context = { cacheKey: 'template-123', size: 1024 };
      const error = new TemplateCacheError(
        'eviction',
        'Memory limit exceeded',
        context
      );

      expect(error.context?.details).toMatchObject(context);
    });
  });

  describe('ResourceLimitError', () => {
    test('should create error with resource details', () => {
      const error = new ResourceLimitError('CPU', 95, 80);

      expect(error.message).toContain('Resource limit exceeded');
      expect(error.message).toContain('CPU used 95, limit 80');
      expect(error.code).toBe('RESOURCE_LIMIT_ERROR');
      expect(error.recoverable).toBe(false);
    });

    test('should include template ID when provided', () => {
      const error = new ResourceLimitError(
        'CPU',
        95,
        80,
        'test-template'
      );

      expect(error.message).toContain('in template "test-template"');
      expect(error.context?.templateId).toBe('test-template');
    });

    test('should include resource details in context', () => {
      const error = new ResourceLimitError('fileHandles', 15, 10);

      expect(error.context?.details?.resourceType).toBe('fileHandles');
      expect(error.context?.details?.used).toBe(15);
      expect(error.context?.details?.limit).toBe(10);
    });
  });

  describe('Utility Functions', () => {
    test('createTemplateError should add timestamp to context', () => {
      const error = createTemplateError(
        TemplateLoadError,
        '/templates/test.yaml',
        'Test error'
      );

      expect(error.context?.details?.timestamp).toBeDefined();
      expect(typeof error.context?.details?.timestamp).toBe('string');
    });

    test('isTemplateError should return true for TemplateError instances', () => {
      const error = new TemplateLoadError('/test.yaml', 'Error');
      expect(isTemplateError(error)).toBe(true);
    });

    test('isTemplateError should return false for non-TemplateError', () => {
      const error = new Error('Regular error');
      expect(isTemplateError(error)).toBe(false);
    });

    test('getRecoverySuggestion should extract recovery from TemplateError', () => {
      const error = new TemplateLoadError('/test.yaml', 'File not found');
      const suggestion = getRecoverySuggestion(error);

      expect(suggestion).toBeDefined();
      expect(suggestion).toContain('template file exists');
    });

    test('getRecoverySuggestion should return undefined for non-TemplateError', () => {
      const error = new Error('Regular error');
      const suggestion = getRecoverySuggestion(error);

      expect(suggestion).toBeUndefined();
    });
  });

  describe('Error Serialization', () => {
    test('toJSON should return complete error information', () => {
      const error = new TemplateValidationError('test-template', [
        'Error 1',
      ]);
      const json = error.toJSON();

      expect(json).toHaveProperty('name');
      expect(json).toHaveProperty('message');
      expect(json).toHaveProperty('code');
      expect(json).toHaveProperty('recoverable');
      expect(json).toHaveProperty('context');
      expect(json).toHaveProperty('stack');
      expect(json.code).toBe('TEMPLATE_VALIDATION_ERROR');
    });

    test('error should have stack trace', () => {
      const error = new TimeoutError('test-template', 5000);

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('TimeoutError');
    });
  });
});

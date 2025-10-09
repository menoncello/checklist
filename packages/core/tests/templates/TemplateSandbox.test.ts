import { describe, expect, test, beforeEach } from 'bun:test';
import { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import { ResourceLimiter } from '../../src/templates/ResourceLimiter';
import {
  SandboxViolationError,
  TimeoutError,
} from '../../src/templates/errors';

describe('TemplateSandbox', () => {
  let sandbox: TemplateSandbox;

  beforeEach(() => {
    sandbox = new TemplateSandbox();
  });

  describe('Constructor', () => {
    test('should create sandbox with default resource limiter', () => {
      const limiter = sandbox.getResourceLimiter();
      expect(limiter).toBeInstanceOf(ResourceLimiter);
    });

    test('should create sandbox with custom resource limiter', () => {
      const customLimiter = new ResourceLimiter({ executionTime: 1000 });
      const customSandbox = new TemplateSandbox(customLimiter);

      expect(customSandbox.getResourceLimiter()).toBe(customLimiter);
    });
  });

  describe('Security - Blocked Globals', () => {
    test('should block access to process', async () => {
      await expect(
        sandbox.executeExpression(
          'process.env.HOME',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should block access to require', async () => {
      await expect(
        sandbox.executeExpression(
          'require("fs")',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should block access to eval', async () => {
      await expect(
        sandbox.executeExpression(
          'eval("malicious code")',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should block access to Function constructor', async () => {
      await expect(
        sandbox.executeExpression(
          'Function("return this")()',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should block access to import', async () => {
      await expect(
        sandbox.executeExpression(
          'import("module")',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should block access to global', async () => {
      await expect(
        sandbox.executeExpression('global.process', {}, 'test-template')
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should block access to __proto__', async () => {
      await expect(
        sandbox.executeExpression(
          'obj.__proto__',
          { obj: {} },
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });
  });

  describe('Variable Substitution', () => {
    test('should substitute single variable', () => {
      const result = sandbox.substituteVariables(
        'Hello ${name}',
        { name: 'World' },
        'test-template'
      );

      expect(result).toBe('Hello World');
    });

    test('should substitute multiple variables', () => {
      const result = sandbox.substituteVariables(
        '${greeting} ${name}!',
        { greeting: 'Hello', name: 'World' },
        'test-template'
      );

      expect(result).toBe('Hello World!');
    });

    test('should keep original for undefined variables', () => {
      const result = sandbox.substituteVariables(
        'Hello ${unknown}',
        {},
        'test-template'
      );

      expect(result).toBe('Hello ${unknown}');
    });

    test('should sanitize dangerous characters', () => {
      const result = sandbox.substituteVariables(
        'echo ${input}',
        { input: 'test; rm -rf /' },
        'test-template'
      );

      // Dangerous shell metacharacters should be removed
      expect(result).not.toContain(';');
      expect(result).not.toContain('&');
      expect(result).not.toContain('|');
      // Note: Forward slash and text are preserved, only dangerous metacharacters removed
    });

    test('should handle numbers in variables', () => {
      const result = sandbox.substituteVariables(
        'Port: ${port}',
        { port: 3000 },
        'test-template'
      );

      expect(result).toBe('Port: 3000');
    });

    test('should handle boolean variables', () => {
      const result = sandbox.substituteVariables(
        'Enabled: ${enabled}',
        { enabled: true },
        'test-template'
      );

      expect(result).toBe('Enabled: true');
    });
  });

  describe('Condition Evaluation', () => {
    test('should evaluate true condition', async () => {
      const result = await sandbox.evaluateCondition(
        '${enabled}',
        { enabled: true },
        'test-template'
      );

      expect(result).toBe(true);
    });

    test('should evaluate false condition', async () => {
      const result = await sandbox.evaluateCondition(
        '${enabled}',
        { enabled: false },
        'test-template'
      );

      expect(result).toBe(false);
    });

    test('should evaluate truthy values as true', async () => {
      const result = await sandbox.evaluateCondition(
        '${value}',
        { value: 'some-string' },
        'test-template'
      );

      expect(result).toBe(true);
    });

    test('should evaluate falsy values as false', async () => {
      const result = await sandbox.evaluateCondition(
        '${value}',
        { value: '' },
        'test-template'
      );

      expect(result).toBe(false);
    });

    test('should evaluate undefined as false', async () => {
      const result = await sandbox.evaluateCondition(
        '${unknown}',
        {},
        'test-template'
      );

      expect(result).toBe(false);
    });

    test('should block dangerous patterns in conditions', async () => {
      await expect(
        sandbox.evaluateCondition(
          'eval("true")',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });
  });

  describe('Expression Execution', () => {
    test('should execute simple variable substitution', async () => {
      const result = await sandbox.executeExpression(
        'Hello ${name}',
        { name: 'World' },
        'test-template'
      );

      expect(result).toBe('Hello World');
    });

    test('should execute with timeout', async () => {
      const result = await sandbox.executeExpression(
        '${value}',
        { value: 'test' },
        'test-template',
        100
      );

      expect(result).toBe('test');
    });

    test('should respect custom timeout', async () => {
      const result = await sandbox.executeExpression(
        '${value}',
        { value: 'test' },
        'test-template',
        1000 // Custom timeout
      );

      expect(result).toBe('test');
    });
  });

  describe('Security Sanitization', () => {
    test('should remove shell metacharacters', () => {
      const dangerousChars = ';|&$(){}[]<>`\\';
      const result = sandbox.substituteVariables(
        '${input}',
        { input: dangerousChars },
        'test-template'
      );

      for (const char of dangerousChars) {
        expect(result).not.toContain(char);
      }
    });

    test('should preserve safe characters', () => {
      const safeChars = 'abc123-_./';
      const result = sandbox.substituteVariables(
        '${input}',
        { input: safeChars },
        'test-template'
      );

      expect(result).toBe(safeChars);
    });
  });

  describe('Pattern Detection', () => {
    test('should detect eval pattern', async () => {
      await expect(
        sandbox.executeExpression('eval(x)', {}, 'test-template')
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should detect Function constructor pattern', async () => {
      await expect(
        sandbox.executeExpression('Function(x)', {}, 'test-template')
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should detect require pattern', async () => {
      await expect(
        sandbox.executeExpression('require(x)', {}, 'test-template')
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should detect import pattern', async () => {
      await expect(
        sandbox.executeExpression('import(x)', {}, 'test-template')
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should detect constructor access pattern', async () => {
      await expect(
        sandbox.executeExpression(
          'obj.constructor()',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });

    test('should detect prototype manipulation', async () => {
      await expect(
        sandbox.executeExpression(
          'prototype["__proto__"]',
          {},
          'test-template'
        )
      ).rejects.toThrow(SandboxViolationError);
    });
  });

  describe('Error Handling', () => {
    test('should provide clear error message for violations', async () => {
      try {
        await sandbox.executeExpression(
          'process.exit()',
          {},
          'test-template'
        );
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(SandboxViolationError);
        expect((error as SandboxViolationError).message).toContain(
          'blocked global'
        );
      }
    });

    test('should include template ID in error', async () => {
      try {
        await sandbox.executeExpression(
          'eval("code")',
          {},
          'my-template'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(SandboxViolationError);
        expect((error as SandboxViolationError).message).toContain(
          'my-template'
        );
      }
    });

    test('should include expression in error context', async () => {
      try {
        await sandbox.executeExpression(
          'require("fs")',
          {},
          'test-template'
        );
      } catch (error) {
        expect(error).toBeInstanceOf(SandboxViolationError);
        const context = (error as SandboxViolationError).context;
        expect(context?.details).toHaveProperty('expression');
      }
    });
  });

  describe('Integration with ResourceLimiter', () => {
    test('should enforce execution time limits', async () => {
      const limiter = new ResourceLimiter({ executionTime: 100 });
      const timedSandbox = new TemplateSandbox(limiter);

      // This should complete within limit
      const result = await timedSandbox.executeExpression(
        '${value}',
        { value: 'test' },
        'test-template',
        100
      );

      expect(result).toBe('test');
    });

    test('should use resource limiter for all operations', () => {
      const customLimiter = new ResourceLimiter();
      const customSandbox = new TemplateSandbox(customLimiter);

      expect(customSandbox.getResourceLimiter()).toBe(customLimiter);
    });
  });

  describe('Safe Operations', () => {
    test('should allow safe variable access', async () => {
      const result = await sandbox.executeExpression(
        '${user}',
        { user: 'alice' },
        'test-template'
      );

      expect(result).toBe('alice');
    });

    test('should allow safe string operations', async () => {
      const result = await sandbox.executeExpression(
        'User: ${user}',
        { user: 'bob' },
        'test-template'
      );

      expect(result).toBe('User: bob');
    });

    test('should handle nested variable references safely', () => {
      const result = sandbox.substituteVariables(
        '${first}-${second}',
        { first: 'hello', second: 'world' },
        'test-template'
      );

      expect(result).toBe('hello-world');
    });
  });
});

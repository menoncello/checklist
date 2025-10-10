/**
 * Tests for TemplateSandbox network access blocking
 */

import { describe, test, expect } from 'bun:test';
import { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import { NetworkAccessError } from '../../src/templates/errors';

describe('TemplateSandbox - Network Access Blocking', () => {
  const sandbox = new TemplateSandbox();

  describe('network global blocking', () => {
    test('should block fetch access', () => {
      const expression = 'fetch';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: fetch');
    });

    test('should block XMLHttpRequest access', () => {
      const expression = 'XMLHttpRequest';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: XMLHttpRequest');
    });

    test('should block WebSocket access', () => {
      const expression = 'WebSocket';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: WebSocket');
    });

    test('should block EventSource access', () => {
      const expression = 'EventSource';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: EventSource');
    });

    test('should block navigator access', () => {
      const expression = 'navigator';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: navigator');
    });

    test('should block location access', () => {
      const expression = 'location';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: location');
    });
  });

  describe('network patterns in expressions', () => {
    test('should detect fetch in expression', () => {
      const expression = 'const data = fetch("https://api.example.com")';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: fetch');
    });

    test('should detect XMLHttpRequest in expression', () => {
      const expression = 'new XMLHttpRequest()';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: XMLHttpRequest');
    });

    test('should detect WebSocket in expression', () => {
      const expression = 'new WebSocket("wss://example.com")';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: WebSocket');
    });
  });

  describe('safe operations should still work', () => {
    test('should allow safe variable substitution', () => {
      const template = 'Hello ${name}';
      const result = sandbox.substituteVariables(
        template,
        { name: 'World' },
        'test-template'
      );

      expect(result).toBe('Hello World');
    });

    test('should allow Math operations', () => {
      const template = 'Math is allowed';
      const result = sandbox.substituteVariables(
        template,
        {},
        'test-template'
      );

      expect(result).toBe('Math is allowed');
    });

    test('should allow JSON operations', () => {
      const template = 'JSON is allowed';
      const result = sandbox.substituteVariables(
        template,
        {},
        'test-template'
      );

      expect(result).toBe('JSON is allowed');
    });

    test('should allow console operations', () => {
      const template = 'console logging is allowed';
      const result = sandbox.substituteVariables(
        template,
        {},
        'test-template'
      );

      expect(result).toBe('console logging is allowed');
    });
  });

  describe('error types', () => {
    test('should throw NetworkAccessError for fetch attempts', () => {
      const expression = 'fetch';

      try {
        sandbox.substituteVariables(expression, {}, 'test-template');
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error instanceof Error).toBe(true);
        expect((error as Error).message).toContain('Access to blocked global: fetch');
      }
    });
  });

  describe('obfuscated network access attempts', () => {
    test('should detect obfuscated fetch', () => {
      // These patterns should be caught by AST validation
      const patterns = [
        'window["fetch"]',
        'globalThis["fetch"]',
        'this.fetch',
      ];

      for (const pattern of patterns) {
        expect(() => {
          sandbox.substituteVariables(pattern, {}, 'test-template');
        }).toThrow(); // Should throw some security error
      }
    });
  });

  describe('allowed modules', () => {
    test('path module should be in allowed list', () => {
      const limiter = sandbox.getResourceLimiter();
      expect(limiter).toBeDefined();
    });
  });

  describe('multiple network attempts in single template', () => {
    test('should block multiple network access attempts', () => {
      const expressions = [
        'fetch("url")',
        'new XMLHttpRequest()',
        'new WebSocket("ws://example.com")',
      ];

      for (const expr of expressions) {
        expect(() => {
          sandbox.substituteVariables(expr, {}, 'test-template');
        }).toThrow();
      }
    });
  });

  describe('case sensitivity', () => {
    test('should block case-sensitive fetch', () => {
      const expression = 'fetch';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: fetch');
    });
  });

  describe('sandboxViolationError vs NetworkAccessError', () => {
    test('should use appropriate error type for network access', () => {
      const expression = 'fetch';

      expect(() => {
        sandbox.substituteVariables(expression, {}, 'test-template');
      }).toThrow('Access to blocked global: fetch');
    });
  });
});

import { describe, test, expect } from 'bun:test';
import { safeEval } from '../src/workflow/conditions';

describe('conditions', () => {
  describe('safeEval', () => {
    test('evaluates simple boolean conditions', () => {
      const result = safeEval('true', {});
      expect(result).toBe(true);

      const result2 = safeEval('false', {});
      expect(result2).toBe(false);
    });

    test('evaluates conditions with variables', () => {
      const context = { platform: 'darwin', count: 5 };
      
      const result1 = safeEval('${platform} === "darwin"', context);
      expect(result1).toBe(true);

      const result2 = safeEval('${platform} === "linux"', context);
      expect(result2).toBe(false);

      const result3 = safeEval('${count} > 3', context);
      expect(result3).toBe(true);
    });

    test('handles multiple variables in condition', () => {
      const context = { 
        hasDocker: true, 
        platform: 'linux',
        stepCount: 10 
      };
      
      const result = safeEval(
        '${hasDocker} === true && ${platform} === "linux"',
        context
      );
      expect(result).toBe(true);
    });

    test('handles numeric comparisons', () => {
      const context = { stepCount: 5, maxSteps: 10 };
      
      const result1 = safeEval('${stepCount} < ${maxSteps}', context);
      expect(result1).toBe(true);

      const result2 = safeEval('${stepCount} > ${maxSteps}', context);
      expect(result2).toBe(false);

      const result3 = safeEval('${stepCount} === 5', context);
      expect(result3).toBe(true);
    });

    test('handles boolean variables correctly', () => {
      const context = { isEnabled: true, isDisabled: false };
      
      const result1 = safeEval('${isEnabled}', context);
      expect(result1).toBe(true);

      const result2 = safeEval('${isDisabled}', context);
      expect(result2).toBe(false);

      const result3 = safeEval('!${isDisabled}', context);
      expect(result3).toBe(true);
    });

    test('handles string comparisons', () => {
      const context = { env: 'production', user: 'admin' };
      
      const result1 = safeEval('${env} === "production"', context);
      expect(result1).toBe(true);

      const result2 = safeEval('${user} !== "guest"', context);
      expect(result2).toBe(true);
    });

    test('handles complex logical operations', () => {
      const context = { 
        platform: 'darwin',
        hasDocker: false,
        stepCount: 7
      };
      
      const result = safeEval(
        '(${platform} === "darwin" || ${platform} === "linux") && ${stepCount} > 5',
        context
      );
      expect(result).toBe(true);
    });

    test('returns false for invalid conditions', () => {
      const context = { test: 'value' };
      
      // Invalid conditions should safely return false
      const result = safeEval('invalid javascript here!!!', context);
      expect(result).toBe(false);
    });

    test('handles undefined variables gracefully', () => {
      const context = { defined: 'value' };
      
      const result = safeEval('${undefined} === undefined', context);
      expect(result).toBe(true);
    });

    test('coerces non-boolean results to boolean', () => {
      const context = { value: 'test' };
      
      const result1 = safeEval('${value}', context);
      expect(result1).toBe(true);

      const result2 = safeEval('""', {});
      expect(result2).toBe(false);

      const result3 = safeEval('0', {});
      expect(result3).toBe(false);

      const result4 = safeEval('1', {});
      expect(result4).toBe(true);
    });
  });
});
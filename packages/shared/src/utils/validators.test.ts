import { describe, it, expect } from 'vitest';

describe('Shared Validators', () => {
  describe('String Validators', () => {
    it('should validate non-empty strings', () => {
      const validator = {
        isNonEmpty: (str: string) => str.trim().length > 0,
      };

      expect(validator.isNonEmpty('valid')).toBe(true);
      expect(validator.isNonEmpty('')).toBe(false);
      expect(validator.isNonEmpty('  ')).toBe(false);
      expect(validator.isNonEmpty('  text  ')).toBe(true);
    });

    it('should validate string length', () => {
      const validator = {
        hasLength: (str: string, min: number, max: number) => {
          return str.length >= min && str.length <= max;
        },
      };

      expect(validator.hasLength('test', 1, 10)).toBe(true);
      expect(validator.hasLength('', 1, 10)).toBe(false);
      expect(validator.hasLength('very long string', 1, 10)).toBe(false);
    });

    it('should validate email format', () => {
      const validator = {
        isEmail: (email: string) => {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
        },
      };

      expect(validator.isEmail('user@example.com')).toBe(true);
      expect(validator.isEmail('invalid.email')).toBe(false);
      expect(validator.isEmail('@example.com')).toBe(false);
      expect(validator.isEmail('user@')).toBe(false);
    });
  });

  describe('Number Validators', () => {
    it('should validate positive numbers', () => {
      const validator = {
        isPositive: (n: number) => n > 0,
        isNonNegative: (n: number) => n >= 0,
      };

      expect(validator.isPositive(5)).toBe(true);
      expect(validator.isPositive(0)).toBe(false);
      expect(validator.isPositive(-5)).toBe(false);

      expect(validator.isNonNegative(5)).toBe(true);
      expect(validator.isNonNegative(0)).toBe(true);
      expect(validator.isNonNegative(-5)).toBe(false);
    });

    it('should validate number ranges', () => {
      const validator = {
        isInRange: (n: number, min: number, max: number) => {
          return n >= min && n <= max;
        },
      };

      expect(validator.isInRange(5, 0, 10)).toBe(true);
      expect(validator.isInRange(0, 0, 10)).toBe(true);
      expect(validator.isInRange(10, 0, 10)).toBe(true);
      expect(validator.isInRange(15, 0, 10)).toBe(false);
    });

    it('should validate integers', () => {
      const validator = {
        isInteger: (n: number) => Number.isInteger(n),
      };

      expect(validator.isInteger(5)).toBe(true);
      expect(validator.isInteger(5.5)).toBe(false);
      expect(validator.isInteger(-10)).toBe(true);
      expect(validator.isInteger(0)).toBe(true);
    });
  });

  describe('Array Validators', () => {
    it('should validate non-empty arrays', () => {
      const validator = {
        isNonEmpty: (arr: unknown[]) => arr.length > 0,
      };

      expect(validator.isNonEmpty([1, 2, 3])).toBe(true);
      expect(validator.isNonEmpty([])).toBe(false);
      expect(validator.isNonEmpty([''])).toBe(true);
    });

    it('should validate array length', () => {
      const validator = {
        hasLength: (arr: unknown[], min: number, max?: number) => {
          if (max === undefined) return arr.length >= min;
          return arr.length >= min && arr.length <= max;
        },
      };

      expect(validator.hasLength([1, 2, 3], 2, 5)).toBe(true);
      expect(validator.hasLength([1], 2, 5)).toBe(false);
      expect(validator.hasLength([1, 2, 3, 4, 5, 6], 2, 5)).toBe(false);
      expect(validator.hasLength([1, 2, 3], 2)).toBe(true);
    });

    it('should validate unique elements', () => {
      const validator = {
        hasUniqueElements: (arr: unknown[]) => {
          return new Set(arr).size === arr.length;
        },
      };

      expect(validator.hasUniqueElements([1, 2, 3])).toBe(true);
      expect(validator.hasUniqueElements([1, 2, 2, 3])).toBe(false);
      expect(validator.hasUniqueElements([])).toBe(true);
    });
  });

  describe('Object Validators', () => {
    it('should validate required properties', () => {
      const validator = {
        hasProperties: (obj: unknown, props: string[]) => {
          const o = obj as Record<string, unknown>;
          return props.every((prop) => prop in o);
        },
      };

      const obj = { name: 'test', value: 123 };
      expect(validator.hasProperties(obj, ['name', 'value'])).toBe(true);
      expect(validator.hasProperties(obj, ['name', 'missing'])).toBe(false);
      expect(validator.hasProperties({}, [])).toBe(true);
    });

    it('should validate object shape', () => {
      const validator = {
        matchesShape: (obj: unknown, shape: Record<string, string>) => {
          const o = obj as Record<string, unknown>;
          return Object.entries(shape).every(([key, type]) => {
            return key in o && typeof o[key] === type;
          });
        },
      };

      const obj = { name: 'test', age: 25, active: true };
      const shape = { name: 'string', age: 'number', active: 'boolean' };

      expect(validator.matchesShape(obj, shape)).toBe(true);
      expect(validator.matchesShape(obj, { name: 'number' })).toBe(false);
      expect(validator.matchesShape({}, shape)).toBe(false);
    });
  });

  describe('Date Validators', () => {
    it('should validate date instances', () => {
      const validator = {
        isValidDate: (date: unknown) => {
          return date instanceof Date && !isNaN(date.getTime());
        },
      };

      expect(validator.isValidDate(new Date())).toBe(true);
      expect(validator.isValidDate(new Date('invalid'))).toBe(false);
      expect(validator.isValidDate('2024-01-01')).toBe(false);
    });

    it('should validate date ranges', () => {
      const validator = {
        isInDateRange: (date: Date, start: Date, end: Date) => {
          return date >= start && date <= end;
        },
      };

      const date = new Date('2024-06-15');
      const start = new Date('2024-01-01');
      const end = new Date('2024-12-31');

      expect(validator.isInDateRange(date, start, end)).toBe(true);
      expect(validator.isInDateRange(new Date('2023-12-31'), start, end)).toBe(false);
      expect(validator.isInDateRange(new Date('2025-01-01'), start, end)).toBe(false);
    });
  });

  describe('Composite Validators', () => {
    it('should combine multiple validators with AND logic', () => {
      const validator = {
        and: (...validators: Array<(value: unknown) => boolean>) => {
          return (value: unknown) => validators.every((v) => v(value));
        },
      };

      const isPositive = (n: unknown) => typeof n === 'number' && n > 0;
      const isEven = (n: unknown) => typeof n === 'number' && n % 2 === 0;
      const isPositiveEven = validator.and(isPositive, isEven);

      expect(isPositiveEven(4)).toBe(true);
      expect(isPositiveEven(3)).toBe(false);
      expect(isPositiveEven(-2)).toBe(false);
    });

    it('should combine multiple validators with OR logic', () => {
      const validator = {
        or: (...validators: Array<(value: unknown) => boolean>) => {
          return (value: unknown) => validators.some((v) => v(value));
        },
      };

      const isZero = (n: unknown) => n === 0;
      const isPositive = (n: unknown) => typeof n === 'number' && n > 0;
      const isZeroOrPositive = validator.or(isZero, isPositive);

      expect(isZeroOrPositive(5)).toBe(true);
      expect(isZeroOrPositive(0)).toBe(true);
      expect(isZeroOrPositive(-5)).toBe(false);
    });
  });
});

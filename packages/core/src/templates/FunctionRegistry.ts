/**
 * Template Function Registry - Registers and manages built-in template functions
 */

import type { TemplateFunction, FunctionRegistry } from './advanced-types';

/**
 * Function registry implementation
 */
export class FunctionRegistryImpl implements FunctionRegistry {
  private functions: Map<string, TemplateFunction> = new Map();

  register(name: string, fn: TemplateFunction): void {
    this.functions.set(name, fn);
  }

  get(name: string): TemplateFunction | undefined {
    return this.functions.get(name);
  }

  has(name: string): boolean {
    return this.functions.has(name);
  }

  list(): string[] {
    return Array.from(this.functions.keys());
  }

  registerAllBuiltIn(): void {
    this.registerStringFunctions();
    this.registerArrayFunctions();
    this.registerUtilityFunctions();
    this.registerDateFunctions();
  }

  private registerStringFunctions(): void {
    this.registerUppercase();
    this.registerLowercase();
    this.registerTrim();
    this.registerReplace();
    this.registerSubstring();
  }

  private registerUppercase(): void {
    this.register('uppercase', {
      name: 'uppercase',
      execute: ([str]) => String(str ?? '').toUpperCase(),
      validate: (args) => args.length === 1,
      safe: true,
    });
  }

  private registerLowercase(): void {
    this.register('lowercase', {
      name: 'lowercase',
      execute: ([str]) => String(str ?? '').toLowerCase(),
      validate: (args) => args.length === 1,
      safe: true,
    });
  }

  private registerTrim(): void {
    this.register('trim', {
      name: 'trim',
      execute: ([str]) => String(str ?? '').trim(),
      validate: (args) => args.length === 1,
      safe: true,
    });
  }

  private registerReplace(): void {
    this.register('replace', {
      name: 'replace',
      execute: ([str, search, replace]) =>
        String(str ?? '').replace(String(search ?? ''), String(replace ?? '')),
      validate: (args) => args.length === 3,
      safe: true,
    });
  }

  private registerSubstring(): void {
    this.register('substring', {
      name: 'substring',
      execute: ([str, start, end]) => {
        const s = String(str ?? '');
        const startIdx = Number(start) || 0;
        const endIdx = end !== undefined ? Number(end) : s.length;
        return s.substring(startIdx, endIdx);
      },
      validate: (args) => args.length >= 2 && args.length <= 3,
      safe: true,
    });
  }

  private registerArrayFunctions(): void {
    this.registerLength();
    this.registerJoin();
    this.registerFirst();
    this.registerLast();
    this.registerSlice();
  }

  private registerLength(): void {
    this.register('length', {
      name: 'length',
      execute: ([arr]) => {
        if (Array.isArray(arr)) return arr.length;
        return String(arr ?? '').length;
      },
      validate: (args) => args.length === 1,
      safe: true,
    });
  }

  private registerJoin(): void {
    this.register('join', {
      name: 'join',
      execute: ([arr, separator = ',']) => {
        if (Array.isArray(arr)) return arr.join(String(separator));
        return String(arr ?? '');
      },
      validate: (args) => args.length >= 1 && args.length <= 2,
      safe: true,
    });
  }

  private registerFirst(): void {
    this.register('first', {
      name: 'first',
      execute: ([arr]) => {
        if (Array.isArray(arr) && arr.length > 0) return arr[0];
        return undefined;
      },
      validate: (args) => args.length === 1,
      safe: true,
    });
  }

  private registerLast(): void {
    this.register('last', {
      name: 'last',
      execute: ([arr]) => {
        if (Array.isArray(arr) && arr.length > 0) return arr[arr.length - 1];
        return undefined;
      },
      validate: (args) => args.length === 1,
      safe: true,
    });
  }

  private registerSlice(): void {
    this.register('slice', {
      name: 'slice',
      execute: ([arr, start, end]) => {
        if (!Array.isArray(arr)) return [];
        const startIdx = Number(start) || 0;
        const endIdx = end !== undefined ? Number(end) : arr.length;
        return arr.slice(startIdx, endIdx);
      },
      validate: (args) => args.length >= 2 && args.length <= 3,
      safe: true,
    });
  }

  private registerUtilityFunctions(): void {
    this.register('default', {
      name: 'default',
      execute: ([value, defaultValue]) => value ?? defaultValue,
      validate: (args) => args.length === 2,
      safe: true,
    });

    this.register('isEmpty', {
      name: 'isEmpty',
      execute: ([value]) => {
        if (value === undefined || value === null) return true;
        if (typeof value === 'string') return value.length === 0;
        if (Array.isArray(value)) return value.length === 0;
        return false;
      },
      validate: (args) => args.length === 1,
      safe: true,
    });

    this.register('isNotEmpty', {
      name: 'isNotEmpty',
      execute: ([value]) => {
        if (value === undefined || value === null) return false;
        if (typeof value === 'string') return value.length > 0;
        if (Array.isArray(value)) return value.length > 0;
        return true;
      },
      validate: (args) => args.length === 1,
      safe: true,
    });
  }

  private registerDateFunctions(): void {
    this.registerFormatDate();
    this.registerNow();
    this.registerAddDays();
  }

  private registerFormatDate(): void {
    this.register('formatDate', {
      name: 'formatDate',
      execute: ([date, format]) => {
        const d = new Date(String(date ?? ''));
        if (isNaN(d.getTime())) return 'Invalid Date';

        const fmt = String(format ?? 'YYYY-MM-DD');
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');

        return fmt
          .replace('YYYY', String(year))
          .replace('MM', month)
          .replace('DD', day);
      },
      validate: (args) => args.length === 2,
      safe: true,
    });
  }

  private registerNow(): void {
    this.register('now', {
      name: 'now',
      execute: () => new Date().toISOString(),
      validate: (args) => args.length === 0,
      safe: true,
    });
  }

  private registerAddDays(): void {
    this.register('addDays', {
      name: 'addDays',
      execute: ([date, days]) => {
        const d = new Date(String(date ?? ''));
        if (isNaN(d.getTime())) return 'Invalid Date';
        d.setDate(d.getDate() + Number(days ?? 0));
        return d.toISOString();
      },
      validate: (args) => args.length === 2,
      safe: true,
    });
  }
}

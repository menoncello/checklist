import { describe, it, expect } from 'vitest';
import { core, initialize } from './index';

describe('Core smoke tests', () => {
  it('should export core object with version', () => {
    expect(core).toBeDefined();
    expect(core.version).toBe('0.1.0');
    expect(core.name).toBe('@checklist/core');
  });

  it('should initialize without errors', () => {
    expect(() => initialize()).not.toThrow();
  });
});

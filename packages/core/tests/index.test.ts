import { describe, it, expect } from 'bun:test';
import { version } from '../src/index';

describe('Core smoke tests', () => {
  it('should export version', () => {
    expect(version).toBeDefined();
    expect(version).toBe('0.0.1');
  });
  
  it('should be able to import from core package', () => {
    expect(() => import('../src/index')).not.toThrow();
  });
});

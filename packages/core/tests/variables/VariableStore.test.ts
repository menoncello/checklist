import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { VariableStore } from '../../src/variables/VariableStore';
import { VariableNotFoundError } from '../../src/variables/errors';
import { tmpdir } from 'os';
import { join } from 'path';
import { rm } from 'fs/promises';

describe('VariableStore', () => {
  let store: VariableStore;
  let testFile: string;

  beforeEach(() => {
    testFile = join(tmpdir(), `test-variables-${Date.now()}.yaml`);
    store = new VariableStore(testFile);
  });

  afterEach(async () => {
    try {
      await rm(testFile, { force: true });
      await rm(`${testFile}.backup`, { force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  describe('get and set', () => {
    test('should set and get global variable', () => {
      store.set('name', 'value');
      expect(store.get('name')).toBe('value');
    });

    test('should set and get step variable', () => {
      store.set('name', 'step-value', 'step1');
      expect(store.get('name', 'step1')).toBe('step-value');
    });

    test('should prioritize step scope over global', () => {
      store.set('name', 'global-value');
      store.set('name', 'step-value', 'step1');

      expect(store.get('name', 'step1')).toBe('step-value');
      expect(store.get('name')).toBe('global-value');
    });

    test('should return undefined for non-existent variable', () => {
      expect(store.get('nonexistent')).toBeUndefined();
    });
  });

  describe('has', () => {
    test('should check variable existence in global scope', () => {
      store.set('name', 'value');
      expect(store.has('name')).toBe(true);
      expect(store.has('other')).toBe(false);
    });

    test('should check variable existence in step scope', () => {
      store.set('name', 'value', 'step1');
      expect(store.has('name', 'step1')).toBe(true);
      expect(store.has('name', 'step2')).toBe(false);
    });
  });

  describe('delete', () => {
    test('should delete global variable', () => {
      store.set('name', 'value');
      store.delete('name');
      expect(store.has('name')).toBe(false);
    });

    test('should delete step variable', () => {
      store.set('name', 'value', 'step1');
      store.delete('name', 'step1');
      expect(store.has('name', 'step1')).toBe(false);
    });
  });

  describe('getAll', () => {
    test('should get all global variables', () => {
      store.set('var1', 'value1');
      store.set('var2', 'value2');

      const all = store.getAll();
      expect(all).toEqual({ var1: 'value1', var2: 'value2' });
    });

    test('should merge global and step variables', () => {
      store.set('global', 'g-value');
      store.set('step', 's-value', 'step1');

      const all = store.getAll('step1');
      expect(all).toEqual({ global: 'g-value', step: 's-value' });
    });

    test('should override global with step variables', () => {
      store.set('shared', 'global-value');
      store.set('shared', 'step-value', 'step1');

      const all = store.getAll('step1');
      expect(all.shared).toBe('step-value');
    });
  });

  describe('clear', () => {
    test('should clear all variables', () => {
      store.set('var1', 'value1');
      store.set('var2', 'value2', 'step1');

      store.clear();

      expect(store.getAll()).toEqual({});
      expect(store.getAll('step1')).toEqual({});
    });

    test('should clear step variables only', () => {
      store.set('global', 'g-value');
      store.set('step', 's-value', 'step1');

      store.clear('step1');

      expect(store.get('global')).toBe('g-value');
      expect(store.get('step', 'step1')).toBeUndefined();
    });
  });

  describe('persist and load', () => {
    test('should persist and load variables', async () => {
      store.set('var1', 'value1');
      store.set('var2', 123);
      store.set('var3', true);

      await store.persist();

      const newStore = new VariableStore(testFile);
      await newStore.load();

      expect(newStore.get('var1')).toBe('value1');
      expect(newStore.get('var2')).toBe(123);
      expect(newStore.get('var3')).toBe(true);
    });

    test('should handle non-existent file on load', async () => {
      const nonExistent = join(tmpdir(), 'non-existent.yaml');
      const newStore = new VariableStore(nonExistent);

      await expect(newStore.load()).resolves.toBeUndefined();
    });
  });

  describe('getOrThrow', () => {
    test('should return value if exists', () => {
      store.set('name', 'value');
      expect(store.getOrThrow('name')).toBe('value');
    });

    test('should throw if variable not found', () => {
      expect(() => store.getOrThrow('nonexistent')).toThrow(
        VariableNotFoundError
      );
    });
  });
});

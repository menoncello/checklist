import { beforeEach, describe, expect, test, jest } from 'bun:test';
import {
  KeyBindingManager,
  KeyEvent,
  KeyModifiers,
  KeyBinding,
  KeyBindingOptions,
  ParsedKeyBinding,
} from '../../../src/events/helpers/KeyBindingManager';

describe('KeyBindingManager', () => {
  let manager: KeyBindingManager;
  let mockHandler: jest.Mock;

  beforeEach(() => {
    manager = new KeyBindingManager();
    mockHandler = jest.fn();
  });

  describe('createBinding', () => {
    test('should create binding with default options', () => {
      const binding = manager.createBinding('ctrl+c', mockHandler);

      expect(binding.keys).toBe('ctrl+c');
      expect(binding.handler).toBe(mockHandler);
      expect(binding.options).toEqual({
        priority: 0,
        enabled: true,
        global: false,
      });
      expect(binding.id).toMatch(/^binding-\d+$/);
    });

    test('should create binding with custom options', () => {
      const options: KeyBindingOptions = {
        description: 'Test binding',
        priority: 100,
        global: true,
        enabled: false,
      };

      const binding = manager.createBinding('alt+f', mockHandler, options);

      expect(binding.options).toEqual({
        description: 'Test binding',
        priority: 100,
        global: true,
        enabled: false,
      });
    });

    test('should generate unique IDs for bindings', () => {
      const binding1 = manager.createBinding('a', mockHandler);
      const binding2 = manager.createBinding('b', mockHandler);

      expect(binding1.id).toMatch(/^binding-\d+$/);
      expect(binding2.id).toMatch(/^binding-\d+$/);
      expect(binding1.id).not.toBe(binding2.id);
      expect(binding1.id).not.toBe(binding2.id);
    });

    test('should merge options with defaults', () => {
      const binding = manager.createBinding('x', mockHandler, { priority: 50 });

      expect(binding.options).toEqual({
        priority: 50,
        enabled: true,
        global: false,
      });
    });
  });

  describe('addBinding', () => {
    test('should add global binding', () => {
      const binding = manager.createBinding('ctrl+q', mockHandler);
      manager.addBinding(binding, true);

      const globalBindings = manager.getGlobalBindings();
      expect(globalBindings).toContain(binding);
      expect(globalBindings).toHaveLength(1);
    });

    test('should add key-specific binding', () => {
      const binding = manager.createBinding('enter', mockHandler);
      manager.addBinding(binding, false);

      const keyBindings = manager.getBindingsByKey('enter');
      expect(keyBindings).toContain(binding);
      expect(keyBindings).toHaveLength(1);
    });

    test('should sort bindings by priority when adding', () => {
      const lowPriority = manager.createBinding('a', mockHandler, { priority: 1 });
      const highPriority = manager.createBinding('a', mockHandler, { priority: 10 });
      const mediumPriority = manager.createBinding('a', mockHandler, { priority: 5 });

      manager.addBinding(lowPriority);
      manager.addBinding(highPriority);
      manager.addBinding(mediumPriority);

      const bindings = manager.getBindingsByKey('a');
      expect(bindings[0]).toBe(highPriority);
      expect(bindings[1]).toBe(mediumPriority);
      expect(bindings[2]).toBe(lowPriority);
    });

    test('should sort global bindings by priority', () => {
      const low = manager.createBinding('ctrl+1', mockHandler, { priority: 1 });
      const high = manager.createBinding('ctrl+2', mockHandler, { priority: 10 });

      manager.addBinding(low, true);
      manager.addBinding(high, true);

      const globalBindings = manager.getGlobalBindings();
      expect(globalBindings[0]).toBe(high);
      expect(globalBindings[1]).toBe(low);
    });

    test('should handle complex key combinations', () => {
      const binding = manager.createBinding('ctrl+shift+f', mockHandler);
      manager.addBinding(binding);

      const keyBindings = manager.getBindingsByKey('f');
      expect(keyBindings).toContain(binding);
    });

    test('should add binding even with empty key', () => {
      const binding = manager.createBinding('', mockHandler);
      manager.addBinding(binding);

      // Empty key still creates a valid binding
      expect(manager.getBindingCount()).toBe(1);
      const bindings = manager.getBindingsByKey('');
      expect(bindings).toContain(binding);
    });
  });

  describe('removeBinding', () => {
    test('should remove global binding', () => {
      const binding = manager.createBinding('ctrl+q', mockHandler);
      manager.addBinding(binding, true);

      const removed = manager.removeBinding(binding.id);

      expect(removed).toBe(true);
      expect(manager.getGlobalBindings()).toHaveLength(0);
    });

    test('should remove key-specific binding', () => {
      const binding = manager.createBinding('enter', mockHandler);
      manager.addBinding(binding);

      const removed = manager.removeBinding(binding.id);

      expect(removed).toBe(true);
      expect(manager.getBindingsByKey('enter')).toHaveLength(0);
    });

    test('should return false for non-existent binding', () => {
      const removed = manager.removeBinding('non-existent-id');

      expect(removed).toBe(false);
    });

    test('should remove correct binding when multiple exist', () => {
      const binding1 = manager.createBinding('a', mockHandler);
      const binding2 = manager.createBinding('a', mockHandler);

      manager.addBinding(binding1);
      manager.addBinding(binding2);

      const removed = manager.removeBinding(binding1.id);

      expect(removed).toBe(true);
      const remaining = manager.getBindingsByKey('a');
      expect(remaining).toHaveLength(1);
      expect(remaining[0]).toBe(binding2);
    });
  });

  describe('getPotentialBindings', () => {
    test('should return enabled global bindings', () => {
      const globalBinding = manager.createBinding('ctrl+g', mockHandler);
      manager.addBinding(globalBinding, true);

      const keyEvent: KeyEvent = {
        key: 'x',
        modifiers: {},
        timestamp: Date.now(),
      };

      const potentials = manager.getPotentialBindings(keyEvent);
      expect(potentials).toContain(globalBinding);
    });

    test('should return enabled key-specific bindings', () => {
      const keyBinding = manager.createBinding('enter', mockHandler);
      manager.addBinding(keyBinding);

      const keyEvent: KeyEvent = {
        key: 'enter',
        modifiers: {},
        timestamp: Date.now(),
      };

      const potentials = manager.getPotentialBindings(keyEvent);
      expect(potentials).toContain(keyBinding);
    });

    test('should exclude disabled bindings', () => {
      const disabledBinding = manager.createBinding('esc', mockHandler, { enabled: false });
      manager.addBinding(disabledBinding);

      const keyEvent: KeyEvent = {
        key: 'esc',
        modifiers: {},
        timestamp: Date.now(),
      };

      const potentials = manager.getPotentialBindings(keyEvent);
      expect(potentials).not.toContain(disabledBinding);
    });

    test('should handle empty key', () => {
      const keyEvent: KeyEvent = {
        key: '',
        modifiers: {},
        timestamp: Date.now(),
      };

      const potentials = manager.getPotentialBindings(keyEvent);
      expect(potentials).toEqual([]);
    });

    test('should handle null key', () => {
      const keyEvent: KeyEvent = {
        key: null as any,
        modifiers: {},
        timestamp: Date.now(),
      };

      const potentials = manager.getPotentialBindings(keyEvent);
      expect(potentials).toEqual([]);
    });

    test('should combine global and key-specific bindings', () => {
      const globalBinding = manager.createBinding('ctrl+g', mockHandler);
      const keyBinding = manager.createBinding('a', mockHandler);

      manager.addBinding(globalBinding, true);
      manager.addBinding(keyBinding);

      const keyEvent: KeyEvent = {
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      };

      const potentials = manager.getPotentialBindings(keyEvent);
      expect(potentials).toContain(globalBinding);
      expect(potentials).toContain(keyBinding);
      expect(potentials).toHaveLength(2);
    });
  });

  describe('matchesBinding', () => {
    test('should match simple key binding', () => {
      const binding = manager.createBinding('a', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'a',
        modifiers: {},
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(true);
    });

    test('should match key with modifiers', () => {
      const binding = manager.createBinding('ctrl+c', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'c',
        modifiers: { ctrl: true },
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(true);
    });

    test('should not match different key', () => {
      const binding = manager.createBinding('a', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'b',
        modifiers: {},
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(false);
    });

    test('should not match missing modifiers', () => {
      const binding = manager.createBinding('ctrl+c', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'c',
        modifiers: {},
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(false);
    });

    test('should not match extra modifiers', () => {
      const binding = manager.createBinding('c', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'c',
        modifiers: { ctrl: true },
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(false);
    });

    test('should match complex modifier combinations', () => {
      const binding = manager.createBinding('ctrl+shift+alt+x', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'x',
        modifiers: { ctrl: true, shift: true, alt: true },
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(true);
    });
  });

  describe('parseBindingKeys', () => {
    test('should parse simple key', () => {
      const parsed = manager.parseBindingKeys('a');

      expect(parsed).toEqual([{
        key: 'a',
        modifiers: {}
      }]);
    });

    test('should parse ctrl modifier', () => {
      const parsed = manager.parseBindingKeys('ctrl+c');

      expect(parsed).toEqual([{
        key: 'c',
        modifiers: { ctrl: true }
      }]);
    });

    test('should parse control alias', () => {
      const parsed = manager.parseBindingKeys('control+c');

      expect(parsed).toEqual([{
        key: 'c',
        modifiers: { ctrl: true }
      }]);
    });

    test('should parse alt modifier', () => {
      const parsed = manager.parseBindingKeys('alt+f');

      expect(parsed).toEqual([{
        key: 'f',
        modifiers: { alt: true }
      }]);
    });

    test('should parse option alias', () => {
      const parsed = manager.parseBindingKeys('option+f');

      expect(parsed).toEqual([{
        key: 'f',
        modifiers: { alt: true }
      }]);
    });

    test('should parse shift modifier', () => {
      const parsed = manager.parseBindingKeys('shift+a');

      expect(parsed).toEqual([{
        key: 'a',
        modifiers: { shift: true }
      }]);
    });

    test('should parse meta modifier', () => {
      const parsed = manager.parseBindingKeys('meta+z');

      expect(parsed).toEqual([{
        key: 'z',
        modifiers: { meta: true }
      }]);
    });

    test('should parse cmd alias', () => {
      const parsed = manager.parseBindingKeys('cmd+z');

      expect(parsed).toEqual([{
        key: 'z',
        modifiers: { meta: true }
      }]);
    });

    test('should parse super alias', () => {
      const parsed = manager.parseBindingKeys('super+z');

      expect(parsed).toEqual([{
        key: 'z',
        modifiers: { meta: true }
      }]);
    });

    test('should parse multiple modifiers', () => {
      const parsed = manager.parseBindingKeys('ctrl+shift+alt+meta+x');

      expect(parsed).toEqual([{
        key: 'x',
        modifiers: {
          ctrl: true,
          shift: true,
          alt: true,
          meta: true,
        }
      }]);
    });

    test('should handle case insensitive input', () => {
      const parsed = manager.parseBindingKeys('CTRL+SHIFT+A');

      expect(parsed).toEqual([{
        key: 'a',
        modifiers: {
          ctrl: true,
          shift: true,
        }
      }]);
    });

    test('should handle empty string', () => {
      const parsed = manager.parseBindingKeys('');

      expect(parsed).toEqual([{
        key: '',
        modifiers: {}
      }]);
    });

    test('should handle just modifiers without key', () => {
      const parsed = manager.parseBindingKeys('ctrl+shift');

      expect(parsed).toEqual([{
        key: '',
        modifiers: {
          ctrl: true,
          shift: true,
        }
      }]);
    });
  });

  describe('enableBinding and disableBinding', () => {
    test('should enable binding', () => {
      const binding = manager.createBinding('a', mockHandler, { enabled: false });
      manager.addBinding(binding);

      const enabled = manager.enableBinding(binding.id);

      expect(enabled).toBe(true);
      expect(binding.options.enabled).toBe(true);
    });

    test('should disable binding', () => {
      const binding = manager.createBinding('a', mockHandler);
      manager.addBinding(binding);

      const disabled = manager.disableBinding(binding.id);

      expect(disabled).toBe(true);
      expect(binding.options.enabled).toBe(false);
    });

    test('should return false for non-existent binding when enabling', () => {
      const enabled = manager.enableBinding('non-existent');

      expect(enabled).toBe(false);
    });

    test('should return false for non-existent binding when disabling', () => {
      const disabled = manager.disableBinding('non-existent');

      expect(disabled).toBe(false);
    });

    test('should enable global binding', () => {
      const binding = manager.createBinding('ctrl+g', mockHandler, { enabled: false });
      manager.addBinding(binding, true);

      const enabled = manager.enableBinding(binding.id);

      expect(enabled).toBe(true);
      expect(binding.options.enabled).toBe(true);
    });
  });

  describe('getAllBindings', () => {
    test('should return all bindings', () => {
      const globalBinding = manager.createBinding('ctrl+g', mockHandler);
      const keyBinding1 = manager.createBinding('a', mockHandler);
      const keyBinding2 = manager.createBinding('b', mockHandler);

      manager.addBinding(globalBinding, true);
      manager.addBinding(keyBinding1);
      manager.addBinding(keyBinding2);

      const allBindings = manager.getAllBindings();

      expect(allBindings).toContain(globalBinding);
      expect(allBindings).toContain(keyBinding1);
      expect(allBindings).toContain(keyBinding2);
      expect(allBindings).toHaveLength(3);
    });

    test('should return empty array when no bindings', () => {
      const allBindings = manager.getAllBindings();

      expect(allBindings).toEqual([]);
    });

    test('should return copy of bindings array', () => {
      const binding = manager.createBinding('a', mockHandler);
      manager.addBinding(binding);

      const allBindings1 = manager.getAllBindings();
      const allBindings2 = manager.getAllBindings();

      expect(allBindings1).toEqual(allBindings2);
      expect(allBindings1).not.toBe(allBindings2); // Different array instances
    });
  });

  describe('getBindingsByKey', () => {
    test('should return bindings for specific key', () => {
      const binding1 = manager.createBinding('a', mockHandler);
      const binding2 = manager.createBinding('a', mockHandler);
      const binding3 = manager.createBinding('b', mockHandler);

      manager.addBinding(binding1);
      manager.addBinding(binding2);
      manager.addBinding(binding3);

      const aBindings = manager.getBindingsByKey('a');

      expect(aBindings).toContain(binding1);
      expect(aBindings).toContain(binding2);
      expect(aBindings).not.toContain(binding3);
      expect(aBindings).toHaveLength(2);
    });

    test('should return empty array for non-existent key', () => {
      const bindings = manager.getBindingsByKey('nonexistent');

      expect(bindings).toEqual([]);
    });
  });

  describe('getGlobalBindings', () => {
    test('should return global bindings', () => {
      const globalBinding1 = manager.createBinding('ctrl+1', mockHandler);
      const globalBinding2 = manager.createBinding('ctrl+2', mockHandler);
      const keyBinding = manager.createBinding('a', mockHandler);

      manager.addBinding(globalBinding1, true);
      manager.addBinding(globalBinding2, true);
      manager.addBinding(keyBinding);

      const globalBindings = manager.getGlobalBindings();

      expect(globalBindings).toContain(globalBinding1);
      expect(globalBindings).toContain(globalBinding2);
      expect(globalBindings).not.toContain(keyBinding);
      expect(globalBindings).toHaveLength(2);
    });

    test('should return copy of global bindings array', () => {
      const binding = manager.createBinding('ctrl+g', mockHandler);
      manager.addBinding(binding, true);

      const globals1 = manager.getGlobalBindings();
      const globals2 = manager.getGlobalBindings();

      expect(globals1).toEqual(globals2);
      expect(globals1).not.toBe(globals2); // Different array instances
    });
  });

  describe('clear', () => {
    test('should clear all bindings', () => {
      const globalBinding = manager.createBinding('ctrl+g', mockHandler);
      const keyBinding = manager.createBinding('a', mockHandler);

      manager.addBinding(globalBinding, true);
      manager.addBinding(keyBinding);

      manager.clear();

      expect(manager.getAllBindings()).toHaveLength(0);
      expect(manager.getGlobalBindings()).toHaveLength(0);
      expect(manager.getBindingsByKey('a')).toHaveLength(0);
      expect(manager.getBindingCount()).toBe(0);
    });
  });

  describe('getBindingCount', () => {
    test('should return total binding count', () => {
      const globalBinding = manager.createBinding('ctrl+g', mockHandler);
      const keyBinding1 = manager.createBinding('a', mockHandler);
      const keyBinding2 = manager.createBinding('b', mockHandler);

      expect(manager.getBindingCount()).toBe(0);

      manager.addBinding(globalBinding, true);
      expect(manager.getBindingCount()).toBe(1);

      manager.addBinding(keyBinding1);
      expect(manager.getBindingCount()).toBe(2);

      manager.addBinding(keyBinding2);
      expect(manager.getBindingCount()).toBe(3);
    });

    test('should count multiple bindings for same key', () => {
      const binding1 = manager.createBinding('a', mockHandler);
      const binding2 = manager.createBinding('a', mockHandler);

      manager.addBinding(binding1);
      manager.addBinding(binding2);

      expect(manager.getBindingCount()).toBe(2);
    });
  });

  describe('edge cases', () => {
    test('should handle undefined modifiers in event', () => {
      const binding = manager.createBinding('ctrl+c', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'c',
        modifiers: {},
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(false);
    });

    test('should handle undefined modifiers in binding', () => {
      const binding = manager.createBinding('c', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'c',
        modifiers: {},
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(true);
    });

    test('should handle partially undefined modifiers', () => {
      const binding = manager.createBinding('ctrl+c', mockHandler);
      const keyEvent: KeyEvent = {
        key: 'c',
        modifiers: { ctrl: true, alt: undefined, shift: undefined },
        timestamp: Date.now(),
      };

      const matches = manager.matchesBinding(keyEvent, binding);
      expect(matches).toBe(true);
    });

    test('should handle complex key names', () => {
      const binding = manager.createBinding('ArrowUp', mockHandler);
      manager.addBinding(binding);

      const keyBindings = manager.getBindingsByKey('arrowup');
      expect(keyBindings).toContain(binding);
    });

    test('should handle duplicate modifier declarations', () => {
      const parsed = manager.parseBindingKeys('ctrl+control+c');

      expect(parsed).toEqual([{
        key: 'c',
        modifiers: { ctrl: true }
      }]);
    });

    test('should handle priority edge cases', () => {
      const noPriority = manager.createBinding('a', mockHandler, {});
      const zeroPriority = manager.createBinding('a', mockHandler, { priority: 0 });
      const negativePriority = manager.createBinding('a', mockHandler, { priority: -5 });

      manager.addBinding(noPriority);
      manager.addBinding(zeroPriority);
      manager.addBinding(negativePriority);

      const bindings = manager.getBindingsByKey('a');
      // Should be sorted: 0, 0, -5 (highest to lowest)
      expect(bindings[2]).toBe(negativePriority);
    });
  });
});
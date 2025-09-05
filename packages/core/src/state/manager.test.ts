import { describe, it, expect } from 'vitest';

describe('State Manager', () => {
  describe('State Initialization', () => {
    it('should initialize with empty state', () => {
      const manager = {
        state: {},
        initialize: function () {
          this.state = {
            version: '1.0.0',
            instances: [],
            templates: [],
          };
        },
      };

      manager.initialize();
      const state = manager.state as {
        version: string;
        instances: unknown[];
        templates: unknown[];
      };
      expect(state.version).toBe('1.0.0');
      expect(state.instances).toHaveLength(0);
      expect(state.templates).toHaveLength(0);
    });

    it('should load state from storage', () => {
      const storage = {
        data: {
          version: '1.0.0',
          instances: [{ id: '1', name: 'Test' }],
        },
        load: function () {
          return this.data;
        },
      };

      const state = storage.load();
      expect(state.instances).toHaveLength(1);
      expect(state.instances[0].name).toBe('Test');
    });
  });

  describe('State Mutations', () => {
    it('should add new instance immutably', () => {
      const state = {
        instances: [{ id: '1', name: 'First' }],
      };

      const newState = {
        ...state,
        instances: [...state.instances, { id: '2', name: 'Second' }],
      };

      expect(newState.instances).toHaveLength(2);
      expect(state.instances).toHaveLength(1);
      expect(newState).not.toBe(state);
    });

    it('should update instance immutably', () => {
      const state = {
        instances: [
          { id: '1', name: 'First', completed: false },
          { id: '2', name: 'Second', completed: false },
        ],
      };

      const newState = {
        ...state,
        instances: state.instances.map((inst) =>
          inst.id === '1' ? { ...inst, completed: true } : inst
        ),
      };

      expect(newState.instances[0].completed).toBe(true);
      expect(state.instances[0].completed).toBe(false);
    });

    it('should remove instance immutably', () => {
      const state = {
        instances: [
          { id: '1', name: 'First' },
          { id: '2', name: 'Second' },
        ],
      };

      const newState = {
        ...state,
        instances: state.instances.filter((inst) => inst.id !== '1'),
      };

      expect(newState.instances).toHaveLength(1);
      expect(newState.instances[0].id).toBe('2');
      expect(state.instances).toHaveLength(2);
    });
  });

  describe('State Validation', () => {
    it('should validate state structure', () => {
      const validator = {
        validate: function (state: unknown) {
          const s = state as { version?: unknown; instances?: unknown };
          if (!s || typeof s !== 'object') return false;
          if (!s.version || typeof s.version !== 'string') return false;
          if (!Array.isArray(s.instances)) return false;
          return true;
        },
      };

      expect(validator.validate({ version: '1.0', instances: [] })).toBe(true);
      expect(validator.validate({ version: '1.0' })).toBe(false);
      expect(validator.validate({ instances: [] })).toBe(false);
      expect(validator.validate(null)).toBe(false);
    });

    it('should validate instance structure', () => {
      const validateInstance = (instance: unknown): boolean => {
        const inst = instance as { id?: string; name?: string };
        return !!inst && typeof inst.id === 'string' && typeof inst.name === 'string';
      };

      expect(validateInstance({ id: '1', name: 'Test' })).toBe(true);
      expect(validateInstance({ id: '1' })).toBe(false);
      expect(validateInstance({ name: 'Test' })).toBe(false);
    });
  });

  describe('State Persistence', () => {
    it('should save state to storage', () => {
      const storage = {
        data: null as unknown,
        save: function (state: unknown) {
          this.data = structuredClone(state);
          return true;
        },
      };

      const state = {
        version: '1.0.0',
        instances: [{ id: '1', name: 'Test' }],
      };

      const result = storage.save(state);
      expect(result).toBe(true);
      expect(storage.data).toEqual(state);
    });

    it('should handle save failures gracefully', () => {
      const storage = {
        save: function () {
          throw new Error('Storage full');
        },
        handleError: function (error: Error) {
          return { success: false, error: error.message };
        },
      };

      let result;
      try {
        storage.save();
      } catch (error) {
        result = storage.handleError(error as Error);
      }

      expect(result?.success).toBe(false);
      expect(result?.error).toBe('Storage full');
    });
  });

  describe('State History', () => {
    it('should maintain state history', () => {
      const history = {
        states: [] as unknown[],
        maxSize: 10,
        push: function (state: unknown) {
          this.states.push(structuredClone(state));
          if (this.states.length > this.maxSize) {
            this.states.shift();
          }
        },
      };

      history.push({ version: 1 });
      history.push({ version: 2 });

      expect(history.states).toHaveLength(2);
      expect((history.states[0] as { version: number }).version).toBe(1);
      expect((history.states[1] as { version: number }).version).toBe(2);
    });

    it('should support undo operation', () => {
      const manager = {
        current: { version: 3 },
        history: [{ version: 1 }, { version: 2 }],
        undo: function () {
          if (this.history.length > 0) {
            const previous = this.history.pop();
            if (previous) this.current = previous;
          }
        },
      };

      manager.undo();
      expect(manager.current.version).toBe(2);
      expect(manager.history).toHaveLength(1);
    });
  });

  describe('State Subscriptions', () => {
    it('should notify subscribers on state change', () => {
      const manager = {
        state: { count: 0 },
        subscribers: [] as Array<(state: unknown) => void>,
        subscribe: function (callback: (state: unknown) => void) {
          this.subscribers.push(callback);
        },
        setState: function (newState: unknown) {
          this.state = newState;
          this.subscribers.forEach((cb) => cb(this.state));
        },
      };

      let notifiedState: { count: number } | null = null;
      manager.subscribe((state) => {
        notifiedState = state as { count: number };
      });

      manager.setState({ count: 1 });
      expect(notifiedState).toEqual({ count: 1 });
    });

    it('should support unsubscribe', () => {
      const manager = {
        subscribers: [] as Array<() => void>,
        subscribe: function (callback: () => void) {
          this.subscribers.push(callback);
          return () => {
            const index = this.subscribers.indexOf(callback);
            if (index > -1) {
              this.subscribers.splice(index, 1);
            }
          };
        },
      };

      const callback = () => {};
      const unsubscribe = manager.subscribe(callback);

      expect(manager.subscribers).toHaveLength(1);
      unsubscribe();
      expect(manager.subscribers).toHaveLength(0);
    });
  });
});

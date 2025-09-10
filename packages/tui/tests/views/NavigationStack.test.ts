/**
 * NavigationStack Tests
 * 
 * Tests for the navigation stack functionality including
 * push/pop operations, state preservation, and history management.
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { NavigationStack } from '../../src/navigation/NavigationStack.js';

describe('NavigationStack', () => {
  let stack: NavigationStack;

  beforeEach(() => {
    stack = new NavigationStack(5); // Small size for testing
  });

  describe('Basic Operations', () => {
    it('should start with empty stack', () => {
      expect(stack.size()).toBe(0);
      expect(stack.canGoBack()).toBe(false);
      expect(stack.peek()).toBeUndefined();
    });

    it('should push entries correctly', () => {
      stack.push('view1');
      
      expect(stack.size()).toBe(1);
      expect(stack.peek()?.viewId).toBe('view1');
      expect(stack.canGoBack()).toBe(false); // Need 2+ entries to go back
    });

    it('should enable going back with multiple entries', () => {
      stack.push('view1');
      stack.push('view2');
      
      expect(stack.size()).toBe(2);
      expect(stack.canGoBack()).toBe(true);
      expect(stack.peek()?.viewId).toBe('view2');
    });

    it('should pop entries correctly', () => {
      stack.push('view1');
      stack.push('view2');
      
      const popped = stack.pop();
      expect(popped?.viewId).toBe('view2');
      expect(stack.size()).toBe(1);
      expect(stack.peek()?.viewId).toBe('view1');
    });

    it('should return undefined when popping empty stack', () => {
      const popped = stack.pop();
      expect(popped).toBeUndefined();
    });
  });

  describe('State and Parameters', () => {
    it('should preserve params and state', () => {
      const params = { id: 123, mode: 'edit' };
      const state = { scrollPosition: 50, selectedItem: 'item1' };
      
      stack.push('view1', params, state);
      
      const entry = stack.peek();
      expect(entry?.params).toEqual(params);
      expect(entry?.state).toEqual(state);
    });

    it('should include timestamp', () => {
      const before = Date.now();
      stack.push('view1');
      const after = Date.now();
      
      const entry = stack.peek();
      expect(entry?.timestamp).toBeGreaterThanOrEqual(before);
      expect(entry?.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('History Management', () => {
    it('should maintain max size', () => {
      // Push more than max size (5)
      for (let i = 1; i <= 7; i++) {
        stack.push(`view${i}`);
      }
      
      expect(stack.size()).toBe(5);
      expect(stack.peek()?.viewId).toBe('view7');
      
      // Should have removed oldest entries
      const history = stack.getHistory();
      expect(history[0].viewId).toBe('view3'); // view1 and view2 should be removed
    });

    it('should get previous entry', () => {
      stack.push('view1');
      stack.push('view2');
      stack.push('view3');
      
      const previous = stack.getPrevious();
      expect(previous?.viewId).toBe('view2');
    });

    it('should return undefined for previous when insufficient entries', () => {
      stack.push('view1');
      
      const previous = stack.getPrevious();
      expect(previous).toBeUndefined();
    });

    it('should clear all entries', () => {
      stack.push('view1');
      stack.push('view2');
      stack.push('view3');
      
      stack.clear();
      
      expect(stack.size()).toBe(0);
      expect(stack.canGoBack()).toBe(false);
      expect(stack.getHistory()).toEqual([]);
    });
  });

  describe('Replace Operation', () => {
    it('should replace current entry', () => {
      stack.push('view1');
      stack.push('view2');
      
      stack.replace('view3', { newParam: true });
      
      expect(stack.size()).toBe(2);
      expect(stack.peek()?.viewId).toBe('view3');
      expect(stack.peek()?.params).toEqual({ newParam: true });
    });

    it('should push when replacing empty stack', () => {
      stack.replace('view1');
      
      expect(stack.size()).toBe(1);
      expect(stack.peek()?.viewId).toBe('view1');
    });
  });

  describe('View Management', () => {
    it('should find entry for specific view', () => {
      stack.push('view1');
      stack.push('view2');
      stack.push('view1'); // Same view again
      
      const entry = stack.findEntry('view1');
      expect(entry?.viewId).toBe('view1');
      // Should find the most recent one
    });

    it('should return undefined for non-existent view', () => {
      stack.push('view1');
      
      const entry = stack.findEntry('nonexistent');
      expect(entry).toBeUndefined();
    });

    it('should remove all entries for a view', () => {
      stack.push('view1');
      stack.push('view2');
      stack.push('view1');
      stack.push('view3');
      
      stack.removeView('view1');
      
      expect(stack.size()).toBe(2);
      const history = stack.getHistory();
      expect(history.map(e => e.viewId)).toEqual(['view2', 'view3']);
    });
  });

  describe('History Retrieval', () => {
    it('should return copy of history', () => {
      stack.push('view1');
      stack.push('view2');
      
      const history1 = stack.getHistory();
      const history2 = stack.getHistory();
      
      expect(history1).toEqual(history2);
      expect(history1).not.toBe(history2); // Should be different objects
    });

    it('should return history in correct order', () => {
      stack.push('view1');
      stack.push('view2');
      stack.push('view3');
      
      const history = stack.getHistory();
      expect(history.map(e => e.viewId)).toEqual(['view1', 'view2', 'view3']);
    });
  });
});
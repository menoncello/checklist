/**
 * Mutation Tests for NavigationStack
 * 
 * These tests are specifically designed to kill mutations in NavigationStack.ts
 * by providing exact value assertions, boundary conditions, and comprehensive
 * coverage of all branches and conditions.
 */

import { test, expect, beforeEach, describe } from 'bun:test';
import { NavigationStack } from '../../src/navigation/NavigationStack';
import type { NavigationStackEntry, ViewParams, ViewState } from '../../src/views/types';

describe('NavigationStack Mutation Tests', () => {
  let navStack: NavigationStack;

  beforeEach(() => {
    navStack = new NavigationStack();
  });

  describe('Constructor and Default Values - Exact Numeric Constants', () => {
    test('should initialize with default max size of exactly 50', () => {
      const defaultStack = new NavigationStack();
      
      // Fill with 51 entries to test boundary
      for (let i = 0; i < 51; i++) {
        defaultStack.push(`view-${i}`);
      }
      
      // Should maintain exactly 50 entries, not 49 or 51
      expect(defaultStack.size()).toBe(50);
    });

    test('should initialize with custom max size exactly', () => {
      const customStack = new NavigationStack(10);
      
      // Fill with 12 entries
      for (let i = 0; i < 12; i++) {
        customStack.push(`view-${i}`);
      }
      
      // Should maintain exactly 10 entries
      expect(customStack.size()).toBe(10);
    });

    test('should initialize with zero max size', () => {
      const zeroStack = new NavigationStack(0);
      zeroStack.push('view-1');
      
      // Should maintain exactly 0 entries
      expect(zeroStack.size()).toBe(0);
    });
  });

  describe('Array Index Mutations - Exact Index Calculations', () => {
    test('should peek at exact last index (length - 1)', () => {
      navStack.push('view-1');
      navStack.push('view-2');
      navStack.push('view-3');
      
      const peeked = navStack.peek();
      
      expect(peeked?.viewId).toBe('view-3'); // Should be last item
      expect(navStack.size()).toBe(3); // Should not modify size
    });

    test('should get previous at exact second-to-last index (length - 2)', () => {
      navStack.push('view-1');
      navStack.push('view-2');
      navStack.push('view-3');
      
      const previous = navStack.getPrevious();
      
      expect(previous?.viewId).toBe('view-2'); // Should be second-to-last
      // Kill mutations: length - 1, length - 3, length + 1, etc.
      expect(previous?.viewId).not.toBe('view-3'); // Not length - 1
      expect(previous?.viewId).not.toBe('view-1'); // Not length - 3
    });

    test('should handle empty stack peek - undefined boundary', () => {
      const peeked = navStack.peek();
      expect(peeked).toBeUndefined(); // Exact undefined, not null
    });

    test('should handle single item previous - undefined boundary', () => {
      navStack.push('only-view');
      const previous = navStack.getPrevious();
      
      expect(previous).toBeUndefined(); // Should return undefined when length < 2
    });

    test('should replace at exact last index (length - 1)', () => {
      navStack.push('original-1');
      navStack.push('original-2');
      
      navStack.replace('replaced-2', { param: 'new' });
      
      const peeked = navStack.peek();
      expect(peeked?.viewId).toBe('replaced-2');
      expect(peeked?.params?.param).toBe('new');
      
      // Verify first item unchanged
      const history = navStack.getHistory();
      expect(history[0].viewId).toBe('original-1');
    });
  });

  describe('Boolean and Conditional Mutations - Exact Comparisons', () => {
    test('should return true for canGoBack when length > 1 exactly', () => {
      navStack.push('view-1');
      expect(navStack.canGoBack()).toBe(false); // length = 1, not > 1
      
      navStack.push('view-2');
      expect(navStack.canGoBack()).toBe(true); // length = 2, which is > 1
      
      // Kill boundary mutations: >=, <, <=, !=
      expect(navStack.canGoBack()).not.toBe(false); // Should be true when length = 2
    });

    test('should return false for canGoBack when length = 1 exactly', () => {
      navStack.push('single-view');
      expect(navStack.canGoBack()).toBe(false); // Exactly false
      expect(navStack.size()).toBe(1); // Confirm boundary condition
    });

    test('should return false for canGoBack when length = 0 exactly', () => {
      expect(navStack.canGoBack()).toBe(false); // Exactly false
      expect(navStack.size()).toBe(0); // Confirm empty state
    });

    test('should handle getPrevious length < 2 condition exactly', () => {
      // Test length = 0
      expect(navStack.getPrevious()).toBeUndefined();
      
      // Test length = 1
      navStack.push('single');
      expect(navStack.getPrevious()).toBeUndefined();
      
      // Test length = 2 (boundary)
      navStack.push('second');
      expect(navStack.getPrevious()).toBeDefined(); // Should now work
    });

    test('should handle stack length > maxSize condition exactly', () => {
      const smallStack = new NavigationStack(3);
      
      smallStack.push('view-1');
      smallStack.push('view-2');
      smallStack.push('view-3');
      expect(smallStack.size()).toBe(3); // At boundary
      
      smallStack.push('view-4');
      expect(smallStack.size()).toBe(3); // Still at max
      
      // Should have shifted first element
      const history = smallStack.getHistory();
      expect(history[0].viewId).toBe('view-2'); // First was shifted out
      expect(history[2].viewId).toBe('view-4'); // New item added
    });

    test('should handle replace when stack length = 0 exactly', () => {
      expect(navStack.size()).toBe(0);
      
      navStack.replace('first-view');
      
      // Should call push instead
      expect(navStack.size()).toBe(1);
      expect(navStack.peek()?.viewId).toBe('first-view');
    });
  });

  describe('Loop and Iterator Mutations - Exact Loop Conditions', () => {
    test('should iterate backward in findEntry with correct bounds', () => {
      navStack.push('view-a');
      navStack.push('view-b');
      navStack.push('view-a'); // Duplicate - should find most recent
      navStack.push('view-c');
      
      const found = navStack.findEntry('view-a');
      
      // Should find the most recent (index 2), not first (index 0)
      expect(found?.viewId).toBe('view-a');
      
      // Verify it found the right one by checking position
      const history = navStack.getHistory();
      expect(history[2].viewId).toBe('view-a');
      expect(found?.timestamp).toBe(history[2].timestamp);
    });

    test('should iterate with exact loop bounds in findEntry', () => {
      navStack.push('target');
      navStack.push('other');
      
      const found = navStack.findEntry('target');
      expect(found?.viewId).toBe('target');
      
      const notFound = navStack.findEntry('missing');
      expect(notFound).toBeUndefined();
    });

    test('should iterate backward in removeView with correct indices', () => {
      navStack.push('keep-1');
      navStack.push('remove');
      navStack.push('keep-2');
      navStack.push('remove');
      navStack.push('keep-3');
      
      expect(navStack.size()).toBe(5);
      
      navStack.removeView('remove');
      
      expect(navStack.size()).toBe(3);
      const history = navStack.getHistory();
      
      // Should only have 'keep' views
      expect(history[0].viewId).toBe('keep-1');
      expect(history[1].viewId).toBe('keep-2');
      expect(history[2].viewId).toBe('keep-3');
      
      // Verify no 'remove' entries left
      const stillThere = navStack.findEntry('remove');
      expect(stillThere).toBeUndefined();
    });

    test('should handle loop with i >= 0 condition exactly', () => {
      navStack.push('first');  // index 0
      navStack.push('second'); // index 1
      
      // Should find item at index 0
      const found = navStack.findEntry('first');
      expect(found?.viewId).toBe('first');
    });
  });

  describe('Array Method Mutations - Exact Array Operations', () => {
    test('should use exact shift() method for size maintenance', () => {
      const stack = new NavigationStack(2);
      
      stack.push('first');
      stack.push('second');
      stack.push('third'); // Should cause shift
      
      const history = stack.getHistory();
      
      // Should have removed first element via shift()
      expect(history.length).toBe(2);
      expect(history[0].viewId).toBe('second');
      expect(history[1].viewId).toBe('third');
      // 'first' should be gone
      expect(history.find(entry => entry.viewId === 'first')).toBeUndefined();
    });

    test('should use exact pop() method', () => {
      navStack.push('first');
      navStack.push('second');
      
      const popped = navStack.pop();
      
      expect(popped?.viewId).toBe('second'); // Should return last item
      expect(navStack.size()).toBe(1); // Size should decrease
      expect(navStack.peek()?.viewId).toBe('first'); // First should remain
    });

    test('should use exact splice() method in removeView', () => {
      navStack.push('a');
      navStack.push('target');
      navStack.push('b');
      navStack.push('target');
      navStack.push('c');
      
      navStack.removeView('target');
      
      // Should remove all 'target' entries
      const history = navStack.getHistory();
      expect(history.length).toBe(3);
      expect(history.map(e => e.viewId)).toEqual(['a', 'b', 'c']);
    });

    test('should use exact spread operator in getHistory', () => {
      navStack.push('item1');
      navStack.push('item2');
      
      const history = navStack.getHistory();
      
      // Should be a copy, not reference
      expect(history).not.toBe((navStack as any).stack);
      
      // Should have same content
      expect(history.length).toBe(2);
      expect(history[0].viewId).toBe('item1');
      expect(history[1].viewId).toBe('item2');
      
      // Modifying returned history shouldn't affect stack
      (history as any).push({ viewId: 'external' });
      expect(navStack.size()).toBe(2); // Stack unchanged
    });

    test('should set length = 0 exactly in clear()', () => {
      navStack.push('item1');
      navStack.push('item2');
      expect(navStack.size()).toBe(2);
      
      navStack.clear();
      
      expect(navStack.size()).toBe(0); // Exactly 0
      expect(navStack.peek()).toBeUndefined();
      expect(navStack.canGoBack()).toBe(false);
      expect(navStack.getHistory()).toEqual([]);
    });
  });

  describe('Numeric Value Mutations - Exact Numbers', () => {
    test('should use exact numeric values in boundary checks', () => {
      // Test with exact boundary value 1
      navStack.push('first');
      expect(navStack.canGoBack()).toBe(false); // length = 1, not > 1
      
      // Test with exact boundary value 2
      navStack.push('second');
      expect(navStack.canGoBack()).toBe(true); // length = 2, which is > 1
      
      // Test with exact boundary value 0
      navStack.clear();
      expect(navStack.size()).toBe(0);
      expect(navStack.canGoBack()).toBe(false);
    });

    test('should maintain exact size limits', () => {
      const stack = new NavigationStack(5);
      
      // Add exactly 5 items
      for (let i = 0; i < 5; i++) {
        stack.push(`item-${i}`);
      }
      expect(stack.size()).toBe(5);
      
      // Add 6th item - should still be 5
      stack.push('item-5');
      expect(stack.size()).toBe(5); // Exactly 5, not 4 or 6
      
      // First item should be shifted out
      const history = stack.getHistory();
      expect(history[0].viewId).toBe('item-1'); // 'item-0' shifted out
    });

    test('should use exact Date.now() for timestamps', () => {
      const beforePush = Date.now();
      navStack.push('timed-view');
      const afterPush = Date.now();
      
      const entry = navStack.peek();
      
      expect(entry?.timestamp).toBeGreaterThanOrEqual(beforePush);
      expect(entry?.timestamp).toBeLessThanOrEqual(afterPush);
      expect(typeof entry?.timestamp).toBe('number');
    });
  });

  describe('Object Property Mutations - Exact Property Access', () => {
    test('should create entry with exact property structure', () => {
      const params: ViewParams = { id: '123', filter: 'active' };
      const state: ViewState = { scrollPosition: 100, selectedItem: 'item-5' };
      
      navStack.push('detailed-view', params, state);
      
      const entry = navStack.peek();
      
      expect(entry?.viewId).toBe('detailed-view');
      expect(entry?.params).toEqual(params);
      expect(entry?.state).toEqual(state);
      expect(typeof entry?.timestamp).toBe('number');
    });

    test('should handle undefined params and state', () => {
      navStack.push('simple-view');
      
      const entry = navStack.peek();
      
      expect(entry?.viewId).toBe('simple-view');
      expect(entry?.params).toBeUndefined();
      expect(entry?.state).toBeUndefined();
      expect(entry?.timestamp).toBeDefined();
    });

    test('should access viewId property correctly in findEntry', () => {
      navStack.push('view-alpha');
      navStack.push('view-beta');
      navStack.push('view-gamma');
      
      const found = navStack.findEntry('view-beta');
      
      expect(found?.viewId).toBe('view-beta');
      // Verify property access, not index confusion
      const foundIndex = navStack.getHistory().findIndex(e => e === found);
      expect(foundIndex).toBe(1); // Should be at index 1
    });

    test('should access viewId property correctly in removeView', () => {
      navStack.push('keep');
      navStack.push('target-id');
      navStack.push('keep');
      navStack.push('target-id');
      
      navStack.removeView('target-id');
      
      // Should remove all entries with viewId = 'target-id'
      const remaining = navStack.getHistory().map(e => e.viewId);
      expect(remaining).toEqual(['keep', 'keep']);
    });
  });

  describe('Edge Cases and Error Conditions', () => {
    test('should handle pop on empty stack', () => {
      expect(navStack.size()).toBe(0);
      
      const popped = navStack.pop();
      
      expect(popped).toBeUndefined();
      expect(navStack.size()).toBe(0); // Should remain 0
    });

    test('should handle operations on empty stack', () => {
      expect(navStack.peek()).toBeUndefined();
      expect(navStack.getPrevious()).toBeUndefined();
      expect(navStack.canGoBack()).toBe(false);
      expect(navStack.size()).toBe(0);
      expect(navStack.getHistory()).toEqual([]);
      expect(navStack.findEntry('any')).toBeUndefined();
    });

    test('should handle very large stack operations', () => {
      const largeStack = new NavigationStack(1000);
      
      // Add 1000 items
      for (let i = 0; i < 1000; i++) {
        largeStack.push(`view-${i}`);
      }
      
      expect(largeStack.size()).toBe(1000);
      expect(largeStack.canGoBack()).toBe(true);
      
      // Add one more - should maintain 1000
      largeStack.push('view-1000');
      expect(largeStack.size()).toBe(1000);
      
      // First item should be shifted
      const history = largeStack.getHistory();
      expect(history[0].viewId).toBe('view-1');
      expect(history[999].viewId).toBe('view-1000');
    });

    test('should handle removeView with non-existent viewId', () => {
      navStack.push('existing');
      const sizeBefore = navStack.size();
      
      navStack.removeView('non-existent');
      
      expect(navStack.size()).toBe(sizeBefore); // Should be unchanged
      expect(navStack.peek()?.viewId).toBe('existing'); // Content unchanged
    });

    test('should handle multiple operations in sequence', () => {
      // Complex sequence to test state consistency
      navStack.push('a');
      navStack.push('b');
      navStack.push('c');
      
      const popped1 = navStack.pop();
      expect(popped1?.viewId).toBe('c');
      
      navStack.replace('b-replaced');
      expect(navStack.peek()?.viewId).toBe('b-replaced');
      
      navStack.push('d');
      expect(navStack.size()).toBe(3);
      
      const previous = navStack.getPrevious();
      expect(previous?.viewId).toBe('b-replaced');
      
      navStack.removeView('a');
      expect(navStack.size()).toBe(2);
      
      const history = navStack.getHistory();
      expect(history.map(e => e.viewId)).toEqual(['b-replaced', 'd']);
    });
  });

  describe('Type Safety and Parameter Validation', () => {
    test('should handle various parameter types', () => {
      const complexParams = {
        string: 'value',
        number: 42,
        boolean: true,
        array: [1, 2, 3],
        object: { nested: 'data' },
        null: null,
        undefined: undefined
      };

      navStack.push('complex-view', complexParams);
      
      const entry = navStack.peek();
      expect(entry?.params).toEqual(complexParams);
    });

    test('should preserve parameter references', () => {
      const params = { mutable: 'original' };
      
      navStack.push('ref-view', params);
      
      // Modify original object
      params.mutable = 'modified';
      
      const entry = navStack.peek();
      // Should reflect the modification (reference preserved)
      expect(entry?.params?.mutable).toBe('modified');
    });

    test('should handle empty string viewId', () => {
      navStack.push('');
      
      const entry = navStack.peek();
      expect(entry?.viewId).toBe('');
      
      const found = navStack.findEntry('');
      expect(found?.viewId).toBe('');
    });

    test('should handle special character viewIds', () => {
      const specialIds = ['view/path', 'view?query=1', 'view#hash', 'view with spaces'];
      
      specialIds.forEach(id => navStack.push(id));
      
      specialIds.forEach(id => {
        const found = navStack.findEntry(id);
        expect(found?.viewId).toBe(id);
      });
    });
  });
});
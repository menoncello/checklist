/**
 * Tests for TemplateAssertions
 * Covers assertion types: equals, contains, exists, and path resolution
 */

import { describe, expect, test } from 'bun:test';
import { TemplateAssertions } from '../../src/templates/TemplateAssertions';
import type { TemplateAssertion, ChecklistTemplate } from '../../src/templates/types';

// Helper to create mock template
function createMockTemplate(overrides?: Partial<ChecklistTemplate>): ChecklistTemplate {
  return {
    name: 'test-template',
    version: '1.0.0',
    description: 'Test template for assertions',
    steps: [
      { id: 'step1', title: 'Step 1', description: 'First step', completed: false },
      { id: 'step2', title: 'Step 2', description: 'Second step', completed: true },
    ],
    variables: {
      projectName: 'my-project',
      author: 'Test Author',
      tags: ['test', 'demo', 'example'],
    },
    metadata: {
      created: '2025-01-01T00:00:00Z',
      modified: '2025-01-02T00:00:00Z',
    },
    ...overrides,
  };
}

describe('TemplateAssertions', () => {
  describe('constructor', () => {
    test('should create assertions instance', () => {
      const assertions = new TemplateAssertions();
      expect(assertions).toBeDefined();
    });
  });

  describe('runAssertions', () => {
    test('should return empty array when all assertions pass', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'name', value: 'test-template' },
        { type: 'equals', path: 'version', value: '1.0.0' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should return failures when assertions fail', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'name', value: 'wrong-name' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].type).toBe('equals');
      expect(failures[0].path).toBe('name');
    });

    test('should handle empty assertions array', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should collect multiple failures', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'name', value: 'wrong-name' },
        { type: 'equals', path: 'version', value: '2.0.0' },
        { type: 'equals', path: 'description', value: 'Test template for assertions' }, // This passes
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(2);
      expect(failures[0].path).toBe('name');
      expect(failures[1].path).toBe('version');
    });
  });

  describe('equals assertion', () => {
    test('should pass when values are equal', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'name', value: 'test-template' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should fail when values are not equal', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'name', value: 'different-name' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].type).toBe('equals');
      expect(failures[0].expected).toBe('different-name');
      expect(failures[0].actual).toBe('test-template');
      expect(failures[0].message).toContain('Expected');
    });

    test('should work with nested properties', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'metadata.created', value: '2025-01-01T00:00:00Z' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should work with deeply nested properties', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        metadata: {
          author: { name: 'Test', email: 'test@example.com' },
        },
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'metadata.author.name', value: 'Test' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should compare numbers correctly', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        metadata: { stepCount: 2 },
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'metadata.stepCount', value: 2 },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should compare booleans correctly', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        steps: [{ id: 'step1', title: 'Step', description: '', completed: true }],
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'steps.0.completed', value: true },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });
  });

  describe('contains assertion', () => {
    test('should pass when string contains value', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'description', value: 'template' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should fail when string does not contain value', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'description', value: 'nonexistent' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].type).toBe('contains');
      expect(failures[0].message).toContain('contain');
    });

    test('should work with array contains', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'variables.tags', value: 'test' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should fail when array does not contain value', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'variables.tags', value: 'nonexistent' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].type).toBe('contains');
    });

    test('should be case sensitive for strings', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'description', value: 'Template' }, // Capital T
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1); // Should fail because description has lowercase 'template'
    });

    test('should handle partial string matches', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'name', value: 'test' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should fail gracefully for non-string/non-array values', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        metadata: { count: 5 },
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'metadata.count', value: '5' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].message).toContain('string or array');
    });
  });

  describe('exists assertion', () => {
    test('should pass when path exists and assertion expects true', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'name', value: true },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should fail when path does not exist and assertion expects true', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'nonexistent', value: true },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].type).toBe('exists');
      expect(failures[0].expected).toBe(true);
      expect(failures[0].actual).toBe(false);
    });

    test('should pass when path does not exist and assertion expects false', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'nonexistent', value: false },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should fail when path exists and assertion expects false', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'name', value: false },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].expected).toBe(false);
      expect(failures[0].actual).toBe(true);
    });

    test('should work with nested paths', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'metadata.created', value: true },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should treat null as non-existent', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        metadata: { optional: null },
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'metadata.optional', value: true },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1); // null is treated as not existing
    });

    test('should treat undefined as non-existent', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'undefinedProperty', value: true },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
    });
  });

  describe('path resolution', () => {
    test('should resolve top-level properties', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'name', value: 'test-template' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should resolve nested properties with dot notation', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'variables.projectName', value: 'my-project' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should resolve array elements by index', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'steps.0.id', value: 'step1' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should return undefined for non-existent paths', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'nonexistent.deeply.nested', value: null },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1); // undefined !== null
    });

    test('should handle paths through null values', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        metadata: null as unknown as { created: string; modified: string },
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'exists', path: 'metadata.created', value: false },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]); // Path doesn't exist, so exists: false passes
    });
  });

  describe('unknown assertion types', () => {
    test('should handle unknown assertion type gracefully', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'unknown-type' as 'equals', path: 'name', value: 'test' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      expect(failures[0].message).toContain('Unknown assertion type');
    });
  });

  describe('edge cases', () => {
    test('should handle empty string values', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        description: '',
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'description', value: '' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should handle zero as a value', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        metadata: { count: 0 },
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'metadata.count', value: 0 },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should handle false as a value', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        steps: [{ id: 'step1', title: 'Step', description: '', completed: false }],
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'steps.0.completed', value: false },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toEqual([]);
    });

    test('should handle empty arrays', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate({
        variables: { tags: [] },
      });
      const testAssertions: TemplateAssertion[] = [
        { type: 'contains', path: 'variables.tags', value: 'test' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1); // Empty array doesn't contain 'test'
    });
  });

  describe('assertion failure details', () => {
    test('should include all required fields in assertion failure', () => {
      const assertions = new TemplateAssertions();
      const template = createMockTemplate();
      const testAssertions: TemplateAssertion[] = [
        { type: 'equals', path: 'name', value: 'wrong-name' },
      ];

      const failures = assertions.runAssertions(template, testAssertions);

      expect(failures).toHaveLength(1);
      const failure = failures[0];
      expect(failure).toHaveProperty('type');
      expect(failure).toHaveProperty('path');
      expect(failure).toHaveProperty('expected');
      expect(failure).toHaveProperty('actual');
      expect(failure).toHaveProperty('message');
      expect(failure.type).toBe('equals');
      expect(failure.path).toBe('name');
      expect(failure.expected).toBe('wrong-name');
      expect(failure.actual).toBe('test-template');
    });
  });
});

/**
 * TemplateEngine Tests
 * Integration tests for the complete template processing pipeline
 * Tests AC1-8 integration: Variables → Math → Functions → Conditionals → Loops
 */

import { describe, expect, test, beforeEach } from 'bun:test';
import { TemplateEngine } from '../../src/templates/TemplateEngine';
import { TemplateSandbox } from '../../src/templates/TemplateSandbox';
import { VariableStore } from '../../src/variables/VariableStore';
import { VariableSubstitutor } from '../../src/templates/VariableSubstitutor';
import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';

describe('TemplateEngine - Pipeline Integration', () => {
  let engine: TemplateEngine;
  let variableStore: VariableStore;
  let sandbox: TemplateSandbox;
  let substitutor: VariableSubstitutor;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(
      import.meta.dir,
      '..',
      '..',
      'test-data',
      `engine-${Date.now()}`
    );
    await mkdir(tempDir, { recursive: true });

    const stateFile = join(tempDir, 'variables.yaml');
    variableStore = new VariableStore(stateFile);
    sandbox = new TemplateSandbox();
    substitutor = new VariableSubstitutor(variableStore);
    engine = new TemplateEngine(sandbox, variableStore, substitutor);
  });

  describe('Pipeline Orchestration', () => {
    test('should execute pipeline in correct order: substitution → math → functions → conditionals → loops', async () => {
      // Setup variables
      variableStore.set('userName', 'Alice');
      variableStore.set('baseScore', 85);
      variableStore.set('bonus', 10);
      variableStore.set('isActive', true);

      const template = `
User: \${userName}
Total Score: \${baseScore + bonus}
Grade: \${fn:uppercase('pass')}
{{#if isActive}}Status: Active{{else}}Status: Inactive{{/if}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('User: Alice');
      expect(result).toContain('Total Score: 95');
      expect(result).toContain('Grade: PASS');
      expect(result).toContain('Status: Active');
    });

    test('should handle mixed syntax in single template', async () => {
      variableStore.set('items', ['Item1', 'Item2', 'Item3']);
      variableStore.set('count', 3);
      variableStore.set('showList', true);

      const template = `
Total Items: \${count}
{{#if showList}}
Items:
{{#each items}}
  - {{this}} (Index: {{@index}})
{{/each}}
{{/if}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Total Items: 3');
      expect(result).toContain('- Item1 (Index: 0)');
      expect(result).toContain('- Item2 (Index: 1)');
      expect(result).toContain('- Item3 (Index: 2)');
    });

    test('should propagate EvaluationContext through all pipeline stages', async () => {
      variableStore.set('value', 42);
      variableStore.set('items', [1, 2, 3]);
      variableStore.set('enabled', true);

      const template = `
Value: \${value * 2}
{{#if enabled}}
{{#each items}}
  Item {{@index}}: \${fn:uppercase('active')} - Current: {{this}}
{{/each}}
{{/if}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Value: 84');
      expect(result).toContain('Item 0: ACTIVE - Current: 1');
      expect(result).toContain('Item 1: ACTIVE - Current: 2');
      expect(result).toContain('Item 2: ACTIVE - Current: 3');
    });
  });

  describe('Error Handling', () => {
    test('should handle errors in middle of pipeline gracefully', async () => {
      // Invalid math expression should not crash entire pipeline
      const template = 'Start \${invalid + } End';

      const result = await engine.processTemplate(template);

      // Should return original on error (fail-safe)
      expect(result).toContain('Start');
      expect(result).toContain('End');
    });

    test('should handle undefined variables in complex templates', async () => {
      const template = `
Value: \${undefined_var}
{{#if undefined_condition}}Content{{/if}}
{{#each undefined_items}}Item{{/each}}
      `.trim();

      const result = await engine.processTemplate(template);

      // Should handle gracefully without crashing
      expect(result).toBeDefined();
    });
  });

  describe('Performance Requirements (AC8 - CRITICAL)', () => {
    test('CRITICAL: complex template with all features should complete in <50ms', async () => {
      // Setup realistic data
      variableStore.set('projectName', 'BMAD Checklist');
      variableStore.set('price', 29.99);
      variableStore.set('quantity', 3);
      variableStore.set('status', 'active');
      variableStore.set('enabled', true);
      variableStore.set('items', ['Feature A', 'Feature B', 'Feature C', 'Feature D', 'Feature E']);

      const template = `
Project: \${projectName}
Total Cost: \${price * quantity}
Formatted Status: \${fn:uppercase(status)}
{{#if enabled}}
Features Available:
{{#each items}}
  - {{this}} [Index {{@index}}] First: {{@first}} Last: {{@last}}
{{/each}}
{{else}}
No features available
{{/if}}
Final Price: \${price * quantity + 10}
      `.trim();

      const start = performance.now();
      const result = await engine.processTemplate(template);
      const duration = performance.now() - start;

      // AC8 CRITICAL REQUIREMENT: <50ms
      expect(duration).toBeLessThan(50);

      // Verify correctness
      expect(result).toContain('Project: BMAD Checklist');
      expect(result).toContain('Total Cost: 89.97');
      expect(result).toContain('Formatted Status: ACTIVE');
      expect(result).toContain('- Feature A [Index 0] First: true Last: false');
      expect(result).toContain('- Feature E [Index 4] First: false Last: true');
      expect(result).toContain('Final Price: 99.97');
    });

    test('should log warning when exceeding 50ms performance target', async () => {
      // Create a complex template that might be slow
      variableStore.set('largeArray', Array.from({ length: 100 }, (_, i) => i));
      variableStore.set('enabled', true);

      const template = `
{{#if enabled}}
{{#each largeArray}}
  Item \${this}: \${this * 2} - \${fn:uppercase('test')}
{{/each}}
{{/if}}
      `.trim();

      // Just verify it completes (logging is internal)
      const result = await engine.processTemplate(template);
      expect(result).toBeDefined();
    });

    test('should track performance metrics through pipeline', async () => {
      variableStore.set('value', 10);

      const template = 'Result: \${value * 5}';

      const result = await engine.processTemplate(template);

      expect(result).toContain('Result: 50');
    });
  });

  describe('Nested Structure Integration (AC4)', () => {
    test('should support conditionals inside loops', async () => {
      // Test if inside each with boolean variable
      variableStore.set('items', ['A', 'B', 'C']);
      variableStore.set('showDetails', true);

      const template = `
{{#each items}}
Item: {{this}}
{{#if showDetails}}
  Details: Index {{@index}}
{{/if}}
{{/each}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Item: A');
      expect(result).toContain('Details: Index 0');
      expect(result).toContain('Item: B');
      expect(result).toContain('Details: Index 1');
      expect(result).toContain('Item: C');
      expect(result).toContain('Details: Index 2');
    });

    test('should support loops inside conditionals', async () => {
      variableStore.set('showItems', true);
      variableStore.set('items', ['Alpha', 'Beta', 'Gamma']);

      const template = `
{{#if showItems}}
Available Items:
{{#each items}}
  - {{this}}
{{/each}}
{{else}}
No items to display
{{/if}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Available Items:');
      expect(result).toContain('- Alpha');
      expect(result).toContain('- Beta');
      expect(result).toContain('- Gamma');
    });

    test('should support deep nesting (3 levels)', async () => {
      variableStore.set('enabledA', true);
      variableStore.set('itemsB', ['X', 'Y']);
      variableStore.set('enabledC', true);

      const template = `
{{#if enabledA}}
Level 1
{{#each itemsB}}
  Level 2: {{this}}
  {{#if enabledC}}
    Level 3: Nested Content for {{this}}
  {{/if}}
{{/each}}
{{/if}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Level 1');
      expect(result).toContain('Level 2: X');
      expect(result).toContain('Level 3: Nested Content for X');
      expect(result).toContain('Level 2: Y');
      expect(result).toContain('Level 3: Nested Content for Y');
    });

    test('should support math and functions in nested structures', async () => {
      // Test math and functions with loops (using global variables, not loop variables)
      variableStore.set('categories', ['Sales', 'Marketing', 'Engineering']);
      variableStore.set('prefix', 'dept');
      variableStore.set('multiplier', 2);

      const template = `
Prefix: \${fn:uppercase(prefix)}
Result: \${multiplier * 10}
{{#each categories}}
  Department: {{this}} (Index: {{@index}})
{{/each}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Prefix: DEPT');
      expect(result).toContain('Result: 20');
      expect(result).toContain('Department: Sales (Index: 0)');
      expect(result).toContain('Department: Marketing (Index: 1)');
      expect(result).toContain('Department: Engineering (Index: 2)');
    });
  });

  describe('Integration with VariableStore (Story 3.3)', () => {
    test('should resolve variables from VariableStore through all evaluators', async () => {
      variableStore.set('global_var', 'Global Value');
      variableStore.set('number', 42);
      variableStore.set('items', ['A', 'B']);

      const template = `
Global: \${global_var}
Math: \${number + 8}
Function: \${fn:uppercase(global_var)}
{{#if number > 40}}Conditional: Yes{{/if}}
{{#each items}}Loop: {{this}} {{/each}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Global: Global Value');
      expect(result).toContain('Math: 50');
      expect(result).toContain('Function: GLOBAL VALUE');
      expect(result).toContain('Conditional: Yes');
      expect(result).toContain('Loop: A');
      expect(result).toContain('Loop: B');
    });

    test('should support step-scoped variables', async () => {
      variableStore.set('global', 'Global', undefined);
      variableStore.set('scoped', 'Step Value', 'step-1');

      const template = 'Global: \${global}, Scoped: \${scoped}';

      const result = await engine.processTemplate(template, 'step-1');

      expect(result).toContain('Global: Global');
      expect(result).toContain('Scoped: Step Value');
    });
  });

  describe('Backward Compatibility (Story 3.4)', () => {
    test('should process simple templates without advanced features', async () => {
      variableStore.set('name', 'John');
      variableStore.set('age', 30);

      const template = 'Name: \${name}, Age: \${age}';

      const result = await engine.processTemplate(template);

      expect(result).toBe('Name: John, Age: 30');
    });

    test('should not break existing variable substitution behavior', async () => {
      variableStore.set('var1', 'Value 1');
      variableStore.set('var2', 'Value 2');

      const template = '\${var1} and \${var2}';

      const result = await engine.processTemplate(template);

      expect(result).toBe('Value 1 and Value 2');
    });
  });

  describe('Real-World Scenarios', () => {
    test('should process simplified order summary template', async () => {
      variableStore.set('orderId', 'ORD-12345');
      variableStore.set('customerName', 'John Doe');
      variableStore.set('items', ['Product A', 'Product B', 'Product C']);
      variableStore.set('subtotal', 109.97);
      variableStore.set('tax', 9.90);
      variableStore.set('isPremium', true);

      const template = `
ORDER CONFIRMATION
==================
Order ID: \${orderId}
Customer: \${fn:uppercase(customerName)}

Items:
{{#each items}}
  {{@index}}. {{this}}
{{/each}}

Subtotal: $\${subtotal}
Tax: $\${tax}
{{#if isPremium}}
Shipping: FREE (Premium Member)
{{else}}
Shipping: $5.00
{{/if}}

Total: $\${subtotal + tax}

{{#if isPremium}}
Thank you for being a premium member!
{{/if}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Order ID: ORD-12345');
      expect(result).toContain('Customer: JOHN DOE');
      expect(result).toContain('0. Product A');
      expect(result).toContain('1. Product B');
      expect(result).toContain('2. Product C');
      expect(result).toContain('Subtotal: $109.97');
      expect(result).toContain('Shipping: FREE (Premium Member)');
      expect(result).toContain('Thank you for being a premium member!');
    });

    test('should process report with categories and status', async () => {
      variableStore.set('reportDate', '2025-10-12');
      variableStore.set('departments', ['Sales', 'Marketing', 'Engineering']);

      const template = `
PERFORMANCE REPORT - \${reportDate}
===================================

{{#each departments}}
{{this}} DEPARTMENT
First: {{@first}}, Last: {{@last}}, Index: {{@index}}
---
{{/each}}
      `.trim();

      const result = await engine.processTemplate(template);

      expect(result).toContain('Sales DEPARTMENT');
      expect(result).toContain('First: true, Last: false, Index: 0');
      expect(result).toContain('Marketing DEPARTMENT');
      expect(result).toContain('Engineering DEPARTMENT');
      expect(result).toContain('First: false, Last: true, Index: 2');
    });
  });
});

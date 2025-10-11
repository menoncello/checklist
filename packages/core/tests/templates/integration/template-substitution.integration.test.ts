/**
 * Integration Tests: Template Substitution System
 *
 * Tests end-to-end integration of:
 * - VariableStore (Story 3.3) → VariableSubstitutor (Story 3.4)
 * - Global and step-scoped variable resolution
 * - Full substitution workflow from VariableStore to output
 *
 * This addresses QA recommendation from traceability assessment:
 * - Coverage gap: No dedicated Story 3.4 integration test
 * - Priority: LOW (nice-to-have)
 * - Reference: docs/qa/assessments/3.4-trace-20251010.md
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { VariableStore } from '../../../src/variables/VariableStore';
import { VariableSubstitutor } from '../../../src/templates/VariableSubstitutor';
import type { SubstitutionConfig } from '../../../src/templates/substitution-types';

describe('Template Substitution Integration', () => {
  let variableStore: VariableStore;
  let substitutor: VariableSubstitutor;

  beforeEach(() => {
    variableStore = new VariableStore('/tmp/test-variables.yaml');
    const config: SubstitutionConfig = {
      maxNestingDepth: 5,
      allowUndefinedVariables: false,
      useDefaultValues: true,
      enableCaching: true,
      escapePattern: '\\',
    };
    substitutor = new VariableSubstitutor(variableStore, config);
  });

  describe('VariableStore → Substitution → Output Workflow', () => {
    it('should substitute variables from VariableStore', () => {
      // GIVEN: Variables stored in VariableStore
      variableStore.set('projectName', 'BMAD Checklist');
      variableStore.set('version', '1.0.0');
      variableStore.set('author', 'Dev Team');

      // WHEN: Template is substituted
      const template = 'Project: ${projectName} v${version} by ${author}';
      const result = substitutor.substitute(template);

      // THEN: Variables are correctly substituted from store
      expect(result.output).toBe('Project: BMAD Checklist v1.0.0 by Dev Team');
      expect(result.variablesUsed).toEqual(['projectName', 'version', 'author']);
      expect(result.errors).toHaveLength(0);
    });

    it('should handle type conversions from VariableStore', () => {
      // GIVEN: Variables of different types in store
      variableStore.set('name', 'Alice'); // string
      variableStore.set('age', 30); // number
      variableStore.set('active', true); // boolean
      variableStore.set('tags', ['typescript', 'bun', 'testing']); // array

      // WHEN: Template with mixed types is substituted
      const template = 'User: ${name}, Age: ${age}, Active: ${active}, Tags: ${tags}';
      const result = substitutor.substitute(template);

      // THEN: All types are correctly converted and substituted
      expect(result.output).toBe('User: Alice, Age: 30, Active: true, Tags: typescript, bun, testing');
      expect(result.errors).toHaveLength(0);
    });

    it('should track substitution metadata', () => {
      // GIVEN: Multiple variables in store
      variableStore.set('var1', 'value1');
      variableStore.set('var2', 'value2');
      variableStore.set('var3', 'value3');

      // WHEN: Substitution is performed
      const template = '${var1} ${var2} ${var3}';
      const result = substitutor.substitute(template);

      // THEN: Metadata is correctly tracked
      expect(result.metadata.variableCount).toBe(3);
      expect(result.metadata.nestingDepth).toBe(0);
      expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
      expect(result.metadata.duration).toBeLessThan(10); // Should be fast
    });
  });

  describe('Global vs Step-Scoped Variable Resolution', () => {
    it('should use global variables when no step context provided', () => {
      // GIVEN: Global variable in store
      variableStore.set('environment', 'production');

      // WHEN: Substitution without step context
      const template = 'Environment: ${environment}';
      const result = substitutor.substitute(template);

      // THEN: Global variable is used
      expect(result.output).toBe('Environment: production');
    });

    it('should use step-scoped variables when provided', () => {
      // GIVEN: Global and step-scoped variables
      variableStore.set('env', 'production'); // global
      variableStore.set('env', 'development', 'step-1'); // step-scoped

      // WHEN: Substitution with step context
      const resultGlobal = substitutor.substitute('Env: ${env}');
      const resultStep = substitutor.substitute('Env: ${env}', 'step-1');

      // THEN: Step-scoped variable overrides global
      expect(resultGlobal.output).toBe('Env: production');
      expect(resultStep.output).toBe('Env: development');
    });

    it('should fall back to global when step variable not found', () => {
      // GIVEN: Only global variable exists
      variableStore.set('fallback', 'global-value');

      // WHEN: Substitution with step context but no step-scoped var
      const result = substitutor.substitute('Value: ${fallback}', 'step-1');

      // THEN: Falls back to global variable
      expect(result.output).toBe('Value: global-value');
    });

    it('should resolve mixed global and step-scoped variables', () => {
      // GIVEN: Mix of global and step-scoped variables
      variableStore.set('globalVar', 'global');
      variableStore.set('stepVar', 'step-value', 'step-1');

      // WHEN: Template uses both variable types
      const template = 'Global: ${globalVar}, Step: ${stepVar}';
      const result = substitutor.substitute(template, 'step-1');

      // THEN: Both are correctly resolved
      expect(result.output).toBe('Global: global, Step: step-value');
    });
  });

  describe('Complex Integration Scenarios', () => {
    it('should handle nested variables with VariableStore', () => {
      // GIVEN: Variables for nested substitution
      variableStore.set('env', 'production');
      variableStore.set('production-host', 'api.prod.com');
      variableStore.set('production-port', 443);

      // WHEN: Nested substitution is performed
      const template = 'Host: ${${env}-host}, Port: ${${env}-port}';
      const result = substitutor.substitute(template);

      // THEN: Nested variables correctly resolved
      expect(result.output).toBe('Host: api.prod.com, Port: 443');
      expect(result.metadata.nestingDepth).toBe(1);
    });

    it('should handle default values with VariableStore', () => {
      // GIVEN: Some variables defined, others undefined
      variableStore.set('defined', 'value');
      // 'undefined' variable not set

      // WHEN: Template with defaults is substituted
      const template = 'Defined: ${defined}, Fallback: ${undefined:-default}';
      const result = substitutor.substitute(template);

      // THEN: Defined variable used, default for undefined
      expect(result.output).toBe('Defined: value, Fallback: default');
      expect(result.errors).toHaveLength(0); // No errors due to default
    });

    it('should handle escaped variables with VariableStore', () => {
      // GIVEN: Variable in store
      variableStore.set('name', 'Alice');

      // WHEN: Template has escaped and unescaped variables
      const template = 'Hello ${name}, use \\${variable} syntax';
      const result = substitutor.substitute(template);

      // THEN: Unescaped substituted, escaped preserved
      expect(result.output).toBe('Hello Alice, use ${variable} syntax');
    });

    it('should handle errors with VariableStore suggestions', () => {
      // GIVEN: Variables in store with similar names
      variableStore.set('userName', 'Alice');
      variableStore.set('userEmail', 'alice@example.com');
      variableStore.set('userId', '12345');

      // WHEN: Template has typo in variable name
      const template = 'Name: ${userNam}'; // Typo: missing 'e'
      const result = substitutor.substitute(template);

      // THEN: Error includes suggestion from VariableStore
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].variableName).toBe('userNam');
      expect(result.errors[0].suggestions).toContain('userName');
      expect(result.output).toBe('Name: ${userNam}'); // Original preserved
    });
  });

  describe('Performance Integration', () => {
    it('should maintain performance with VariableStore lookups', () => {
      // GIVEN: Large number of variables in store
      for (let i = 1; i <= 50; i++) {
        variableStore.set(`var${i}`, `value${i}`);
      }

      // WHEN: Template with many variables is substituted
      const vars = Array.from({ length: 50 }, (_, i) => `\${var${i + 1}}`).join(' ');
      const template = `Values: ${vars}`;

      const startTime = performance.now();
      const result = substitutor.substitute(template);
      const duration = performance.now() - startTime;

      // THEN: Performance meets <5ms target
      expect(result.errors).toHaveLength(0);
      expect(result.metadata.variableCount).toBe(50);
      expect(duration).toBeLessThan(5); // Critical AC8 requirement
    });

    it('should efficiently handle repeated VariableStore access', () => {
      // GIVEN: Variables in store
      variableStore.set('repeated', 'value');

      // WHEN: Variable used multiple times in template
      const template = Array(20).fill('${repeated}').join(' ');
      const startTime = performance.now();
      const result = substitutor.substitute(template);
      const duration = performance.now() - startTime;

      // THEN: Still performs efficiently
      expect(result.output.split(' ')).toHaveLength(20);
      expect(duration).toBeLessThan(5);
    });
  });

  describe('Error Handling Integration', () => {
    it('should collect multiple errors from VariableStore lookups', () => {
      // GIVEN: Some variables missing from store
      variableStore.set('defined', 'value');

      // WHEN: Template has multiple undefined variables
      const template = '${defined} ${missing1} ${missing2} ${missing3}';
      const result = substitutor.substitute(template);

      // THEN: All errors collected, defined variable still substituted
      expect(result.output).toContain('value'); // defined var works
      expect(result.output).toContain('${missing1}'); // preserved
      expect(result.errors).toHaveLength(3);
      expect(result.errors.map(e => e.variableName)).toEqual([
        'missing1',
        'missing2',
        'missing3',
      ]);
    });

    it('should handle VariableStore returning different types safely', () => {
      // GIVEN: Variables with edge case types
      variableStore.set('nan', NaN);
      variableStore.set('infinity', Infinity);
      variableStore.set('negInfinity', -Infinity);
      variableStore.set('zero', 0);
      variableStore.set('emptyString', '');
      variableStore.set('false', false);

      // WHEN: Template uses edge case values
      const template =
        'NaN: ${nan}, Inf: ${infinity}, -Inf: ${negInfinity}, Zero: ${zero}, Empty: "${emptyString}", False: ${false}';
      const result = substitutor.substitute(template);

      // THEN: All edge cases handled correctly
      expect(result.output).toBe(
        'NaN: NaN, Inf: Infinity, -Inf: -Infinity, Zero: 0, Empty: "", False: false'
      );
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('Real-World Workflow Simulation', () => {
    it('should handle realistic project configuration template', () => {
      // GIVEN: Realistic project configuration variables
      variableStore.set('projectName', 'My Project');
      variableStore.set('projectVersion', '2.1.0');
      variableStore.set('environment', 'staging');
      variableStore.set('apiUrl', 'https://api.staging.example.com');
      variableStore.set('dbHost', 'db.staging.internal');
      variableStore.set('timeout', 5000);
      variableStore.set('retries', 3);
      variableStore.set('debug', true);
      variableStore.set('tags', ['backend', 'api', 'critical']);

      // WHEN: Complex template is substituted
      const template = `
Project Configuration:
  Name: \${projectName}
  Version: \${projectVersion}
  Environment: \${environment}

API Settings:
  URL: \${apiUrl}
  Timeout: \${timeout}ms
  Retries: \${retries}
  Debug: \${debug}

Database:
  Host: \${dbHost}

Tags: \${tags}
      `.trim();

      const result = substitutor.substitute(template);

      // THEN: Complete workflow produces correct output
      expect(result.errors).toHaveLength(0);
      expect(result.output).toContain('Name: My Project');
      expect(result.output).toContain('Version: 2.1.0');
      expect(result.output).toContain('Environment: staging');
      expect(result.output).toContain('URL: https://api.staging.example.com');
      expect(result.output).toContain('Timeout: 5000ms');
      expect(result.output).toContain('Retries: 3');
      expect(result.output).toContain('Debug: true');
      expect(result.output).toContain('Host: db.staging.internal');
      expect(result.output).toContain('Tags: backend, api, critical');
    });

    it('should handle CI/CD pipeline template with scope resolution', () => {
      // GIVEN: Global and step-specific CI/CD variables
      variableStore.set('branch', 'main');
      variableStore.set('commit', 'abc123');

      // Step-specific variables
      variableStore.set('command', 'npm install', 'install-step');
      variableStore.set('command', 'npm test', 'test-step');
      variableStore.set('command', 'npm run build', 'build-step');

      // WHEN: Different steps use same template
      const template = 'Running: ${command} on ${branch} (${commit})';

      const installResult = substitutor.substitute(template, 'install-step');
      const testResult = substitutor.substitute(template, 'test-step');
      const buildResult = substitutor.substitute(template, 'build-step');

      // THEN: Each step resolves to correct command
      expect(installResult.output).toBe('Running: npm install on main (abc123)');
      expect(testResult.output).toBe('Running: npm test on main (abc123)');
      expect(buildResult.output).toBe('Running: npm run build on main (abc123)');
    });
  });
});

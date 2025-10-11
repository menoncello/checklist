/**
 * Performance Benchmark Tests for Variable Substitution (AC: 8)
 * Target: <5ms for typical templates (10-50 variables)
 */

import { bench, describe } from 'bun:test';
import { VariableSubstitutor } from '../../packages/core/src/templates/VariableSubstitutor';
import { VariableStore } from '../../packages/core/src/variables/VariableStore';
import { join } from 'path';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';

// Setup
const tempDir = mkdtempSync(join(tmpdir(), 'bench-sub-'));
const stateFile = join(tempDir, 'variables.yaml');
const variableStore = new VariableStore(stateFile);
const substitutor = new VariableSubstitutor(variableStore);

// Populate test data
for (let i = 1; i <= 100; i++) {
  variableStore.set(`var${i}`, `value${i}`);
}

describe('Variable Substitution Performance', () => {
  bench('Simple template (1-5 variables)', () => {
    const template = 'Hello ${var1}, you are user ${var2} from ${var3}';
    substitutor.substitute(template);
  });

  bench('Typical template (10-50 variables) - CRITICAL AC', () => {
    const vars = Array.from({ length: 30 }, (_, i) => `\${var${i + 1}}`);
    const template = vars.join(' ');
    substitutor.substitute(template);
  });

  bench('Complex template (50-100 variables)', () => {
    const vars = Array.from({ length: 75 }, (_, i) => `\${var${i + 1}}`);
    const template = vars.join(' ');
    substitutor.substitute(template);
  });

  bench('Nested variables (2 levels)', () => {
    variableStore.set('key', 'var5');
    const template = '\${var\${key}}';
    substitutor.substitute(template);
  });

  bench('Default values', () => {
    const template =
      '\${missing1:-default1} \${missing2:-default2} \${missing3:-default3}';
    substitutor.substitute(template);
  });

  bench('Escape sequences', () => {
    const template =
      '\${var1} \\${literal} \${var2} \\${another} \${var3}';
    substitutor.substitute(template);
  });
});

// Cleanup
rmSync(tempDir, { recursive: true, force: true });

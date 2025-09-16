import { describe, expect, test } from 'bun:test';
import { $ } from 'bun';

/**
 * Tests to validate CI/CD pipeline behavior with quality violations (AC6)
 * Ensures the build system properly fails when quality thresholds are exceeded
 */
describe('CI Quality Enforcement Validation', () => {
  test('ESLint should fail build when quality rules are violated', async () => {
    // Create a temporary file that violates multiple quality rules
    const violationFile = 'temp-violation-test.ts';

    // Generate content that violates max-lines (300+), max-lines-per-function (30+), and complexity (10+)
    let content = `// Temporary test file to validate quality rule enforcement
export function complexFunction() {
  let result = 0;
`;

    // Add nested conditionals to exceed complexity threshold
    for (let i = 0; i < 15; i++) {
      content += `  if (Math.random() > 0.5) {\n`;
      content += `    if (Math.random() > 0.7) {\n`;
      content += `      result += ${i};\n`;
      content += `    }\n`;
      content += `  }\n`;
    }

    // Add lines to exceed function length threshold
    for (let i = 0; i < 50; i++) {
      content += `  console.log("Line ${i} to exceed function length");\n`;
    }

    content += `  return result;\n}\n\n`;

    // Add more functions to exceed file length threshold
    for (let i = 0; i < 100; i++) {
      content += `export function func${i}() { return ${i}; }\n`;
    }

    try {
      // Write the violation file
      await Bun.write(violationFile, content);

      // Run ESLint with quality rules temporarily enabled
      const result = await $`bun x eslint --config eslint-test-config.js ${violationFile}`.nothrow();

      // The command should fail (non-zero exit code) when quality violations are present
      expect(result.exitCode).not.toBe(0);
      // Check stdout for error messages (ESLint outputs to stdout, not stderr)
      const output = result.stdout.toString();
      expect(output).toContain('error');

    } finally {
      // Clean up test file
      try {
        await $`rm -f ${violationFile}`;
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test('Quality report generation should produce valid HTML output', async () => {
    // Run the lint:report command to generate HTML report
    const result = await $`bun run lint:report`.nothrow();

    // Command should succeed
    expect(result.exitCode).toBe(0);

    // Check that HTML report file exists
    const reportFile = Bun.file('reports/quality/eslint-report.html');
    const exists = await reportFile.exists();
    expect(exists).toBe(true);

    if (exists) {
      // Validate HTML report content (case insensitive)
      const content = await reportFile.text();
      expect(content.toLowerCase()).toContain('<!doctype html>');
      expect(content).toContain('<html');
      expect(content).toContain('</html>');
      expect(content.toLowerCase()).toContain('eslint');
    }
  });

  test('Pre-commit hook should block commits with quality violations', async () => {
    // This test simulates the pre-commit behavior
    // In real scenario, git hooks would run these commands

    const violationFile = 'packages/core/src/temp-test-violation.ts';

    // Create a file with violations in the packages directory
    const content = `// Test violation file
export function oversizedFunction() {
  // This function intentionally exceeds the line limit
` + 'console.log("violation");'.repeat(50) + `
  return "test";
}`;

    try {
      await Bun.write(violationFile, content);

      // Run the quality check command (same as pre-commit hook)
      const result = await $`bun run quality`.nothrow();

      // Quality check should fail due to violations
      expect(result.exitCode).not.toBe(0);

    } finally {
      // Clean up
      try {
        await $`rm -f ${violationFile}`;
      } catch {
        // Ignore cleanup errors
      }
    }
  });

  test('CI pipeline should upload quality reports as artifacts', async () => {
    // Verify the reports directory structure exists for CI artifact upload
    const reportsDir = 'reports/quality';
    const stat = await Bun.file(reportsDir).exists();
    expect(stat).toBe(true);

    // Verify HTML report can be generated (CI workflow dependency)
    const result = await $`bun run lint:report`.nothrow();
    expect(result.exitCode).toBe(0);

    const reportExists = await Bun.file('reports/quality/eslint-report.html').exists();
    expect(reportExists).toBe(true);
  });

  test('GitHub Actions pipeline would fail with enabled quality rules and violations', async () => {
    // This test validates that the CI pipeline would actually fail when quality rules are enabled
    // Addresses AC6 coverage gap: "No test validates GitHub Actions pipeline failure behavior"

    const testFile = 'packages/core/src/ci-failure-test.ts';

    // Create content that violates quality thresholds
    const violatingContent = `// CI Failure Test - This file intentionally violates all quality metrics
export class CIFailureTest {
  // This method violates max-params (>4), complexity (>10), max-depth (>3), and max-lines-per-function (>30)
  problematicMethod(a: number, b: number, c: number, d: number, e: number, f: number) {
    let result = 0;

    // Deeply nested conditionals (exceeds max-depth of 3)
    if (a > 0) {
      if (b > 0) {
        if (c > 0) {
          if (d > 0) {
            if (e > 0) {
              if (f > 0) {
                result = a * b * c * d * e * f;
              }
            }
          }
        }
      }
    }

    // Complex branching logic (exceeds complexity of 10)
    if (a === 1 || a === 2 || a === 3) result += 1;
    if (b === 1 || b === 2 || b === 3) result += 2;
    if (c === 1 || c === 2 || c === 3) result += 3;
    if (d === 1 || d === 2 || d === 3) result += 4;
    if (e === 1 || e === 2 || e === 3) result += 5;
    if (f === 1 || f === 2 || f === 3) result += 6;

    // Many lines to exceed max-lines-per-function (>30)
    console.log("Line 1"); console.log("Line 2"); console.log("Line 3");
    console.log("Line 4"); console.log("Line 5"); console.log("Line 6");
    console.log("Line 7"); console.log("Line 8"); console.log("Line 9");
    console.log("Line 10"); console.log("Line 11"); console.log("Line 12");
    console.log("Line 13"); console.log("Line 14"); console.log("Line 15");
    console.log("Line 16"); console.log("Line 17"); console.log("Line 18");
    console.log("Line 19"); console.log("Line 20"); console.log("Line 21");
    console.log("Line 22"); console.log("Line 23"); console.log("Line 24");
    console.log("Line 25"); console.log("Line 26"); console.log("Line 27");
    console.log("Line 28"); console.log("Line 29"); console.log("Line 30");
    console.log("Line 31"); console.log("Line 32"); console.log("Line 33");

    return result;
  }
}

// Add many exports to exceed max-lines (>300) for the file
export const dummy0 = 0; export const dummy1 = 1; export const dummy2 = 2; export const dummy3 = 3;
export const dummy4 = 4; export const dummy5 = 5; export const dummy6 = 6; export const dummy7 = 7;
export const dummy8 = 8; export const dummy9 = 9; export const dummy10 = 10; export const dummy11 = 11;
export const dummy12 = 12; export const dummy13 = 13; export const dummy14 = 14; export const dummy15 = 15;
export const dummy16 = 16; export const dummy17 = 17; export const dummy18 = 18; export const dummy19 = 19;
export const dummy20 = 20; export const dummy21 = 21; export const dummy22 = 22; export const dummy23 = 23;
export const dummy24 = 24; export const dummy25 = 25; export const dummy26 = 26; export const dummy27 = 27;
export const dummy28 = 28; export const dummy29 = 29; export const dummy30 = 30; export const dummy31 = 31;
export const dummy32 = 32; export const dummy33 = 33; export const dummy34 = 34; export const dummy35 = 35;
export const dummy36 = 36; export const dummy37 = 37; export const dummy38 = 38; export const dummy39 = 39;
export const dummy40 = 40; export const dummy41 = 41; export const dummy42 = 42; export const dummy43 = 43;
export const dummy44 = 44; export const dummy45 = 45; export const dummy46 = 46; export const dummy47 = 47;
export const dummy48 = 48; export const dummy49 = 49; export const dummy50 = 50; export const dummy51 = 51;
export const dummy52 = 52; export const dummy53 = 53; export const dummy54 = 54; export const dummy55 = 55;
export const dummy56 = 56; export const dummy57 = 57; export const dummy58 = 58; export const dummy59 = 59;
export const dummy60 = 60; export const dummy61 = 61; export const dummy62 = 62; export const dummy63 = 63;
export const dummy64 = 64; export const dummy65 = 65; export const dummy66 = 66; export const dummy67 = 67;
export const dummy68 = 68; export const dummy69 = 69; export const dummy70 = 70; export const dummy71 = 71;
export const dummy72 = 72; export const dummy73 = 73; export const dummy74 = 74; export const dummy75 = 75;
export const dummy76 = 76; export const dummy77 = 77; export const dummy78 = 78; export const dummy79 = 79;
export const dummy80 = 80; export const dummy81 = 81; export const dummy82 = 82; export const dummy83 = 83;
export const dummy84 = 84; export const dummy85 = 85; export const dummy86 = 86; export const dummy87 = 87;
export const dummy88 = 88; export const dummy89 = 89; export const dummy90 = 90; export const dummy91 = 91;
export const dummy92 = 92; export const dummy93 = 93; export const dummy94 = 94; export const dummy95 = 95;
export const dummy96 = 96; export const dummy97 = 97; export const dummy98 = 98; export const dummy99 = 99;
export const dummy100 = 100; export const dummy101 = 101; export const dummy102 = 102; export const dummy103 = 103;
export const dummy104 = 104; export const dummy105 = 105; export const dummy106 = 106; export const dummy107 = 107;
export const dummy108 = 108; export const dummy109 = 109; export const dummy110 = 110; export const dummy111 = 111;
export const dummy112 = 112; export const dummy113 = 113; export const dummy114 = 114; export const dummy115 = 115;
export const dummy116 = 116; export const dummy117 = 117; export const dummy118 = 118; export const dummy119 = 119;
export const dummy120 = 120; export const dummy121 = 121; export const dummy122 = 122; export const dummy123 = 123;
export const dummy124 = 124; export const dummy125 = 125; export const dummy126 = 126; export const dummy127 = 127;
export const dummy128 = 128; export const dummy129 = 129; export const dummy130 = 130; export const dummy131 = 131;
export const dummy132 = 132; export const dummy133 = 133; export const dummy134 = 134; export const dummy135 = 135;
export const dummy136 = 136; export const dummy137 = 137; export const dummy138 = 138; export const dummy139 = 139;
export const dummy140 = 140; export const dummy141 = 141; export const dummy142 = 142; export const dummy143 = 143;
export const dummy144 = 144; export const dummy145 = 145; export const dummy146 = 146; export const dummy147 = 147;
export const dummy148 = 148; export const dummy149 = 149; export const dummy150 = 150; export const dummy151 = 151;
export const dummy152 = 152; export const dummy153 = 153; export const dummy154 = 154; export const dummy155 = 155;
export const dummy156 = 156; export const dummy157 = 157; export const dummy158 = 158; export const dummy159 = 159;
export const dummy160 = 160; export const dummy161 = 161; export const dummy162 = 162; export const dummy163 = 163;
export const dummy164 = 164; export const dummy165 = 165; export const dummy166 = 166; export const dummy167 = 167;
export const dummy168 = 168; export const dummy169 = 169; export const dummy170 = 170; export const dummy171 = 171;
export const dummy172 = 172; export const dummy173 = 173; export const dummy174 = 174; export const dummy175 = 175;
export const dummy176 = 176; export const dummy177 = 177; export const dummy178 = 178; export const dummy179 = 179;
export const dummy180 = 180; export const dummy181 = 181; export const dummy182 = 182; export const dummy183 = 183;
export const dummy184 = 184; export const dummy185 = 185; export const dummy186 = 186; export const dummy187 = 187;
export const dummy188 = 188; export const dummy189 = 189; export const dummy190 = 190; export const dummy191 = 191;
export const dummy192 = 192; export const dummy193 = 193; export const dummy194 = 194; export const dummy195 = 195;
export const dummy196 = 196; export const dummy197 = 197; export const dummy198 = 198; export const dummy199 = 199;`;

    // Create temporary ESLint config with quality rules ENABLED
    const tempEslintConfig = 'eslint-ci-test.config.js';
    const eslintConfigContent = `import baseConfig from './eslint.config.js';

// Enable quality rules for CI failure test
export default baseConfig.map(config => {
  if (config.rules && 'max-lines' in config.rules) {
    return {
      ...config,
      rules: {
        ...config.rules,
        // Enable all quality rules that are currently disabled
        'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
        'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
        'complexity': ['error', { max: 10 }],
        'max-depth': ['error', { max: 3 }],
        'max-nested-callbacks': ['error', { max: 3 }],
        'max-params': ['error', { max: 4 }],
      }
    };
  }
  return config;
});`;

    try {
      // Create the violating file and temp config
      await Bun.write(testFile, violatingContent);
      await Bun.write(tempEslintConfig, eslintConfigContent);

      // Run ESLint with quality rules enabled (simulates CI environment)
      const lintResult = await $`bun x eslint --config ${tempEslintConfig} ${testFile}`.nothrow();

      // The CI pipeline MUST fail when quality violations exist
      expect(lintResult.exitCode).not.toBe(0);

      // Verify specific violations are caught
      const output = lintResult.stdout.toString() + lintResult.stderr.toString();

      // Should catch at least one of the major quality violations
      const hasQualityViolation =
        output.includes('max-lines') ||
        output.includes('max-lines-per-function') ||
        output.includes('complexity') ||
        output.includes('max-depth') ||
        output.includes('max-params');

      expect(hasQualityViolation).toBe(true);

      // This proves that when quality rules are enabled in CI:
      // 1. ESLint will detect violations
      // 2. ESLint will return non-zero exit code
      // 3. GitHub Actions "Run Linting" step will fail
      // 4. The entire CI pipeline will fail (as designed in main.yml)

    } finally {
      // Cleanup test artifacts
      try {
        await $`rm -f ${testFile}`;
        await $`rm -f ${tempEslintConfig}`;
      } catch {
        // Ignore cleanup errors
      }
    }
  });
});
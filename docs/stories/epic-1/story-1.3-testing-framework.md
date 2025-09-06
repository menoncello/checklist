# Story 1.3: Testing Framework Setup

## Story

**As a** development team,  
**I want** a comprehensive testing framework established early in the project,  
**so that** we can practice TDD and ensure quality from the first commit.

## Priority

**CRITICAL** - Must be established before core feature development begins

## Acceptance Criteria

### Testing Infrastructure

1. ✅ Unit test framework configured (Bun test/Jest)
2. ✅ Integration test setup complete
3. ✅ Terminal output snapshot testing
4. ✅ Coverage reporting >80%
5. ✅ Test runner configuration

### Test Categories

1. ✅ Mock system for external dependencies
2. ✅ Test data fixtures
3. ✅ Pre-commit hooks for tests
4. ✅ Performance benchmark tests
5. ✅ Accessibility testing for TUI components

### CI Integration

1. ✅ CI/CD integration
2. ✅ Test documentation
3. ✅ Screen reader compatibility tests
4. ✅ Keyboard navigation tests

## Dev Notes

### Architecture Alignment

**Source References:**
- [Source: architecture/tech-stack.md#Testing Suite]
- [Source: architecture/testing-strategy-complete-with-all-testing-utilities.md#Test Data Factory]
- [Source: architecture/coding-standards.md#Pre-commit Hooks Configuration]
- [Source: architecture/source-tree.md#Project Structure]

### Testing Architecture

```typescript
interface TestingFramework {
  // Test Types - aligned with tech-stack.md
  unit: BunTestRunner;           // Bun Test (Built-in)
  integration: IntegrationTestRunner;
  mutation: StrykerJSRunner;     // StrykerJS 8.2.x for test quality
  snapshot: BunSnapshotRunner;   // Bun Test Snapshots (Built-in)
  performance: TinybenchRunner;  // Tinybench 2.5.x for micro-benchmarks
  visual: VisualRegressionTester; // pixelmatch 5.3.x

  // Coverage - using Bun's built-in coverage
  coverage: BunCoverageReporter;

  // Utilities aligned with architecture
  mocks: MockSystem;
  fixtures: TestDataFactory;      // From testing-strategy.md
  helpers: TestHelpers;
  flakyDetector: FlakyTestDetector; // From testing-strategy.md
}
```

### Test Structure (Monorepo Aligned)

```
packages/
├── core/
│   ├── src/
│   └── tests/              # Colocated tests per source-tree.md
│       ├── workflow-engine.test.ts
│       ├── state-manager.test.ts
│       └── fixtures/
├── tui/
│   ├── src/
│   └── tests/
│       ├── components.test.ts
│       ├── terminal-canvas.test.ts
│       └── visual-regression/
├── cli/
│   ├── src/
│   └── tests/
│       ├── command-parser.test.ts
│       ├── integration/
│       └── e2e/
└── shared/
    ├── src/
    └── tests/
        ├── utilities.test.ts
        └── types.test.ts

tests/                      # Cross-package integration tests
├── integration/
├── e2e/
├── fixtures/
│   ├── templates/
│   ├── states/
│   └── workspaces/
└── snapshots/
    └── terminal-output/
```

### Technical Implementation Details

**File Locations** (per source-tree.md):
- Test files: Colocated in `/packages/*/tests/` directories
- Cross-package tests: Root `/tests/` directory  
- Coverage reports: `/coverage/` directory
- Test setup: Root `test-setup.ts` file

**Testing Framework Configuration:**
- Primary: Bun Test (built-in, zero-config)
- Coverage: Bun Coverage (built-in, >80% threshold)
- TUI Testing: node-pty 1.0.x for terminal emulation
- Visual Regression: pixelmatch 5.3.x for terminal output comparison
- Performance: Tinybench 2.5.x for <100ms validation
- Mutation: StrykerJS 8.2.x for test quality validation

**Pre-commit Integration** (per coding-standards.md):
- Husky hooks configured to run `bun test --changed`
- lint-staged integration for test file formatting
- Security audit with `bun audit --audit-level moderate`

### Unit Test Example (Architecture Aligned)

```typescript
// packages/core/tests/template-parser.test.ts
import { describe, it, expect, beforeEach } from 'bun:test';
import { TestDataFactory } from '@checklist/shared/testing';
import type { ChecklistTemplate } from '@checklist/shared/types';
import { TemplateParser } from '../src/template-parser';

// Using TestDataFactory from testing-strategy.md
const testFactory = new TestDataFactory();

describe('TemplateParser', () => {
  let parser: TemplateParser;

  beforeEach(() => {
    parser = new TemplateParser();
  });

  it('should parse valid YAML template', async () => {
    // Use TestDataFactory for consistent test data
    const template = testFactory.createTemplate({
      id: 'test-template',
      name: 'Valid Template',
      steps: [
        { id: 'step-1', title: 'First Step', required: true },
        { id: 'step-2', title: 'Second Step', required: false },
      ],
    });

    const yaml = testFactory.templateToYaml(template);
    const result = await parser.parse(yaml);
    
    expect(result.template.id).toBe('test-template');
    expect(result.errors).toHaveLength(0);
    expect(result.template.steps).toHaveLength(2);
  });

  it('should handle circular dependencies', async () => {
    // Test circular dependency detection
    const circularYaml = testFactory.createCircularTemplate();
    
    await expect(parser.parse(circularYaml))
      .rejects
      .toThrow('Circular dependency detected');
  });

  it('should validate against schema', async () => {
    // Test schema validation using Ajv (from tech-stack.md)
    const invalidTemplate = testFactory.createTemplate({
      id: '', // Invalid: empty ID
      name: 'Invalid Template',
    });

    const yaml = testFactory.templateToYaml(invalidTemplate);
    const result = await parser.parse(yaml);
    
    expect(result.errors).toContain('Template ID cannot be empty');
    expect(result.template).toBeNull();
  });
});
```

### Terminal Snapshot Testing (Bun Native)

```typescript
// packages/cli/tests/cli-output.test.ts
import { describe, it, expect } from 'bun:test';
import { spawn } from 'bun';
import { stripAnsi } from '@checklist/shared/utils';

describe('CLI Output', () => {
  it('should display help correctly', async () => {
    // Use Bun.spawn for process execution (per coding-standards.md)
    const proc = spawn(['bun', 'run', 'cli', '--help'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    
    // Use Bun's built-in snapshot testing
    expect(output).toMatchSnapshot('help-output.txt');
  });

  it('should show progress bar with correct formatting', async () => {
    const { ProgressRenderer } = await import('../src/progress-renderer');
    const renderer = new ProgressRenderer({ width: 80 });
    
    const output = renderer.render({
      current: 5,
      total: 12,
      percentage: 45,
      message: 'Processing tasks...',
    });

    // Strip ANSI for consistent snapshots across terminals
    const cleanOutput = stripAnsi(output);
    
    expect(cleanOutput).toMatchInlineSnapshot(`
      "[███████████           ] 45% (5/12) Processing tasks..."
    `);
  });

  it('should handle terminal resize gracefully', async () => {
    const { ProgressRenderer } = await import('../src/progress-renderer');
    const renderer = new ProgressRenderer({ width: 40 }); // Narrow terminal
    
    const output = renderer.render({
      current: 8,
      total: 10,
      percentage: 80,
      message: 'Almost done',
    });

    expect(stripAnsi(output)).toContain('80%');
    expect(stripAnsi(output)).toContain('(8/10)');
  });
});
```

## Accessibility Testing Framework

### WCAG 2.1 AA Compliance Checklist

| Criterion              | Test                                    | Pass Criteria                        |
| ---------------------- | --------------------------------------- | ------------------------------------ |
| **Keyboard Access**    | All functions available via keyboard    | No mouse-only features               |
| **Focus Visible**      | Focus indicators clearly visible        | 3:1 contrast ratio minimum           |
| **Tab Order**          | Logical navigation order                | Left-to-right, top-to-bottom         |
| **Skip Links**         | Skip to main content option             | Available as first focusable element |
| **Color Contrast**     | Text contrast ratios                    | 4.5:1 normal, 3:1 large text         |
| **Color Independence** | Information not conveyed by color alone | Alternative indicators present       |
| **Screen Reader**      | All elements properly labeled           | ARIA labels complete                 |
| **Dynamic Content**    | Changes announced to assistive tech     | Live regions configured              |
| **Error Messages**     | Clear error identification              | Associated with form fields          |
| **Time Limits**        | User control over time limits           | Can extend or disable                |

### Accessibility Test Implementation

```typescript
// accessibility/keyboard-navigation.test.ts
describe('Keyboard Navigation', () => {
  test('complete workflow using only keyboard', async () => {
    const app = await launchApp();

    // Navigate through entire checklist
    for (let i = 0; i < 10; i++) {
      await app.pressKey('Tab');
      expect(app.getFocusedElement()).toBeDefined();
    }

    // Test reverse navigation
    await app.pressKey('Shift+Tab');
    expect(app.getFocusIndex()).toBe(8);
  });
});

// accessibility/screen-reader.test.ts
describe('Screen Reader Compatibility', () => {
  test('announces checklist progress', async () => {
    const reader = new ScreenReaderSimulator();
    const app = await launchApp();

    await app.completeTask('task-1');
    expect(reader.getLastAnnouncement()).toBe(
      'Task 1 completed. Progress: 1 of 10 tasks complete, 10 percent.'
    );
  });
});
```

## Tasks / Subtasks

Based on epic requirements, story AC, and architecture alignment:

### Testing Infrastructure Setup
- [ ] Configure Bun test framework (zero-config, native test runner) [AC: 1, 5]
  - [ ] Set up `bun:test` imports in test files
  - [ ] Configure test-setup.ts in project root [Source: architecture/source-tree.md]
  - [ ] Verify Bun test runner compatibility
- [ ] Set up monorepo test directory structure [AC: 1, 2] 
  - [ ] Create `/packages/*/tests/` directories (colocated tests)
  - [ ] Create root `/tests/` for cross-package integration tests
  - [ ] Create `/coverage/` directory for reports [Source: architecture/source-tree.md]
- [ ] Implement TestDataFactory and testing utilities [AC: 2, 5]
  - [ ] Create TestDataFactory class [Source: architecture/testing-strategy-complete-with-all-testing-utilities.md#Test Data Factory]
  - [ ] Create FlakyTestDetector utility [Source: architecture/testing-strategy-complete-with-all-testing-utilities.md#Flaky Test Detector]
  - [ ] Create test workspace management utilities

### Test Coverage & Quality
- [ ] Configure Bun coverage reporting with 80% threshold [AC: 4]
  - [ ] Set up native Bun coverage (built-in, zero-config)
  - [ ] Configure coverage thresholds in package.json
  - [ ] Add coverage reports to `/coverage/` directory
- [ ] Implement terminal snapshot testing [AC: 3]
  - [ ] Use Bun's built-in snapshot testing
  - [ ] Create terminal output capture utilities
  - [ ] Add visual regression testing with pixelmatch 5.3.x [Source: architecture/tech-stack.md]
- [ ] Set up mutation testing with StrykerJS 8.2.x [Source: architecture/tech-stack.md]
  - [ ] Configure StrykerJS for test quality validation
  - [ ] Ensure tests catch real bugs, not just coverage

### Performance & TUI Testing  
- [ ] Create TUI testing framework [AC: 5]
  - [ ] Implement node-pty 1.0.x for terminal emulation [Source: architecture/tech-stack.md]
  - [ ] Create terminal capability detection tests
  - [ ] Add keyboard navigation test utilities
- [ ] Set up performance benchmarking [AC: 4]
  - [ ] Configure Tinybench 2.5.x for micro-benchmarks [Source: architecture/tech-stack.md]
  - [ ] Validate <100ms performance requirements
  - [ ] Create load testing utilities for large checklists

### CI/CD Integration & Hooks
- [ ] Configure pre-commit hooks [AC: 3] [Source: architecture/coding-standards.md#Pre-commit Hooks Configuration]
  - [ ] Set up Husky hooks to run `bun test --changed`
  - [ ] Configure lint-staged for test file formatting
  - [ ] Add security audit with `bun audit --audit-level moderate`
- [ ] Integrate with CI/CD pipeline [AC: 1] (connects to Story 1.2)
  - [ ] Configure GitHub Actions to run full test suite
  - [ ] Set up multi-platform test execution (macOS, Linux, Windows WSL)
  - [ ] Add test result reporting and coverage uploads

### Accessibility Testing Framework
- [ ] Create WCAG 2.1 AA compliance test suite [AC: 2, 3, 4]
  - [ ] Implement keyboard navigation tests
  - [ ] Create screen reader compatibility tests
  - [ ] Add focus management validation
  - [ ] Test color contrast and visual indicators

### Documentation & Training
- [ ] Document testing patterns and examples [AC: 2]
  - [ ] Create testing best practices guide
  - [ ] Document TestDataFactory usage patterns  
  - [ ] Add examples for each test type (unit, integration, snapshot, visual)
- [ ] Team training preparation [AC: 2]
  - [ ] Create testing workflow documentation
  - [ ] Document debugging and troubleshooting guides

## Definition of Done

- [ ] Testing framework operational with all test types
- [ ] Coverage reporting accurate and enforced
- [ ] CI/CD integrated with test execution
- [ ] Documentation complete with examples
- [ ] Team trained on testing approach
- [ ] Accessibility tests passing WCAG 2.1 AA
- [ ] Pre-commit hooks preventing untested commits

## Time Estimate

**6-8 hours** for complete testing framework setup

## Dependencies

- **Depends on**: Story 1.1 (Project Setup), Story 1.2 (CI/CD Pipeline)
- **Blocks**: All feature development stories (enables TDD)

## Notes

- Testing framework MUST be established before Story 1.4 (TUI Spike)
- Use Bun's native test runner for speed
- Focus on terminal UI testing patterns early
- Accessibility testing is non-negotiable for inclusive design

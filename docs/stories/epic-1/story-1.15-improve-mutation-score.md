# Story 1.15: Improve Mutation Testing Score

## Status
Draft

## Story
**As a** quality engineer,  
**I want** improved mutation testing score above 90%,  
**So that** our test suite reliably catches potential bugs and regressions.

## Acceptance Criteria
1. Mutation score increased to >90% (from current 85% threshold)
2. Weak test assertions identified and strengthened
3. New test cases added to kill surviving mutants
4. Existing StrykerJS configuration (stryker.conf.js) continues to work
5. New tests follow existing testing patterns
6. Integration with Bun test runner maintains current behavior
7. All new assertions are meaningful (not just to kill mutants)
8. Test readability and maintainability preserved
9. Mutation report shows clear improvement in reports/mutation/

## Tasks / Subtasks

- [ ] **Task 1: Analyze Current Mutation Report** (AC: 1, 2)
  - [ ] Run StrykerJS using existing configuration: `npx stryker run`
  - [ ] Open mutation report at reports/mutation/index.html
  - [ ] Identify surviving mutants by category (String Literal, Boolean, Arithmetic, etc.)
  - [ ] Document weak test areas by package (core, tui, cli, shared)
  - [ ] Create prioritized list based on mutant count and criticality
  - [ ] Focus on core package first (target: 95% mutation score)

- [ ] **Task 2: Strengthen Core Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/core/tests/*.test.ts for weak assertions
  - [ ] Replace truthy/falsy checks with exact value assertions
  - [ ] Add boundary condition tests (null, undefined, empty arrays, zero values)
  - [ ] Test error handling paths with specific error types and messages
  - [ ] Verify all conditional branches are covered (if-else, switch, ternary)
  - [ ] Use TestDataFactory from utils/test-factory.ts for consistent test data
  - [ ] Ensure tests use mocks to maintain <500ms execution time
  - [ ] Target 95% mutation score for core package

- [ ] **Task 3: Improve TUI Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/tui/tests/views/*.test.ts and tests/framework/*.test.ts
  - [ ] Add tests for terminal capability detection edge cases
  - [ ] Test ANSI escape sequence generation with exact string assertions
  - [ ] Validate error boundaries and crash recovery paths
  - [ ] Test resize event handling with various terminal dimensions
  - [ ] Add visual regression tests using pixelmatch for rendering accuracy
  - [ ] Use node-pty for realistic terminal emulation in complex scenarios
  - [ ] Ensure differential rendering logic is thoroughly tested
  - [ ] Target 90% mutation score for TUI package

- [ ] **Task 4: Enhance CLI Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/cli/tests/*.test.ts for command handling
  - [ ] Test Bun.argv parsing with malformed inputs
  - [ ] Add tests for all command validation failures
  - [ ] Verify exact error messages and exit codes
  - [ ] Test command aliases and shortcuts
  - [ ] Add tests for help text generation
  - [ ] Use CommandCache from utils/command-cache.ts to speed up CLI tests
  - [ ] Test concurrent command execution scenarios
  - [ ] Target 90% mutation score for CLI package

- [ ] **Task 5: Update Shared Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/shared/tests/*.test.ts utilities
  - [ ] Add strict type validation tests with TypeScript guards
  - [ ] Test utility functions with edge cases (empty inputs, max values)
  - [ ] Verify schema validation with Ajv for malformed data
  - [ ] Test async utilities with timeout and cancellation scenarios
  - [ ] Add tests for resource cleanup and disposal patterns
  - [ ] Use FastTimers from utils/fast-timers.ts for time-based tests
  - [ ] Target 90% mutation score for shared package

- [ ] **Task 6: Validate Improvements** (AC: 1, 4, 6, 9)
  - [ ] Run StrykerJS with updated tests: `npx stryker run`
  - [ ] Verify overall mutation score >90% (check console output)
  - [ ] Verify individual package scores meet targets:
    - Core: 95%+
    - TUI: 90%+
    - CLI: 90%+
    - Shared: 90%+
  - [ ] Update stryker.conf.js threshold.break from 85 to 90
  - [ ] Ensure all tests still pass with Bun: `bun test`
  - [ ] Verify test execution time <500ms per test
  - [ ] Generate final HTML report in reports/mutation/index.html
  - [ ] Update dashboard configuration with new baseline
  - [ ] Commit .stryker-tmp/incremental.json for faster future runs

- [ ] **Task 7: Maintain Test Quality** (AC: 5, 8)
  - [ ] Review test readability - ensure clear test names and intentions
  - [ ] Verify tests follow existing patterns:
    - describe/it blocks structure
    - Given-When-Then format for complex tests
    - Consistent use of test utilities
  - [ ] Add JSDoc comments for complex test scenarios
  - [ ] Run quality checks: `bun run quality`
  - [ ] Fix any ESLint issues: `bun run lint:fix`
  - [ ] Ensure proper TypeScript types (no any without justification)
  - [ ] Verify no performance regression:
    - Run benchmarks: `bun run bench`
    - Check test suite execution time
    - Confirm <500ms per test maintained
  - [ ] Update test documentation if new patterns introduced

## Dev Notes

### Previous Story Insights
**From Story 1.14 (Performance Tuning):**
- Implemented TestDataFactory for fast test data generation with mocks
- Created CommandCache utility to cache command outputs for faster tests
- Implemented FastTimers utility for accelerated timer operations in tests
- Configured global 500ms timeout for all tests via bunfig.toml
- All unit tests optimized to <500ms using mock infrastructure
- Fixed performance test issues by using mock loggers instead of real I/O
- Removed console.log statements from tests that were causing output pollution
[Source: Story 1.14 Dev Agent Record]

### Testing Standards
- Tests must be placed in packages/*/tests/ directories
- Use Bun test runner (built-in) with native assertions
- Follow existing test patterns and naming conventions
- Maintain test execution speed <100ms per test (500ms max per bunfig.toml)
- Use test doubles (mocks/stubs) to replace I/O operations
- Implement efficient test data factories for performance
- Enable parallel test execution where possible
[Source: architecture/testing-strategy.md#unit-test-performance-strategy]

### StrykerJS Configuration
**Current Configuration in stryker.conf.js:**
```javascript
module.exports = {
  packageManager: 'npm',  // Required for StrykerJS
  testRunner: 'command',   // Use command runner for Bun
  commandRunner: {
    command: 'bun test --bail --coverage'  // Execute Bun directly
  },
  mutate: ['packages/*/src/**/*.ts', '!**/*.test.ts', '!**/*.spec.ts'],
  thresholds: {
    high: 95,
    low: 90,
    break: 85 // Fail CI if below 85%
  },
  dashboard: {
    project: 'github.com/your-org/checklist',
    version: 'main',
    module: 'checklist-core'
  },
  reporters: ['html', 'json', 'progress', 'dashboard'],
  htmlReporter: {
    fileName: 'reports/mutation/index.html'
  },
  incremental: true,
  incrementalFile: '.stryker-tmp/incremental.json',
  tempDirName: '.stryker-tmp',
  timeoutMS: 60000,
  concurrency: 4,
  disableTypeChecks: false
};
```
[Source: architecture/testing-strategy.md#strykerjs-configuration]

### Mutation Testing Workflow
1. **Initial Analysis**: Run StrykerJS to establish baseline (currently at 85% threshold)
2. **Gap Identification**: Review surviving mutants report in reports/mutation/index.html
3. **Test Enhancement**: Add tests targeting surviving mutants with meaningful assertions
4. **Continuous Monitoring**: Track mutation score trends via dashboard reporter
[Source: architecture/testing-strategy.md#mutation-testing-workflow]

### Mutation Score Requirements
- **Current Minimum Threshold**: 85% mutation score (configured in stryker.conf.js)
- **Target Goal**: >90% for this story (will update threshold.break to 90)
- **Critical Modules Target**: 95% for core package
- **CI Integration**: Automatic failure below threshold via stryker.conf.js
[Source: architecture/testing-strategy.md#mutation-score-requirements]

### Test Optimization Utilities (Available from Story 1.14)
**Test Data Factory (packages/core/tests/utils/test-factory.ts):**
- Use TestDataFactory.createTemplate() for test templates
- Use TestDataFactory.createTestWorkspace() for isolated test environments
- Implements efficient counter-based ID generation
[Source: architecture/testing-strategy.md#test-data-factory]

**Command Cache (packages/core/tests/utils/command-cache.ts):**
- Caches command outputs to avoid process spawning
- Significantly reduces test execution time

**Fast Timers (packages/core/tests/utils/fast-timers.ts):**
- Accelerated timer operations for time-based tests
- Prevents timeout issues in time-sensitive tests

### Coding Standards for Tests
**ESLint Rules (Enforced):**
- No console.log in tests (use debug logger instead)
- No unused imports or variables
- Prefer const over let/var
- Use Bun.env instead of process.env
[Source: architecture/coding-standards.md#eslint-configuration-rules]

**Quality Checks (Must Pass):**
```bash
bun run lint          # ESLint check
bun run typecheck     # TypeScript type checking
bun run test          # Run all tests
bun run quality       # Run all quality checks
```
[Source: architecture/coding-standards.md#package-json-lint-scripts]

### Project Structure for Tests
```
packages/
├── core/
│   ├── src/                    # Source code to test
│   │   ├── index.ts
│   │   └── utils/
│   │       └── logger.ts       # Pino logger factory
│   └── tests/                  # Test files location
│       ├── index.test.ts
│       ├── env-validation.test.ts
│       ├── setup-validation.test.ts
│       ├── performance.bench.ts
│       └── utils/
│           ├── test-factory.ts
│           ├── command-cache.ts
│           └── fast-timers.ts
├── tui/
│   ├── src/                    # TUI source code
│   └── tests/                  # TUI test files
│       ├── views/              # View system tests
│       └── framework/          # Framework tests
├── cli/
│   ├── src/                    # CLI source code
│   └── tests/                  # CLI test files
└── shared/
    ├── src/                    # Shared utilities
    └── tests/                  # Shared tests
```
[Source: architecture/source-tree.md#project-structure]

### Mutation Testing Strategy (Enhanced)
1. **Focus Areas for High Impact:**
   - Boundary conditions and edge cases (null, undefined, empty arrays)
   - Error handling paths (try-catch blocks, error callbacks)
   - Conditional branches (if-else, switch statements, ternary operators)
   - Loop conditions (for, while, array methods)
   - Type validations and guards
   - Async operation error cases
   
2. **Test Assertion Patterns to Kill Mutants:**
   - Use exact value assertions instead of truthy/falsy
   - Test both success and failure paths
   - Verify error messages and error types
   - Assert on all returned properties, not just existence
   - Test boundary values explicitly (0, -1, MAX_VALUE)
   - Verify state changes, not just final results

3. **Common Surviving Mutant Patterns:**
   - String literal mutations (fix: assert exact strings)
   - Boolean negations (fix: test both true/false cases)
   - Arithmetic operators (fix: test exact calculations)
   - Comparison operators (fix: test boundary values)
   - Array method mutations (fix: test empty/single/multiple items)
   - Optional chaining (fix: test null/undefined cases)

### Key Test Areas with Current Coverage
- packages/core/tests/ - Core business logic tests (target: 95% mutation score)
- packages/tui/tests/ - Terminal UI component tests (target: 90% mutation score)
- packages/cli/tests/ - Command-line interface tests (target: 90% mutation score)
- packages/shared/tests/ - Shared utility tests (target: 90% mutation score)

### Available Testing Tools
- **Bun Test**: Built-in test runner with native assertions
- **StrykerJS 8.2.x**: Mutation testing framework
- **Tinybench 2.5.x**: Micro-benchmarks for performance
- **Bun Coverage**: Built-in coverage reporting
- **node-pty 1.0.x**: Terminal emulation for TUI tests
- **pixelmatch 5.3.x**: Visual regression testing for terminal output
[Source: architecture/tech-stack.md#testing-suite]

### Performance Considerations
- All unit tests must execute in <500ms (enforced via bunfig.toml)
- Use mocks to avoid I/O operations in unit tests
- Leverage test factories for efficient test data generation
- Run mutation testing with concurrency: 4 for faster feedback
- Use incremental mode to only test changed files
[Source: architecture/testing-strategy.md#unit-test-performance-strategy]

## Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-09 | 1.0 | Initial story creation | Sarah (PO) |

## Dev Agent Record

### Agent Model Used
(To be filled by dev agent)

### Debug Log References
(To be filled by dev agent)

### Completion Notes List
(To be filled by dev agent)

### File List
(To be filled by dev agent)

## QA Results
(To be filled by QA agent)
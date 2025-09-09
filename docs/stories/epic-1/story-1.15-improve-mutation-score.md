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
  - [ ] Run StrykerJS to generate current mutation report
  - [ ] Identify surviving mutants by category
  - [ ] Document weak test areas
  - [ ] Prioritize improvements by impact

- [ ] **Task 2: Strengthen Core Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/core/tests/*.test.ts
  - [ ] Add missing edge case assertions
  - [ ] Strengthen existing assertions
  - [ ] Ensure meaningful test coverage

- [ ] **Task 3: Improve TUI Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/tui/tests/*.test.ts
  - [ ] Add boundary condition tests
  - [ ] Test error handling paths
  - [ ] Validate rendering edge cases

- [ ] **Task 4: Enhance CLI Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/cli/tests/*.test.ts
  - [ ] Test command parsing edge cases
  - [ ] Add negative test scenarios
  - [ ] Validate error messages

- [ ] **Task 5: Update Shared Package Tests** (AC: 2, 3, 7)
  - [ ] Review packages/shared/tests/*.test.ts
  - [ ] Add type validation tests
  - [ ] Test utility function edge cases
  - [ ] Ensure comprehensive coverage

- [ ] **Task 6: Validate Improvements** (AC: 1, 4, 6, 9)
  - [ ] Run StrykerJS with updated tests
  - [ ] Verify mutation score >90%
  - [ ] Ensure tests run with Bun test runner
  - [ ] Generate HTML report in reports/mutation/
  - [ ] Update dashboard with new score

- [ ] **Task 7: Maintain Test Quality** (AC: 5, 8)
  - [ ] Review test readability
  - [ ] Ensure tests follow existing patterns
  - [ ] Document complex test scenarios
  - [ ] Verify no performance regression

## Dev Notes

### Testing Standards
- Tests must be placed in packages/*/tests/ directories
- Use Bun test runner with built-in assertions
- Follow existing test patterns and naming conventions
- Maintain test execution speed <100ms per test

### StrykerJS Configuration
- Configuration file: stryker.conf.js (root directory)
- Command runner: 'bun test --bail --coverage'
- Mutation patterns: packages/*/src/**/*.ts (excluding test files)
- Current threshold: 85% (target: >90%)
- Reports output to: reports/mutation/index.html
- Incremental testing enabled: .stryker-tmp/incremental.json

### Mutation Testing Strategy
1. Focus on boundary conditions and edge cases
2. Test both positive and negative scenarios
3. Validate error handling and exceptions
4. Ensure type safety validations
5. Test all conditional branches

### Key Test Areas
- packages/core/tests/ - Core business logic tests
- packages/tui/tests/ - Terminal UI component tests
- packages/cli/tests/ - Command-line interface tests
- packages/shared/tests/ - Shared utility tests

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
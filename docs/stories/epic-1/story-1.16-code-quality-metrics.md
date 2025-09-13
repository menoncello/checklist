# Story 1.16: Code Quality Metrics Enforcement

## Status
Approved

## Story
**As a** technical lead,
**I want** automated code quality metrics enforcement with strict thresholds,
**So that** the codebase maintains high standards of readability, maintainability, and simplicity according to established project standards.

## Acceptance Criteria
1. File size limits enforced (max 300 lines per file, excluding comments and blank lines)
2. Method/function size limits enforced (max 30 lines per function)
3. Cyclomatic complexity limits enforced (max complexity of 10)
4. Maximum indentation depth enforced (max 3 levels)
5. Quality metrics integrated into existing ESLint configuration
6. CI/CD pipeline fails when quality thresholds are exceeded
7. Detailed quality reports generated for each violation in reports/quality/
8. Existing code refactored to meet new quality standards
9. Pre-commit hooks validate quality metrics locally

## Tasks / Subtasks

- [ ] **Task 1: Configure ESLint Built-in Quality Rules** (AC: 1, 2, 3, 4, 5)
  - [ ] Update eslint.config.js to add quality rules in the existing flat config format
  - [ ] Add to the main rules object after line 89 (before security rules):
    ```javascript
    // Code quality metrics (Story 1.16)
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
    'complexity': ['error', { max: 10 }],
    'max-depth': ['error', { max: 3 }],
    'max-nested-callbacks': ['error', { max: 3 }],
    'max-params': ['error', { max: 4 }],
    ```
  - [ ] Verify configuration works with existing `bun run lint` command
  - [ ] Test that violations are properly reported
  - [ ] Ensure the rules apply to all TypeScript files except those in ignores

- [ ] **Task 2: Setup ESLint HTML Reporter for Quality Metrics** (AC: 7)
  - [ ] Install ESLint HTML reporter: `bun install --frozen-lockfile` after adding to package.json:
    ```json
    "eslint-formatter-html": "^3.0.0"
    ```
  - [ ] Create npm script in root package.json:
    ```json
    "lint:report": "eslint . --format html --output-file reports/quality/eslint-report.html"
    ```
  - [ ] Create reports/quality/ directory structure:
    ```bash
    mkdir -p reports/quality
    echo '/reports/' >> .gitignore  # If not already ignored
    ```
  - [ ] Test report generation: `bun run lint:report`
  - [ ] Update docs/architecture/coding-standards.md with new quality thresholds section

- [ ] **Task 3: Run Baseline Quality Analysis** (AC: 7, 8)
  - [ ] Execute `bun run lint` to capture current violations
  - [ ] Generate HTML report: `bun run lint:report`
  - [ ] Document files exceeding thresholds (based on initial scan):
    - **Critical (>600 lines)**:
      - packages/tui/src/performance/MetricsCollector.ts (823 lines)
      - packages/tui/src/errors/CrashRecovery.ts (788 lines)
      - packages/tui/src/components/VirtualList.ts (713 lines)
      - packages/tui/src/performance/PerformanceMonitor.ts (686 lines)
      - packages/tui/src/performance/StartupProfiler.ts (673 lines)
      - packages/core/src/monitoring/PerformanceProfiler.ts (673 lines)
    - **High Priority (>500 lines)**: 14 additional files
  - [ ] Create prioritized refactoring list by impact (core > tui > cli > shared)
  - [ ] Save baseline metrics: `bun run lint --format json > reports/quality/baseline.json`

- [ ] **Task 4: Refactor Core Package** (AC: 8, 10)
  - [ ] Priority files to refactor:
    - packages/core/src/monitoring/PerformanceProfiler.ts (673 lines → split into ProfilerCore, ProfilerMetrics, ProfilerReporter)
    - packages/core/src/workflow/WorkflowEngine.ts (607 lines → extract validators, processors)
    - packages/core/src/state/StateManager.ts (589 lines → separate persistence, validation)
  - [ ] Refactoring patterns to apply:
    - Extract complex conditionals into named boolean functions
    - Replace nested if-else with guard clauses and early returns
    - Split large functions using Single Responsibility Principle
    - Extract repeated code into utility functions
  - [ ] After each file refactor:
    - Run `bun test packages/core --coverage` to ensure coverage maintained
    - Run `bun run test:mutation` to verify mutation score ≥85%
    - Commit changes with descriptive message

- [ ] **Task 5: Refactor TUI Package** (AC: 8)
  - [ ] Analyze packages/tui/src/ for quality violations
  - [ ] Split large rendering functions into smaller components
  - [ ] Simplify complex conditional rendering logic using lookup tables
  - [ ] Extract deeply nested UI logic into separate functions
  - [ ] Ensure terminal rendering performance remains <10ms per frame
  - [ ] Run `bun test packages/tui` to verify functionality
  - [ ] Run visual regression tests to ensure UI unchanged

- [ ] **Task 6: Refactor CLI Package** (AC: 8)
  - [ ] Analyze packages/cli/src/ for quality violations
  - [ ] Break down complex command processing functions
  - [ ] Simplify argument parsing using helper functions
  - [ ] Reduce error handling complexity with consistent patterns
  - [ ] Run `bun test packages/cli` to verify command functionality
  - [ ] Test all CLI commands manually to ensure no regressions

- [ ] **Task 7: Refactor Shared Package** (AC: 8)
  - [ ] Analyze packages/shared/src/ for quality violations
  - [ ] Split utility files that exceed size limits
  - [ ] Simplify complex utility functions
  - [ ] Ensure all shared utilities remain pure functions
  - [ ] Run `bun test packages/shared` to verify utilities

- [ ] **Task 8: Verify Pre-commit Hooks** (AC: 9)
  - [ ] Verify .husky/pre-commit already runs `bun run quality` (includes lint)
  - [ ] Test that new quality rules are enforced by existing hook:
    ```bash
    # Create test file with violations
    echo 'function test() {' > test-violation.ts
    for i in {1..35}; do echo '  console.log("line");' >> test-violation.ts; done
    echo '}' >> test-violation.ts
    git add test-violation.ts
    git commit -m "test" # Should fail
    rm test-violation.ts
    ```
  - [ ] Measure hook execution time: `time bun run quality`
  - [ ] Ensure execution remains <5 seconds

- [ ] **Task 9: Verify CI/CD Quality Integration** (AC: 6, 7)
  - [ ] Verify .github/workflows/main.yml already runs lint at line 43-44
  - [ ] Add HTML report generation to CI by updating main.yml after line 44:
    ```yaml
    - name: Generate Quality Report
      run: bun run lint:report
      continue-on-error: true

    - name: Upload Quality Reports
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: quality-reports
        path: reports/quality/
        retention-days: 30
    ```
  - [ ] Test CI pipeline with a PR containing violations
  - [ ] Verify pipeline fails when thresholds exceeded
  - [ ] Add status badge to README.md: `[![Lint](https://github.com/[org]/[repo]/actions/workflows/main.yml/badge.svg)](https://github.com/[org]/[repo]/actions/workflows/main.yml)`

- [ ] **Task 10: Update Documentation** (AC: 7)
  - [ ] Update docs/architecture/coding-standards.md with new quality metrics section
  - [ ] Document all quality thresholds with rationale
  - [ ] Create refactoring guidelines with examples
  - [ ] Add "Good vs Bad" code pattern examples
  - [ ] Document exemption process and approval requirements
  - [ ] Update developer onboarding guide with quality standards

- [ ] **Task 11: Validate Quality Enforcement** (AC: 1-9)
  - [ ] Create test file with intentional violations
  - [ ] Verify ESLint catches all violation types
  - [ ] Verify pre-commit hook blocks commits with violations
  - [ ] Verify CI pipeline fails with violations
  - [ ] Verify quality reports are generated correctly
  - [ ] Remove test file after validation

## Dev Notes

### ESLint Configuration from Architecture
[Source: architecture/coding-standards.md#eslint-configuration]

The project already has ESLint 8.57.x configured with TypeScript rules. The existing configuration must be extended, not replaced. Current mandatory rules include:
- `@typescript-eslint/no-unused-vars`: 'error'
- `@typescript-eslint/no-explicit-any`: 'warn'
- `@typescript-eslint/strict-boolean-expressions`: 'error'
- `no-console`: 'warn' (use debug logger instead)
- `no-eval`: 'error' (security)

### Quality Enforcement Scripts Structure
[Source: architecture/coding-standards.md#quality-enforcement-scripts]

Every package already has these scripts that must continue to work:
```json
{
  "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
  "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
  "quality": "bun run lint && bun run format:check && bun run type-check",
  "quality:fix": "bun run lint:fix && bun run format && bun run type-check"
}
```

The new quality metrics must integrate with the existing "quality" script flow.

### Project Structure for Quality Reports
[Source: architecture/source-tree.md#project-structure]

Quality reports must be organized in the following structure:
- `/reports/quality/` - Main quality reports directory
- `/reports/quality/eslint/` - ESLint violation reports
- `/reports/quality/complexity/` - Complexity analysis reports
- `/reports/quality/baseline.json` - Baseline metrics snapshot
- `/reports/quality/trends/` - Historical trend analysis
- `/reports/quality/exemptions.md` - Documented exemptions

### Existing Pre-commit Hook Configuration
[Source: architecture/coding-standards.md#pre-commit-hook-requirements]

The project uses Husky for pre-commit hooks. Current hooks run:
1. `bun run quality` (lint + format check + type check)
2. `bun test --changed` on changed files
3. `bun audit --audit-level moderate` for security

New quality checks must be added to this existing flow without breaking current checks.

### Performance Requirements
[Source: architecture/testing-strategy.md#performance-testing-thresholds]

When refactoring, maintain these performance requirements:
- Memory Usage: <100MB for large checklists
- Navigation Speed: <10ms per step for large lists
- Initialization Time: <1000ms for 10,000 items
- Terminal rendering: 60fps with 1000 items (from Canvas requirements)

### Mutation Testing Impact
[Source: architecture/testing-strategy.md#mutation-testing-configuration]

The project uses StrykerJS with these thresholds:
- High: 95%
- Low: 90%
- Break: 85% (CI fails below this)

When refactoring code, ensure mutation score doesn't drop below 85% or CI will fail.

### Testing Standards and Maintenance Strategy
[Source: architecture/testing-strategy.md]

- Test files use `.test.ts` extension and are colocated with source files
- Tests must use Bun Test (built-in test runner)
- Visual regression tests use pixelmatch with 0.1 threshold
- All refactored code must maintain existing test coverage
- New helper functions extracted during refactoring need unit tests

### Test Maintenance During Refactoring
[Source: Story 1.16 Requirements]

**Strategy to maintain 85% mutation score during refactoring:**
1. Run `bun run test:mutation` before starting each package refactor
2. Save mutation report as baseline: `cp reports/mutation/index.html reports/mutation/baseline-{package}.html`
3. After refactoring, run mutation tests again
4. Compare scores - if dropped below 85%, add tests for surviving mutants
5. Focus on meaningful assertions, not just killing mutants
6. Use `bun test --watch` during refactoring for immediate feedback
7. Run full test suite before committing: `bun test && bun run test:mutation`

### Package Dependencies from Previous Story
[Source: Story 1.13 Dev Agent Record]

Previous story implemented IoC/DI pattern. When refactoring:
- Maintain constructor injection patterns
- Keep service interfaces intact
- Don't break dependency injection container
- Preserve service lifecycle hooks

### IDE Configuration Requirements
[Source: architecture/coding-standards.md#ide-configuration-requirements]

Ensure VSCode settings remain configured for:
- Format on save: enabled
- ESLint auto-fix on save: enabled
- Working directories for monorepo: `["packages/*"]`

### Files Identified for Refactoring
[Source: Codebase Analysis]

**Files exceeding 300-line threshold (priority order):**

1. **Core Package** (3 files):
   - `packages/core/src/monitoring/PerformanceProfiler.ts` - 673 lines
   - `packages/core/src/workflow/WorkflowEngine.ts` - 607 lines
   - `packages/core/src/state/StateManager.ts` - 589 lines

2. **TUI Package** (17 files):
   - `packages/tui/src/performance/MetricsCollector.ts` - 823 lines
   - `packages/tui/src/errors/CrashRecovery.ts` - 788 lines
   - `packages/tui/src/components/VirtualList.ts` - 713 lines
   - Plus 14 additional files ranging from 544-686 lines

3. **CLI Package**: To be analyzed in Task 6
4. **Shared Package**: To be analyzed in Task 7

### Integration with Existing Quality Scripts
[Source: package.json analysis]

The project already has quality enforcement scripts that must continue to work:
- `bun run quality`: Runs lint, format:check, and typecheck
- `bun run quality:fix`: Auto-fixes issues where possible
- `bun run lint`: Runs ESLint on all files
- `bun run lint:fix`: Auto-fixes ESLint issues

New quality rules will automatically be enforced through these existing scripts.

## Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-13 | 1.0 | Initial story creation | Bob (SM) |
| 2025-01-13 | 2.0 | Complete rewrite with architecture alignment | Bob (SM) |
| 2025-01-13 | 3.0 | Fixed critical issues: Added to Epic 1, replaced fictional packages with ESLint built-ins, aligned with project structure | Sarah (PO) |
| 2025-01-13 | 4.0 | Story validated and approved for implementation - Readiness score: 9/10 | Sarah (PO) |

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
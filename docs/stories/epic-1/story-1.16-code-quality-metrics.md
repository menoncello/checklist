# Story 1.16: Code Quality Metrics Enforcement

## Status
Draft

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

- [ ] **Task 1: Install and Configure ESLint Quality Plugins** (AC: 1, 2, 3, 4, 5)
  - [ ] Install complexity analysis plugins: `bun add -D eslint-plugin-complexity eslint-plugin-max-lines-per-function`
  - [ ] Update eslint.config.js to add new quality rules
  - [ ] Configure max-lines rule: `['error', { max: 300, skipBlankLines: true, skipComments: true }]`
  - [ ] Configure max-lines-per-function rule: `['error', { max: 30, skipBlankLines: true, skipComments: true }]`
  - [ ] Configure complexity rule: `['error', { max: 10 }]`
  - [ ] Configure max-depth rule: `['error', { max: 3 }]`
  - [ ] Configure max-nested-callbacks rule: `['error', { max: 3 }]`
  - [ ] Configure max-params rule: `['error', { max: 4 }]`
  - [ ] Verify configuration works with existing "bun run lint" command

- [ ] **Task 2: Setup Complexity Analysis Tool** (AC: 3, 7)
  - [ ] Install complexity-report tool: `bun add -D complexity-report`
  - [ ] Create npm script in root package.json: `"complexity": "complexity-report --output reports/quality/complexity/"`
  - [ ] Ensure reports/quality/ directory structure exists
  - [ ] Configure complexity-report to output JSON and HTML formats
  - [ ] Add complexity thresholds to align with ESLint rules
  - [ ] Document complexity thresholds in docs/architecture/coding-standards.md

- [ ] **Task 3: Run Baseline Quality Analysis** (AC: 7, 8)
  - [ ] Execute `bun run lint` to capture current violations
  - [ ] Run complexity analysis: `bun run complexity`
  - [ ] Generate baseline quality report in reports/quality/baseline.json
  - [ ] Identify all files exceeding the new thresholds
  - [ ] Create prioritized refactoring list by package (core > tui > cli > shared)
  - [ ] Document exemptions process in reports/quality/exemptions.md

- [ ] **Task 4: Refactor Core Package** (AC: 8)
  - [ ] Analyze packages/core/src/ for quality violations
  - [ ] Split files exceeding 300 lines into logical modules
  - [ ] Break down functions exceeding 30 lines using helper functions
  - [ ] Reduce complexity by replacing nested conditionals with guard clauses
  - [ ] Flatten nesting depth using early returns and function extraction
  - [ ] Run `bun test packages/core` to ensure no regressions
  - [ ] Verify mutation score remains above 85% threshold

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

- [ ] **Task 8: Update Pre-commit Hooks** (AC: 9)
  - [ ] Update .husky/pre-commit to include quality checks
  - [ ] Add ESLint quality rules check: `bun run lint`
  - [ ] Add complexity analysis check: `bun run complexity --threshold`
  - [ ] Ensure hook execution time remains <5 seconds
  - [ ] Test hook with intentional violations to verify blocking

- [ ] **Task 9: Integrate Quality Checks with CI/CD** (AC: 6, 7)
  - [ ] Update .github/workflows/ci.yml to add quality metrics step
  - [ ] Add step: "Check Code Quality" running `bun run lint`
  - [ ] Add step: "Analyze Complexity" running `bun run complexity`
  - [ ] Configure workflow to fail if thresholds are exceeded
  - [ ] Configure artifact upload for reports/quality/ directory
  - [ ] Add quality badge to README.md showing current status

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

### Testing Standards
[Source: architecture/testing-strategy.md]

- Test files use `.test.ts` extension and are colocated with source files
- Tests must use Bun Test (built-in test runner)
- Visual regression tests use pixelmatch with 0.1 threshold
- All refactored code must maintain existing test coverage
- New helper functions extracted during refactoring need unit tests

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

## Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-01-13 | 1.0 | Initial story creation | Bob (SM) |
| 2025-01-13 | 2.0 | Complete rewrite with architecture alignment | Bob (SM) |

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
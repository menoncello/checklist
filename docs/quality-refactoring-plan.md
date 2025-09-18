# Progressive Quality Refactoring Plan

## Overview

Based on QA findings from story 1.16, we have 47 files exceeding the 300-line threshold. This document outlines a systematic approach to refactoring these files while maintaining code functionality and test coverage.

## Current Status

- **Total files over 300 lines:** 47
- **Quality rules status:** Temporarily disabled in ESLint
- **Infrastructure:** Complete (ESLint rules, CI/CD, reports, pre-commit hooks)

## Refactoring Strategy

### Phase 1: Enable Rules Gradually by Package

1. **Core Package** (4 files remaining)
   - Already partially complete (ServiceBindings refactored)
   - Remaining files: PerformanceProfiler (335), StateManager (346), etc.
   - Target: Enable rules for core package first

2. **Shared Package** (analyze needed)
   - Likely smallest package
   - Enable rules after core

3. **CLI Package** (analyze needed)
   - Command handling logic
   - Enable after shared

4. **TUI Package** (31 files)
   - Largest refactoring effort
   - Complex UI rendering logic
   - Enable rules last

### Phase 2: File-by-File Refactoring Approach

For each file exceeding 300 lines:

#### 1. Analysis
- Run complexity analysis: `bun run lint --rule complexity:error`
- Identify large functions (>30 lines)
- Map dependencies and test coverage

#### 2. Refactoring Patterns
- **Extract Method:** Break large functions into smaller, focused functions
- **Extract Class:** Split large classes into composition of smaller classes
- **Extract Module:** Move related functionality to separate files
- **Simplify Conditionals:** Replace nested if-else with guard clauses
- **Configuration Objects:** Replace long parameter lists with config objects

#### 3. Validation Steps
- Run tests: `bun test packages/{package} --coverage`
- Check mutation score: `bun run test:mutation`
- Verify no performance regression: `bun run bench`
- Lint check: `bun run lint`

### Phase 3: Quality Rule Activation Timeline

#### Week 1: Core Package
```bash
# Enable rules for core package only
# Update eslint.config.js with package-specific overrides
```

#### Week 2: Shared Package
```bash
# Analyze and refactor shared package
# Enable rules for core + shared
```

#### Week 3: CLI Package
```bash
# Refactor CLI command handlers
# Enable rules for core + shared + cli
```

#### Week 4-6: TUI Package
```bash
# Refactor TUI components (largest effort)
# Enable all quality rules project-wide
```

## Risk Mitigation

### Testing Strategy
- Run full test suite before and after each file refactoring
- Maintain mutation testing score ≥85%
- Preserve all existing test coverage
- Add tests for newly extracted functions

### Performance Validation
- Benchmark critical paths before/after refactoring
- Monitor memory usage during TUI refactoring
- Ensure startup time remains <1000ms

### Rollback Plan
- Each refactoring gets its own commit
- Keep original implementation in git history
- Document any breaking changes in commit messages

## Progress Tracking

### Priority Order (by impact and dependency)

1. **packages/core/src/monitoring/PerformanceProfiler.ts** (335 lines)
   - Central performance monitoring
   - Used by all packages
   - High impact on overall system

2. **packages/core/src/services/StateManagerService.ts** (346 lines)
   - Core state management
   - Critical for data integrity
   - High test coverage required

3. **packages/core/src/services/WorkflowEngineService.ts** (382 lines)
   - Business logic orchestration
   - Complex workflow handling

4. **packages/tui/src/performance/StartupProfiler.ts** (673 lines)
   - UI startup optimization
   - Performance-critical code

5. **packages/tui/src/debug/DebugOverlay.ts** (643 lines)
   - Development tooling
   - Less critical, good refactoring practice

Continue with remaining files in size order within each package...

## Success Metrics

- All 47 files under 300 lines
- All functions under 30 lines
- Maximum complexity ≤10 per function
- Maximum nesting depth ≤3
- Test coverage maintained at current levels
- Mutation score ≥85%
- No performance regression

## Implementation Commands

### Enable Rules for Specific Package
```javascript
// In eslint.config.js, add package-specific config:
{
  files: ['packages/core/**/*.ts'],
  rules: {
    'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
    'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
    'complexity': ['error', { max: 10 }],
    'max-depth': ['error', { max: 3 }],
  }
}
```

### Validation Script
```bash
#!/bin/bash
# validate-refactoring.sh
echo "Running validation for package: $1"
bun test packages/$1 --coverage
bun run test:mutation
bun run lint packages/$1
bun run bench:assert
echo "Validation complete for $1"
```

## Next Actions

1. Start with packages/core/src/monitoring/PerformanceProfiler.ts
2. Apply refactoring patterns systematically
3. Enable quality rules for core package after refactoring complete
4. Move to next package in priority order

This progressive approach ensures we maintain system stability while systematically improving code quality across the entire codebase.
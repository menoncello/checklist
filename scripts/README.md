# Lint Analysis Scripts

This directory contains utility scripts for analyzing and reporting ESLint violations in the codebase, particularly focused on code quality metrics.

## Available Scripts

### 1. `lint-summary.sh` - Quick Summary Report

A fast shell script that provides a quick overview of lint issues.

**Usage:**
```bash
# Direct execution
./scripts/lint-summary.sh

# Via npm/bun
bun run lint:summary
```

**Output includes:**
- Total violation count
- Top violation types
- Files with most issues
- Violations by package
- Code quality metrics summary

### 2. `lint-report.js` - Detailed Analysis Report

A comprehensive Node.js script that generates detailed reports with file-by-file analysis.

**Usage:**
```bash
# Direct execution
node scripts/lint-report.js

# Via npm/bun
bun run lint:analysis
```

**Features:**
- Detailed file-by-file violation breakdown
- Top 20 files with most issues
- Package-level statistics
- Rule violation frequency analysis
- Saves reports to `reports/quality/` directory
- Generates both text and JSON outputs

**Output files:**
- `reports/quality/lint-analysis-{date}.txt` - Human-readable report
- `reports/quality/lint-analysis-{date}.json` - Machine-readable data for further analysis

## Code Quality Metrics

Both scripts track the following ESLint quality rules:
- `max-lines` - Maximum lines per file (300)
- `max-lines-per-function` - Maximum lines per function (30)
- `complexity` - Cyclomatic complexity (max 10)
- `max-depth` - Maximum nesting depth (3)
- `max-params` - Maximum function parameters (4)
- `max-nested-callbacks` - Maximum nested callbacks (3)

## Current Status

As of the last analysis, the codebase has:
- **117 total violations** across 60 files
- **TUI package**: 89 violations (highest priority for refactoring)
- **Core package**: 28 violations

Top violation types:
1. `max-lines-per-function` - 68 violations
2. `max-lines` - 29 violations
3. `complexity` - 19 violations

## Refactoring Priority

Based on the analysis, files should be refactored in this order:

### High Priority (Most violations):
1. `packages/tui/src/events/helpers/MessageMatcher.ts` - 8 violations
2. `packages/tui/src/debug/DebugOverlay.ts` - 6 violations
3. `packages/tui/src/performance/index.ts` - 5 violations

### Package Priority:
1. **TUI Package** - 42 files with violations
2. **Core Package** - 18 files with violations

## Integration with CI/CD

These scripts can be integrated into the CI/CD pipeline to track quality metrics over time:

```yaml
# Example GitHub Actions step
- name: Generate Lint Report
  run: |
    bun run lint:analysis
    # Upload reports as artifacts
```

## Tips for Refactoring

When addressing violations:

1. **max-lines-per-function**: Extract helper functions and break down complex logic
2. **max-lines**: Split large files into smaller, focused modules
3. **complexity**: Simplify conditional logic, use early returns, extract boolean functions
4. **max-depth**: Flatten nested structures, use guard clauses

## Related Commands

- `bun run lint` - Run ESLint check
- `bun run lint:fix` - Auto-fix ESLint issues where possible
- `bun run lint:report` - Generate HTML report
- `bun run quality` - Run all quality checks (lint + format + typecheck)

## Contributing

When adding new analysis scripts:
1. Place them in this `scripts/` directory
2. Add corresponding npm scripts in `package.json`
3. Update this README with usage instructions
4. Consider adding JSON output for automation
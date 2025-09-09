# Mutation Testing Guide

## Overview

This project uses **StrykerJS 9.1.x** for mutation testing to validate test quality. Mutation testing introduces small changes (mutations) to the source code and checks if tests catch these changes.

## Configuration

StrykerJS is configured in `stryker.conf.js` at the project root with:
- **Command Runner**: Executes Bun tests directly
- **Mutation Score Threshold**: 85% minimum (CI fails below this)
- **Reporters**: HTML, JSON, Dashboard, Progress
- **Incremental Testing**: Enabled for faster PR validation

## Running Mutation Tests

### Local Development

```bash
# Run full mutation testing
bun run test:mutation

# Run incremental mutation testing (faster, uses cache)
bun run test:mutation:incremental

# Test specific files
bunx stryker run --mutate "packages/core/src/**/*.ts"
```

### Viewing Reports

After running mutation tests, reports are available at:
- **HTML Report**: `reports/mutation/index.html` - Visual browser-based report
- **JSON Report**: `reports/mutation/mutation-report.json` - Machine-readable data

## CI/CD Integration

### GitHub Actions Workflow

Mutation testing runs automatically on:
- **Pull Requests**: Incremental testing (non-blocking)
- **Main Branch**: Full testing with threshold enforcement

The workflow is defined in `.github/workflows/mutation.yml`

### Dashboard Integration

To setup dashboard integration:

1. Register your project at https://dashboard.stryker-mutator.io/
2. Add the API token as GitHub Secret: `STRYKER_DASHBOARD_API_TOKEN`
3. Dashboard will track mutation score trends automatically

## Understanding Mutation Scores

### Score Ranges

| Score | Quality Level | Action Required |
|-------|--------------|-----------------|
| 95%+ | Excellent | Maintain quality |
| 90-95% | Good | Minor improvements |
| 85-90% | Acceptable | Review surviving mutants |
| < 85% | Below Threshold | CI fails, improvements required |

### Common Mutation Types

- **String Literal**: Changes string values
- **Boolean Literal**: Flips true/false
- **Conditional Expression**: Modifies if conditions
- **Logical Operator**: Changes && to ||
- **Arithmetic Operator**: Changes + to -
- **Array Declaration**: Modifies array initialization

## Improving Mutation Scores

### Analyzing Surviving Mutants

1. Open the HTML report: `reports/mutation/index.html`
2. Look for "Survived" mutants (shown in red)
3. Click on each survivor to see the mutation
4. Write tests that would catch this mutation

### Common Patterns to Test

```typescript
// Boundary conditions
expect(value).toBeGreaterThan(0);
expect(value).toBeLessThanOrEqual(100);

// Exact values (not just truthy)
expect(result).toBe('specific-value');
expect(count).toBe(5);

// Error conditions
expect(() => fn()).toThrow(SpecificError);
expect(error.message).toContain('expected text');

// All branches
if (condition1 && condition2) { /* test both */ }
if (value > 10 || value < 0) { /* test all paths */ }
```

## Performance Optimization

### Configuration Tuning

```javascript
// stryker.conf.js
module.exports = {
  // Adjust based on CI resources
  concurrency: 4,
  
  // Increase for slow tests
  timeoutMS: 60000,
  
  // Use incremental for faster runs
  incremental: true,
  
  // Focus on specific packages
  mutate: ['packages/core/src/**/*.ts']
};
```

### Best Practices

1. **Use Incremental Mode**: For local development and PRs
2. **Parallel Execution**: Set concurrency based on CPU cores
3. **Targeted Testing**: Focus on changed files in PRs
4. **Cache Management**: Clear `.stryker-tmp` if issues arise

## Troubleshooting

### Common Issues

#### Timeout Errors
```bash
# Increase timeout in stryker.conf.js
timeoutMS: 120000
```

#### Environment-Dependent Tests
```typescript
// Skip in mutation testing
if (process.env.STRYKER_MUTATOR_RUNNER) {
  return;
}
```

#### Memory Issues
```bash
# Reduce concurrency
concurrency: 2
```

### Debug Commands

```bash
# Verbose logging
bunx stryker run --logLevel debug

# Trace level for detailed info
bunx stryker run --fileLogLevel trace --logLevel debug

# Clear cache
rm -rf .stryker-tmp
```

## Module-Specific Goals

| Module | Target Score | Current Focus |
|--------|-------------|---------------|
| Workflow Engine | 95% | Critical business logic |
| Core Utils | 90% | Foundation utilities |
| State Management | 85% | Complex state handling |
| CLI Commands | 85% | User-facing functionality |

## Further Resources

- [StrykerJS Documentation](https://stryker-mutator.io/docs/)
- [Mutation Testing Concepts](https://stryker-mutator.io/docs/mutation-testing-elements/)
- [Dashboard Guide](https://stryker-mutator.io/docs/stryker-js/dashboard/)
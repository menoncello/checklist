# Slow Tests Report

## Summary
Total test execution time: **~52 seconds**
- Core package: 49.33s (94% of total time)
- TUI package: 331ms
- CLI package: 902ms  
- Shared package: 8ms

## Critical Slow Tests (>10s)

### 1. WAL Crash Recovery Tests
**File**: `packages/core/tests/integration/wal-crash-recovery.test.ts`
**Total Time**: ~20.34s for 10 tests
**Specific Slow Tests**:
- `should detect and handle incomplete transactions` - 15s timeout
- `should detect incomplete transactions on init` - 15s timeout

**Issue**: Tests have explicit 15-second timeouts, likely for simulating crash recovery scenarios.

### 2. Build System Tests  
**File**: `packages/core/tests/build-system.test.ts`
**Timeout**: 30s timeout configured
**Line**: 211

**Issue**: Has a 30-second timeout for build-related tests.

## Moderately Slow Tests (1-10s)

### 3. Bottleneck Detection Tests
**File**: `packages/core/tests/monitoring/bottleneck-detection.test.ts`
**Total Time**: 7.58s for 19 tests
**Issue**: Multiple `setTimeout` delays:
- Line 198: 100ms delay
- Lines 219, 225, 262, 280, 318, 335, 482, 549, 566: 100ms delays each
- Lines 660, 710: 50ms and 40ms delays

These delays are intentional for testing performance monitoring features.

### 4. Other Monitoring Tests
**Directory**: `packages/core/tests/monitoring/`
**Total Time**: 10.11s for entire directory
- bottleneck-detection.test.ts: 7.58s
- Other monitoring tests: ~2.5s combined

## Root Causes

1. **Integration Tests**: WAL crash recovery tests are integration tests that need to simulate real crash scenarios
2. **Performance Tests**: Monitoring tests need real delays to test timing-sensitive features
3. **Build Tests**: Build system tests may involve actual compilation/bundling

## Recommendations

### Immediate Actions
1. **Separate Test Suites**: Create separate commands for:
   - `bun test:unit` - Fast unit tests only (<100ms each)
   - `bun test:integration` - Slower integration tests
   - `bun test:performance` - Performance monitoring tests with delays

2. **Use Timer Mocks**: For bottleneck detection tests, consider using Bun's timer mocks instead of real delays

3. **Reduce Timeouts**: Review if 15s and 30s timeouts are really necessary

### Example package.json Scripts
```json
{
  "scripts": {
    "test": "bun test",
    "test:unit": "bun test --ignore '**/integration/**' --ignore '**/monitoring/**'",
    "test:integration": "bun test packages/core/tests/integration",
    "test:performance": "bun test packages/core/tests/monitoring",
    "test:quick": "bun test:unit",
    "test:ci": "bun test"
  }
}
```

### Timer Mock Example
Instead of:
```typescript
await new Promise(resolve => setTimeout(resolve, 100));
```

Use:
```typescript
import { useFakeTimers, runAllTimers } from 'bun:test';

// In test
useFakeTimers();
// ... code that uses timers
runAllTimers();
```

## Files to Optimize

Priority order based on impact:
1. `packages/core/tests/integration/wal-crash-recovery.test.ts` (20s)
2. `packages/core/tests/monitoring/bottleneck-detection.test.ts` (7.5s)
3. `packages/core/tests/build-system.test.ts` (unknown, but has 30s timeout)

## Test Performance Monitoring Script

Created `find-slow-tests.sh` to identify slow tests when Bun reports individual test times.
# Test Framework Migration: Vitest → Bun Native

## Executive Summary

Migration from Vitest to Bun's native test runner to leverage native performance benefits and reduce dependency overhead.

## Architecture Decision Record (ADR)

### Status

Proposed

### Context

- Current: Vitest v3.2.4 with V8 coverage
- Target: Bun native test runner (built-in)
- Motivation: Performance, reduced dependencies, native TypeScript support

### Decision Drivers

1. **Performance**: Bun's native runner is ~10x faster
2. **Simplicity**: Zero-config TypeScript support
3. **Integration**: Better Bun ecosystem alignment
4. **Maintenance**: Fewer dependencies to manage

## Migration Strategy

### Phase 1: Compatibility Assessment

```typescript
// Current Vitest Pattern
import { describe, it, expect } from 'vitest';

// Bun Native Pattern (compatible)
import { describe, it, expect } from 'bun:test';
```

### Phase 2: Configuration Migration

#### Before (vitest.config.ts)

```typescript
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: { provider: 'v8' }
  },
  resolve: { alias: {...} }
});
```

#### After (bunfig.toml)

```toml
[test]
preload = ["./test-setup.ts"]
coverage = true
coverageReporter = ["text", "json", "html"]

[test.alias]
"@checklist/core" = "./packages/core/src"
"@checklist/cli" = "./packages/cli/src"
"@checklist/tui" = "./packages/tui/src"
"@checklist/shared" = "./packages/shared/src"
```

### Phase 3: Test File Migration

#### Migration Script Pattern

```typescript
// migrate-test.ts
const migrateTestFile = async (filePath: string) => {
  let content = await Bun.file(filePath).text();

  // Replace imports
  content = content.replace(
    "import { describe, it, expect } from 'vitest'",
    "import { describe, it, expect } from 'bun:test'"
  );

  // Replace vi.mock with Bun mock
  content = content.replace(/vi\.mock/g, 'mock');

  // Handle beforeEach/afterEach
  content = content.replace(/beforeEach/g, 'beforeEach');

  await Bun.write(filePath, content);
};
```

## Implementation Checklist

### 1. Dependencies Update

- [ ] Remove vitest dependencies
- [ ] Remove @vitest/coverage-v8
- [ ] Update package.json scripts
- [ ] Create bunfig.toml

### 2. Configuration

- [ ] Create test-setup.ts for global setup
- [ ] Configure coverage settings
- [ ] Setup path aliases
- [ ] Configure test patterns

### 3. Test Migration

- [ ] Migrate core package tests (5 files)
- [ ] Migrate state package tests (5 files)
- [ ] Update mock patterns
- [ ] Validate coverage reports

### 4. CI/CD Updates

- [ ] Update GitHub Actions
- [ ] Update coverage reporting
- [ ] Update test commands

## Package.json Changes

```json
{
  "scripts": {
    "test": "bun test",
    "test:watch": "bun test --watch",
    "test:coverage": "bun test --coverage",
    "test:smoke": "bun test --grep 'smoke'"
  }
}
```

## Test Pattern Mappings

| Vitest API   | Bun Test API    | Notes              |
| ------------ | --------------- | ------------------ |
| `describe`   | `describe`      | Direct replacement |
| `it`/`test`  | `it`/`test`     | Direct replacement |
| `expect`     | `expect`        | Direct replacement |
| `beforeEach` | `beforeEach`    | Direct replacement |
| `afterEach`  | `afterEach`     | Direct replacement |
| `vi.fn()`    | `mock()`        | Different API      |
| `vi.mock()`  | `mock.module()` | Different pattern  |
| `vi.spyOn()` | `spyOn()`       | Built-in           |

## Risk Analysis

### Low Risk

- Basic test structure (describe/it/expect)
- Simple assertions
- Path aliases

### Medium Risk

- Mock system migration
- Coverage configuration
- Custom matchers

### High Risk

- Complex mock scenarios
- Third-party test utilities
- Coverage thresholds

## Performance Expectations

### Current (Vitest)

- Cold start: ~2-3s
- Test execution: ~500ms
- Coverage: +30% overhead

### Target (Bun)

- Cold start: ~200ms
- Test execution: ~50ms
- Coverage: +10% overhead

## Rollback Plan

1. Keep vitest.config.ts for 2 sprints
2. Maintain git branch with Vitest setup
3. Document any Bun-specific patterns
4. Create migration guide for team

## Success Metrics

- [ ] All tests passing
- [ ] Coverage > 80% maintained
- [ ] Test execution < 500ms total
- [ ] Zero runtime dependencies for testing

## Timeline

- **Week 1**: Setup and core package
- **Week 2**: Remaining packages and CI/CD
- **Week 3**: Documentation and team training

# Log Mocking Strategy for Clean Test Output

## Problem Statement

The current test setup has conflicting goals:
1. Tests need to verify console.log output for CLI commands
2. Test setup suppresses all console output for clean test runs
3. This results in tests passing but still showing output during execution

## Proposed Solution Architecture

### 1. Selective Console Mocking Framework

Create a test utility that provides:
- **Context-aware console mocking** - Only suppress output when not being tested
- **Test-specific console capture** - Allow tests to capture what they need
- **Clean global suppression** - Suppress all other output

### 2. Test Utility Components

#### A. ConsoleCaptureManager
```typescript
class ConsoleCaptureManager {
  private isCapturing = false;
  private capturedOutput: string[] = [];

  enableCapture(): void
  disableCapture(): void
  getCapturedOutput(): string[]
  clearCapturedOutput(): void
}
```

#### B. TestConsoleMock
```typescript
class TestConsoleMock {
  private originalConsole: Console;
  private captureManager: ConsoleCaptureManager;

  install(): void
  uninstall(): void
  spyOnConsole(method: 'log' | 'error' | 'warn'): SpyFunction
}
```

#### C. GlobalTestSetup
```typescript
class GlobalTestSetup {
  private consoleMock: TestConsoleMock;

  installGlobalMocks(): void
  cleanupGlobalMocks(): void
}
```

### 3. Implementation Strategy

#### Phase 1: Create Test Utilities
1. Create `packages/core/tests/utils/ConsoleCaptureManager.ts`
2. Create `packages/core/tests/utils/TestConsoleMock.ts`
3. Create `packages/core/tests/utils/TestLoggerSuppressor.ts`

#### Phase 2: Update Test Setup
1. Modify `packages/core/tests/test-setup.ts` to use new utilities
2. Modify `apps/cli/test-setup.ts` to use new utilities
3. Ensure selective mocking based on test context

#### Phase 3: Update Individual Tests
1. Refactor tests to use new console capture utilities
2. Replace direct `spyOn(console, 'log')` calls with test utilities
3. Ensure tests can verify output without polluting test runs

#### Phase 4: Documentation & Best Practices
1. Document proper console mocking patterns
2. Create examples for different test scenarios
3. Establish guidelines for future test development

### 4. Expected Benefits

1. **Clean Test Output**: No unwanted console pollution during test runs
2. **Test Accuracy**: Tests can still verify console output when needed
3. **Maintainability**: Centralized console mocking logic
4. **Performance**: Reduced overhead from multiple mock setups
5. **Developer Experience**: Clear, clean test output for debugging

### 5. Integration Points

- **Core Package**: Base test utilities and console management
- **CLI Package**: Command-specific console testing patterns
- **TUI Package**: Terminal output testing capabilities
- **Global Setup**: Cross-package test environment configuration

### 6. Backwards Compatibility

- Existing tests continue to work with minimal changes
- Gradual migration path for old test patterns
- Deprecation warnings for old mocking approaches

### 7. Success Metrics

1. Zero console pollution in test output (unless explicitly requested)
2. All existing tests continue to pass
3. New test utilities adopted across packages
4. Reduced test execution time (from optimized mocking)
5. Improved developer feedback during test runs

## Implementation Priority

1. **High Priority**: ConsoleCaptureManager and TestConsoleMock
2. **Medium Priority**: Test setup updates and CLI integration
3. **Low Priority**: Documentation and migration utilities
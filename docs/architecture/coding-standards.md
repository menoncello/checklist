# Coding Standards (Complete with All Standards)

## ESLint Configuration Rules

**All developers MUST follow these ESLint rules enforced in the project:**

```javascript
// eslint.config.js (ESLint 9.x Flat Config)
export default [
  {
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser: '@typescript-eslint/parser',
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      import: importPlugin,
      'unused-imports': unusedImportsPlugin,
    },
    rules: {
      // TypeScript-specific rules (MANDATORY)
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/prefer-optional-chain': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/strict-boolean-expressions': 'error',

      // Import organization (MANDATORY)
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          alphabetize: { order: 'asc' },
        },
      ],
      'unused-imports/no-unused-imports': 'error',

      // Code quality (MANDATORY)
      'no-console': 'warn', // Use debug logger instead
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Bun-specific patterns (MANDATORY)
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression[callee.object.name='process'][callee.property.name='env']",
          message: 'Use Bun.env instead of process.env for better performance',
        },
      ],

      // Security rules (MANDATORY)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error',
    },
  },
];
```

## Prettier Configuration Rules

**All code MUST be formatted according to these Prettier rules:**

```javascript
// .prettierrc.js
module.exports = {
  // Basic formatting (MANDATORY)
  semi: true,
  singleQuote: true,
  tabWidth: 2,
  useTabs: false,
  trailingComma: 'es5',

  // Line length for readability (MANDATORY)
  printWidth: 80,

  // TypeScript specific (MANDATORY)
  parser: 'typescript',

  // Import formatting (MANDATORY)
  importOrder: ['^@core/(.*)$', '^@/(.*)$', '^[./]'],
  importOrderSeparation: true,

  // Specific overrides
  overrides: [
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'preserve',
      },
    },
  ],
};
```

## Package.json Lint Scripts

**These scripts MUST be available in every package:**

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx,.js,.jsx",
    "lint:fix": "eslint . --ext .ts,.tsx,.js,.jsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "type-check": "tsc --noEmit",
    "quality": "bun run lint && bun run format:check && bun run type-check",
    "quality:fix": "bun run lint:fix && bun run format && bun run type-check"
  }
}
```

## Pre-commit Hooks Configuration

**Git hooks MUST be configured to enforce quality:**

```bash
# .husky/pre-commit (using Husky)
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run quality checks
bun run quality

# Run tests on changed files
bun test --changed

# Security audit
bun audit --audit-level moderate
```

```json
// package.json - lint-staged configuration
{
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": ["eslint --fix", "prettier --write"],
    "*.{md,json,yaml,yml}": ["prettier --write"]
  }
}
```

## IDE Configuration Guidelines

**Developers MUST configure their IDE/Editor with:**

1. **VSCode Settings (.vscode/settings.json):**

```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "eslint.workingDirectories": ["packages/*"]
}
```

2. **Required Extensions:**
   - ESLint
   - Prettier
   - TypeScript Importer
   - Error Lens

## Linting Enforcement Rules

**MANDATORY for all developers:**

1. **❌ NO commits allowed without passing lint**
2. **❌ NO PR merges without lint passing in CI**
3. **❌ NO exceptions to ESLint errors (warnings acceptable with justification)**
4. **✅ Auto-fix must be run before every commit**
5. **✅ All imports must be sorted and unused imports removed**

## Bun-Specific Performance Standards

```typescript
// ALWAYS use Bun.file() for file operations (10x faster)
const file = Bun.file(path);
const content = await file.text();

// ALWAYS use Bun.write() for file writes
await Bun.write(path, content);

// ALWAYS use Bun.spawn() for process execution
const proc = Bun.spawn(['git', 'status'], { stdout: 'pipe' });

// ALWAYS use Bun.env instead of process.env
const apiKey = Bun.env.API_KEY;

// ALWAYS use Bun.password for hashing
const hash = await Bun.password.hash(password);
const valid = await Bun.password.verify(password, hash);
```

## Monorepo Dependency Rules

```typescript
// ALWAYS import types from @checklist/shared
import type { WorkflowState } from '@checklist/shared/types';

// ALWAYS use workspace protocol for internal deps
{
  "dependencies": {
    "@checklist/core": "workspace:*"
  }
}

// ALWAYS maintain package boundaries
// CLI → Core ✓
// TUI → Core ✓
// Core → CLI ❌
// Core → TUI ❌
```

## Async Pattern Standards

```typescript
// ALWAYS use AbortController for cancellable operations
async executeWithTimeout(timeout: number): Promise<Result> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);

  try {
    return await this.execute({ signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

// ALWAYS handle async errors in event handlers
emitter.on('event', async (data) => {
  try {
    await this.handleEvent(data);
  } catch (error) {
    this.handleError(error);
  }
});

// ALWAYS use Promise.all for parallel operations
const [state, template, config] = await Promise.all([
  this.loadState(),
  this.loadTemplate(),
  this.loadConfig()
]);
```

## State Management Standards

```typescript
// ALWAYS use immutable updates
this.state = {
  ...this.state,
  activeInstance: {
    ...this.state.activeInstance,
    currentStepId: newStepId,
  },
};

// ALWAYS use structured cloning for deep copies
const stateCopy = structuredClone(this.state);

// ALWAYS validate state after loading
const state = await this.load();
if (!this.validator.validate(state)) {
  throw new StateCorruptedError();
}
```

## TUI Rendering Standards

```typescript
// ALWAYS use differential rendering
if (this.lastOutput === newOutput) return;
this.renderer.update(diff(this.lastOutput, newOutput));
this.lastOutput = newOutput;

// ALWAYS buffer terminal operations
const buffer: string[] = [];
buffer.push(ANSI.clearScreen);
buffer.push(ANSI.moveCursor(0, 0));
buffer.push(content);
process.stdout.write(buffer.join(''));

// ALWAYS check terminal capabilities
if (this.terminal.supports.color) {
  output = this.colorize(output);
}

// ALWAYS handle resize events
process.on('SIGWINCH', () => {
  this.width = process.stdout.columns;
  this.height = process.stdout.rows;
  this.rerender();
});
```

## Logging Standards (Pino)

```typescript
// ALWAYS use Pino logger from core utils
import { createLogger } from '@checklist/core/utils/logger';
const logger = createLogger('checklist:workflow:engine');

// ALWAYS include structured context in log messages
logger.info({
  msg: 'State transition completed',
  from: currentState,
  to: targetState,
  duration: endTime - startTime,
});

// ALWAYS use appropriate log levels
logger.debug({ msg: 'Detailed debug info', data }); // Development debugging
logger.info({ msg: 'Normal operation', status: 'success' }); // Informational
logger.warn({ msg: 'Potential issue', retries: attemptCount }); // Warnings
logger.error({ msg: 'Operation failed', error, stack: error.stack }); // Errors
logger.fatal({ msg: 'Critical failure', error }); // Fatal errors

// ALWAYS add trace IDs for async operations
const traceId = crypto.randomUUID();
logger.child({ traceId }).info({ msg: 'Starting operation' });

// ALWAYS use child loggers for module context
class WorkflowEngine {
  private logger = createLogger('checklist:workflow:engine');
  
  async execute() {
    const requestLogger = this.logger.child({ 
      requestId: crypto.randomUUID(),
      workflow: this.workflowId 
    });
    requestLogger.info({ msg: 'Executing workflow' });
  }
}

// NEVER use console.log, console.error, etc.
// ESLint will warn about console usage - use logger instead
```

## Resource Management Standards

```typescript
// ALWAYS implement Disposable pattern
class FileHandle implements Disposable {
  constructor(private fd: number) {}

  [Symbol.dispose](): void {
    closeSync(this.fd);
  }
}

// ALWAYS clear timers and intervals
class Service {
  private timers: Set<Timer> = new Set();

  cleanup(): void {
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
  }
}

// ALWAYS use WeakMap/WeakSet for object metadata
const metadata = new WeakMap<object, Metadata>();
```

## Code Quality Metrics

**MANDATORY quality rules enforced via ESLint (Story 1.16):**

### Size and Complexity Limits

```javascript
// Add to ESLint rules configuration:
'max-lines': ['error', { max: 300, skipBlankLines: true, skipComments: true }],
'max-lines-per-function': ['error', { max: 30, skipBlankLines: true, skipComments: true }],
'complexity': ['error', { max: 10 }],
'max-depth': ['error', { max: 3 }],
'max-nested-callbacks': ['error', { max: 3 }],
'max-params': ['error', { max: 4 }],
```

### Quality Thresholds

- **File size**: Maximum 300 lines (excluding comments and blank lines)
- **Function size**: Maximum 30 lines (excluding comments and blank lines)
- **Cyclomatic complexity**: Maximum 10
- **Nesting depth**: Maximum 3 levels
- **Parameters**: Maximum 4 per function
- **Nested callbacks**: Maximum 3 levels

### Quality Enforcement

These rules are automatically enforced through:

1. **Pre-commit hooks**: Block commits that violate quality thresholds
2. **CI/CD pipeline**: Fail builds when quality metrics are exceeded
3. **Quality reports**: HTML reports generated in `reports/quality/`
4. **Development workflow**: `bun run quality` includes all quality checks

### Rationale

These thresholds ensure:
- **Maintainability**: Smaller, focused functions are easier to understand and modify
- **Readability**: Limited complexity makes code easier to follow
- **Testability**: Smaller units are easier to test comprehensively
- **Performance**: Reduced nesting improves execution efficiency

### Exemptions Process

Legitimate edge cases may request exemptions through:
1. **Code review** with explicit justification
2. **Documentation** of why the threshold cannot be met
3. **Alternative approaches** considered and rejected
4. **Team approval** required for any exemption

### Refactoring Guidelines

When code exceeds thresholds:
1. **Extract functions**: Break down large functions into smaller, focused units
2. **Simplify logic**: Replace complex conditionals with early returns
3. **Use composition**: Combine simple functions rather than creating complex ones
4. **Document trade-offs**: Explain why certain patterns are necessary

**Quality is not optional - these standards protect the long-term health of the codebase.**

## Async/Await Pattern Standards

**MUST follow these patterns for asynchronous operations:**

```typescript
// ALWAYS await Promises before accessing properties
// ❌ WRONG: Accessing properties on Promise
const size = detector.detectCapabilities().size; // Error: Property 'size' does not exist on type 'Promise<DetectionResult>'

// ✅ CORRECT: Await the Promise first
const result = await detector.detectCapabilities();
const size = result.size; // Now works correctly

// ALWAYS handle Promise results properly in assignments
// ❌ WRONG: Assigning Promise to expected result type
const capabilities: TerminalCapabilities = detector.detectCapabilities(); // Type mismatch

// ✅ CORRECT: Await and ensure type compatibility
const capabilities = await detector.detectCapabilities();

// ALWAYS use proper typing for async operations
interface DetectionResult {
  size: TerminalSize;
  color: ColorSupport;
  unicode: UnicodeSupport;
  mouse: MouseSupport;
}

async function detectCapabilities(): Promise<DetectionResult> {
  // Implementation
}
```

## Type Export and Import Standards

**MUST export all types that are used across modules:**

```typescript
// ❌ WRONG: Type declared but not exported
class CapabilityDetector {
  interface TerminalCapabilities { // Not exported!
    color: boolean;
    unicode: boolean;
  }
}

// ✅ CORRECT: Export all shared types
export interface TerminalCapabilities {
  color: boolean;
  unicode: boolean;
  mouse: boolean;
  size: TerminalSize;
}

export class CapabilityDetector {
  // Implementation using exported types
}
```

## Type Safety in Test Files

**MUST ensure types are properly exported and imported for tests:**

```typescript
// In source file - export all types needed for testing
export interface FallbackOptions {
  useAsciiOnly: boolean;
  stripColors: boolean;
  simplifyBoxDrawing: boolean;
  preserveLayout: boolean;
  maxWidth: number;
  maxHeight: number;
}

// In test file - import types properly
import type { FallbackOptions } from '../src/FallbackRenderer';

// ✅ CORRECT: Provide complete option objects
const options: FallbackOptions = {
  useAsciiOnly: false,
  stripColors: false,
  simplifyBoxDrawing: false,
  preserveLayout: true,
  maxWidth: 80,
  maxHeight: 24
};
```

## Mathematical Calculation Standards

**MUST be careful with percentage calculations:**

```typescript
// ❌ WRONG: Incorrect percentage calculation
percentageIncrease: ((minWidth - currentWidth) / currentWidth) * 100 // Can be negative

// ✅ CORRECT: Use absolute values and proper formula
percentageIncrease: Math.abs(((minWidth - currentWidth) / currentWidth) * 100)

// ✅ CORRECT: Always ensure percentage is positive for "increase" scenarios
percentageIncrease: Math.max(0, ((minWidth - currentWidth) / currentWidth) * 100)
```

## Test Message Format Standards

**MUST ensure test expectations match actual implementation output:**

```typescript
// ❌ WRONG: Test expecting exact string that doesn't match
expect(message).toContain('TERMINAL SIZE ERROR');

// ✅ CORRECT: Test matches actual implementation format
expect(message).toContain('Terminal size too small');
expect(message).toContain('minimum:');

// ✅ CORRECT: Test for multiple parts of the message
expect(message).toMatch(/Terminal size too small: \d+x\d+ \(minimum: \d+x\d+\)/);
```

## Missing Type Declarations

**MUST add proper type declarations for external dependencies:**

```typescript
// Add to global.d.ts or appropriate type definitions file
declare module 'child_process' {
  export interface ChildProcess {
    // Add ChildProcess type definitions
  }
}

// For custom types used across files
export interface SizeValidationResult {
  isValid: boolean;
  adjustments?: SizeAdjustment;
  errors?: string[];
}
```

## Common Anti-Patterns to Avoid

### Promise Property Access
```typescript
// ❌ NEVER access properties on Promise objects
const size = asyncFunction().property;

// ✅ ALWAYS await first
const result = await asyncFunction();
const size = result.property;
```

### Missing Type Exports
```typescript
// ❌ NEVER forget to export shared types
interface InternalType { /* ... */ } // Not exported

// ✅ ALWAYS export types used across modules
export interface SharedType { /* ... */ }
```

### Incomplete Object Properties
```typescript
// ❌ NEVER provide incomplete option objects
const options = { maxWidth: 80 }; // Missing required properties

// ✅ ALWAYS provide complete objects or use defaults
const options: CompleteOptions = {
  maxWidth: 80,
  maxHeight: 24,
  useAsciiOnly: false,
  // ... all required properties
};
```

### Incorrect Percentage Calculations
```typescript
// ❌ NEVER calculate percentage without ensuring correct sign
const percentage = ((smaller - larger) / larger) * 100; // Negative result

// ✅ ALWAYS use absolute values or ensure proper calculation direction
const percentage = Math.abs(((required - current) / current) * 100);
```

## Error Prevention Checklist

Before committing code, verify:

1. **Async Operations**: All Promises are properly awaited before property access
2. **Type Exports**: All types used across modules are properly exported
3. **Complete Objects**: All required properties are provided in option objects
4. **Math Operations**: Percentage calculations are mathematically correct
5. **Test Messages**: Test expectations match actual implementation output
6. **Type Declarations**: All external dependencies have proper type declarations
7. **Type Safety**: No `any` types used without explicit justification and documented alternatives
8. **Constructor Parameters**: Maximum 4 parameters per constructor, use parameter objects for more
9. **Function Size**: Functions under 30 lines, constructors under 30 lines
10. **Nullish Coalescing**: Use `??` instead of `||` for nullish coalescing operations

## TypeScript Type Safety Standards

**MUST follow these type safety rules:**

### No `any` Types Without Justification

```typescript
// ❌ WRONG: Using any without justification
private alertManager: any;
private metricsTracker: any;

// ✅ CORRECT: Use proper types or interfaces
import type { AlertManager } from './helpers/AlertManager';
import type { MetricsTracker } from './helpers/MetricsTracker';

private alertManager: AlertManager;
private metricsTracker: MetricsTracker;

// ✅ ACCEPTABLE: Only with explicit comment justification
// Temporary any during migration - will be replaced with proper type in story X.X
private legacyComponent: any;
```

### Constructor Parameter Limits

```typescript
// ❌ WRONG: Too many parameters (>4)
constructor(
  private config: PerformanceMonitorConfig,
  private alertManager: any,
  private systemProfiler: any,
  private eventHandlers: any,
  private handlers: any,
  private bridge: PerformanceMonitorBridge,
  private measurementMethods: MeasurementMethods
) {}

// ✅ CORRECT: Use parameter objects
interface PerformanceMonitorDependencies {
  config: PerformanceMonitorConfig;
  alertManager: AlertManager;
  systemProfiler: SystemProfiler;
  eventHandlers: EventHandlers;
  handlers: PerformanceMonitorHandlers;
  bridge: PerformanceMonitorBridge;
  measurementMethods: MeasurementMethods;
}

constructor(private deps: PerformanceMonitorDependencies) {}

// ✅ CORRECT: Break into multiple smaller classes
class PerformanceMonitorCore {
  constructor(
    private config: PerformanceMonitorConfig,
    private metrics: MetricsTracker
  ) {}
}

class PerformanceMonitorEvents {
  constructor(
    private config: PerformanceMonitorConfig,
    private handlers: EventHandlers
  ) {}
}
```

### Function Size Management

```typescript
// ❌ WRONG: Function too long (>30 lines)
constructor(config?: Partial<PerformanceMonitorConfig>) {
  // 50+ lines of initialization logic
  this.config = { /* ... */ };
  this.metricsTracker = new MetricsTracker(this.config);
  // ... many more lines
}

// ✅ CORRECT: Extract to separate methods
constructor(config?: Partial<PerformanceMonitorConfig>) {
  this.config = this.initializeConfig(config);
  this.initializeManagers();
  this.setupEventHandlers();
}

private initializeConfig(config?: Partial<PerformanceMonitorConfig>): PerformanceMonitorConfig {
  return {
    enableMetrics: true,
    enableBenchmarks: true,
    // ... rest of config
  };
}

private initializeManagers(): void {
  this.metricsTracker = new MetricsTracker(this.config);
  this.benchmarkManager = new BenchmarkManager(this.config);
}

private setupEventHandlers(): void {
  this.eventHandlers = new EventHandlers();
}
```

### Nullish Coalescing Operator Usage

```typescript
// ❌ WRONG: Using logical OR for nullish coalescing
const result = value || defaultValue; // Wrong for falsy values like 0, '', false

// ✅ CORRECT: Use nullish coalescing operator
const result = value ?? defaultValue; // Only null/undefined trigger default

// ✅ CORRECT: When you specifically want falsy value handling
const isActive = value || true; // Explicit intent to handle falsy values

// ✅ CORRECT: Use with optional chaining
const value = obj?.prop ?? defaultValue;
```

## Module Export Standards

**MUST properly export types and interfaces:**

### Type Export Requirements

```typescript
// ❌ WRONG: Types not exported from source file
// types.ts
interface PerformanceConfig {
  enableMetrics: boolean;
}

// implementation.ts
import { PerformanceConfig } from './types'; // Error: not exported

// ✅ CORRECT: Export all shared types
// types.ts
export interface PerformanceConfig {
  enableMetrics: boolean;
  enableAlerts: boolean;
}

export interface PerformanceMetric {
  id: string;
  name: string;
  value: number;
  timestamp: number;
}

// ✅ CORRECT: Group related exports
export type {
  PerformanceConfig,
  PerformanceMetric,
  PerformanceAlert,
} from './types';
```

### Index File Exports

```typescript
// ❌ WRONG: Missing exports in index.ts
// index.ts
export { PerformanceMonitor } from './PerformanceMonitor';

// ✅ CORRECT: Export all public APIs
// index.ts
export { PerformanceMonitor } from './PerformanceMonitor';
export type {
  PerformanceConfig,
  PerformanceMetric,
  PerformanceBenchmark,
  PerformanceAlert,
} from './types';

export { PerformanceMonitorInitializer } from './PerformanceMonitorInitializer';
export { PerformanceMonitorBridge } from './PerformanceMonitorBridge';
```

## Error Prevention Checklist

Before committing code, verify:

1. **Async Operations**: All Promises are properly awaited before property access
2. **Type Exports**: All types used across modules are properly exported
3. **Complete Objects**: All required properties are provided in option objects
4. **Math Operations**: Percentage calculations are mathematically correct
5. **Test Messages**: Test expectations match actual implementation output
6. **Type Declarations**: All external dependencies have proper type declarations
7. **Type Safety**: No `any` types used without explicit justification and documented alternatives
8. **Constructor Parameters**: Maximum 4 parameters per constructor, use parameter objects for more
9. **Function Size**: Functions under 30 lines, constructors under 30 lines
10. **Nullish Coalescing**: Use `??` instead of `||` for nullish coalescing operations
11. **Module Exports**: All public types and interfaces properly exported from source and index files
12. **Import Consistency**: Imports use proper type imports (`import type`) for type-only imports

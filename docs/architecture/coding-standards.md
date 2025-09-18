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

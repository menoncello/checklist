# Story 1.1: Project Setup and Structure

## Story

**As a** developer,  
**I want** a properly configured Bun/TypeScript project with modular architecture,  
**so that** the codebase is maintainable and supports both CLI and TUI interfaces.

## Acceptance Criteria

### Project Initialization

1. ✅ Run `bun init` in project root
2. ✅ Configure TypeScript with strict mode
3. ✅ Set up monorepo with Bun workspaces
4. ✅ Create package directories
5. ✅ Configure build scripts
6. ✅ Set up git with .gitignore
7. ✅ Add README with setup instructions
8. ✅ Define performance budgets

### Technical Tasks

```bash
# 1. Initialize Bun project
cd checklist
bun init -y

# 2. Set up TypeScript
bun add -d typescript @types/bun
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "types": ["bun-types"],
    "lib": ["ESNext"],
    "outDir": "dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@checklist/core": ["packages/core/src/index.ts"],
      "@checklist/cli": ["packages/cli/src/index.ts"],
      "@checklist/tui": ["packages/tui/src/index.ts"],
      "@checklist/shared": ["packages/shared/src/index.ts"]
    }
  },
  "include": ["packages/*/src/**/*"],
  "exclude": ["node_modules", "dist"]
}
EOF

# 3. Configure monorepo workspace
cat > package.json << 'EOF'
{
  "name": "@bmad/checklist",
  "version": "0.0.1",
  "private": true,
  "workspaces": [
    "packages/*"
  ],
  "scripts": {
    "dev": "bun run --watch packages/cli/src/index.ts",
    "build": "bun run build:all",
    "build:all": "bun run build:core && bun run build:cli && bun run build:tui",
    "build:core": "cd packages/core && bun run build",
    "build:cli": "cd packages/cli && bun run build",
    "build:tui": "cd packages/tui && bun run build",
    "test": "bun test",
    "test:watch": "bun test --watch",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "quality": "bun run lint && bun run format:check && bun run typecheck",
    "quality:fix": "bun run lint:fix && bun run format && bun run typecheck",
    "prepare": "husky"
  },
  "lint-staged": {
    "*.{ts,tsx,js,jsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{md,json,yaml,yml}": [
      "prettier --write"
    ]
  },
  "devDependencies": {
    "@types/bun": "^1.1.0",
    "@typescript-eslint/eslint-plugin": "^6.21.0",
    "@typescript-eslint/parser": "^6.21.0",
    "eslint": "^8.57.0",
    "eslint-config-prettier": "^9.1.0",
    "eslint-plugin-import": "^2.29.1",
    "eslint-plugin-prettier": "^5.1.3",
    "eslint-plugin-unused-imports": "^3.0.0",
    "husky": "^9.0.11",
    "lint-staged": "^15.2.2",
    "prettier": "^3.2.5",
    "typescript": "^5.3.0"
  }
}
EOF

# 4. Create package directories
mkdir -p packages/{core,cli,tui,shared}/src
mkdir -p packages/{core,cli,tui,shared}/tests

# 5. Initialize each package
for pkg in core cli tui shared; do
  cat > packages/$pkg/package.json << EOF
{
  "name": "@checklist/$pkg",
  "version": "0.0.1",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "scripts": {
    "build": "bun build ./src/index.ts --outdir=dist --target=bun",
    "test": "bun test",
    "lint": "eslint src --ext .ts,.tsx",
    "lint:fix": "eslint src --ext .ts,.tsx --fix",
    "format": "prettier --write src",
    "format:check": "prettier --check src",
    "type-check": "tsc --noEmit"
  }
}
EOF

  cat > packages/$pkg/src/index.ts << EOF
export const version = '0.0.1';
console.log('Package @checklist/$pkg initialized');
EOF
done

# 6. Set up ESLint and Prettier (MANDATORY)
bun add -d eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
bun add -d prettier eslint-config-prettier eslint-plugin-prettier
bun add -d eslint-plugin-import eslint-plugin-unused-imports
bun add -d husky lint-staged

# 7. Configure ESLint (ESLint 9.x Flat Config)
cat > eslint.config.js << 'EOF'
import typescriptEslint from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';
import importPlugin from 'eslint-plugin-import';
import unusedImportsPlugin from 'eslint-plugin-unused-imports';

export default [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      parser,
      parserOptions: {
        project: './tsconfig.json'
      }
    },
    plugins: {
      '@typescript-eslint': typescriptEslint,
      'import': importPlugin,
      'unused-imports': unusedImportsPlugin
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
      'import/order': ['error', {
        'groups': [
          'builtin',
          'external',
          'internal',
          'parent',
          'sibling',
          'index'
        ],
        'alphabetize': { 'order': 'asc' }
      }],
      'unused-imports/no-unused-imports': 'error',

      // Code quality (MANDATORY)
      'no-console': 'warn', // Use debug logger instead
      'no-debugger': 'error',
      'no-alert': 'error',
      'prefer-const': 'error',
      'no-var': 'error',

      // Bun-specific patterns (MANDATORY)
      'no-restricted-syntax': ['error', {
        'selector': "CallExpression[callee.object.name='process'][callee.property.name='env']",
        'message': 'Use Bun.env instead of process.env for better performance'
      }],

      // Security rules (MANDATORY)
      'no-eval': 'error',
      'no-implied-eval': 'error',
      'no-new-func': 'error'
    }
  }
];
EOF

# 8. Configure Prettier (MANDATORY)
cat > .prettierrc.js << 'EOF'
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

  // Specific overrides
  overrides: [
    {
      files: '*.md',
      options: {
        printWidth: 100,
        proseWrap: 'preserve'
      }
    }
  ]
};
EOF

# 9. Configure Pre-commit hooks (MANDATORY)
npx husky init
cat > .husky/pre-commit << 'EOF'
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

# Run quality checks
bun run quality

# Run tests on changed files
bun test --changed

# Security audit
bun audit --audit-level moderate
EOF
chmod +x .husky/pre-commit

# 10. Create VSCode settings for team consistency (MANDATORY)
mkdir -p .vscode
cat > .vscode/settings.json << 'EOF'
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "typescript.preferences.includePackageJsonAutoImports": "off",
  "eslint.workingDirectories": ["packages/*"],
  "files.exclude": {
    "**/node_modules": true,
    "**/dist": true,
    "**/*.tsbuildinfo": true
  }
}
EOF

cat > .vscode/extensions.json << 'EOF'
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "dbaeumer.vscode-eslint",
    "ms-vscode.vscode-typescript-next",
    "usernamehw.errorlens"
  ]
}
EOF

# 11. Create .gitignore
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
bun.lockb

# Build outputs
dist/
*.tsbuildinfo

# Test coverage
coverage/
.nyc_output/

# Environment
.env
.env.local
.env.*.local

# OS
.DS_Store
Thumbs.db

# IDE
.vscode/
.idea/
*.swp
*.swo

# Logs
*.log
npm-debug.log*

# Checklist state files
.checklist/
!.checklist/.gitkeep
EOF

# 8. Create test structure
mkdir -p tests/{unit,integration,e2e}
cat > tests/smoke.test.ts << 'EOF'
import { expect, test } from "bun:test";
Wrote 1776 lin
test("Bun environment is configured", () => {
  expect(Bun.version).toBeDefined();
  expect(parseFloat(Bun.version)).toBeGreaterThanOrEqual(1.1);
});

test("TypeScript compilation works", async () => {
  const proc = Bun.spawn(["bun", "run", "typecheck"]);
  const exitCode = await proc.exited;
  expect(exitCode).toBe(0);
});
EOF
```

### Performance Budget Configuration

```typescript
// performance.config.ts
export const PERFORMANCE_BUDGET = {
  startup: {
    target: 50, // ms
    max: 100, // ms
  },
  memory: {
    target: 30, // MB
    max: 50, // MB
  },
  operation: {
    target: 10, // ms
    max: 100, // ms
  },
  binarySize: {
    target: 15, // MB
    max: 20, // MB
  },
};
```

## Definition of Done

- [ ] `bun install` completes without errors
- [ ] `bun test` runs smoke tests successfully
- [ ] `bun run typecheck` passes
- [ ] `bun run lint` passes without errors
- [ ] `bun run format:check` passes
- [ ] `bun run quality` passes all checks
- [ ] All 4 packages created and linked
- [ ] Git repository initialized with proper .gitignore
- [ ] ESLint and Prettier configurations active
- [ ] Pre-commit hooks configured and working
- [ ] README includes setup instructions
- [ ] Performance budgets defined and documented
- [ ] VSCode settings configured for team consistency

## Time Estimate

**4-6 hours**

## Dependencies

- Story 0.0 (Environment Setup) must be complete

## Notes

- Use Bun workspaces instead of npm/yarn workspaces
- Keep TypeScript config strict from the start
- Ensure all packages can be built independently
- Set up CI-friendly scripts

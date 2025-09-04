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
    "format": "prettier --write ."
  },
  "devDependencies": {
    "@types/bun": "^1.1.0",
    "typescript": "^5.3.0",
    "eslint": "^8.57.0",
    "prettier": "^3.2.0"
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
    "test": "bun test"
  }
}
EOF

  cat > packages/$pkg/src/index.ts << EOF
export const version = '0.0.1';
console.log('Package @checklist/$pkg initialized');
EOF
done

# 6. Set up ESLint and Prettier
bun add -d eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
bun add -d prettier eslint-config-prettier eslint-plugin-prettier

# 7. Create .gitignore
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
    target: 50,  // ms
    max: 100     // ms
  },
  memory: {
    target: 30,  // MB
    max: 50      // MB  
  },
  operation: {
    target: 10,  // ms
    max: 100     // ms
  },
  binarySize: {
    target: 15,  // MB
    max: 20      // MB
  }
};
```

## Definition of Done
- [ ] `bun install` completes without errors
- [ ] `bun test` runs smoke tests successfully
- [ ] `bun run typecheck` passes
- [ ] All 4 packages created and linked
- [ ] Git repository initialized with proper .gitignore
- [ ] README includes setup instructions
- [ ] Performance budgets defined and documented

## Time Estimate
**4-6 hours**

## Dependencies
- Story 0.0 (Environment Setup) must be complete

## Notes
- Use Bun workspaces instead of npm/yarn workspaces
- Keep TypeScript config strict from the start
- Ensure all packages can be built independently
- Set up CI-friendly scripts
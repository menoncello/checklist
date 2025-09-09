# Contributing to BMAD Checklist Manager

Welcome to the BMAD Checklist Manager project! We're excited that you're interested in contributing. This guide will help you get started quickly and ensure your contributions align with our project standards.

## 🚀 Quick Start

Get up and running in under 30 minutes:

```bash
# Clone the repository
git clone https://github.com/your-org/bmad-checklist.git
cd bmad-checklist

# Run the automated setup
bun run setup:dev

# Verify everything works
bun test

# Start development
bun dev
```

## 📋 Table of Contents

- [Project Overview](#project-overview)
- [Development Setup](#development-setup)
- [Development Workflow](#development-workflow)
- [Code Style Guidelines](#code-style-guidelines)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Architecture Overview](#architecture-overview)
- [Common Tasks](#common-tasks)
- [Troubleshooting](#troubleshooting)

## Project Overview

BMAD Checklist Manager is a terminal-first workflow management tool that transforms static BMAD checklists into dynamic, interactive workflows. Built with Bun and TypeScript, it provides both CLI and TUI interfaces for managing development workflows.

### Key Technologies

- **Runtime:** Bun 1.1.x
- **Language:** TypeScript 5.9+
- **Architecture:** Monorepo with Bun workspaces
- **Testing:** Bun's native test runner
- **State:** YAML-based file storage

### Performance Requirements

- All operations must complete in <100ms
- Memory usage must stay under 50MB
- Binary size must be under 20MB
- TUI must maintain 60fps with 1000+ items

## Development Setup

### Prerequisites

- Bun 1.1.x or later (`curl -fsSL https://bun.sh/install | bash`)
- Git 2.30+
- Terminal with UTF-8 support
- VS Code recommended (but not required)

### Automated Setup

```bash
# Run the development setup script
bun run setup:dev

# This will:
# 1. Install all dependencies
# 2. Set up git hooks
# 3. Configure your IDE
# 4. Create necessary config files
# 5. Run initial tests
```

### Manual Setup

If the automated setup fails:

```bash
# Install dependencies
bun install

# Set up git hooks
bun run hooks:install

# Copy environment template
cp .env.example .env

# Build the project
bun run build

# Run tests to verify
bun test
```

## Development Workflow

### Branch Strategy

We use GitHub Flow with protected main branch:

```bash
# Create feature branch
git checkout -b feature/your-feature-name

# Make changes and commit
git add .
git commit -m "feat: add new feature"

# Push and create PR
git push origin feature/your-feature-name
```

### Commit Convention

We follow [Conventional Commits](https://www.conventionalcommits.org/):

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `style:` Code style changes (formatting, etc)
- `refactor:` Code refactoring
- `perf:` Performance improvements
- `test:` Test additions or fixes
- `chore:` Maintenance tasks

### Development Commands

```bash
# Start development (TUI + CLI)
bun dev

# Run only TUI
bun dev:tui

# Run only CLI
bun dev:cli

# Run tests
bun test              # All tests
bun test:watch       # Watch mode
bun test:coverage    # Coverage report
bun test:smoke       # Smoke tests only

# Code quality
bun lint             # Run ESLint
bun format           # Run Prettier
bun typecheck        # TypeScript checking

# Performance
bun bench            # Run benchmarks
bun profile:cpu      # CPU profiling
bun profile:memory   # Memory profiling
```

## Code Style Guidelines

### TypeScript Standards

```typescript
// ✅ GOOD: Use explicit types
function processStep(step: Step): StepResult {
  return { success: true, stepId: step.id };
}

// ❌ BAD: Avoid any
function processStep(step: any): any {
  return { success: true };
}

// ✅ GOOD: Use Bun APIs
const file = Bun.file(path);
const content = await file.text();

// ❌ BAD: Don't use Node.js fs
import fs from 'fs';
const content = fs.readFileSync(path);
```

### Performance Standards

```typescript
// ✅ GOOD: Check performance budget
const start = performance.now();
await operation();
const duration = performance.now() - start;
if (duration > 100) {
  console.warn(`Operation exceeded 100ms: ${duration}ms`);
}

// ✅ GOOD: Use differential rendering
if (this.lastOutput !== newOutput) {
  this.render(diff(this.lastOutput, newOutput));
  this.lastOutput = newOutput;
}
```

### Error Handling

```typescript
// ✅ GOOD: Specific error types with recovery
try {
  await stateManager.save(state);
} catch (error) {
  if (error instanceof StateCorruptedError) {
    await stateManager.recoverFromBackup();
  } else {
    throw new ChecklistError('Failed to save state', { cause: error });
  }
}
```

## Testing Requirements

### Coverage Requirements

- Minimum 80% code coverage
- 100% coverage for critical paths (state management, workflow engine)
- All edge cases must have tests

### Test Structure

```typescript
import { describe, it, expect, beforeEach } from 'bun:test';

describe('WorkflowEngine', () => {
  let engine: WorkflowEngine;

  beforeEach(() => {
    engine = new WorkflowEngine();
  });

  describe('nextStep', () => {
    it('should advance to next step', async () => {
      // Arrange
      await engine.init(mockTemplate);

      // Act
      const result = await engine.nextStep();

      // Assert
      expect(result.success).toBe(true);
      expect(engine.getCurrentStep()?.id).toBe('step-2');
    });

    it('should handle end of checklist', async () => {
      // Test edge case
    });
  });
});
```

### Performance Tests

```typescript
it('should complete operations within 100ms', async () => {
  const start = performance.now();
  await engine.init(largeTemplate);
  const duration = performance.now() - start;

  expect(duration).toBeLessThan(100);
});
```

## Pull Request Process

### Before Creating a PR

1. **Run all checks locally:**

   ```bash
   bun run checks  # Runs lint, format, typecheck, and tests
   ```

2. **Update documentation** if needed

3. **Add tests** for new functionality

4. **Check performance** impact

### PR Template

```markdown
## Description

Brief description of changes

## Type of Change

- [ ] Bug fix
- [ ] New feature
- [ ] Performance improvement
- [ ] Documentation update

## Testing

- [ ] Unit tests pass
- [ ] E2E tests pass
- [ ] Performance benchmarks pass

## Checklist

- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No new warnings
```

### Review Process

1. All PRs require at least one approval
2. CI must pass (tests, lint, build)
3. Performance benchmarks must not regress
4. Documentation must be updated for API changes

## Architecture Overview

### Monorepo Structure

```
/
├── packages/
│   ├── core/        # Business logic (no UI)
│   ├── cli/         # CLI interface
│   ├── tui/         # Terminal UI
│   └── shared/      # Shared types and utils
├── examples/        # Usage examples
├── docs/           # Documentation
└── scripts/        # Build and dev scripts
```

### Key Architectural Patterns

- **Event-Driven:** Core emits events for state changes
- **Command Pattern:** All actions are commands with undo
- **Repository Pattern:** Abstract state management
- **Sandbox Pattern:** Secure template execution

### Package Dependencies

```
CLI → Core
TUI → Core
Core → Shared
Templates → Core
```

Never create circular dependencies!

## Common Tasks

### Adding a New Feature

1. Create feature branch
2. Update or create stories in `/docs/stories`
3. Implement with TDD approach
4. Update documentation
5. Add to CHANGELOG
6. Create PR

### Debugging

```bash
# Debug with Chrome DevTools
bun --inspect dev

# Debug specific test
bun test --inspect-brk path/to/test

# Enable debug logs
DEBUG=checklist:* bun dev
```

### Creating a Release

```bash
# Version bump and changelog
bun run release:patch  # 1.0.0 → 1.0.1
bun run release:minor  # 1.0.0 → 1.1.0
bun run release:major  # 1.0.0 → 2.0.0

# Build binaries
bun run build:all

# Tag and push
git push --follow-tags
```

## Troubleshooting

### Common Issues

**Bun not found:**

```bash
curl -fsSL https://bun.sh/install | bash
source ~/.bashrc  # or ~/.zshrc
```

**Permission errors:**

```bash
# Fix permissions
chmod +x scripts/*.ts
```

**Test failures on Windows:**

```bash
# Use WSL
wsl --install
# Then run commands inside WSL
```

**Memory issues during development:**

```bash
# Increase memory limit
NODE_OPTIONS="--max-old-space-size=4096" bun dev
```

### Getting Help

- Check existing issues: [GitHub Issues](https://github.com/your-org/bmad-checklist/issues)
- Ask in discussions: [GitHub Discussions](https://github.com/your-org/bmad-checklist/discussions)
- Read the docs: `/docs` directory
- Architecture decisions: `/docs/architecture/decisions/`

## Code of Conduct

We are committed to providing a welcoming and inclusive environment. Please read our [Code of Conduct](CODE_OF_CONDUCT.md) before contributing.

## License

By contributing to BMAD Checklist Manager, you agree that your contributions will be licensed under the project's MIT License.

---

Thank you for contributing to BMAD Checklist Manager! Your efforts help make development workflows better for everyone. 🎉

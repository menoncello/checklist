# Turborepo Usage Guide

This guide covers how to use Turborepo effectively in the Checklist project for fast, intelligent builds and task management.

## Introduction

Turborepo is a high-performance build system for monorepos that provides:
- **Intelligent Caching**: Never rebuild the same code twice
- **Parallel Execution**: Run tasks in parallel when dependencies allow
- **Incremental Builds**: Only rebuild what changed
- **Task Dependencies**: Automatic task ordering based on package relationships

## Quick Start

### Basic Commands

```bash
# Build all packages
turbo run build

# Test all packages
turbo run test

# Run linting
turbo run lint

# Check types
turbo run typecheck
```

### Package-Specific Operations

```bash
# Build a specific package
turbo run build --filter=@checklist/core

# Test a specific package
turbo run test --filter=@checklist/shared

# Lint multiple packages
turbo run lint --filter=@checklist/core --filter=@checklist/tui
```

### Development Workflow

```bash
# Start development server
turbo run dev --filter=@checklist/cli

# Run tests in watch mode
turbo run test:watch --filter=@checklist/core

# Run quality checks on current package
turbo run lint && turbo run typecheck
```

## Package Architecture

### Package Dependencies

```
@checklist/shared  ←  No dependencies
@checklist/core    ←  No dependencies
@checklist/cli     ←  Depends on: @checklist/core, @checklist/shared
@checklist/tui     ←  Depends on: @checklist/core, @checklist/shared
```

### Build Order

Turborepo automatically determines the correct build order:

1. **Phase 1**: `@checklist/shared`, `@checklist/core` (parallel)
2. **Phase 2**: `@checklist/cli`, `@checklist/tui` (parallel, after dependencies)

## Caching Strategy

### How Caching Works

- **Global Hash**: Based on global dependencies (.env, bun.lockb, tsconfig.json)
- **Package Hash**: Based on package-specific inputs (src files, package.json, etc.)
- **Task Hash**: Combines global + package hashes for each task

### Cache Location

```bash
# Local cache
.turbo/

# Package-specific caches
packages/core/.turbo/
packages/cli/.turbo/
packages/tui/.turbo/
packages/shared/.turbo/
```

### Cache Management

```bash
# Clear all caches
rm -rf .turbo

# Force rebuild (ignore cache)
turbo run build --force

# Check cache status (verbose mode)
turbo run build --verbosity=2

# Dry run to see what would execute
turbo run build --dry-run
```

## Task Configuration

### Available Tasks

| Task | Purpose | Dependencies | Caching |
|------|---------|-------------|----------|
| `build` | Compile TypeScript | `^build` | ✅ Outputs cached |
| `test` | Run all tests | `build` | ✅ Outputs cached |
| `test:unit` | Unit tests only | `build` | ✅ Outputs cached |
| `test:integration` | Integration tests | `build` | ✅ Outputs cached |
| `test:coverage` | Coverage report | `build` | ✅ Outputs cached |
| `lint` | ESLint checking | `^lint` | ✅ Results cached |
| `typecheck` | Type checking | `^build` | ✅ Results cached |
| `format` | Code formatting | - | ✅ Results cached |
| `dev` | Development server | `^build` | ❌ Disabled (persistent) |
| `test:watch` | Watch mode testing | `build` | ❌ Disabled (persistent) |

### Task Filtering

```bash
# Filter by package name
turbo run build --filter=@checklist/core

# Filter by package dependencies
turbo run build --filter=@checklist/cli...  # CLI + its dependencies

# Filter by package dependents
turbo run test --filter=...@checklist/core   # Packages that depend on core

# Filter by changed files (git)
turbo run build --filter='[HEAD^1]'

# Multiple filters
turbo run build --filter=@checklist/core --filter=@checklist/shared
```

## Performance Optimization

### Best Practices

1. **Use Package Filtering**: Only run tasks on packages you're working on
2. **Trust the Cache**: Let Turborepo handle incremental builds
3. **Parallel Testing**: Run tests on multiple packages simultaneously
4. **Watch Mode**: Use `test:watch` during development for instant feedback

### Performance Examples

```bash
# Fast development iteration
turbo run test:unit --filter=@checklist/core --watch

# Build only what changed
turbo run build --filter='[HEAD^1]'

# Parallel quality checks
turbo run lint --filter=@checklist/core & turbo run typecheck --filter=@checklist/tui

# CI/CD optimization
turbo run build --team=my-team --token=$TURBO_TOKEN
```

## CI/CD Integration

### GitHub Actions

The project's CI/CD pipeline is configured to use Turborepo:

```yaml
# Environment variables for remote caching
env:
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ secrets.TURBO_TEAM }}
```

### CI Commands

```bash
# Build for deployment
turbo run build

# Full test suite
turbo run test:coverage

# Quality gates
turbo run lint && turbo run typecheck
```

## Troubleshooting

### Common Issues

**Issue: Cache not invalidating**
```bash
# Clear cache and rebuild
rm -rf .turbo
turbo run build
```

**Issue: Tasks not running in expected order**
```bash
# Check task dependencies
turbo run build --graph

# Verify dependsOn configuration in turbo.json
```

**Issue: Package filtering not working**
```bash
# List available packages
turbo ls

# Check package names
cat packages/*/package.json | grep '"name"'
```

### Debug Commands

```bash
# Verbose task execution
turbo run build --verbosity=3

# Show task graph
turbo run build --graph

# Inspect cache hash inputs
turbo run build --verbosity=2 | grep "hash"
```

## Advanced Usage

### Remote Caching

For team collaboration, configure remote caching:

```bash
# Set up remote cache
turbo link

# Share cache with team
turbo run build --team=my-team
```

### Custom Tasks

Add custom tasks to `turbo.json`:

```json
{
  "tasks": {
    "custom": {
      "dependsOn": ["build"],
      "outputs": ["dist/**"],
      "inputs": ["src/**/*.ts", "custom-config.json"]
    }
  }
}
```

### Environment Variables

```bash
# Development mode
NODE_ENV=development turbo run build

# Production mode
NODE_ENV=production turbo run build

# Custom environment
MY_ENV=var turbo run test
```

## Migration Notes

This project migrated from custom Bun scripts to Turborepo with these benefits:

- **95% faster builds**: Cold builds went from ~8.5s to ~171ms
- **Intelligent caching**: 80%+ cache hit rates for incremental changes
- **Parallel execution**: 30-50% faster through task parallelization
- **Better CI/CD**: Remote caching and dependency management

### Legacy Commands

Legacy commands are still available with `:legacy` suffix:

```bash
# Old: bun run build:all
# New: bun run build
# Legacy: bun run build:all:legacy
```

## Getting Help

- **Turborepo Documentation**: https://turbo.build/repo/docs
- **Project Issues**: Open an issue on the project repository
- **Community**: Join the project Discord for real-time help

## Reference

### Task Command Reference

| Command | Description |
|---------|-------------|
| `turbo run build` | Build all packages |
| `turbo run test` | Run all tests |
| `turbo run lint` | Run linting |
| `turbo run typecheck` | Type checking |
| `turbo run dev` | Development servers |
| `turbo run format` | Code formatting |
| `turbo clean` | Clean all caches (not available, use `rm -rf .turbo`) |

### Filter Reference

| Filter | Description |
|--------|-------------|
| `--filter=package-name` | Run on specific package |
| `--filter=package-name...` | Run on package + dependencies |
| `--filter=...package-name` | Run on package + dependents |
| `--filter='[commit]'` | Run on packages changed since commit |
| `--filter='[commit]...'` | Include dependencies of changed packages |
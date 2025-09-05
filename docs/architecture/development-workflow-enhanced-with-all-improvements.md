# Development Workflow (Enhanced with All Improvements)

## Development Container Setup

```dockerfile
# .devcontainer/Dockerfile
FROM oven/bun:1.1-slim

RUN apt-get update && apt-get install -y \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

RUN bun add -g @stryker-mutator/core

WORKDIR /workspace
COPY package.json bun.lockb ./
RUN bun install
```

## Development Commands (Complete)

```bash
# Development
bun run dev              # Start all services
bun run dev:tui          # TUI only
bun run dev:cli          # CLI only

# State Management
bun run dev:reset        # Reset to clean state
bun run dev:backup       # Backup current dev state
bun run dev:restore      # Restore from backup
bun run dev:snapshot     # Create named snapshot
bun run dev:load-fixture # Load test fixture state

# Testing
bun run test:unit        # Unit tests only
bun run test:integration # Integration tests
bun run test:e2e        # End-to-end tests
bun run test:smoke      # Quick smoke tests
bun run test:all        # All test suites
bun run test:mutation   # StrykerJS mutation tests
bun run test:debug      # Run tests with debugger
bun run test:verbose    # Verbose output
bun run test:failed     # Re-run only failed tests

# Performance
bun run profile:cpu     # CPU profiling with --inspect
bun run profile:memory  # Memory profiling
bun run profile:startup # Startup time analysis
bun run bench          # Run benchmarks
bun run perf:baseline  # Create performance baseline
bun run perf:compare   # Compare against baseline

# Security
bun run security:audit   # Audit dependencies
bun run security:scan    # Semgrep security scan
bun run security:secrets # Scan for hardcoded secrets
bun run security:sandbox # Test template sandbox

# Build
bun run build           # Build all packages
bun run compile        # Create binary
bun run clean          # Clean build artifacts
```

## Cross-Platform CI

```yaml
name: Cross-Platform Testing
on: [push, pull_request]

jobs:
  test:
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        bun-version: [1.1.x, latest]
    runs-on: ${{ matrix.os }}
    steps:
      - uses: actions/checkout@v3
      - uses: oven-sh/setup-bun@v1
        with:
          bun-version: ${{ matrix.bun-version }}
      - run: bun install
      - run: bun test
      - run: bun run build
      - run: bun run compile
```

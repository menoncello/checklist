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
bunx stryker run   # StrykerJS mutation tests via command runner (85% threshold)
bunx stryker run --incremental # Incremental mutation testing for PRs (Story 1.12)
bun run test:debug      # Run tests with debugger
bun run test:verbose    # Verbose output
bun run test:failed     # Re-run only failed tests

# Logging
bun run logs:tail       # Tail all log files
bun run logs:tail:error # Tail error logs only
bun run logs:clean      # Clean old log files
bun run logs:analyze    # Analyze log patterns
LOG_LEVEL=debug bun run dev # Run with debug logging

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
      - run: bun run test:mutation
      - run: bun run build
      - run: bun run compile
```

## Logging Workflow

### Development Logging

```bash
# Set log level via environment variable
LOG_LEVEL=debug bun run dev     # Debug level
LOG_LEVEL=info bun run dev      # Info level (default)
LOG_LEVEL=warn bun run dev      # Warning and above
LOG_LEVEL=error bun run dev     # Error and above

# View logs in real-time
bun run logs:tail              # All logs
bun run logs:tail:error        # Error logs only

# Analyze log patterns
bun run logs:analyze           # Generate log analysis report
```

### Production Logging

```typescript
// Logger configuration for production
const logger = createLogger('module-name', {
  level: process.env.LOG_LEVEL || 'info',
  transport: [
    { target: 'pino/file', options: { destination: '.logs/app.log' } },
    { target: 'pino-roll', options: { file: '.logs/app', size: '10M' } },
    // Add 3rd party service transport here
  ]
});
```

## Mutation Testing Workflow

### Initial Setup

```bash
# Run initial mutation testing to establish baseline (Story 1.12)
bunx stryker run

# View mutation report
open reports/mutation/index.html

# Analyze surviving mutants
bunx stryker run --reporter json | jq '.mutants[] | select(.status == "survived")'
```

### Improving Mutation Score

1. **Identify Gaps**: Review surviving mutants in the HTML report
2. **Write Tests**: Target specific mutations with new test cases
3. **Verify**: Re-run mutation testing to confirm improvements
4. **CI Integration**: Ensure mutation score meets 85% threshold

```bash
# Run incremental mutation testing (faster for PRs)
bunx stryker run --incremental

# Check current mutation score
bunx stryker run --reporter progress
```

### CI/CD Pipeline Integration

The mutation testing runs automatically in CI and will fail if:
- Mutation score drops below 85%
- Critical modules have score below 90%
- New code lacks adequate test coverage

```

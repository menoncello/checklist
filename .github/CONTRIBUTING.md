# Contributing to Checklist

## CI/CD Workflows

### Overview

Our CI/CD pipeline uses GitHub Actions to ensure code quality and automate releases. All code must pass through our quality gates before merging.

### Workflow Files

- **`.github/workflows/main.yml`** - Main CI pipeline (tests, linting, type checking)
- **`.github/workflows/build.yml`** - Multi-platform binary builds
- **`.github/workflows/benchmark.yml`** - Performance benchmarking
- **`.github/workflows/security.yml`** - Security scanning (npm audit, Semgrep, Gitleaks)
- **`.github/workflows/coverage.yml`** - Coverage reporting and enforcement (>80%)
- **`.github/workflows/release.yml`** - Automated releases on version tags

### Branch Protection

The `main` branch has the following protection rules:

1. **Required PR Reviews**: At least 1 approval required
2. **Required Status Checks**: All CI checks must pass
3. **Up-to-date branches**: Must be current with main before merge
4. **No force pushes**: Direct pushes and force pushes disabled
5. **No deletions**: Branch deletion protection enabled

To set up branch protection (requires admin access):

```bash
# Using GitHub CLI
gh api repos/:owner/:repo/branches/main/protection \
  --method PUT \
  --field required_status_checks='{"strict":true,"contexts":["test","build","security"]}' \
  --field enforce_admins=true \
  --field required_pull_request_reviews='{"required_approving_review_count":1}' \
  --field restrictions=null \
  --field allow_force_pushes=false \
  --field allow_deletions=false
```

### Running CI Locally

Before pushing, validate your changes locally:

```bash
# Run all quality checks
bun run quality

# Individual checks
bun test                    # Run tests
bun run lint               # Check linting
bun run format:check       # Check formatting
bun run type-check         # TypeScript validation
bun test --coverage        # Check coverage

# Performance benchmarks
bun run bench              # Run benchmarks
bun run bench:assert       # Validate performance
```

### Release Process

Releases are automated via semantic versioning:

1. **Create Release Tag**:
   ```bash
   # For a new release
   git tag v1.0.0
   git push origin v1.0.0
   
   # For pre-releases
   git tag v1.0.0-beta.1
   git push origin v1.0.0-beta.1
   ```

2. **Automated Steps**:
   - Tests run to validate code
   - Binaries built for all platforms
   - Binary size validated (<20MB)
   - Changelog generated from commits
   - GitHub Release created with assets
   - npm package prepared (dry-run)

3. **Release Types**:
   - **Production**: `v1.0.0` - Full release to npm
   - **Pre-release**: `v1.0.0-rc.1` - Release candidate
   - **Beta**: `v1.0.0-beta.1` - Beta testing
   - **Alpha**: `v1.0.0-alpha.1` - Early testing

### Required Secrets

Configure these in GitHub Settings → Secrets:

- **`NPM_TOKEN`** - For npm package publishing (when ready)
- Future: API tokens for external services

### Environment Variables

No special environment variables required for CI. The workflows use:
- `GITHUB_TOKEN` - Automatically provided by GitHub Actions
- `NPM_TOKEN` - Only for npm publishing (optional initially)

### Performance Baselines

Performance benchmarks compare against baselines in `.performance/baselines/`:

- Startup time: <50ms
- Memory usage: <30MB
- Operation time: <10ms per operation
- Binary size: <20MB

Failed benchmarks will block PR merges.

### Coverage Requirements

- **Minimum**: 80% code coverage enforced
- **Reports**: Available in PR comments
- **Badges**: Coverage badge in README

### Security Scanning

All PRs are scanned for:
- Known vulnerabilities (npm audit)
- Security anti-patterns (Semgrep)
- Leaked secrets (Gitleaks)
- SAST analysis results

### Troubleshooting CI Issues

#### Test Failures
- Check test output in Actions tab
- Run `bun test` locally to reproduce
- Ensure all dependencies installed: `bun install`

#### Build Failures
- Verify TypeScript compiles: `bun run type-check`
- Check for platform-specific issues
- Validate Bun version: `bun --version` (requires 1.1.x)

#### Coverage Drops
- Run `bun test --coverage` locally
- Add tests for new code
- Check `.gitignore` isn't excluding test files

#### Performance Regressions
- Run `bun run bench` locally
- Compare with `.performance/baselines/`
- Profile with Chrome DevTools if needed

### Windows CI Considerations

Windows builds may be slower (2-3x Linux speed). We've configured:
- Extended timeouts for Windows jobs
- Parallel job execution where possible
- Caching for faster subsequent runs

### Getting Help

- Check workflow logs in GitHub Actions tab
- Review this documentation
- Ask in discussions or create an issue
- Tag maintainers for urgent CI problems
# ADR-001: CI/CD Platform and Tool Choices

## Status
Accepted

## Context
We need a robust CI/CD pipeline that supports multi-platform builds, automated testing, and release management for our TypeScript/Bun-based checklist application.

## Decision

### CI/CD Platform: GitHub Actions

**Chosen:** GitHub Actions

**Alternatives Considered:**
- GitLab CI
- CircleCI
- Jenkins
- Azure DevOps

**Rationale:**
- Native GitHub integration (where our code lives)
- Free tier sufficient for public repos (2000 minutes/month)
- Excellent marketplace of pre-built actions
- Matrix builds for cross-platform testing
- Built-in secret management
- Integrated with GitHub Releases

### Build Tool: Bun Native Compilation

**Chosen:** `bun build --compile`

**Rationale:**
- Native single-binary output
- No runtime dependencies
- Fast compilation
- Cross-compilation support
- Small binary size (<20MB)

### Testing Framework: Bun Test

**Chosen:** Bun Test (built-in)

**Rationale:**
- Zero configuration
- Fast execution
- Built-in coverage reporting
- Native TypeScript support
- Snapshot testing included

### Security Scanning Stack

**Chosen:**
- npm audit (dependency vulnerabilities)
- Semgrep (SAST)
- Gitleaks (secret detection)

**Rationale:**
- Comprehensive coverage of security concerns
- Free for open source
- SARIF output for GitHub Security tab
- Low false positive rate

### Performance Testing: Tinybench

**Chosen:** Tinybench 2.5.x

**Rationale:**
- Lightweight micro-benchmarking
- Statistical analysis built-in
- Easy baseline comparison
- Works well with Bun

## Consequences

### Positive
- Fast CI/CD pipeline execution
- No infrastructure to maintain
- Good developer experience
- Strong security posture
- Reliable cross-platform builds

### Negative
- Vendor lock-in to GitHub
- Limited customization compared to self-hosted
- 2000 minute limit on free tier
- Windows builds slower than Linux/macOS

### Mitigations
- Keep workflows portable (standard YAML)
- Abstract complex logic into scripts
- Cache dependencies aggressively
- Run Windows builds only when necessary

## Implementation Notes

### Workflow Structure
```
.github/workflows/
├── main.yml       # Primary CI (test, lint, type-check)
├── build.yml      # Multi-platform builds
├── benchmark.yml  # Performance testing
├── security.yml   # Security scanning
├── coverage.yml   # Coverage reporting
└── release.yml    # Release automation
```

### Required Secrets
- `NPM_TOKEN` - For package publishing (future)

### Branch Protection
- All checks must pass before merge
- At least 1 review required
- Branches must be up-to-date

## References
- [GitHub Actions Documentation](https://docs.github.com/actions)
- [Bun Compilation Guide](https://bun.sh/docs/bundler)
- [Semgrep Rules](https://semgrep.dev/r)
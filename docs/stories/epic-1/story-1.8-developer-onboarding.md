# Story 1.8: Developer Onboarding Documentation

## Story Details

**Epic:** 1 - Foundation & Validation
**Story Number:** 1.8
**Story Name:** Developer Onboarding Documentation
**Story Points:** 3
**Priority:** High
**Dependencies:** Story 1.1 (Project Setup)
**Risk Level:** Low

## User Story

**As a** new developer joining the BMAD Checklist Manager project,
**I want** comprehensive onboarding documentation and automated setup,
**so that** I can start contributing effectively within 30 minutes.

## Acceptance Criteria

1. **CONTRIBUTING.md created with:**
   - Project overview and architecture summary
   - Development workflow (branch strategy, PR process)
   - Code style guidelines with examples
   - Testing requirements and strategies
   - How to run the project locally
   - Common troubleshooting steps

2. **Development environment setup automated:**
   - Single command setup script (`bun run setup:dev`)
   - Automatic dependency installation
   - Pre-commit hooks configured
   - VS Code recommended extensions installed
   - Environment variables template created

3. **Architecture Decision Records (ADRs) established:**
   - ADR template created in `docs/adr/`
   - Initial ADRs for key decisions:
     - ADR-001: Why Bun over Node.js
     - ADR-002: TUI Framework Selection
     - ADR-003: State Management Approach
     - ADR-004: Monorepo Structure

4. **Local development guide includes:**
   - How to run tests (`bun test`, `bun test:watch`)
   - How to debug (with VS Code and Chrome DevTools)
   - How to profile performance
   - How to work with the monorepo structure
   - How to test CLI commands locally

5. **Code review checklist provided:**
   - Performance considerations (<100ms requirement)
   - Accessibility requirements
   - Testing coverage requirements (80% minimum)
   - Documentation requirements
   - Security considerations

6. **Interactive onboarding verified:**
   - New developer can complete setup in <30 minutes
   - All commands work on macOS, Linux, Windows (WSL)
   - No undocumented dependencies
   - Clear next steps after setup

## Technical Implementation Details

### File Structure
```
/
├── CONTRIBUTING.md
├── docs/
│   ├── development/
│   │   ├── setup.md
│   │   ├── workflow.md
│   │   ├── debugging.md
│   │   └── troubleshooting.md
│   ├── adr/
│   │   ├── template.md
│   │   ├── 001-bun-runtime.md
│   │   ├── 002-tui-framework.md
│   │   ├── 003-state-management.md
│   │   └── 004-monorepo.md
│   └── onboarding/
│       ├── checklist.md
│       └── first-contribution.md
├── scripts/
│   ├── setup-dev.ts
│   ├── verify-setup.ts
│   └── create-adr.ts
└── .vscode/
    ├── extensions.json
    ├── settings.json
    └── launch.json
```

### Setup Script Implementation
```typescript
// scripts/setup-dev.ts
#!/usr/bin/env bun

async function setupDevelopment() {
  console.log('🚀 Setting up BMAD Checklist Manager development environment...\n');
  
  // Check prerequisites
  await checkPrerequisites();
  
  // Install dependencies
  await installDependencies();
  
  // Setup git hooks
  await setupGitHooks();
  
  // Create environment files
  await createEnvFiles();
  
  // Verify setup
  await verifySetup();
  
  console.log('✅ Development environment ready! Run "bun dev" to start.\n');
  console.log('📚 Next steps:');
  console.log('   1. Read CONTRIBUTING.md');
  console.log('   2. Run "bun test" to verify everything works');
  console.log('   3. Check docs/onboarding/first-contribution.md');
}
```

## Definition of Done

- [ ] All documentation files created and reviewed
- [ ] Setup script tested on all target platforms
- [ ] Another developer successfully onboarded using only the docs
- [ ] All ADRs reviewed by tech lead
- [ ] VS Code configuration tested and working
- [ ] Onboarding time measured and confirmed <30 minutes
- [ ] Documentation integrated into main README
- [ ] Setup script added to package.json scripts
- [ ] CI validates that setup script works

## Testing Considerations

### Test Scenarios
1. Fresh developer machine setup (no Bun installed)
2. Partial setup recovery (some steps already done)
3. Windows WSL compatibility
4. Network issues during setup
5. Permission issues handling

### Validation Script
```typescript
// scripts/verify-setup.ts
async function verifySetup() {
  const checks = [
    { name: 'Bun version', cmd: 'bun --version', expected: '1.1' },
    { name: 'Dependencies', cmd: 'bun pm ls', expected: '@checklist' },
    { name: 'Tests run', cmd: 'bun test --bail', expected: 'passed' },
    { name: 'Build works', cmd: 'bun run build', expected: 'success' },
  ];
  
  for (const check of checks) {
    await runCheck(check);
  }
}
```

## Notes

- This story enables team scaling and reduces onboarding friction
- Good documentation here saves hours of team time later
- Consider recording a video walkthrough as supplementary material
- Setup script should be idempotent (can run multiple times safely)
# Story 0.0: Development Environment Setup

## Story
**As a** developer,  
**I want** a fully configured development environment with all necessary tools and accounts,  
**so that** I can begin development immediately without setup blockers.

## Priority
**CRITICAL** - Must be completed before any other story

## Acceptance Criteria

### Local Development Setup
1. ✅ Bun runtime installed (version 1.1.x or later)
2. ✅ Git installed and configured with user credentials
3. ✅ Code editor configured with TypeScript support (VSCode recommended)
4. ✅ Terminal emulator tested (supports 256 colors and UTF-8)
5. ✅ Node.js installed as fallback (for tools that don't support Bun yet)

### Project Initialization
1. ✅ Repository cloned from GitHub
2. ✅ Bun dependencies installed successfully (`bun install`)
3. ✅ All workspace packages recognized (`bun pm ls`)
4. ✅ Pre-commit hooks installed (if using Husky)
5. ✅ Environment variables template created (`.env.example`)

### Account Setup
1. ✅ GitHub account with repository access
2. ✅ npm account created (for future package publishing)
3. ✅ Homebrew/Chocolatey configured (for distribution testing)
4. ✅ GitHub Actions secrets configured (for CI/CD)

### Verification Commands
```bash
# Verify Bun installation
bun --version  # Should output 1.1.x or higher

# Verify project setup
bun install
bun test:smoke  # Basic smoke test to verify setup

# Verify workspace configuration
bun pm ls  # Should list all workspace packages

# Verify TypeScript compilation
bun run typecheck

# Verify terminal capabilities
echo $TERM  # Should support colors
locale  # Should show UTF-8 encoding

# Test TUI rendering capability
bun run examples/terminal-test.ts
```

### Development Tools Checklist
- [ ] Bun installed via official installer
- [ ] Git version 2.30+ installed
- [ ] VSCode with extensions:
  - [ ] TypeScript language support
  - [ ] ESLint
  - [ ] Prettier
  - [ ] EditorConfig
- [ ] Terminal verified:
  - [ ] iTerm2 (macOS) / Windows Terminal / Alacritty
  - [ ] 256 color support confirmed
  - [ ] UTF-8 locale configured
  - [ ] Minimum 80 columns width

### Project Structure Verification
```
checklist/
├── .git/                    ✓ Git repository initialized
├── .env.example             ✓ Environment template
├── .gitignore              ✓ Proper ignore rules
├── bun.lockb               ✓ Lock file present
├── package.json            ✓ Root package configured
├── tsconfig.json           ✓ TypeScript configured
├── docs/
│   ├── prd.md             ✓ Product requirements
│   ├── architecture.md     ✓ Architecture document
│   ├── front-end-spec.md  ✓ UI/UX specification
│   └── stories/           ✓ Story files organized
├── packages/
│   ├── core/              ✓ Core package scaffolded
│   ├── cli/               ✓ CLI package scaffolded
│   ├── tui/               ✓ TUI package scaffolded
│   └── shared/            ✓ Shared utilities scaffolded
└── templates/              ✓ Template directory created
```

## Technical Notes

### Environment Variables Required
```bash
# .env.example
NODE_ENV=development
LOG_LEVEL=debug
CHECKLIST_HOME=$HOME/.checklist
ENABLE_TELEMETRY=false
```

### Potential Blockers & Solutions

| Blocker | Solution |
|---------|----------|
| Bun not available for platform | Use Node.js with tsx as fallback |
| Terminal doesn't support UTF-8 | Implement ASCII fallback mode |
| Git not configured | Run `git config --global` setup wizard |
| TypeScript errors on fresh clone | Run `bun install` then `bun run build` |
| Permission errors on .checklist | Ensure user has write access to home directory |

## Definition of Done
- [ ] All verification commands pass successfully
- [ ] Developer can run `bun run dev` without errors
- [ ] Test suite runs with `bun test`
- [ ] TypeScript compilation succeeds
- [ ] Terminal renders example TUI components correctly
- [ ] Team member has successfully cloned and run project

## Time Estimate
**2-4 hours** for complete environment setup (varies by platform)

## Dependencies
- No story dependencies (this is the first story)
- Blocks all other stories until complete

## Notes for Developers
- Windows developers should use WSL2 for best compatibility
- macOS developers need Xcode Command Line Tools
- Linux developers may need build-essential package
- If behind corporate proxy, configure git and bun proxy settings
- Document any platform-specific issues encountered for team knowledge base
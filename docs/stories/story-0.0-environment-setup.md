# Story 0.0: Development Environment Setup

## Status
**Approved**

## Story
**As a** developer,  
**I want** a fully configured development environment with all necessary tools and accounts,  
**so that** I can begin development immediately without setup blockers.

## Priority
**CRITICAL** - Must be completed before any other story

## Acceptance Criteria

### Local Development Setup
1. Bun runtime installed (version 1.1.x or later)
2. Git installed and configured with user credentials
3. Code editor configured with TypeScript support (VSCode recommended)
4. Terminal emulator tested (supports 256 colors and UTF-8)
5. Node.js installed as fallback (for tools that don't support Bun yet)

### Project Initialization
6. Repository cloned from GitHub
7. Bun dependencies installed successfully (`bun install`)
8. All workspace packages recognized (`bun pm ls`)
9. Pre-commit hooks installed (if using Husky)
10. Environment variables template created (`.env.example`)

### Account Setup
11. GitHub account with repository access
12. npm account created (for future package publishing)
13. Homebrew/Chocolatey configured (for distribution testing)
14. GitHub Actions secrets configured (for CI/CD)

### Development Tools Verification
15. ESLint configuration loaded and working
16. Prettier configuration loaded and working
17. TypeScript compilation succeeds
18. Test suite runs successfully

## Tasks / Subtasks

### Task 1: Install Core Runtime and Tools (AC: 1, 2, 3, 4, 5)
- [ ] Install Bun runtime via official installer
  - [ ] Verify version is 1.1.x or later with `bun --version`
  - [ ] Add Bun to PATH if not automatically done
- [ ] Install Git (version 2.30+)
  - [ ] Configure git user.name globally
  - [ ] Configure git user.email globally
- [ ] Install Node.js as fallback runtime
  - [ ] Verify npm is available
- [ ] Setup code editor (VSCode recommended)
  - [ ] Install TypeScript extension
  - [ ] Install ESLint extension
  - [ ] Install Prettier extension
  - [ ] Install EditorConfig extension
- [ ] Verify terminal capabilities
  - [ ] Check for 256 color support: `echo $TERM`
  - [ ] Verify UTF-8 locale: `locale | grep UTF`
  - [ ] Ensure minimum 80 columns width

### Task 2: Clone and Initialize Project (AC: 6, 7, 8, 9, 10)
- [ ] Clone repository from GitHub
  - [ ] `git clone <repository-url>`
  - [ ] Navigate to project directory
- [ ] Initialize project dependencies
  - [ ] Run `bun install` in root directory
  - [ ] Verify no installation errors
- [ ] Verify workspace setup
  - [ ] Run `bun pm ls` to list all workspace packages
  - [ ] Confirm packages: core, cli, tui, shared
- [ ] Setup environment configuration
  - [ ] Create `.env` file from `.env.example`
  - [ ] Set NODE_ENV=development
  - [ ] Set LOG_LEVEL=debug
  - [ ] Set CHECKLIST_HOME=$HOME/.checklist
  - [ ] Set ENABLE_TELEMETRY=false
- [ ] Install pre-commit hooks if available
  - [ ] Check for husky configuration
  - [ ] Run hook installation if present

### Task 3: Configure Accounts and Services (AC: 11, 12, 13, 14)
- [ ] Verify GitHub access
  - [ ] Test push access to repository
  - [ ] Configure SSH keys if needed
- [ ] Create npm account (for future publishing)
  - [ ] Register at npmjs.com
  - [ ] Run `npm login` locally
- [ ] Install package managers for distribution
  - [ ] macOS: Install Homebrew
  - [ ] Windows: Install Chocolatey
  - [ ] Linux: Note system package manager
- [ ] Setup CI/CD secrets (if admin access)
  - [ ] Add NPM_TOKEN to GitHub secrets
  - [ ] Add any required API keys

### Task 4: Validate Development Environment (AC: 15, 16, 17, 18)
- [ ] Verify linting setup
  - [ ] Run `bun run lint` successfully
  - [ ] Confirm ESLint configuration loaded
  - [ ] Test auto-fix: `bun run lint:fix`
- [ ] Verify formatting setup
  - [ ] Run `bun run format:check` successfully
  - [ ] Test auto-format: `bun run format`
- [ ] Verify TypeScript compilation
  - [ ] Run `bun run typecheck` successfully
  - [ ] Check for any type errors
- [ ] Run test suites
  - [ ] Execute `bun test` successfully
  - [ ] Run smoke test: `bun test:smoke`
  - [ ] Verify coverage report generation
- [ ] Create terminal test file
  - [ ] Create `examples/terminal-test.ts` with basic TUI test
  - [ ] Run test to verify terminal rendering

### Task 5: Document Setup Issues (No specific AC)
- [ ] Document any platform-specific issues encountered
- [ ] Note any workarounds required
- [ ] Update this story with findings for future developers

## Dev Notes

### Project Structure
```
checklist/
├── .git/                    # Git repository
├── .env                     # Environment variables (create from .env.example)
├── .env.example             # Environment template
├── .gitignore              # Git ignore rules
├── bun.lockb               # Bun lock file
├── package.json            # Root package configuration
├── tsconfig.json           # TypeScript configuration
├── eslint.config.js        # ESLint configuration (flat config)
├── .prettierrc.js          # Prettier configuration
├── vitest.config.ts        # Vitest test configuration
├── docs/
│   ├── prd/               # Product requirements (sharded)
│   ├── architecture/      # Architecture documents (sharded)
│   └── stories/           # User stories
├── packages/
│   ├── core/              # Core checklist engine
│   ├── cli/               # CLI implementation
│   ├── tui/               # Terminal UI components
│   └── shared/            # Shared utilities
├── examples/              # Example files and demos
└── templates/             # Checklist templates
```

### Tech Stack Reference
From architecture docs, the project uses:
- **Runtime**: Bun 1.1.x (primary), Node.js (fallback)
- **Language**: TypeScript 5.3.x
- **Testing**: Vitest 1.6.x with coverage-v8
- **Linting**: ESLint 8.57.x with TypeScript plugin
- **Formatting**: Prettier 3.2.x
- **State Management**: YAML with js-yaml 4.1.x
- **Schema Validation**: Ajv 8.12.x

### Required VS Code Extensions
1. **TypeScript and JavaScript Language Features** (built-in)
2. **ESLint** (dbaeumer.vscode-eslint)
3. **Prettier** (esbenp.prettier-vscode)
4. **EditorConfig** (EditorConfig.EditorConfig)

### Environment Variables Required
```bash
# .env file content
NODE_ENV=development
LOG_LEVEL=debug
CHECKLIST_HOME=$HOME/.checklist
ENABLE_TELEMETRY=false
```

### Common Setup Commands
```bash
# Install dependencies
bun install

# Verify setup
bun --version
bun pm ls
bun run typecheck
bun run lint
bun run format:check
bun test:smoke

# Development commands
bun run dev        # Start development mode
bun run build      # Build all packages
bun run test       # Run full test suite
bun run test:watch # Run tests in watch mode
```

### Platform-Specific Notes
- **Windows**: Use WSL2 for best compatibility
- **macOS**: Requires Xcode Command Line Tools (`xcode-select --install`)
- **Linux**: May need build-essential package (`sudo apt install build-essential`)
- **Corporate Proxy**: Configure git and bun proxy settings if behind firewall

## Testing

### Testing Standards
Based on architecture documentation:

1. **Test File Locations**:
   - Unit tests: `*.test.ts` files colocated with source
   - Integration tests: `*.spec.ts` files in `__tests__` directories
   - E2E tests: `e2e/*.e2e.ts` files

2. **Testing Framework**:
   - Vitest 1.6.x for all testing
   - Use `describe`, `it`, `expect` syntax
   - Snapshot testing for TUI output validation

3. **Test Coverage Requirements**:
   - Minimum 80% code coverage
   - Coverage reports via `@vitest/coverage-v8`
   - Run: `bun run test:coverage`

4. **Test Data Management**:
   - Use TestDataFactory for test data creation
   - Create test workspaces in temp directories
   - Always cleanup after tests

5. **Smoke Test Requirements**:
   - Basic environment verification
   - Package loading confirmation
   - No external dependencies

### Validation Commands
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

## Potential Blockers & Solutions

| Blocker | Solution |
|---------|----------|
| Bun not available for platform | Use Node.js with tsx as fallback |
| Terminal doesn't support UTF-8 | Implement ASCII fallback mode |
| Git not configured | Run `git config --global` setup wizard |
| TypeScript errors on fresh clone | Run `bun install` then `bun run build` |
| Permission errors on .checklist | Ensure user has write access to home directory |
| Corporate proxy blocking | Set HTTP_PROXY and HTTPS_PROXY environment variables |
| VSCode extensions not installing | Manually download VSIX files and install offline |

## Definition of Done
- [ ] All verification commands pass successfully
- [ ] Developer can run `bun run dev` without errors
- [ ] Test suite runs with `bun test`
- [ ] TypeScript compilation succeeds
- [ ] Linting and formatting checks pass
- [ ] Terminal renders example TUI components correctly
- [ ] Team member has successfully cloned and run project
- [ ] All acceptance criteria marked complete

## Time Estimate
**2-4 hours** for complete environment setup (varies by platform and network speed)

## Dependencies
- No story dependencies (this is the first story)
- Blocks all other stories until complete

## Change Log
| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-09-05 | 1.0 | Initial story creation | Sarah (PO) |
| 2025-09-05 | 1.1 | Added required template sections, tasks, and dev notes | Sarah (PO) |

## Dev Agent Record
*This section will be populated by the development agent during implementation*

### Agent Model Used
*To be filled by dev agent*

### Debug Log References
*To be filled by dev agent*

### Completion Notes List
*To be filled by dev agent*

### File List
*To be filled by dev agent*

## QA Results
*This section will be populated by the QA agent after story completion*
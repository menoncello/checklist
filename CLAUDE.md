# CLAUDE.md - BMAD Checklist Manager Project Guidelines

## CRITICAL: Language Requirements

**ALL DOCUMENTATION, CODE COMMENTS, AND COMMIT MESSAGES MUST BE IN ENGLISH**
- No exceptions for any written content
- Use standard technical English terminology
- Ensure grammatical correctness

## Project Overview

The BMAD Checklist Manager is a high-performance, terminal-based interactive checklist application built with:
- **Runtime**: Bun 1.1.x
- **Language**: TypeScript 5.9+
- **Architecture**: Monorepo with clean architecture principles
- **Testing**: Bun's native test runner with >80% coverage requirement

## Development Environment

### Prerequisites
- Bun 1.1.x or later
- Git 2.30+
- Terminal with 256 color and UTF-8 support
- VSCode (recommended) with extensions:
  - dbaeumer.vscode-eslint
  - esbenp.prettier-vscode
  - ms-vscode.vscode-typescript-next

### Quick Commands
```bash
# Development
bun run dev              # Start development mode
bun run build:all        # Build all packages

# Quality Checks (MUST PASS before commits)
bun run lint             # ESLint check
bun run typecheck        # TypeScript type checking
bun run test             # Run all tests
bun run quality          # Run all quality checks

# Testing
bun test:coverage        # Generate coverage report
bun test:watch          # Watch mode
bun test:mutation       # Mutation testing

# Performance
bun run bench           # Run benchmarks
```

## Code Quality Standards

### Before Every Commit
1. **Run quality checks**: `bun run quality`
2. **Fix any issues**: `bun run quality:fix`
3. **Ensure tests pass**: `bun test`
4. **Check coverage**: `bun test:coverage` (minimum 80%, core package 90%)

### TypeScript Guidelines
- Strict mode enabled
- No `any` types without justification
- Prefer interfaces over type aliases for objects
- Use discriminated unions for state management
- Document complex types with JSDoc

### Testing Requirements
- **Unit tests**: All business logic
- **Integration tests**: Package interactions
- **Snapshot tests**: TUI output validation
- **Performance tests**: Critical paths
- **Coverage targets**:
  - Overall: 80% minimum
  - Core package: 90% minimum
  - New code: 100% expected

## Documentation Standards

**IMPORTANT**: Always follow the standards defined in `docs/DOCUMENTATION-STANDARDS.md`:

### File Naming
- **Stories**: `story-{epic}.{number}-{name}.md` (e.g., `story-1.1-project-setup.md`)
- **Epics**: `epic-{number}-{name}.md` (e.g., `epic-1-foundation.md`)
- **Architecture**: Simple names without long suffixes (e.g., `api-specification.md`, NOT `api-specification-complete-with-all-refinements.md`)
- **ADRs**: `ADR-{number}-{title}.md`

### Content Structure
- No emojis in main headers
- Use consistent user story format
- Always include metadata at the beginning when applicable

### Links and References
- Use relative paths
- Include file:line for code references (e.g., `src/file.ts:42`)

## Important Files

### Documentation
- **Documentation Standards**: `docs/DOCUMENTATION-STANDARDS.md`
- **Main PRD**: `docs/prd.md`
- **Main Architecture**: `docs/architecture.md`
- **Frontend Spec**: `docs/front-end-spec.md`
- **Stories Index**: `docs/stories/README.md`

### Configuration
- **TypeScript**: `tsconfig.json` (root and per-package)
- **ESLint**: `.eslintrc.json`
- **Prettier**: `.prettierrc`
- **Husky**: `.husky/`
- **Stryker**: `stryker.conf.json`

## Commit and Development Rules

### Git Workflow
- NEVER use `--no-verify` when committing
- Always fix lint and type errors before committing
- Follow conventional commits format: `type(scope): description`
- Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`
- Write all commit messages in English

### Branch Strategy
- `main`: Production-ready code
- Feature branches: `feature/description`
- Fix branches: `fix/description`
- Documentation: `docs/description`
- Update branches: `update/description`

### Code Review Checklist
- [ ] Tests pass and coverage maintained
- [ ] TypeScript types are correct
- [ ] No lint errors or warnings
- [ ] Documentation updated if needed
- [ ] Performance benchmarks pass
- [ ] Follows project architecture patterns

## Project Structure

### Monorepo Organization
```
checklist/
├── packages/                    # Workspace packages
│   ├── core/                   # Core business logic
│   │   ├── src/
│   │   │   ├── models/        # Domain models
│   │   │   ├── services/      # Business services
│   │   │   └── utils/         # Core utilities
│   │   └── tests/
│   ├── tui/                    # Terminal UI components
│   │   ├── src/
│   │   │   ├── components/    # UI components
│   │   │   ├── screens/       # Screen layouts
│   │   │   └── themes/        # Color themes
│   │   └── tests/
│   ├── cli/                    # CLI application
│   │   ├── src/
│   │   │   ├── commands/      # CLI commands
│   │   │   └── index.ts       # Entry point
│   │   └── tests/
│   └── shared/                 # Shared utilities
│       ├── src/
│       └── tests/
├── docs/                        # Documentation
│   ├── DOCUMENTATION-STANDARDS.md
│   ├── prd.md                 # Main PRD
│   ├── architecture.md        # Main Architecture
│   ├── front-end-spec.md      # Frontend specification
│   ├── prd/                   # Detailed PRD documents
│   ├── architecture/          # Architecture documents
│   ├── stories/               # User stories by epic
│   ├── qa/                    # QA assessments
│   ├── development/           # Development guides
│   └── guides/                # Technical guides
├── examples/                   # Usage examples
├── tests/                      # Integration tests
│   ├── smoke.test.ts          # Smoke tests
│   └── fixtures/              # Test fixtures
└── coverage/                   # Coverage reports
```

## Architecture Principles

### Clean Architecture Layers
1. **Domain Layer** (packages/core)
   - Pure business logic
   - No external dependencies
   - Framework agnostic

2. **Application Layer** (packages/cli)
   - Use case orchestration
   - Command handling
   - State management

3. **Infrastructure Layer** (packages/tui, shared)
   - UI components
   - External integrations
   - Persistence mechanisms

### Dependency Rules
- Dependencies point inward (UI → Application → Domain)
- Core package has no dependencies on other packages
- Shared utilities can be used by all layers
- Use dependency injection for testability

## Performance Requirements

### Benchmarks Must Pass
```bash
bun run bench:assert
```

### Performance Targets
- **Startup time**: < 100ms
- **Memory baseline**: < 50MB
- **Command response**: < 50ms
- **State save**: < 10ms
- **Binary size**: < 10MB

### Performance Monitoring
- Run benchmarks before significant changes
- Compare results: `bun run bench:compare`
- Profile memory usage during development
- Monitor bundle size on builds

## Documentation Validation

Before any documentation commit:
1. ✅ File name follows standard
2. ✅ No unnecessary suffixes
3. ✅ Links working
4. ✅ Consistent formatting
5. ✅ No content duplication
6. ✅ All content in English
7. ✅ Code references include file:line
8. ✅ Relative paths used for internal links

## State Management

### YAML State Files
- Location: `~/.bmad/checklists/`
- Format: YAML with schema validation
- Automatic backups before saves
- Atomic write operations

### State Structure
```yaml
version: "1.0.0"
metadata:
  created: ISO-8601
  modified: ISO-8601
  template: template-name
items:
  - id: uuid
    title: string
    completed: boolean
    metadata: object
```

## Error Handling

### Error Categories
1. **User Errors**: Clear messages, recovery suggestions
2. **System Errors**: Log details, graceful degradation
3. **Development Errors**: Throw with stack traces

### Error Response Format
```typescript
interface ErrorResponse {
  code: string;           // Machine-readable code
  message: string;        // User-friendly message
  details?: unknown;      // Additional context
  recovery?: string;      // Recovery suggestion
}
```

## Security Considerations

- No sensitive data in state files
- Validate all user input
- Sanitize file paths
- Use secure YAML parsing
- No eval() or dynamic code execution
- Principle of least privilege for file access

---

*This file contains the specific guidelines for the BMAD Checklist Manager project and must be followed by all contributors.*
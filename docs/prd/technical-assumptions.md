# Technical Assumptions

## Repository Structure: Monorepo with Clear Module Separation

Single repository organized with clear module boundaries: `/packages/core` (business logic), `/packages/cli` (CLI interface), `/packages/tui` (TUI implementation), `/templates` (built-in BMAD templates), `/docs` (user and developer documentation), `/examples` (sample projects for testing). This structure supports both `bun install` workflow and future plugin architecture while maintaining clear separation of concerns.

## Service Architecture

**Standalone CLI with Progressive Enhancement** - Core distributed as single Bun-compiled binary with embedded templates. Architecture supports future additions via feature flags (`--tui` mode default, `--no-tui` for automation), optional shell integration scripts, and potential daemon mode for filesystem watching. All state operations use transactional writes with atomic file operations to prevent corruption. Configuration cascade: command flags → environment variables → project `.checklist/config.yaml` → user `~/.config/checklist/` → embedded defaults.

## Testing Requirements

**Pragmatic Testing Pyramid:**

- **Unit tests (80% coverage):** Core state management, template parsing, workflow engine logic
- **Integration tests:** CLI commands, filesystem operations, clipboard integration
- **Workflow tests:** Complete BMAD scenarios using example projects in `/examples/`
- **Compatibility tests:** Automated testing on macOS, Linux, Windows via GitHub Actions
- **Template validation tests:** Ensuring all bundled templates parse and execute correctly
- **Performance tests:** Benchmarking response times stay under 100ms threshold
- **Manual testing playbooks:** Step-by-step guides for testing complex scenarios

## Additional Technical Assumptions and Requests

• **Runtime:** Bun as high-performance JavaScript/TypeScript runtime
• **Language:** TypeScript with strict configuration for type safety
• **State Management:** YAML format with JSON Schema validation, automatic backup before modifications
• **Template Engine:** Custom engine supporting variables, conditionals, loops with sandboxed execution
• **TUI Framework:** Hybrid approach - custom components with minimal auxiliary libraries
• **File Operations:** Bun's native file APIs for optimal I/O performance
• **Process Management:** Bun.spawn() for command execution
• **Shell Integration:** Bun Shell for safe command execution
• **Build System:** `bun build --compile` for standalone binaries
• **Distribution:** Binaries via GitHub Releases, npm package with bunx support, Homebrew formula
• **Performance Targets:** <50ms startup, <50MB memory, <20MB binary size
• **Security:** No telemetry, local-only data, respect .gitignore, sandboxed template execution
• **Backward Compatibility:** State files readable across minor versions, migration for major versions
• **Concurrent Access:** File locking to prevent simultaneous state modifications
• **IDE Preparation:** Core engine designed to support future VSCode/IntelliJ plugins

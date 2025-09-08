# Tech Stack (Enhanced with All Tools)

| Category                     | Technology         | Version       | Purpose                       | Rationale                           |
| ---------------------------- | ------------------ | ------------- | ----------------------------- | ----------------------------------- |
| **Core Languages & Runtime** |
| Runtime                      | Bun                | 1.1.x         | JavaScript/TypeScript runtime | High performance, built-in tooling  |
| Language                     | TypeScript         | 5.3.x         | Type-safe development         | Strong typing across entire stack   |
| **Testing Suite**            |
| Unit Testing                 | Bun Test           | Built-in      | Unit and integration tests    | Native Bun test runner, zero-config |
| Mutation Testing             | StrykerJS          | 8.2.x         | Test quality validation       | Ensures tests catch real bugs       |
| TUI Testing                  | node-pty           | 1.0.x         | Terminal emulation for tests  | Simulates real terminal environment |
| Snapshot Testing             | Bun Test Snapshots | Built-in      | TUI output validation         | Native snapshot support in Bun      |
| Performance Testing          | Tinybench          | 2.5.x         | Micro-benchmarks              | Validates <100ms requirement        |
| Coverage Tool                | Bun Coverage       | Built-in      | Coverage reporting            | Native coverage in Bun test runner  |
| Visual Regression            | pixelmatch         | 5.3.x         | Terminal output comparison    | Catch visual regressions            |
| Contract Testing             | Custom             | 1.0.0         | API contract validation       | Ensure package compatibility        |
| Load Testing                 | Custom             | 1.0.0         | Performance validation        | Ensure scalability                  |
| **Quality & Security**       |
| Linting                      | ESLint             | 8.57.x        | Code quality                  | Enforces consistent patterns        |
| Formatting                   | Prettier           | 3.2.x         | Code formatting               | Automatic formatting                |
| Type Checking                | tsc                | 5.3.x         | Type validation               | Compile-time type safety            |
| Security Scanning            | npm audit          | Built-in      | Dependency vulnerabilities    | Catches known vulnerabilities       |
| Static Analysis              | Semgrep            | 1.45.x        | Security patterns             | Finds security anti-patterns        |
| **TUI/CLI Framework**        |
| TUI Framework                | Custom ANSI        | 1.0.0         | Terminal UI rendering         | Full control, optimal performance   |
| CLI Parser                   | Bun.argv           | Built-in      | Command parsing               | Native Bun argument parsing         |
| Terminal Detection           | supports-color     | 9.4.x         | Terminal capability detection | Graceful degradation                |
| **State & Data**             |
| State Format                 | YAML               | js-yaml 4.1.x | State persistence             | Human-readable, Git-friendly        |
| Schema Validation            | Ajv                | 8.12.x        | YAML/JSON schema validation   | Ensures state file integrity        |
| File Watching                | Bun.watch          | Built-in      | File change detection         | Native file system watching         |
| **Build & Distribution**     |
| Compiler                     | Bun                | 1.1.x         | Binary compilation            | Single executable output            |
| CI/CD                        | GitHub Actions     | latest        | Multi-platform builds         | Automated testing and releases      |
| Package Manager              | Bun                | 1.1.x         | Dependency management         | Fast package installation           |
| Container                    | Docker             | 24.x          | Development environment       | Consistent dev setup                |
| **Development Tools**        |
| Logging                      | Pino               | 9.x           | Production-ready logging      | High-performance JSON logger        |
| Log Rotation                 | pino-roll          | 1.x           | Log file management           | Automatic rotation and cleanup      |
| Log Formatting               | pino-pretty        | 10.x          | Development log formatting    | Human-readable log output           |
| Process Manager              | Bun.spawn          | Built-in      | Child process management      | Native process spawning             |
| Clipboard                    | clipboardy         | 4.0.x         | System clipboard access       | Cross-platform clipboard            |
| Profiling                    | Chrome DevTools    | Built-in      | Performance profiling         | Deep performance analysis           |

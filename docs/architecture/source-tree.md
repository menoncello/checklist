# Source Tree

## Project Structure

```
checklist/
├── packages/                    # Monorepo workspace packages
│   ├── core/                   # Core business logic
│   │   ├── src/                # Source code
│   │   │   ├── index.ts        # Main entry point
│   │   │   └── utils/          # Utility functions
│   │   │       └── logger.ts   # Pino logger factory
│   │   ├── tests/              # Test files
│   │   │   ├── index.test.ts
│   │   │   ├── env-validation.test.ts
│   │   │   └── setup-validation.test.ts
│   │   └── dist/               # Compiled output
│   │
│   ├── tui/                    # Terminal UI components
│   │   ├── src/
│   │   │   ├── index.ts        # Main TUI entry point
│   │   │   ├── views/          # View system (Story 1.9)
│   │   │   │   ├── ViewSystem.ts
│   │   │   │   ├── BaseView.ts
│   │   │   │   └── types.ts
│   │   │   ├── navigation/     # Navigation system (Story 1.9)
│   │   │   │   ├── NavigationStack.ts
│   │   │   │   └── ViewRegistry.ts
│   │   │   ├── layout/         # Layout management (Story 1.9)
│   │   │   │   ├── LayoutManager.ts
│   │   │   │   ├── DefaultHeaderComponent.ts
│   │   │   │   └── DefaultFooterComponent.ts
│   │   │   ├── framework/      # TUI framework (Story 1.8)
│   │   │   │   ├── UIFramework.ts
│   │   │   │   ├── TerminalCanvas.ts
│   │   │   │   ├── ApplicationLoop.ts
│   │   │   │   └── Lifecycle.ts
│   │   │   ├── screens/        # Screen management (Story 1.8)
│   │   │   │   ├── ScreenManager.ts
│   │   │   │   ├── BaseScreen.ts
│   │   │   │   └── ScreenStack.ts
│   │   │   ├── components/     # UI components (Story 1.8)
│   │   │   │   ├── ComponentRegistry.ts
│   │   │   │   ├── BaseComponent.ts
│   │   │   │   ├── ComponentInstance.ts
│   │   │   │   └── VirtualizedList.ts
│   │   │   ├── events/         # Event handling (Story 1.8)
│   │   │   │   ├── EventManager.ts
│   │   │   │   ├── KeyboardHandler.ts
│   │   │   │   ├── EventBus.ts
│   │   │   │   └── InputValidator.ts
│   │   │   ├── terminal/       # Terminal capabilities (Story 1.8)
│   │   │   │   ├── CapabilityDetector.ts
│   │   │   │   ├── TerminalInfo.ts
│   │   │   │   ├── FallbackRenderer.ts
│   │   │   │   └── ColorSupport.ts
│   │   │   ├── errors/         # Error handling (Story 1.8)
│   │   │   │   ├── ErrorBoundary.ts
│   │   │   │   ├── CrashRecovery.ts
│   │   │   │   └── StatePreservation.ts
│   │   │   ├── performance/    # Performance monitoring (Story 1.8)
│   │   │   │   ├── PerformanceMonitor.ts
│   │   │   │   ├── StartupProfiler.ts
│   │   │   │   ├── MemoryTracker.ts
│   │   │   │   └── MetricsCollector.ts
│   │   │   ├── debug/          # Debug utilities (Story 1.8)
│   │   │   │   ├── DebugRenderer.ts
│   │   │   │   ├── EventLogger.ts
│   │   │   │   ├── StateInspector.ts
│   │   │   │   └── DebugCommands.ts
│   │   │   ├── rendering/      # Rendering optimization (Story 1.8)
│   │   │   │   ├── Viewport.ts
│   │   │   │   └── RenderOptimizer.ts
│   │   │   └── utils/          # TUI utilities (Story 1.8)
│   │   │       ├── ResizeHandler.ts
│   │   │       ├── ScrollManager.ts
│   │   │       └── CleanShutdown.ts
│   │   ├── tests/              # Test files
│   │   │   ├── views/          # View system tests (Story 1.9)
│   │   │   │   ├── ViewSystem.test.ts
│   │   │   │   ├── NavigationStack.test.ts
│   │   │   │   ├── ViewRegistry.test.ts
│   │   │   │   ├── BaseView.test.ts
│   │   │   │   ├── TabSwitching.test.ts
│   │   │   │   ├── LayoutComponents.test.ts
│   │   │   │   ├── KeyboardNavigation.test.ts
│   │   │   │   └── Performance.test.ts
│   │   │   └── framework/      # Framework tests (Story 1.8)
│   │   │       ├── TerminalCanvas.test.ts
│   │   │       ├── ApplicationLoop.test.ts
│   │   │       ├── ScreenManager.test.ts
│   │   │       ├── ComponentRegistry.test.ts
│   │   │       ├── EventManager.test.ts
│   │   │       ├── KeyboardHandler.test.ts
│   │   │       ├── CapabilityDetector.test.ts
│   │   │       ├── ErrorBoundary.test.ts
│   │   │       ├── PerformanceMonitor.test.ts
│   │   │       ├── MemoryTracker.test.ts
│   │   │       ├── VirtualizedList.test.ts
│   │   │       └── DebugRenderer.test.ts
│   │   └── dist/
│   │
│   ├── shared/                 # Shared utilities
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tests/              # Test files
│   │   └── dist/
│   │
│   └── cli/                    # CLI application
│       ├── src/
│       │   └── index.ts
│       ├── tests/              # Test files
│       └── dist/
│
├── docs/                        # Documentation
│   ├── architecture/           # Architecture docs
│   │   ├── coding-standards.md
│   │   ├── tech-stack.md
│   │   └── source-tree.md     # This file
│   │
│   ├── prd/                   # Product requirements
│   ├── stories/               # User stories by epic
│   │   ├── epic-1/
│   │   ├── epic-2/
│   │   ├── epic-3/
│   │   ├── epic-4/
│   │   └── epic-5/
│   │
│   └── qa/                    # Quality assurance
│       ├── assessments/
│       └── gates/
│
├── examples/                   # Example implementations
│   └── terminal-test.ts
│
├── coverage/                   # Test coverage reports
│
├── reports/                    # Generated reports
│   └── mutation/              # StrykerJS mutation reports
│       └── index.html
│
├── .logs/                     # Application log files
│   ├── info/                  # Info level logs
│   ├── error/                 # Error level logs
│   └── debug/                 # Debug logs (dev only)
│
├── .stryker-tmp/              # StrykerJS temporary files
│
├── .claude/                   # Claude AI integration
│   └── commands/
│       └── BMad/
│           ├── agents/
│           └── tasks/
│
├── .husky/                    # Git hooks
│
├── .bmad-core/               # BMAD framework
│
├── package.json              # Root package configuration
├── bunfig.toml              # Bun configuration
├── test-setup.ts            # Test setup file
├── stryker.conf.js          # StrykerJS mutation testing config
├── eslint.config.js          # Linting rules
├── .prettierrc.js           # Code formatting
├── tsconfig.json            # TypeScript config
├── tsconfig.base.json       # Base TS config
└── README.md                # Project documentation
```

## Key Directories

### `/packages`

Monorepo workspace containing all the modular components of the application:

- **core**: Core business logic and domain models
- **tui**: Terminal UI components and interactions
- **shared**: Shared utilities and common types
- **cli**: Command-line interface application

### `/docs`

Comprehensive project documentation:

- **architecture**: Technical architecture and design decisions
- **prd**: Product requirements and specifications (sharded)
- **stories**: User stories organized by epic
- **qa**: Quality assurance assessments and gates

### `/.claude`

Claude AI integration and automation:

- Custom commands and workflows
- BMAD framework integration

### `/.bmad-core`

BMAD (Build, Manage, Architect, Deploy) framework:

- Tasks and templates
- Checklists and utilities
- Agent configurations

## Build Artifacts

- `/packages/*/dist/`: Compiled JavaScript output for each package
- `/coverage/`: Test coverage reports and metrics

## Configuration Files

- `package.json`: Root package configuration and workspace setup
- `tsconfig.json` & `tsconfig.base.json`: TypeScript configuration
- `vitest.config.ts`: Testing framework configuration
- `eslint.config.js`: Code quality and linting rules
- `.prettierrc.js`: Code formatting standards
- `bunfig.toml`: Bun runtime configuration

## Development Workflow

1. Source code lives in `/packages/*/src/`
2. Tests are colocated with source files (`.test.ts`)
3. Documentation is maintained in `/docs/`
4. Build outputs to `/packages/*/dist/`
5. Git hooks managed via `.husky/`

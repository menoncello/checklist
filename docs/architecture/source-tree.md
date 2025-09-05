# Source Tree

## Project Structure

```
checklist/
├── packages/                    # Monorepo workspace packages
│   ├── core/                   # Core business logic
│   │   ├── src/                # Source code
│   │   │   └── index.ts        # Main entry point
│   │   ├── tests/              # Test files
│   │   │   ├── index.test.ts
│   │   │   ├── env-validation.test.ts
│   │   │   └── setup-validation.test.ts
│   │   └── dist/               # Compiled output
│   │
│   ├── tui/                    # Terminal UI components
│   │   ├── src/
│   │   │   └── index.ts
│   │   ├── tests/              # Test files
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

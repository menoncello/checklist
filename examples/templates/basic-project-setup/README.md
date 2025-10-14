# Basic Project Setup Template

A comprehensive checklist for initializing new projects with best practices.

## Features

- Git repository initialization
- Project structure creation
- Package manager setup (npm, yarn, pnpm, bun)
- Linting and formatting configuration
- Testing framework setup (optional)
- Documentation scaffolding
- CI/CD pipeline setup
- License file generation

## Usage

```bash
# Install the template
bmad template install basic-project-setup

# Use the template
bmad template use basic-project-setup
```

## Variables

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| projectName | Name of the project | Yes | - |
| projectType | Type of project (web, api, library, cli) | No | web |
| packageManager | Package manager (npm, yarn, pnpm, bun) | No | npm |
| author | Project author or team name | No | Development Team |
| includeTests | Include testing setup | No | true |

## Examples

### Web Application

```bash
bmad template use basic-project-setup \
  --projectName "my-web-app" \
  --projectType "web" \
  --packageManager "npm" \
  --author "John Doe"
```

### CLI Tool

```bash
bmad template use basic-project-setup \
  --projectName "my-cli-tool" \
  --projectType "cli" \
  --packageManager "bun" \
  --includeTests "true"
```

### Library

```bash
bmad template use basic-project-setup \
  --projectName "my-library" \
  --projectType "library" \
  --packageManager "pnpm"
```

## Steps Overview

1. **Initialize Git repository** - Set up version control
2. **Create project structure** - Organize directories
3. **Initialize package** - Set up package.json
4. **Install dependencies** - Get core packages
5. **Setup linting** - Configure code quality tools
6. **Setup tests** - Add testing framework (optional)
7. **Create README** - Document the project
8. **Setup CI/CD** - Configure automation
9. **Add license** - Include legal protection
10. **Initial commit** - Save the setup

## Requirements

- Git 2.30+
- Node.js 18+ (if using npm/yarn/pnpm)
- Bun 1.0+ (if using bun)

## License

MIT

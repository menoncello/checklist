# Template Authoring Guide

Complete guide for creating, testing, and publishing BMAD Checklist templates.

## Table of Contents

- [Overview](#overview)
- [Template Structure](#template-structure)
- [Creating a Template](#creating-a-template)
- [Template Manifest](#template-manifest)
- [Variables and Substitution](#variables-and-substitution)
- [Dependencies](#dependencies)
- [Testing Templates](#testing-templates)
- [Version Management](#version-management)
- [Publishing Templates](#publishing-templates)
- [Best Practices](#best-practices)

## Overview

Templates provide reusable checklist structures that can be instantiated with custom values. They support variables, dependencies, inheritance, and comprehensive testing.

### Key Features

- **Variable Substitution**: Dynamic content using `{{variable}}` syntax
- **Dependencies**: Reference other templates as dependencies
- **Version Management**: Semantic versioning with compatibility checking
- **Testing Framework**: Validate templates with assertions
- **Git Integration**: Publish templates via Git repositories

## Template Structure

A complete template repository has the following structure:

```
my-template/
├── template.manifest.json    # Template metadata
├── template.yaml              # Template content
├── tests/                     # Test files
│   └── template.test.json
└── README.md                  # Documentation
```

## Creating a Template

### Basic Template

Create a simple checklist template in `template.yaml`:

```yaml
version: "1.0.0"
metadata:
  id: basic-setup
  title: Basic Project Setup
  description: Essential steps for new projects
  tags:
    - setup
    - beginner

variables:
  - name: projectName
    description: Name of the project
    required: true
  - name: author
    description: Project author
    default: Team

steps:
  - id: init
    title: Initialize {{projectName}}
    description: Set up project structure for {{projectName}}
    completed: false

  - id: config
    title: Configure project
    description: Created by {{author}}
    completed: false
```

### Template with Validation

Add validation rules to ensure data quality:

```yaml
variables:
  - name: email
    description: Contact email
    required: true
    validation:
      pattern: "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$"
      message: Must be a valid email address

  - name: version
    description: Initial version
    default: "1.0.0"
    validation:
      pattern: "^\\d+\\.\\d+\\.\\d+$"
      message: Must follow semantic versioning
```

## Template Manifest

The `template.manifest.json` file defines the manifest format with template metadata and dependencies.

### Minimal Manifest

```json
{
  "name": "basic-setup",
  "version": "1.0.0",
  "description": "Basic project setup template",
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/username/basic-setup"
  },
  "tags": ["setup", "beginner"],
  "files": ["template.yaml"]
}
```

### Complete Manifest

```json
{
  "name": "advanced-workflow",
  "version": "2.1.0",
  "description": "Advanced workflow with CI/CD integration",
  "author": {
    "name": "Your Name",
    "email": "you@example.com",
    "url": "https://yoursite.com"
  },
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/username/advanced-workflow"
  },
  "homepage": "https://github.com/username/advanced-workflow#readme",
  "bugs": "https://github.com/username/advanced-workflow/issues",
  "keywords": ["workflow", "cicd", "automation"],
  "tags": ["advanced", "cicd", "deployment"],
  "files": [
    "template.yaml",
    "README.md"
  ],
  "main": "template.yaml",
  "dependencies": [
    {
      "name": "basic-setup",
      "version": "^1.0.0",
      "optional": false
    },
    {
      "name": "security-checks",
      "version": "~2.3.0",
      "optional": true
    }
  ],
  "engines": {
    "bmad": ">=1.0.0"
  }
}
```

### Manifest Fields

#### Required Fields

- **name**: Template identifier (lowercase, hyphens only)
- **version**: Semantic version (MAJOR.MINOR.PATCH)
- **description**: Clear, concise description (max 200 chars)
- **author**: String or author object
- **license**: SPDX license identifier
- **repository**: Repository information object
- **tags**: Array of classification tags
- **files**: Array of files to include

#### Optional Fields

- **homepage**: Project homepage URL
- **bugs**: Issue tracker URL
- **keywords**: Search keywords
- **main**: Entry point file (default: template.yaml)
- **dependencies**: Template dependencies
- **engines**: Required BMAD version

## Variables and Substitution

### Variable Definition

```yaml
variables:
  - name: serviceName
    description: Name of the microservice
    required: true

  - name: port
    description: Service port number
    default: "3000"

  - name: environment
    description: Deployment environment
    default: "development"
    validation:
      pattern: "^(development|staging|production)$"
```

### Variable Usage

Use variables in step content with `{{variableName}}` syntax:

```yaml
steps:
  - title: Deploy {{serviceName}} to {{environment}}
    description: |
      Service: {{serviceName}}
      Port: {{port}}
      Environment: {{environment}}

  - title: Configure {{serviceName}}
    commands:
      - run: npm install
        description: Install dependencies for {{serviceName}}
```

### Nested Variables

Access nested properties with dot notation:

```yaml
variables:
  - name: config
    description: Configuration object

steps:
  - title: Setup {{config.name}}
    description: Version {{config.version}}
```

## Dependencies

### Declaring Dependencies

Specify template dependencies in manifest:

```json
{
  "dependencies": [
    {
      "name": "base-template",
      "version": "^1.0.0",
      "optional": false
    },
    {
      "name": "optional-addon",
      "version": "~2.0.0",
      "optional": true
    }
  ]
}
```

### Version Constraints

Use semantic versioning constraints:

- **Exact**: `"1.2.3"` - Only version 1.2.3
- **Caret**: `"^1.2.3"` - >=1.2.3 <2.0.0
- **Tilde**: `"~1.2.3"` - >=1.2.3 <1.3.0
- **Range**: `">=1.0.0 <2.0.0"` - Custom range

### Dependency Resolution

Dependencies are resolved depth-first and installed in dependency order:

```
my-template (1.0.0)
├── base-template (1.5.0)
│   └── core-utils (2.0.1)
└── logging (3.1.0)
    └── core-utils (2.0.1)  # Deduplicated

Installation order:
1. core-utils (2.0.1)
2. base-template (1.5.0)
3. logging (3.1.0)
4. my-template (1.0.0)
```

## Testing Templates

### Test Structure

Create tests in `tests/template.test.json`:

```json
{
  "name": "Basic Setup Tests",
  "template": "../template.yaml",
  "testCases": [
    {
      "name": "should substitute project name",
      "input": {
        "projectName": "MyApp",
        "author": "John Doe"
      },
      "assertions": [
        {
          "type": "contains",
          "path": "steps.0.title",
          "expected": "MyApp",
          "message": "Step title should contain project name"
        },
        {
          "type": "equals",
          "path": "steps.1.description",
          "expected": "Created by John Doe"
        }
      ]
    },
    {
      "name": "should use default values",
      "input": {
        "projectName": "TestApp"
      },
      "assertions": [
        {
          "type": "equals",
          "path": "steps.1.description",
          "expected": "Created by Team"
        }
      ]
    }
  ]
}
```

### Assertion Types

#### Equals

Check exact value match:

```json
{
  "type": "equals",
  "path": "metadata.title",
  "expected": "My Project",
  "message": "Title should match exactly"
}
```

#### Contains

Check if string/array contains value:

```json
{
  "type": "contains",
  "path": "steps.0.title",
  "expected": "Deploy",
  "message": "Should contain Deploy keyword"
}
```

#### Length

Check array or string length:

```json
{
  "type": "length",
  "path": "steps",
  "expected": 5,
  "message": "Should have 5 steps"
}
```

#### Exists

Check if path exists:

```json
{
  "type": "exists",
  "path": "metadata.id",
  "expected": true,
  "message": "Metadata ID must exist"
}
```

### Running Tests

Test your template using the CLI:

```bash
# Run all tests
bmad template test ./my-template

# Run specific test file
bmad template test ./my-template/tests/template.test.json

# Verbose output
bmad template test ./my-template --verbose
```

## Version Management

### Semantic Versioning

Follow semantic versioning (MAJOR.MINOR.PATCH):

- **MAJOR**: Breaking changes (2.0.0)
- **MINOR**: New features, backwards compatible (1.1.0)
- **PATCH**: Bug fixes (1.0.1)

### Pre-release Versions

Use pre-release tags for testing:

```
1.0.0-alpha.1    # Alpha release
1.0.0-beta.2     # Beta release
1.0.0-rc.1       # Release candidate
```

### Version Tags

Tag versions in Git:

```bash
# Create annotated tag
git tag -a v1.0.0 -m "Release version 1.0.0"

# Push tags
git push origin v1.0.0
```

### Breaking Changes

When making breaking changes:

1. Increment MAJOR version
2. Document changes in CHANGELOG.md
3. Update migration guide
4. Consider deprecation period

## Publishing Templates

### Git Repository Setup

1. **Initialize repository**:

```bash
git init
git add .
git commit -m "Initial commit"
```

2. **Create remote repository**:

```bash
git remote add origin https://github.com/username/template-name.git
git push -u origin main
```

3. **Tag release**:

```bash
git tag -a v1.0.0 -m "Version 1.0.0"
git push origin v1.0.0
```

### Template Registry

Register your template in the marketplace index:

```json
{
  "name": "my-template",
  "version": "1.0.0",
  "description": "Description of my template",
  "author": "Your Name",
  "repository": "https://github.com/username/my-template",
  "tags": ["category", "feature"]
}
```

### Documentation

Include comprehensive README.md:

````markdown
# Template Name

Brief description of the template.

## Features

- Feature 1
- Feature 2

## Usage

```bash
bmad template install my-template
bmad template use my-template
```

## Variables

| Name | Description | Required | Default |
|------|-------------|----------|---------|
| projectName | Project name | Yes | - |
| author | Author name | No | Team |

## Examples

...

## License

MIT
````

## Best Practices

### Template Design

1. **Keep it focused**: One template, one purpose
2. **Use clear names**: Descriptive variable and step names
3. **Provide defaults**: Sensible default values
4. **Add validation**: Validate variable inputs
5. **Document everything**: Clear descriptions and examples

### Variable Naming

```yaml
# Good
variables:
  - name: serviceName
  - name: apiEndpoint
  - name: maxRetries

# Avoid
variables:
  - name: sn
  - name: ep
  - name: max
```

### Step Organization

```yaml
# Group related steps
steps:
  # Setup phase
  - id: setup-env
    title: Setup environment

  - id: setup-deps
    title: Install dependencies

  # Configuration phase
  - id: config-service
    title: Configure service

  - id: config-db
    title: Configure database
```

### Testing

1. **Test all paths**: Cover all variable combinations
2. **Test defaults**: Verify default values work
3. **Test validation**: Ensure validation catches errors
4. **Test edge cases**: Empty strings, special characters

### Version Control

1. **Meaningful commits**: Descriptive commit messages
2. **Semantic versioning**: Follow semver strictly
3. **Changelog**: Maintain CHANGELOG.md
4. **Git tags**: Tag all releases

### Documentation

1. **Clear README**: Comprehensive usage guide
2. **Variable documentation**: Document all variables
3. **Examples**: Provide working examples
4. **Migration guides**: Document breaking changes

## Resources

- [Template Examples](../../examples/templates/)
- [API Reference](../architecture/api-specification.md)
- [Testing Guide](template-testing.md)
- [Marketplace Guide](template-marketplace.md)

## Support

For questions and support:

- GitHub Issues: [Report an issue](https://github.com/bmad/checklist/issues)
- Discussions: [Join discussion](https://github.com/bmad/checklist/discussions)

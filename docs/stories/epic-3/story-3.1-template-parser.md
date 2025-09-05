# Story 3.1: Template Parser Engine

## Overview

Implement the core template parsing and processing engine that reads, validates, and prepares checklist templates for execution.

## Story Details

- **Epic**: 3 - Template System & Security
- **Type**: Feature
- **Priority**: Critical
- **Estimated Effort**: 2 days
- **Dependencies**: [1.3, 1.4]

## Description

Create a robust template parser that can read YAML and Markdown-based templates, extract workflow structure, validate syntax, and support template inheritance. This parser forms the foundation of the template system.

## Acceptance Criteria

- [ ] Parse YAML-based template files
- [ ] Parse Markdown-based template files with YAML frontmatter
- [ ] Extract workflow structure and metadata
- [ ] Validate template syntax against schema
- [ ] Support template inheritance and composition
- [ ] Handle template versioning
- [ ] Parse custom directives and macros
- [ ] Support template includes/imports
- [ ] Generate parse error messages with line numbers
- [ ] Cache parsed templates for performance

## Technical Requirements

### Template Parser Architecture

```typescript
interface TemplateParser {
  // Parsing
  parse(content: string, format: TemplateFormat): Template;
  parseFile(path: string): Promise<Template>;

  // Validation
  validate(template: Template): ValidationResult;
  validateAgainstSchema(template: any, schema: Schema): boolean;

  // Template Composition
  resolveInheritance(template: Template): Template;
  resolveIncludes(template: Template): Promise<Template>;

  // Caching
  getCached(templateId: string): Template | null;
  setCached(templateId: string, template: Template): void;
}

interface Template {
  // Metadata
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  tags?: string[];

  // Structure
  extends?: string; // Parent template
  includes?: string[]; // Included templates

  // Content
  variables: Variable[];
  sections: Section[];
  items: ChecklistItem[];

  // Directives
  directives: Directive[];
  macros: Macro[];
}

interface ChecklistItem {
  id: string;
  title: string;
  description?: string;
  type: 'task' | 'section' | 'decision' | 'note';

  // Conditions
  when?: Expression; // Conditional display
  unless?: Expression;

  // Dependencies
  dependsOn?: string[];
  blocks?: string[];

  // Actions
  commands?: Command[];
  validations?: Validation[];

  // Children
  items?: ChecklistItem[];
}
```

### Template Formats

#### YAML Template Format

```yaml
# sprint-planning.yaml
template:
  id: sprint-planning
  name: Sprint Planning Checklist
  version: 1.0.0
  extends: agile-base

variables:
  - name: sprintNumber
    type: number
    required: true
    prompt: 'Enter sprint number'

  - name: teamSize
    type: number
    default: 5

sections:
  - id: preparation
    name: Sprint Preparation
    items:
      - id: review-backlog
        title: Review product backlog
        description: Ensure backlog is groomed and prioritized
        type: task

      - id: capacity-planning
        title: Calculate team capacity
        description: 'Team capacity: {{teamSize * 6}} story points'
        type: task
        when: 'teamSize > 0'
```

#### Markdown Template Format

```markdown
---
id: sprint-planning
name: Sprint Planning Checklist
version: 1.0.0
extends: agile-base
---

# Sprint Planning Checklist

## Variables

- `sprintNumber` (number, required): Enter sprint number
- `teamSize` (number, default: 5): Team size

## Preparation

### Review product backlog

Ensure backlog is groomed and prioritized

### Calculate team capacity

Team capacity: {{teamSize * 6}} story points
_Condition: teamSize > 0_
```

### Parser Implementation

```typescript
class YAMLTemplateParser {
  parse(content: string): Template {
    // 1. Parse YAML to object
    const raw = yaml.parse(content);

    // 2. Validate structure
    this.validateStructure(raw);

    // 3. Transform to Template
    const template = this.transform(raw);

    // 4. Resolve references
    this.resolveReferences(template);

    // 5. Validate semantics
    this.validateSemantics(template);

    return template;
  }

  private validateStructure(raw: any) {
    // Check required fields
    if (!raw.template?.id) {
      throw new ParseError('Template must have an id');
    }

    // Validate against JSON schema
    const valid = ajv.validate(templateSchema, raw);
    if (!valid) {
      throw new ParseError(ajv.errorsText());
    }
  }
}
```

### Error Handling

```typescript
class ParseError extends Error {
  constructor(
    message: string,
    public line?: number,
    public column?: number,
    public suggestion?: string
  ) {
    super(message);
  }
}

// Example error output:
"Parse error at line 15, column 8:
  Invalid item type 'todos'
  Valid types are: task, section, decision, note

Did you mean 'task'?"
```

## Testing Requirements

- [ ] Unit tests for YAML parsing
- [ ] Unit tests for Markdown parsing
- [ ] Validation tests with invalid templates
- [ ] Inheritance resolution tests
- [ ] Include resolution tests
- [ ] Error message quality tests
- [ ] Performance tests with large templates
- [ ] Cache functionality tests

## Performance Requirements

- Parse typical template (<100 items): <50ms
- Parse large template (1000+ items): <200ms
- Cache hit performance: <5ms
- Validation: <20ms

## Definition of Done

- [ ] YAML parser implemented and tested
- [ ] Markdown parser implemented and tested
- [ ] Template validation working
- [ ] Inheritance system functional
- [ ] Include system working
- [ ] Error messages helpful with line numbers
- [ ] Caching implemented
- [ ] Tests passing with >90% coverage
- [ ] Performance targets met

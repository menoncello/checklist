# Story 3.8: Template Creator Documentation

## Story

**As a** template creator,  
**I want** comprehensive documentation and examples,  
**So that** I can create custom templates for my team's workflows.

## Priority

**MEDIUM** - Complete with Epic 3

## Acceptance Criteria

### Documentation Coverage

1. ✅ Complete template syntax reference
2. ✅ Variable system documentation with all types
3. ✅ Conditional logic patterns and examples
4. ✅ Best practices and anti-patterns guide
5. ✅ Template testing and validation guide
6. ✅ Publishing and sharing documentation
7. ✅ Troubleshooting common issues

### Example Templates

1. ✅ At least 10 real-world examples
2. ✅ Progressive complexity (simple → advanced)
3. ✅ Industry-specific templates (dev, QA, DevOps)
4. ✅ Templates with complex conditionals
5. ✅ Templates using all variable types

## Documentation Structure

### Template Documentation Tree

```
docs/templates/
├── README.md                    # Template system overview
├── quick-start.md              # 5-minute getting started
├── syntax-reference.md         # Complete syntax documentation
├── variables.md                # Variable types and usage
├── conditionals.md             # Conditional logic guide
├── commands.md                 # Command execution in templates
├── validation.md               # Template validation rules
├── best-practices.md           # Do's and don'ts
├── troubleshooting.md          # Common issues and solutions
├── examples/
│   ├── basic/
│   │   ├── simple-checklist.yaml
│   │   ├── daily-standup.yaml
│   │   └── code-review.yaml
│   ├── intermediate/
│   │   ├── pr-review.yaml
│   │   ├── deployment.yaml
│   │   └── feature-development.yaml
│   └── advanced/
│       ├── multi-stage-pipeline.yaml
│       ├── conditional-workflow.yaml
│       └── team-onboarding.yaml
├── tutorials/
│   ├── first-template.md       # Step-by-step first template
│   ├── adding-variables.md     # Working with variables
│   ├── using-conditionals.md   # Conditional logic tutorial
│   └── testing-templates.md    # How to test templates
└── api/
    ├── template-schema.json     # JSON schema for validation
    └── type-definitions.ts      # TypeScript definitions
```

## Content Examples

### Quick Start Guide

```markdown
# Template Quick Start

Create your first template in 5 minutes!

## 1. Create a Template File

Create `my-template.yaml`:

\`\`\`yaml
name: my-first-template
description: A simple daily checklist
version: 1.0.0

sections:

- name: Morning Tasks
  items: - text: Review calendar for the day - text: Check priority emails - text: Update task board
  \`\`\`

## 2. Use Your Template

\`\`\`bash
checklist init my-template.yaml
checklist start
\`\`\`

## 3. Add Variables

Make your template dynamic:

\`\`\`yaml
variables:
project_name:
type: text
prompt: "What project are you working on?"
default: "My Project"

sections:

- name: "{{ project_name }} Tasks"
  items: - text: "Update {{ project_name }} documentation"
  \`\`\`
```

### Variable System Documentation

```markdown
# Template Variables

## Variable Types

### Text Variables

\`\`\`yaml
variables:
username:
type: text
prompt: "Enter your name"
default: "User"
validation: "^[A-Za-z ]+$" # Letters and spaces only
\`\`\`

### Choice Variables

\`\`\`yaml
variables:
environment:
type: choice
prompt: "Select deployment environment"
options: - development - staging - production
default: development
\`\`\`

### Boolean Variables

\`\`\`yaml
variables:
include_tests:
type: boolean
prompt: "Include test steps?"
default: true
\`\`\`

### Number Variables

\`\`\`yaml
variables:
team_size:
type: number
prompt: "How many team members?"
min: 1
max: 100
default: 5
\`\`\`

### Date Variables

\`\`\`yaml
variables:
deadline:
type: date
prompt: "Project deadline"
format: "YYYY-MM-DD"
default: "{{ today() + days(7) }}" # 7 days from now
\`\`\`

## Using Variables

### In Text

\`\`\`yaml
items:

- text: "Deploy to {{ environment }} environment"
- text: "Team of {{ team_size }} developers"
  \`\`\`

### In Conditionals

\`\`\`yaml
items:

- text: "Run unit tests"
  condition: "{{ include_tests == true }}"

- text: "Run integration tests"
  condition: "{{ include_tests && environment != 'production' }}"
  \`\`\`

### In Commands

\`\`\`yaml
items:

- text: "Deploy application"
  command: "deploy.sh {{ environment }} --team-size={{ team_size }}"
  \`\`\`
```

### Advanced Template Example

```yaml
# Advanced Multi-Stage Deployment Template
name: advanced-deployment
description: Production deployment with safety checks
version: 2.0.0

variables:
  app_name:
    type: text
    prompt: 'Application name'
    validation: '^[a-z0-9-]+$'

  environment:
    type: choice
    prompt: 'Target environment'
    options: [staging, production]
    default: staging

  deployment_type:
    type: choice
    prompt: 'Deployment strategy'
    options: [blue-green, canary, rolling]
    default: blue-green

  rollback_enabled:
    type: boolean
    prompt: 'Enable automatic rollback?'
    default: true

  canary_percentage:
    type: number
    prompt: 'Canary traffic percentage'
    condition: "{{ deployment_type == 'canary' }}"
    min: 1
    max: 50
    default: 10

sections:
  - name: Pre-Deployment Checks
    items:
      - text: 'Verify CI/CD pipeline passed'
        required: true

      - text: 'Check system health metrics'
        command: 'check-health.sh {{ environment }}'
        required: true

      - text: 'Backup database'
        condition: "{{ environment == 'production' }}"
        command: 'backup-db.sh {{ app_name }}'
        required: true

      - text: 'Notify team of deployment'
        command: "slack-notify.sh 'Deploying {{ app_name }} to {{ environment }}'"

  - name: Deployment
    condition: "{{ all_required_complete('Pre-Deployment Checks') }}"
    items:
      - text: 'Pull latest Docker image'
        command: 'docker pull {{ app_name }}:{{ git_sha }}'

      - text: 'Run database migrations'
        command: 'migrate-db.sh {{ environment }}'
        rollback: 'migrate-db.sh {{ environment }} --rollback'

      - text: 'Deploy using {{ deployment_type }} strategy'
        command: |
          {% if deployment_type == 'blue-green' %}
            deploy-blue-green.sh {{ app_name }} {{ environment }}
          {% elif deployment_type == 'canary' %}
            deploy-canary.sh {{ app_name }} {{ environment }} --percentage={{ canary_percentage }}
          {% else %}
            deploy-rolling.sh {{ app_name }} {{ environment }}
          {% endif %}
        rollback: 'rollback.sh {{ app_name }} {{ environment }}'

  - name: Post-Deployment Validation
    items:
      - text: 'Run smoke tests'
        command: 'smoke-test.sh {{ environment }}'
        required: true
        timeout: 300 # 5 minutes

      - text: 'Monitor error rates (5 minutes)'
        command: 'monitor-errors.sh {{ app_name }} --duration=5m'
        condition: "{{ environment == 'production' }}"

      - text: 'Validate canary metrics'
        condition: "{{ deployment_type == 'canary' }}"
        command: 'validate-canary.sh {{ canary_percentage }}'

      - text: 'Full rollout approval'
        condition: "{{ deployment_type == 'canary' }}"
        type: approval
        approvers: ['team-lead', 'qa-lead']

  - name: Cleanup
    items:
      - text: 'Remove old deployments'
        command: 'cleanup-old.sh {{ app_name }} --keep=3'

      - text: 'Update documentation'
        command: 'update-docs.sh {{ app_name }} {{ version }}'

      - text: 'Send deployment report'
        command: 'generate-report.sh | send-report.sh'

hooks:
  on_failure:
    - condition: '{{ rollback_enabled }}'
      action: rollback
      notify: ['oncall@team.com']

  on_success:
    - action: notify
      message: '✅ {{ app_name }} deployed to {{ environment }}'
      channels: ['#deployments', '#{{ app_name }}']

  on_timeout:
    - action: alert
      severity: high
      message: 'Deployment timeout for {{ app_name }}'
```

### Template Validation Documentation

```markdown
# Template Validation

## Validation Rules

### Required Fields

- `name`: Unique template identifier
- `version`: Semantic version (x.y.z)
- `sections`: At least one section with items

### Schema Validation

Run validation before using a template:

\`\`\`bash
checklist validate my-template.yaml
\`\`\`

### Common Validation Errors

#### Missing Required Field

\`\`\`
❌ Error: Missing required field 'version'
Line 2: name: my-template

Fix: Add version field:
version: 1.0.0
\`\`\`

#### Invalid Variable Reference

\`\`\`
❌ Error: Unknown variable 'project_namee'
Line 15: text: "Deploy {{ project_namee }}"

Fix: Check variable name spelling
\`\`\`

#### Circular Dependency

\`\`\`
❌ Error: Circular dependency detected
Section 'Deploy' depends on 'Test'
Section 'Test' depends on 'Deploy'

Fix: Remove one of the dependencies
\`\`\`

## Testing Templates

### Unit Testing

\`\`\`typescript
import { validateTemplate, runTemplate } from '@checklist/core';

describe('My Template', () => {
it('should validate successfully', async () => {
const template = await loadTemplate('my-template.yaml');
const result = await validateTemplate(template);
expect(result.valid).toBe(true);
});

it('should handle all variable combinations', async () => {
const scenarios = [
{ environment: 'staging', include_tests: true },
{ environment: 'production', include_tests: false }
];

    for (const vars of scenarios) {
      const result = await runTemplate('my-template.yaml', vars);
      expect(result.errors).toHaveLength(0);
    }

});
});
\`\`\`
```

## Technical Tasks

### Phase 1: Core Documentation

- [ ] Write README.md with overview
- [ ] Create quick-start guide
- [ ] Write complete syntax reference
- [ ] Document all variable types
- [ ] Create conditional logic guide

### Phase 2: Examples and Tutorials

- [ ] Create 10+ example templates
- [ ] Write step-by-step tutorials
- [ ] Build progressive learning path
- [ ] Add industry-specific examples
- [ ] Create troubleshooting guide

### Phase 3: Tools and Integration

- [ ] Generate JSON schema for validation
- [ ] Create TypeScript type definitions
- [ ] Build template testing framework
- [ ] Add VS Code extension docs
- [ ] Create template generator CLI

## Definition of Done

- [ ] All syntax documented with examples
- [ ] 10+ complete template examples
- [ ] Template validator documented
- [ ] Publishing workflow documented
- [ ] Community guidelines written
- [ ] Video tutorials created (3+)
- [ ] Template playground available

## Time Estimate

**3-4 days** for comprehensive documentation

## Dependencies

- Complete after Story 3.1-3.7 (Template system implementation)
- Before public release

## Risk Factors

- 🟢 Documentation can evolve with feedback
- 🟡 Examples must stay in sync with implementation
- 🟢 Can leverage existing template systems for patterns

## Notes for Developers

- Keep examples working with CI tests
- Update docs when template syntax changes
- Include real-world use cases from beta users
- Consider interactive documentation site
- Maintain template gallery/marketplace docs

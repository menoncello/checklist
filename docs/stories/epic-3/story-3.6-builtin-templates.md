# Story 3.6: Built-in Templates

## Overview
Create a comprehensive set of built-in BMAD methodology templates that demonstrate the system capabilities and provide immediate value to users.

## Story Details
- **Epic**: 3 - Template System & Security
- **Type**: Feature
- **Priority**: High
- **Estimated Effort**: 2 days
- **Dependencies**: [3.1, 3.2, 3.3]

## Description
Develop core BMAD templates for common development workflows including Product Owner, Developer, QA, Architect, and General workflows. These templates serve as both functional tools and examples for custom template creation.

## Acceptance Criteria
- [ ] 5 core BMAD role templates implemented
- [ ] Project initialization template
- [ ] Sprint planning template  
- [ ] Code review checklist template
- [ ] Bug tracking workflow template
- [ ] Deployment checklist template
- [ ] All templates follow best practices
- [ ] Templates are well-documented
- [ ] Templates demonstrate advanced features
- [ ] Templates are tested and validated

## Technical Requirements

### Template Categories
```typescript
interface BuiltInTemplates {
  // BMAD Role Templates
  roles: {
    productOwner: Template      // PO workflows
    developer: Template          // Dev workflows
    qualityAssurance: Template   // QA workflows
    architect: Template          // Architecture workflows
    general: Template           // General workflows
  }
  
  // Process Templates
  processes: {
    projectInit: Template       // New project setup
    sprintPlanning: Template    // Sprint ceremonies
    codeReview: Template        // Review process
    bugTracking: Template       // Bug workflow
    deployment: Template        // Release process
  }
  
  // Utility Templates
  utilities: {
    dailyStandup: Template      // Daily check-ins
    retrospective: Template     // Sprint retros
    documentation: Template     // Doc processes
  }
}
```

### Template 1: Product Owner Workflow
```yaml
# po-workflow.yaml
template:
  id: po-workflow
  name: Product Owner Workflow
  version: 1.0.0
  description: BMAD Product Owner sprint workflow
  author: BMAD Team
  tags: [bmad, product-owner, agile]

variables:
  - name: sprintNumber
    type: number
    required: true
    prompt: "Sprint number"
    
  - name: sprintGoal
    type: string
    required: true
    multiline: true
    prompt: "Sprint goal"
    
  - name: teamCapacity
    type: number
    default: 40
    prompt: "Team capacity (story points)"

sections:
  - id: planning
    name: Sprint Planning
    items:
      - id: review-backlog
        title: Review and groom product backlog
        description: Ensure backlog items are ready for sprint
        checklist:
          - Acceptance criteria defined
          - Story points estimated
          - Dependencies identified
          
      - id: define-sprint-goal
        title: Define sprint goal
        description: "Goal: {{sprintGoal}}"
        
      - id: select-stories
        title: Select stories for sprint
        description: "Target capacity: {{teamCapacity}} points"
        loop:
          times: 5
          as: index
          items:
            - id: "story-{{index}}"
              title: "Select story {{index + 1}}"
              prompt: "Enter story ID"
              
  - id: execution
    name: Sprint Execution
    items:
      - id: daily-standups
        title: Facilitate daily standups
        repeating: daily
        
      - id: remove-blockers
        title: Address team blockers
        when: "hasBlockers"
        
      - id: stakeholder-updates
        title: Update stakeholders
        repeating: weekly
        
  - id: review
    name: Sprint Review & Retro
    items:
      - id: demo-preparation
        title: Prepare sprint demo
        checklist:
          - Demo environment ready
          - Features tested
          - Stakeholders invited
          
      - id: conduct-demo
        title: Conduct sprint demo
        
      - id: gather-feedback
        title: Gather stakeholder feedback
        
      - id: retrospective
        title: Facilitate retrospective
        checklist:
          - What went well?
          - What could improve?
          - Action items defined
```

### Template 2: Developer Workflow
```yaml
# developer-workflow.yaml
template:
  id: developer-workflow
  name: Developer Story Implementation
  version: 1.0.0
  description: BMAD developer workflow for story implementation

variables:
  - name: storyId
    type: string
    required: true
    pattern: "^[A-Z]+-\\d+$"
    prompt: "Story ID (e.g., PROJ-123)"
    
  - name: branchName
    type: string
    computed: "feature/{{storyId | lowercase}}"

sections:
  - id: setup
    name: Story Setup
    items:
      - id: understand-requirements
        title: Review story requirements
        checklist:
          - Read acceptance criteria
          - Understand dependencies
          - Clarify unknowns with PO
          
      - id: create-branch
        title: Create feature branch
        command: "git checkout -b {{branchName}}"
        
      - id: setup-environment
        title: Setup development environment
        
  - id: implementation
    name: Implementation
    items:
      - id: write-tests
        title: Write unit tests
        description: TDD - tests first!
        
      - id: implement-feature
        title: Implement feature
        checklist:
          - Follow coding standards
          - Add appropriate comments
          - Handle edge cases
          
      - id: refactor
        title: Refactor and optimize
        
      - id: update-documentation
        title: Update documentation
        when: "requiresDocUpdate"
        
  - id: validation
    name: Validation & Review
    items:
      - id: run-tests
        title: Run all tests
        command: "npm test"
        validation:
          - exitCode: 0
          - coverage: ">= 80"
          
      - id: lint-code
        title: Run linter
        command: "npm run lint"
        
      - id: self-review
        title: Self code review
        checklist:
          - No console.logs
          - No commented code
          - Proper error handling
          
      - id: create-pr
        title: Create pull request
        command: "gh pr create"
```

### Template 3: QA Testing Workflow
```yaml
# qa-testing.yaml
template:
  id: qa-testing
  name: QA Testing Workflow
  version: 1.0.0
  description: Comprehensive QA testing checklist

sections:
  - id: preparation
    name: Test Preparation
    items:
      - id: review-requirements
        title: Review requirements and AC
        
      - id: prepare-test-cases
        title: Prepare test cases
        
      - id: setup-test-env
        title: Setup test environment
        
  - id: functional
    name: Functional Testing
    items:
      - id: happy-path
        title: Test happy path scenarios
        
      - id: edge-cases
        title: Test edge cases
        
      - id: error-handling
        title: Test error scenarios
        
  - id: non-functional
    name: Non-Functional Testing
    items:
      - id: performance
        title: Performance testing
        when: "requiresPerformanceTest"
        
      - id: security
        title: Security testing
        when: "requiresSecurityTest"
        
      - id: accessibility
        title: Accessibility testing
```

### Template 4: Sprint Planning
```yaml
# sprint-planning.yaml
template:
  id: sprint-planning
  name: Sprint Planning Ceremony
  version: 1.0.0
  description: Facilitate sprint planning meeting

variables:
  - name: duration
    type: enum
    enum: [1 week, 2 weeks, 3 weeks, 4 weeks]
    default: 2 weeks

sections:
  - id: preparation
    name: Pre-Planning
    items:
      - id: backlog-ready
        title: Ensure backlog is refined
        
      - id: capacity-calculated
        title: Calculate team capacity
        
  - id: planning
    name: Planning Meeting
    items:
      - id: review-velocity
        title: Review previous sprint velocity
        
      - id: define-goal
        title: Define sprint goal
        
      - id: select-items
        title: Select sprint backlog items
        
      - id: task-breakdown
        title: Break down stories into tasks
        
      - id: commit
        title: Team commitment
```

### Template 5: Deployment Checklist
```yaml
# deployment.yaml  
template:
  id: deployment
  name: Production Deployment
  version: 1.0.0
  description: Production deployment checklist

variables:
  - name: environment
    type: enum
    enum: [staging, production]
    required: true
    
  - name: version
    type: string
    required: true
    pattern: "^v\\d+\\.\\d+\\.\\d+$"

sections:
  - id: pre-deployment
    name: Pre-Deployment
    items:
      - id: code-freeze
        title: Enforce code freeze
        when: "environment == 'production'"
        
      - id: run-tests
        title: Run full test suite
        critical: true
        
      - id: backup
        title: Backup current version
        when: "environment == 'production'"
        
  - id: deployment
    name: Deployment
    items:
      - id: deploy
        title: Deploy version {{version}}
        
      - id: smoke-test
        title: Run smoke tests
        critical: true
        
      - id: monitor
        title: Monitor application metrics
        
  - id: post-deployment
    name: Post-Deployment
    items:
      - id: verify
        title: Verify deployment success
        
      - id: notify
        title: Notify stakeholders
        
      - id: document
        title: Update deployment log
```

## Testing Requirements
- [ ] All templates parse successfully
- [ ] Variable substitution works correctly
- [ ] Conditional logic evaluated properly
- [ ] Loops function as expected
- [ ] Commands are safe and valid
- [ ] Templates complete without errors
- [ ] Documentation is accurate
- [ ] Examples demonstrate features

## Documentation Requirements
Each template must include:
- Clear description of purpose
- List of variables with explanations
- Usage examples
- Best practices guide
- Customization instructions

## Definition of Done
- [ ] All 10+ templates implemented
- [ ] Templates follow BMAD methodology
- [ ] Advanced features demonstrated
- [ ] Templates fully tested
- [ ] Documentation complete
- [ ] Templates validated by PO
- [ ] Performance acceptable
- [ ] Security sandbox compliant
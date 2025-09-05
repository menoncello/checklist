# Epic 3: Templates & Security

**Goal:** Implement a powerful and secure template engine with advanced variable substitution, conditionals, and preparation for community template sharing.

## Story 3.1: Template Loading with Sandbox

**As a** developer,  
**I want** secure template loading with validation,  
**so that** malicious templates cannot harm the system.

**Acceptance Criteria:**
1. Templates loaded from `/templates` with validation
2. Schema validation before parsing
3. Sandboxed environment for template execution
4. Template metadata extracted safely
5. Template inheritance supported
6. Invalid templates fail with clear errors
7. Template cache with invalidation
8. Resource limits enforced (memory, CPU)

## Story 3.2: Template Security System ✨ NEW

**As a** developer,  
**I want** comprehensive template security,  
**so that** users can safely use community templates.

**Acceptance Criteria:**
1. Template signing with checksums
2. Dangerous command detection and warnings
3. Network access blocked in templates
4. File system access restricted
5. Command injection prevention
6. Template permissions system
7. Security audit log for templates
8. Trusted publisher registry prepared

## Story 3.3: Variable Management System

**As a** user,  
**I want** flexible variable management,  
**so that** workflows adapt to my project needs.

**Acceptance Criteria:**
1. Variables defined with types and defaults
2. Required variables prompted during init
3. Variables persist in state.yaml
4. Global and step-level scope
5. Variable editor in TUI
6. Environment variable access
7. Computed variables with expressions
8. Type validation (string, number, boolean, array)

## Story 3.4: Basic Template Substitution ✨ SPLIT

**As a** user,  
**I want** simple variable substitution,  
**so that** commands use my project-specific values.

**Acceptance Criteria:**
1. ${variable} substitution works
2. Nested variables: ${var1.${var2}}
3. Default values: ${var:-default}
4. Escaping: \${literal}
5. All string operations safe
6. Clear error messages for undefined
7. Preview shows substituted values
8. Performance <5ms for typical templates

## Story 3.5: Advanced Template Features ✨ SPLIT

**As a** user,  
**I want** conditionals and loops in templates,  
**so that** workflows can have dynamic behavior.

**Acceptance Criteria:**
1. Conditionals: {{#if condition}}...{{/if}}
2. Else branches: {{else}}
3. Loops: {{#each items}}...{{/each}}
4. Nested conditionals and loops
5. Functions: ${fn:uppercase(var)}
6. Math expressions: ${count + 1}
7. Safe evaluation only
8. Performance <50ms for complex templates

## Story 3.6: Conditional Workflow Branching

**As a** user,  
**I want** steps to appear based on conditions,  
**so that** workflows adapt to my choices.

**Acceptance Criteria:**
1. Steps define condition property
2. Conditions evaluated on state change
3. Hidden steps don't appear in list
4. Step groups conditional together
5. Manual re-evaluation trigger
6. Debug mode shows why steps hidden
7. Complex logic (AND/OR/NOT)
8. Performance maintained with 100+ conditions

## Story 3.7: Template Marketplace Foundation ✨ NEW

**As a** developer,  
**I want** infrastructure for template sharing,  
**so that** community can contribute workflows.

**Acceptance Criteria:**
1. Template manifest format defined
2. Git-based template repositories supported
3. Template discovery via index file
4. Version management for templates
5. Dependency resolution between templates
6. Template testing framework
7. Documentation for template authors
8. Example templates demonstrate patterns

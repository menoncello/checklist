# Story 3.7: Template Import/Export

## Overview

Implement template import and export functionality to enable sharing templates between projects and users, with support for versioning and dependency resolution.

## Story Details

- **Epic**: 3 - Template System & Security
- **Type**: Feature
- **Priority**: Medium
- **Estimated Effort**: 1 day
- **Dependencies**: [3.1, 3.4]

## Description

Create a system for packaging, exporting, and importing templates with their dependencies, supporting both file-based and URL-based imports. This enables template sharing and reuse across projects.

## Acceptance Criteria

- [ ] Export template to file (single or bundled)
- [ ] Import template from file
- [ ] Import template from URL
- [ ] Template versioning support
- [ ] Dependency resolution and bundling
- [ ] Signature verification for trusted templates
- [ ] Import conflict resolution
- [ ] Template metadata preservation
- [ ] Rollback capability for failed imports
- [ ] Template upgrade paths

## Technical Requirements

### Import/Export Architecture

```typescript
interface TemplatePortability {
  // Export
  exportTemplate(templateId: string, options?: ExportOptions): TemplatePackage;
  exportBundle(templateIds: string[], options?: ExportOptions): TemplateBundle;

  // Import
  importTemplate(source: string | File | URL, options?: ImportOptions): ImportResult;
  importBundle(source: string | File | URL, options?: ImportOptions): ImportResult;

  // Validation
  validatePackage(package: TemplatePackage): ValidationResult;
  verifySignature(package: TemplatePackage): boolean;

  // Dependency Management
  resolveDependencies(template: Template): Dependency[];
  checkCompatibility(template: Template): CompatibilityResult;

  // Version Management
  upgradeTemplate(current: Template, target: Template): UpgradeResult;
  migrateTemplate(template: Template, fromVersion: string): Template;
}

interface TemplatePackage {
  // Metadata
  format: 'checklist/template';
  version: '1.0.0';
  exported: Date;
  exporter: {
    tool: string;
    version: string;
  };

  // Content
  template: Template;
  dependencies?: Template[];
  assets?: Asset[];

  // Security
  checksum: string;
  signature?: string;

  // Compatibility
  requires: {
    checklistVersion: string;
    features?: string[];
  };
}
```

### Export Formats

#### Single Template Export

```yaml
# sprint-planning.ctpl (Checklist Template Package)
---
format: checklist/template
version: 1.0.0
exported: 2024-01-04T10:30:00Z
exporter:
  tool: checklist-manager
  version: 1.0.0

metadata:
  id: sprint-planning
  name: Sprint Planning Template
  version: 2.1.0
  author: BMAD Team
  license: MIT

requires:
  checklistVersion: '>=1.0.0'
  features:
    - variables
    - conditionals
    - loops

template:
  # Full template content here
  id: sprint-planning
  name: Sprint Planning
  sections:
    # ... template content

dependencies:
  - id: bmad-common
    version: '^1.0.0'

checksum: sha256:abcdef1234567890
signature: |
  -----BEGIN PGP SIGNATURE-----
  # ... signature ...
  -----END PGP SIGNATURE-----
```

#### Bundle Export (Tar/Zip)

```
template-bundle.tgz/
├── manifest.yaml
├── templates/
│   ├── sprint-planning.yaml
│   ├── code-review.yaml
│   └── deployment.yaml
├── dependencies/
│   └── bmad-common.yaml
├── assets/
│   ├── icons/
│   └── docs/
└── signatures/
    └── bundle.sig
```

### Import Process

#### Import Workflow

```typescript
class TemplateImporter {
  async importTemplate(source: string | URL): Promise<ImportResult> {
    // 1. Fetch template
    const package = await this.fetchPackage(source);

    // 2. Validate package
    const validation = await this.validatePackage(package);
    if (!validation.valid) {
      return { success: false, errors: validation.errors };
    }

    // 3. Check signature (if required)
    if (this.config.requireSignature) {
      const verified = await this.verifySignature(package);
      if (!verified) {
        return { success: false, error: 'Invalid signature' };
      }
    }

    // 4. Check compatibility
    const compat = this.checkCompatibility(package);
    if (!compat.compatible) {
      return { success: false, error: compat.reason };
    }

    // 5. Resolve dependencies
    const deps = await this.resolveDependencies(package);
    if (deps.missing.length > 0) {
      const resolved = await this.promptForDependencies(deps.missing);
      if (!resolved) {
        return { success: false, error: 'Missing dependencies' };
      }
    }

    // 6. Check for conflicts
    const conflicts = this.checkConflicts(package);
    if (conflicts.length > 0) {
      const resolution = await this.resolveConflicts(conflicts);
      if (!resolution) {
        return { success: false, error: 'Unresolved conflicts' };
      }
    }

    // 7. Install template
    try {
      await this.installTemplate(package);
      return { success: true, template: package.template };
    } catch (error) {
      await this.rollback(package);
      return { success: false, error };
    }
  }
}
```

#### Conflict Resolution

```typescript
interface ConflictResolution {
  type: 'version' | 'name' | 'dependency'
  existing: Template
  importing: Template
  resolution?: 'keep' | 'replace' | 'rename' | 'merge'
}

// UI for conflict resolution
"Template Conflict Detected
─────────────────────────
Template 'sprint-planning' already exists:
  Existing: v1.2.0 (modified 3 days ago)
  Importing: v2.0.0

How would you like to proceed?
  [k]eep existing
  [r]eplace with new
  [m]erge (attempt auto-merge)
  [n]ame as 'sprint-planning-v2'
  [c]ancel import"
```

### URL Import

```typescript
// Import from URL
checklist template import https://templates.bmad.dev/sprint-planning

// Import from GitHub
checklist template import github:bmad/templates/sprint-planning

// Import from npm
checklist template import npm:@bmad/sprint-planning-template

// Import from local file
checklist template import ./my-template.ctpl

// Import with options
checklist template import https://example.com/template.yaml \
  --force \
  --skip-validation \
  --no-dependencies
```

### Template Registry Integration

```yaml
# .checklist/registry.yaml
registries:
  - name: bmad-official
    url: https://templates.bmad.dev
    trusted: true

  - name: company
    url: https://templates.company.com
    apiKey: ${TEMPLATE_API_KEY}

  - name: community
    url: https://community.bmad.dev/templates
    requireSignature: true

installed:
  - id: sprint-planning
    version: 2.1.0
    source: bmad-official
    installed: 2024-01-04

  - id: custom-workflow
    version: 1.0.0
    source: local
    path: ./templates/custom.yaml
```

## Testing Requirements

- [ ] Export single template tests
- [ ] Export bundle tests
- [ ] Import from file tests
- [ ] Import from URL tests
- [ ] Signature verification tests
- [ ] Dependency resolution tests
- [ ] Conflict resolution tests
- [ ] Version compatibility tests
- [ ] Rollback functionality tests

## Security Requirements

- Validate all imported templates
- Sandbox template execution
- Verify signatures for trusted sources
- Scan for malicious patterns
- Limit import file sizes
- Validate URLs before fetching

## Definition of Done

- [ ] Export functionality implemented
- [ ] Import from file working
- [ ] Import from URL functional
- [ ] Versioning system complete
- [ ] Dependency resolution working
- [ ] Signature verification optional
- [ ] Conflict resolution UI done
- [ ] Tests passing with >85% coverage
- [ ] Security review completed

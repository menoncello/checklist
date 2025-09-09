# Documentation Standards - BMAD Checklist Manager

**Version**: 1.0  
**Date**: 2025-09-09  
**Status**: MANDATORY for all documentation  
**Language**: ALL DOCUMENTATION MUST BE IN ENGLISH

## 0. Language Requirements

### MANDATORY: English Only
- **All documentation MUST be written in English**
- **No exceptions for comments, commit messages, or documentation**
- **Technical terms should use standard English terminology**
- **User-facing content must be clear and grammatically correct**

## 1. File Naming

### 1.1 General Rules
- **Format**: Always use kebab-case (lowercase-words-separated-by-hyphens)
- **Extension**: Always `.md` for documentation
- **Language**: Names in English
- **No long suffixes**: Avoid suffixes like "-complete-with-all-*", "-enhanced-with-*"

### 1.2 Standards by Type

#### Stories
```
story-{epic}.{numero}-{nome-descritivo}.md

Examples:
✅ story-1.1-project-setup.md
✅ story-2.3-progress-visualization.md
❌ 1.1.project-setup.story.md
❌ story-1.1-project-setup-complete.md
```

#### Epics
```
epic-{numero}-{nome-descritivo}.md

Examples:
✅ epic-1-foundation-validation.md
✅ epic-2-tui-core.md
❌ epic-1-foundation-validation-complete.md
```

#### Architecture Documents
```
{componente}.md (sem sufixos descritivos longos)

Examples:
✅ api-specification.md
✅ backend-architecture.md
✅ testing-strategy.md
❌ api-specification-complete-with-all-refinements.md
❌ testing-strategy-complete-with-all-testing-utilities.md
```

#### Architecture Decision Records (ADRs)
```
ADR-{numero}-{titulo}.md

Examples:
✅ ADR-001-ci-cd-choices.md
✅ ADR-002-testing-framework.md
```

#### QA Documents
```
{story-numero}-{tipo}-{data}.md

Examples:
✅ 1.6-risk-assessment-20250907.md
✅ 1.10-trace-20250908.md
```

## 2. Directory Structure

```
docs/
├── README.md                    # Entrada principal da documentação
├── DOCUMENTATION-STANDARDS.md   # Este documento
├── prd.md                      # PRD principal
├── architecture.md              # Arquitetura principal
├── prd/
│   ├── epic-*.md               # Epics do PRD
│   ├── requirements.md         # Requisitos consolidados
│   └── *.md                    # Outros documentos PRD
├── architecture/
│   ├── decisions/              # ADRs
│   │   └── ADR-*.md
│   └── *.md                    # Documentos de arquitetura
├── stories/
│   ├── README.md               # Índice de stories
│   ├── epic-1/
│   │   ├── epic-1-overview.md
│   │   └── story-1.*-*.md
│   ├── epic-2/
│   │   └── story-2.*-*.md
│   └── ...
├── qa/
│   ├── assessments/
│   └── gates/
├── development/
└── guides/
```

## 3. Content Structure

### 3.1 Headers
- **No emojis** in main headers
- Use `#` para título principal
- Use `##` para seções principais
- Use `###` para subseções

```markdown
✅ Correct:
# Document Title
## Table of Contents
### Subsection

❌ Incorrect:
# 📚 Document Title
## 🎯 Table of Contents
```

### 3.2 User Stories
```markdown
## Story
**As a** [role]  
**I want** [feature]  
**So that** [benefit]

## Acceptance Criteria
- [ ] Critério 1
- [ ] Critério 2

## Technical Details
[Detalhes técnicos]

## Dependencies
- Story X.Y
- Story X.Z
```

### 3.3 Metadata
Always at the beginning of the document, when applicable:
```markdown
**Epic**: 1 - Foundation & Validation  
**Story**: 1.1  
**Status**: In Progress  
**Priority**: High  
**Estimated**: 3 days  
**Dependencies**: [1.0]
```

## 4. Links and References

### 4.1 Relative Links
- Use relative paths whenever possible
- No leading `/` for relative links
- Use `../` to go up levels

```markdown
✅ Correct:
[See PRD](../prd.md)
[See Story 1.2](./story-1.2-tui-spike.md)

❌ Incorrect:
[See PRD](/docs/prd.md)
[See Story](story-1.2-tui-spike.md)
```

### 4.2 Code References
Always include file and line:
```markdown
Implemented in `src/services/process.ts:712`
```

## 5. Versioning and Changes

### 5.1 Change Log
For main documents:
```markdown
## Change Log

| Date | Version | Description | Author |
|------|---------|-------------|--------|
| 2025-09-09 | 1.0 | Initial version | Sarah |
```

### 5.2 Document Status
Use consistent badges:
- `[DRAFT]` - Under development
- `[REVIEW]` - Under review
- `[APPROVED]` - Approved
- `[DEPRECATED]` - Deprecated

## 6. Quality Requirements

### 6.1 Before Commit
- [ ] File name follows standard
- [ ] No unnecessary suffixes
- [ ] Links working
- [ ] Consistent formatting
- [ ] No content duplication
- [ ] All content in English

### 6.2 Mandatory Review
- Architecture documents
- Epics and stories
- Changes to standards

## 7. Validation Tools

### Link Validation
```bash
# Check for broken links
find docs -name "*.md" -exec grep -l "\.md" {} \;
```

### Name Validation
```bash
# Find files with non-compliant names
find docs -name "*-complete-with-*" -o -name "*-enhanced-*"
```

## 8. Allowed Exceptions

- README.md (industry standard name)
- CHANGELOG.md (industry standard name)
- LICENSE.md (industry standard name)
- Automatically generated files

## 9. Application

**IMPORTANT**: These standards are MANDATORY for:
- All new documentation
- Any significant updates
- Documentation refactoring

## 10. Responsibilities

- **Developers**: Follow standards when creating/updating docs
- **Product Owner**: Validate compliance
- **Tech Lead**: Approve exceptions when necessary

---

*This document is the single source of truth for documentation standards in the BMAD Checklist Manager project.*
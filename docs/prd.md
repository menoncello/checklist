# BMAD Checklist Manager Product Requirements Document (PRD)

This document has been sharded into multiple sections for better organization and maintainability. Each section is now in its own file within the `docs/prd/` directory.

## Table of Contents

### Project Overview

- [Goals and Background Context](./prd/goals-and-background-context.md) - Project goals, background, and change log
- [Requirements](./prd/requirements.md) - Functional and Non-Functional requirements (FR1-FR10, NFR1-NFR10)

### Design & Technical

- [User Interface Design Goals](./prd/user-interface-design-goals.md) - UX vision, interaction paradigms, and CLI outputs
- [Technical Assumptions](./prd/technical-assumptions.md) - Repository structure, service architecture, and testing

### Development Epics

- [Epic List](./prd/epic-list.md) - Overview of all 5 epics
- [Epic 1: Foundation & Validation](./prd/epic-1-foundation-validation.md) - Project setup, TUI spike, workflow engine
- [Epic 2: TUI Core with Performance](./prd/epic-2-tui-core-with-performance.md) - Checklist panel, detail panel, navigation
- [Epic 3: Templates & Security](./prd/epic-3-templates-security.md) - Template engine, variables, conditionals
- [Epic 4: Intelligence & Safety](./prd/epic-4-intelligence-safety.md) - Command differentiation, clipboard, shell integration
- [Epic 5: Production & Community](./prd/epic-5-production-community.md) - CLI automation, distribution, documentation

### Results & Next Steps

- [Checklist Results Report](./prd/checklist-results-report.md) - Placeholder for checklist execution results
- [Next Steps](./prd/next-steps.md) - UX Expert and Architect prompts

## Quick Reference

### Key Goals

- Enable developers to maintain workflow context across multiple BMAD projects
- Reduce context switch time from **15-30 minutes to under 2 minutes**
- Decrease workflow execution errors by **95%**
- Achieve **90% workflow completion accuracy** without external docs

### Core Requirements Summary

- **10 Functional Requirements (FR1-FR10)** covering initialization, state tracking, command differentiation
- **10 Non-Functional Requirements (NFR1-NFR10)** covering performance (<100ms), memory (<50MB), cross-platform support

### Epic Summary

1. **Foundation & Validation** - 6 stories including critical TUI spike
2. **TUI Core with Performance** - 6 stories for terminal UI implementation
3. **Templates & Security** - 7 stories for template engine and security
4. **Intelligence & Safety** - 7 stories for command handling and safety
5. **Production & Community** - 7 stories for distribution and documentation

## Change Log

| Date       | Version | Description                              | Author     |
| ---------- | ------- | ---------------------------------------- | ---------- |
| 2025-09-04 | 1.0     | Initial PRD creation                     | John (PM)  |
| 2025-09-04 | 1.1     | Sharded document into organized sections | Sarah (PO) |

## Navigation

- [← Back to Project Root](../README.md)
- [→ Architecture Document](../architecture.md)

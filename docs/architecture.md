# BMAD Checklist Manager Fullstack Architecture Document

This document has been sharded into multiple sections for better organization and maintainability. Each section is now in its own file within the `docs/architecture/` directory.

## 📚 Table of Contents

### Core Architecture

- [Introduction](./architecture/introduction.md) - Project overview and starter template information
- [High Level Architecture](./architecture/high-level-architecture.md) - Technical summary, platform choices, and architecture diagram
- [Tech Stack](./architecture/tech-stack-enhanced-with-all-tools.md) - Complete technology stack with all tools
- [Components](./architecture/components-complete-with-all-components.md) - All system components and initialization order

### Data & APIs

- [Data Models](./architecture/data-models-with-multi-script-support.md) - ChecklistTemplate, Step, and Command models
- [API Specification](./architecture/api-specification-complete-with-all-refinements.md) - Core, Workflow, Test, Plugin, and Recovery APIs
- [External APIs](./architecture/external-apis-updated-with-bun.md) - Bun package registry, environment detection, and GitHub APIs
- [Database Schema](./architecture/database-schema-complete-with-all-enhancements.md) - File structure and YAML schemas

### Implementation

- [Backend Architecture](./architecture/backend-architecture-complete-with-all-services.md) - Service architecture, concurrency, transactions, and DI
- [Development Workflow](./architecture/development-workflow-enhanced-with-all-improvements.md) - Dev container, commands, and CI/CD
- [Security and Performance](./architecture/security-and-performance-complete-implementation.md) - Sandbox, resource limits, crypto, and audit

### Quality & Standards

- [Testing Strategy](./architecture/testing-strategy-complete-with-all-testing-utilities.md) - Test factories, visual regression, and load testing
- [Coding Standards](./architecture/coding-standards-complete-with-all-standards.md) - **MANDATORY** ESLint, Prettier, and code patterns
- [Error Handling Strategy](./architecture/error-handling-strategy-complete-with-all-patterns.md) - Error correlation, circuit breakers, and recovery

### Operations & Future

- [Monitoring and Observability](./architecture/monitoring-and-observability.md) - Metrics, health checks, and monitoring stack
- [Internationalization (i18n)](./architecture/internationalization-i18n-considerations.md) - Post-MVP i18n strategy
- [Checklist Results Report](./architecture/checklist-results-report.md) - Architecture validation results
- [Next Steps](./architecture/next-steps.md) - Immediate actions and epic planning

## Quick Access to Key Files

### 🎯 Must-Read for Developers

1. **[Coding Standards](./architecture/coding-standards-complete-with-all-standards.md)** - MANDATORY rules for all code
2. **[Tech Stack](./architecture/tech-stack-enhanced-with-all-tools.md)** - Technologies and versions to use
3. **[Development Workflow](./architecture/development-workflow-enhanced-with-all-improvements.md)** - How to set up and run the project

### 🏗️ Architecture Deep Dives

1. **[High Level Architecture](./architecture/high-level-architecture.md)** - System overview with detailed diagram
2. **[API Specification](./architecture/api-specification-complete-with-all-refinements.md)** - All APIs and contracts
3. **[Backend Architecture](./architecture/backend-architecture-complete-with-all-services.md)** - Service implementations

### 📋 For Reference

- **[Database Schema](./architecture/database-schema-complete-with-all-enhancements.md)** - State file formats
- **[Error Handling](./architecture/error-handling-strategy-complete-with-all-patterns.md)** - Error recovery patterns
- **[Testing Strategy](./architecture/testing-strategy-complete-with-all-testing-utilities.md)** - Testing approaches

## Change Log

| Date       | Version | Description                                         | Author              |
| ---------- | ------- | --------------------------------------------------- | ------------------- |
| 2025-09-04 | 1.0     | Initial fullstack architecture document             | Winston (Architect) |
| 2025-09-04 | 1.1     | Added comprehensive refinements across all sections | Winston (Architect) |
| 2025-09-04 | 1.2     | Sharded document into organized sections            | Sarah (PO)          |

## Navigation

- [← Back to Project Root](../README.md)
- [→ PRD Document](../prd.md)
- [→ Architecture Sections Index](./architecture/index.md)

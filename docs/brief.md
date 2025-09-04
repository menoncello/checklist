# Project Brief: BMAD Checklist Manager

## Executive Summary

**Product Concept:** A terminal-based checklist management application designed specifically for the BMAD software development methodology, providing dynamic workflow tracking with persistent state management across multiple projects and stories.

**Primary Problem:** Developers using the BMAD methodology lose context when switching between multiple projects and stories, with critical workflow state information fragmented across files and chat histories, creating high friction for maintaining productive development flow.

**Target Market:** Software developers and AI-assisted development teams using the BMAD methodology for structured project development, particularly those managing multiple concurrent projects.

**Key Value Proposition:** Transform static, linear checklists into dynamic, branching workflows with persistent local state, enabling developers to maintain context and productivity across multiple BMAD projects without leaving their terminal environment.

## Problem Statement

### Current State and Pain Points

Developers implementing the BMAD (Build, Measure, Adjust, Deploy) methodology face significant workflow management challenges. The method involves multiple structured steps across different project phases, and practitioners frequently work on multiple projects simultaneously. Currently, developers track their progress through fragmented tools - using Claude Code chat history, scattered files, and manual note-taking to remember which step they're on and which story they're implementing.

### Impact of the Problem

This context fragmentation leads to:
- **15-30 minutes lost per context switch** when resuming work on a project
- **Increased error rates** from forgetting completed steps or repeating unnecessary work
- **Cognitive overhead** from manually tracking multiple project states
- **Reduced flow state** due to constant interruptions to find current status
- **Knowledge silos** when team members cannot easily understand project progress

### Why Existing Solutions Fall Short

Generic task management tools fail because they:
- Treat checklists as static, linear lists rather than dynamic workflows
- Lack conditional branching based on project decisions
- Cannot distinguish between Claude Code commands and terminal commands
- Don't integrate naturally with the developer's terminal workflow
- Fail to persist state locally with the project codebase

### Urgency and Importance

With the BMAD methodology gaining adoption and AI-assisted development becoming mainstream, the need for proper workflow tooling is critical. Early adopters are experiencing productivity losses that will only compound as more teams adopt structured AI-development methodologies.

## Proposed Solution

### Core Concept

A Terminal User Interface (TUI) application that lives alongside your code, storing workflow state in a `.checklist/` directory within each project. The tool transforms BMAD workflows from static documentation into interactive, stateful checklists with conditional branching, command templates, and intelligent context preservation.

### Key Differentiators

1. **Filesystem-Integrated State**: State lives with the code, versionable in Git
2. **Terminal-Native Experience**: Full TUI interface inspired by tools like lazygit
3. **Command Differentiation**: Clear distinction between Claude Code and Bash commands
4. **Workflow Branching**: Support for conditional paths based on project decisions
5. **Zero-Friction Context Recovery**: Open project = see current state immediately

### Why This Solution Will Succeed

- **Built for developers, by developers**: Terminal-first approach respects existing workflows
- **Minimal adoption friction**: Integrates into existing project structures
- **Portable and shareable**: State travels with code through Git
- **Progressive enhancement**: Start simple, add complexity as needed

### High-level Vision

Create the definitive workflow management tool for AI-assisted development, starting with BMAD support and expanding to become the standard for structured development methodologies.

## Target Users

### Primary User Segment: BMAD Practitioners

**Profile:**
- Software developers using AI assistants (Claude Code, GitHub Copilot)
- Working on 2-5 concurrent projects
- Comfortable with terminal/CLI tools
- Following structured development methodologies

**Current Behaviors:**
- Heavy terminal usage (80%+ of development time)
- Frequent context switching between projects
- Copy-pasting commands between documentation and terminal
- Using chat history as informal task tracking

**Specific Needs:**
- Clear visibility of current project state
- Quick context recovery when switching projects
- Reliable command templates with variable substitution
- Distinction between AI assistant and terminal commands

**Goals:**
- Maintain flow state during development
- Reduce errors from missed or repeated steps
- Share project progress with team members
- Standardize workflows across projects

### Secondary User Segment: Development Teams

**Profile:**
- Small to medium development teams (2-10 developers)
- Teams adopting AI-assisted development practices
- Organizations seeking to standardize development workflows

**Needs:**
- Shared understanding of project progress
- Consistent methodology application
- Onboarding new team members efficiently
- Tracking methodology compliance

## Goals & Success Metrics

### Business Objectives
- Achieve 1,000 active users within 6 months of launch
- Reduce average context switch time from 15-30 minutes to under 2 minutes
- Enable 90% of users to complete BMAD workflows without external documentation
- Establish as the de facto tool for BMAD methodology with 50% adoption rate

### User Success Metrics
- Time to recover context after project switch: < 30 seconds
- Workflow completion accuracy: > 95%
- Command execution errors: < 5% reduction
- User-reported productivity improvement: > 30%

### Key Performance Indicators (KPIs)
- **Daily Active Users (DAU)**: Target 70% of installed base using daily
- **Workflow Completion Rate**: 85% of started workflows reach completion
- **Context Switch Time**: Average time from opening project to resuming work < 2 minutes
- **Template Reuse Rate**: Each template used average 5+ times
- **User Retention**: 80% monthly retention after 3 months

## MVP Scope

### Core Features (Must Have)

- **Local State Management:** `.checklist/` directory with YAML/JSON state files tracking current position, completed steps, and project variables
- **CLI Commands:** Basic command set including `checklist init [template]`, `checklist status`, `checklist next`, `checklist done`
- **Template Support:** YAML-based templates with linear workflow steps, command definitions, and basic variable substitution
- **Command Differentiation:** Visual and functional distinction between Claude Code and Bash commands with appropriate copy mechanisms
- **Status Visualization:** Clear display of current step, completed steps, and remaining workflow items
- **Project Context:** Automatic loading of state when entering project directory

### Out of Scope for MVP
- TUI interface (will be CLI only initially)
- Conditional branching in workflows
- Multi-user collaboration features
- Cloud synchronization
- Analytics and reporting
- Integration with Claude Code API
- Workflow editor UI
- Mobile/web interfaces

### MVP Success Criteria

The MVP will be considered successful when a developer can:
1. Initialize a new BMAD project with a template
2. Navigate through workflow steps sequentially
3. Copy commands to appropriate destinations (Claude/terminal)
4. Resume work after closing terminal with full context preserved
5. Complete a full BMAD workflow without referring to external documentation

## Post-MVP Vision

### Phase 2 Features

**TUI Implementation (Months 2-3):**
- Full-screen terminal interface with keyboard navigation
- Split-pane view: checklist on left, details on right
- Vim-like keybindings and command palette
- Real-time status updates and progress indicators

**Workflow Intelligence (Months 3-4):**
- Conditional branching based on user responses
- Workflow validation and prerequisite checking
- Smart command suggestions based on context
- Automatic detection of step completion

### Long-term Vision (Year 1-2)

Transform from a BMAD-specific tool into the standard platform for AI-assisted development workflows:
- Support for multiple methodologies beyond BMAD
- Marketplace for community-contributed templates
- Integration with popular development tools (VS Code, Git, CI/CD)
- Team collaboration features with real-time sync
- Analytics dashboard for productivity metrics
- AI-powered workflow optimization suggestions

### Expansion Opportunities

- **Enterprise Edition**: Team management, compliance tracking, custom workflows
- **Educational Platform**: Tutorial mode, best practices enforcement, skill tracking
- **Methodology Ecosystem**: Partner with methodology creators for official templates
- **IDE Extensions**: Native integrations with VS Code, IntelliJ, Vim/Neovim
- **CI/CD Integration**: Automated workflow verification in pipelines

## Technical Considerations

### Platform Requirements
- **Target Platforms:** macOS, Linux, Windows (via WSL)
- **Browser/OS Support:** Terminal emulators with 256-color support, UTF-8 encoding
- **Performance Requirements:** Instant command response (< 100ms), minimal memory footprint (< 50MB)

### Technology Preferences
- **Frontend:** Go with Bubble Tea framework for TUI, or Rust with Ratatui
- **Backend:** Local filesystem operations, no server component for MVP
- **Database:** YAML/JSON files in `.checklist/` directory
- **Hosting/Infrastructure:** Distributed via Homebrew, apt, npm, or cargo

### Architecture Considerations
- **Repository Structure:** Monorepo with clear separation between CLI and future TUI
- **Service Architecture:** Single binary distribution, no external dependencies
- **Integration Requirements:** Clipboard access, terminal control, filesystem watching
- **Security/Compliance:** No data leaves local machine, respect .gitignore patterns

## Constraints & Assumptions

### Constraints
- **Budget:** Bootstrap/open-source development model initially
- **Timeline:** MVP in 4-6 weeks with single developer
- **Resources:** Part-time development alongside other projects
- **Technical:** Must work in restricted terminal environments

### Key Assumptions
- BMAD methodology will continue growing in adoption
- Developers prefer terminal-based tools for development workflows
- Local state management is acceptable (vs. cloud sync)
- Users will contribute templates to community repository
- Git integration provides sufficient "sync" capability

## Risks & Open Questions

### Key Risks
- **Adoption Risk:** Developers may resist adding another tool to their workflow - Mitigation: Ensure zero-friction integration
- **Methodology Evolution:** BMAD may change significantly - Mitigation: Flexible template system
- **Competition:** Larger players may enter space - Mitigation: First-mover advantage and community building
- **Complexity Creep:** Feature requests may bloat the tool - Mitigation: Strong focus on core use case

### Open Questions
- Should the tool support multiple concurrent stories within a single project?
- How to handle partially completed workflows when requirements change?
- What's the best way to share templates while maintaining security?
- Should there be a "strict mode" that prevents skipping steps?
- How to integrate with existing BMAD tooling ecosystem?

### Areas Needing Further Research
- Optimal TUI framework for cross-platform compatibility
- Best practices for YAML schema versioning
- Integration possibilities with Claude Code API
- User preferences for keyboard shortcuts and navigation
- Market size for AI-assisted development methodology tools

## Appendices

### A. Research Summary

**Brainstorming Session Findings:**
- Users lose 15-30 minutes per context switch
- Pain point centers on fragmented information across files and chat history
- Strong preference for terminal-native solution
- Need for clear command differentiation (Claude vs Bash)
- Lazygit identified as ideal UX reference

**Market Observations:**
- No existing tools address dynamic, branching checklists
- Generic task managers too simplistic for developer workflows
- Growing demand for AI-development methodology support

### B. Stakeholder Input

Based on brainstorming session with primary user:
- "The ideal would be to replicate workflows (mermaid) to process lists, with command copying"
- "Important to see checklist side-by-side with terminal"
- "Should have user-specific workflow library with defined templates"
- "Distinction between Claude Code and Bash commands is critical"

### C. References

- BMAD Methodology Documentation: [Internal docs]
- Lazygit Project: https://github.com/jesseduffield/lazygit
- Bubble Tea TUI Framework: https://github.com/charmbracelet/bubbletea
- Ratatui Framework: https://github.com/ratatui-org/ratatui

## Next Steps

### Immediate Actions
1. Validate technical approach with proof-of-concept CLI
2. Create initial BMAD workflow template in YAML format
3. Implement basic state management in `.checklist/` directory
4. Test with real BMAD project to identify gaps
5. Gather feedback from 5-10 BMAD practitioners
6. Refine template format based on user testing
7. Plan TUI architecture and framework selection

### PM Handoff

This Project Brief provides the full context for BMAD Checklist Manager. Please start in 'PRD Generation Mode', review the brief thoroughly to work with the user to create the PRD section by section as the template indicates, asking for any necessary clarification or suggesting improvements.
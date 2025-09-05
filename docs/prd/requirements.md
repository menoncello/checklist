# Requirements

## Functional Requirements

**FR1:** The system shall initialize a new checklist project with `checklist init [template]` command, creating a `.checklist/` directory with state files

**FR2:** The system shall track workflow progress in YAML/JSON state files, persisting current step, completed steps, and project variables locally

**FR3:** The system shall display current workflow status with `checklist status`, showing current step, progress percentage, and remaining items

**FR4:** The system shall advance to the next workflow step with `checklist next` command, updating state and displaying new step details

**FR5:** The system shall mark current step as complete with `checklist done` command and automatically advance to next step

**FR6:** The system shall visually differentiate between Claude Code commands and Bash commands using distinct markers or colors

**FR7:** The system shall support variable substitution in command templates using project-specific values stored in state

**FR8:** The system shall automatically load project state when entering a directory containing `.checklist/` configuration

**FR9:** The system shall provide copy-to-clipboard functionality with appropriate destination indication (Claude vs terminal)

**FR10:** The system shall support YAML-based workflow templates with step definitions, descriptions, and command specifications

## Non-Functional Requirements

**NFR1:** The system shall respond to all commands in less than 100ms to maintain developer flow state

**NFR2:** The system shall consume less than 50MB of memory during normal operation

**NFR3:** The system shall work on macOS, Linux, and Windows (via WSL) terminal environments

**NFR4:** The system shall operate entirely offline with no network dependencies for core functionality

**NFR5:** The system shall respect `.gitignore` patterns and never expose sensitive information in state files

**NFR6:** The system shall maintain backward compatibility with state files across minor version updates

**NFR7:** The system shall provide clear error messages with actionable recovery steps when operations fail

**NFR8:** The system shall support UTF-8 encoding and work in terminal emulators with 256-color support

**NFR9:** The system shall handle state file corruption gracefully with automatic backup and recovery options

**NFR10:** The system shall distribute as a single binary with no external runtime dependencies

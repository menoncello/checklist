# User Interface Design Goals

## Overall UX Vision

The BMAD Checklist Manager embraces a **terminal-first philosophy** that treats context preservation as sacred. When switching between projects, the tool instantly restores your exact position in the workflow, including command history, variable state, and decision branches taken. The interface acts as an **intelligent co-pilot** rather than a task master—suggesting next steps, validating completions, and preventing common BMAD methodology errors. Every interaction is optimized for keyboard efficiency with zero mouse requirement, supporting both quick command execution and deep workflow exploration without breaking developer flow.

## Key Interaction Paradigms

• **Command-driven flow** with intuitive verbs (`init`, `next`, `done`, `status`, `back`, `skip`) that mirror natural workflow progression
• **Contextual awareness** through automatic state loading when entering project directories—zero manual project switching  
• **Smart command routing** with clear visual indicators: `[Claude]` for AI commands, `[$]` for terminal commands
• **Undo-friendly operations** allowing `checklist back` to reverse steps and `checklist reset` for complete restart
• **Selective disclosure** with `--verbose` flag for detailed output and `--quiet` for minimal distraction
• **Safe copy mechanisms** preventing accidental execution of Claude commands in terminal and vice versa

## Core CLI Outputs

• **Status Output** - Shows: current step (1/15), completion percentage, current command, time on step
• **List View** - Full workflow with checkmarks for completed, arrow for current, dimmed for upcoming
• **Detail Output** - Current step with full description, any warnings, command with variables resolved
• **Project Summary** - All active projects with their current states when run from parent directory
• **History View** - Recently completed steps with timestamps and any notes captured
• **Diff View** - What changed in workflow template vs current state (for template updates)
• **Help Output** - Context-sensitive help showing only relevant commands for current state

## Accessibility: Clean Terminal Output

Clean terminal output compatible with screen readers, `--no-color` mode for monochrome displays or pipes, `--ascii` mode for environments without UTF-8 support. All status information available via exit codes for scripting integration.

## Branding

Friendly but professional tone using developer-familiar language. Celebratory messages for milestone completions ("🎉 Epic completed!"). Empathetic error messages ("Oops, that step needs to be completed first. Run `checklist status` to see requirements."). Optional fun mode with ASCII art progress bars and achievement unlocks.

## Target Device and Platforms: Terminal-Native Cross-Platform

Runs in any POSIX-compliant shell (bash, zsh, fish) on macOS, Linux, Windows (Git Bash, WSL, PowerShell 7+). Requires terminal with minimum 80-character width, supports 256 colors (graceful degradation to 16 or monochrome), UTF-8 encoding preferred (ASCII fallback available).

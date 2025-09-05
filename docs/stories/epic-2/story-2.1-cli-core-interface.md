# Story 2.1: CLI Core Interface

## Overview

Implement the base CLI command structure and argument parsing system that will serve as the foundation for all user interactions with the checklist manager.

## Story Details

- **Epic**: 2 - User Interface & Interaction
- **Type**: Feature
- **Priority**: Critical
- **Estimated Effort**: 2 days
- **Dependencies**: [1.1, 1.3, 1.4]

## Description

Build the core command-line interface that handles all primary commands and global options. This story establishes the fundamental interaction pattern that users will experience, whether using CLI-only mode or the full TUI.

## Acceptance Criteria

- [ ] Parse and execute main commands:
  - `checklist init` - Initialize new checklist project
  - `checklist run [template]` - Run a checklist workflow
  - `checklist add [template]` - Add template to project
  - `checklist status` - Show current state/progress
  - `checklist reset` - Reset checklist state
  - `checklist list` - List available templates
- [ ] Handle global flags correctly:
  - `--help, -h` - Show contextual help
  - `--version, -v` - Display version info
  - `--config, -c` - Specify config file
  - `--verbose` - Enable verbose output
  - `--no-color` - Disable colored output
- [ ] Validate all arguments and provide helpful error messages
- [ ] Support both interactive and non-interactive modes
- [ ] Exit codes follow Unix conventions (0=success, 1-255=various errors)
- [ ] Support command aliases for common operations

## Technical Requirements

### Architecture

```typescript
interface CLICommand {
  name: string;
  aliases?: string[];
  description: string;
  options: CommandOption[];
  action: (options: ParsedOptions) => Promise<void>;
}

interface CommandOption {
  flag: string;
  description: string;
  required?: boolean;
  default?: any;
  validator?: (value: any) => boolean;
}
```

### Implementation Notes

- Use Bun's built-in arg parser or lightweight alternative (not heavy frameworks)
- Keep bundle size minimal (<1MB for CLI module)
- Implement command registry pattern for extensibility
- All commands should be async-first
- Use exit codes consistently:
  - 0: Success
  - 1: General error
  - 2: Misuse of shell command
  - 126: Command cannot execute
  - 127: Command not found

### Error Handling

- Catch all errors at top level
- Display user-friendly messages
- Include `--debug` flag for stack traces
- Suggest corrections for typos (did you mean...?)

## Testing Requirements

- [ ] Unit tests for argument parsing
- [ ] Integration tests for each command
- [ ] Test error scenarios and messages
- [ ] Verify exit codes
- [ ] Test command aliases
- [ ] Validate help text generation

## Definition of Done

- [ ] All commands implemented and working
- [ ] Help text is clear and comprehensive
- [ ] Error messages are helpful
- [ ] Tests passing with >90% coverage
- [ ] Documentation updated
- [ ] Performance: Command parsing <10ms

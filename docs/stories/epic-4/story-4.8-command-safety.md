# Story 4.7: Command Safety System

## Story

**As a** user executing commands from checklists,  
**I want** clear differentiation between command types and safety validation,  
**so that** I don't accidentally execute dangerous or incorrect commands.

## Priority

**HIGH** - Critical for user safety and trust

## Acceptance Criteria

### Command Differentiation

1. ✅ Claude commands clearly marked with `[Claude]` prefix
2. ✅ Bash commands marked with `[$]` prefix
3. ✅ Visual distinction through colors/icons
4. ✅ Copy mechanism prevents wrong destination
5. ✅ Warning for ambiguous commands

### Safety Validation

1. ✅ Dangerous commands require confirmation
2. ✅ Destructive operations highlighted
3. ✅ Dry-run mode for testing
4. ✅ Command preview before execution
5. ✅ Rollback information provided

### Command Categories

1. ✅ Safe commands execute immediately
2. ✅ Caution commands show warning
3. ✅ Dangerous commands require confirmation
4. ✅ Forbidden commands blocked entirely
5. ✅ Custom safety rules configurable

### Clipboard Integration

1. ✅ Smart clipboard routing based on command type
2. ✅ Fallback for unsupported clipboard access
3. ✅ Visual confirmation of copy success
4. ✅ Multi-line command support
5. ✅ Variable substitution before copy

## Technical Implementation

### Command Safety Classifier

```typescript
export class CommandSafetyValidator {
  private dangerousPatterns = [
    /rm\s+-rf/,
    /dd\s+if=/,
    /format\s+/,
    /:(){ :|:& };:/, // Fork bomb
    /> \/dev\/sda/,
    /chmod\s+777\s+\//,
    /chown\s+-R/,
  ];

  private cautionPatterns = [
    /sudo/,
    /rm\s+/,
    /mv\s+/,
    /cp\s+-r/,
    /git\s+push\s+--force/,
    /npm\s+publish/,
    /docker\s+rm/,
  ];

  /**
   * Classify command safety level
   */
  classifyCommand(command: string): SafetyLevel {
    // Check for forbidden patterns
    if (this.isForbidden(command)) {
      return SafetyLevel.FORBIDDEN;
    }

    // Check for dangerous patterns
    if (this.dangerousPatterns.some((p) => p.test(command))) {
      return SafetyLevel.DANGEROUS;
    }

    // Check for caution patterns
    if (this.cautionPatterns.some((p) => p.test(command))) {
      return SafetyLevel.CAUTION;
    }

    return SafetyLevel.SAFE;
  }

  /**
   * Validate command before execution
   */
  async validateCommand(command: string): Promise<ValidationResult> {
    const level = this.classifyCommand(command);

    return {
      level,
      safe: level === SafetyLevel.SAFE,
      requiresConfirmation: level >= SafetyLevel.CAUTION,
      message: this.getSafetyMessage(level, command),
      suggestions: this.getSafetySuggestions(command),
    };
  }

  /**
   * Get safety message for user
   */
  private getSafetyMessage(level: SafetyLevel, command: string): string {
    switch (level) {
      case SafetyLevel.FORBIDDEN:
        return `⛔ This command is potentially destructive and has been blocked`;
      case SafetyLevel.DANGEROUS:
        return `🔴 WARNING: This command could cause data loss or system damage`;
      case SafetyLevel.CAUTION:
        return `🟡 CAUTION: This command makes system changes`;
      case SafetyLevel.SAFE:
        return `✅ This command is safe to execute`;
    }
  }
}
```

### Command Type Detection

```typescript
export class CommandTypeDetector {
  /**
   * Detect command type from content
   */
  detectType(command: string): CommandType {
    // Claude command patterns
    if (this.isClaudeCommand(command)) {
      return CommandType.CLAUDE;
    }

    // Shell command patterns
    if (this.isShellCommand(command)) {
      return CommandType.SHELL;
    }

    // Code snippet patterns
    if (this.isCodeSnippet(command)) {
      return CommandType.CODE;
    }

    return CommandType.UNKNOWN;
  }

  private isClaudeCommand(command: string): boolean {
    const claudePatterns = [
      /^\/[a-z]+/, // Slash commands
      /@Claude/i, // Direct mentions
      /\[Claude\]/, // Explicit markup
      /^(explain|analyze|review|generate)/i,
    ];

    return claudePatterns.some((p) => p.test(command));
  }

  private isShellCommand(command: string): boolean {
    const shellPatterns = [
      /^\$/, // Shell prompt
      /^[a-z]+\s+/, // Unix commands
      /\|/, // Pipes
      /&&|\|\|/, // Shell operators
      />|<|>>/, // Redirections
    ];

    return shellPatterns.some((p) => p.test(command));
  }
}
```

### Interactive Safety Prompt

```typescript
export class SafetyPrompt {
  /**
   * Show confirmation dialog for dangerous commands
   */
  async confirmExecution(command: string, level: SafetyLevel): Promise<boolean> {
    const ui = new ConfirmationUI();

    ui.showWarning(level);
    ui.showCommand(command);
    ui.showConsequences(this.analyzeConsequences(command));

    const response = await ui.prompt({
      message: 'Do you want to proceed?',
      choices: [
        { key: 'y', label: 'Yes, execute', value: true },
        { key: 'n', label: 'No, cancel', value: false },
        { key: 'd', label: 'Dry run first', value: 'dry-run' },
      ],
      default: 'n',
    });

    if (response === 'dry-run') {
      await this.performDryRun(command);
      return this.confirmExecution(command, level);
    }

    return response === true;
  }

  /**
   * Perform dry run of command
   */
  private async performDryRun(command: string): Promise<void> {
    console.log(chalk.blue('🧪 Dry Run Mode'));
    console.log(chalk.gray('The following would be executed:'));
    console.log(chalk.white(command));

    // Simulate execution
    const simulation = await this.simulateCommand(command);
    console.log(chalk.gray('\nExpected changes:'));
    console.log(simulation);
  }
}
```

### Clipboard Router

```typescript
export class ClipboardRouter {
  /**
   * Route command to appropriate clipboard
   */
  async copyCommand(command: string, type: CommandType): Promise<void> {
    const processedCommand = this.processCommand(command, type);

    try {
      await this.copyToClipboard(processedCommand);
      this.showSuccessFeedback(type);
    } catch (error) {
      this.showFallback(processedCommand, type);
    }
  }

  private processCommand(command: string, type: CommandType): string {
    // Remove prefixes and markers
    let processed = command
      .replace(/^\[Claude\]\s*/, '')
      .replace(/^\$\s*/, '')
      .trim();

    // Handle multi-line commands
    if (type === CommandType.SHELL && processed.includes('\n')) {
      processed = this.wrapMultilineCommand(processed);
    }

    return processed;
  }

  private showSuccessFeedback(type: CommandType): void {
    const destination = type === CommandType.CLAUDE ? 'Claude' : 'Terminal';
    console.log(chalk.green(`✅ Copied to clipboard for ${destination}`));
  }
}
```

## Development Tasks

- [ ] Implement command safety validator
- [ ] Create command type detector
- [ ] Build confirmation UI system
- [ ] Implement dry-run capability
- [ ] Create clipboard router
- [ ] Add safety configuration options
- [ ] Write safety rule documentation
- [ ] Test dangerous command detection
- [ ] Implement safety override mechanism
- [ ] Add telemetry for safety events

## Definition of Done

- [ ] All dangerous commands detected correctly
- [ ] Confirmation prompts working
- [ ] Dry-run mode functional
- [ ] Command types correctly identified
- [ ] Clipboard routing working
- [ ] Safety rules configurable
- [ ] No false positives in safety detection
- [ ] Documentation includes safety guidelines

## Time Estimate

**12-16 hours** for complete safety system

## Dependencies

- Stories 1-3.x complete (core functionality)
- Integrates with Story 4.6 (telemetry for safety events)

## Notes

- Balance safety with usability
- Allow power users to customize rules
- Consider adding learning mode
- Track blocked commands for improvement
- Provide clear explanations for blocks

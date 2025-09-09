# Story 4.9: User Help & Tutorial System

## Story

**As a** new user of the checklist manager,  
**I want** comprehensive help documentation and interactive tutorials,  
**so that** I can quickly learn to use the tool effectively.

## Priority

**HIGH** - Critical for user adoption and self-service support

## Acceptance Criteria

### Built-in Help System

1. ✅ `checklist help` displays all available commands
2. ✅ `checklist help [command]` shows detailed command help
3. ✅ `--help` flag works on all commands
4. ✅ Man pages generated for Unix systems
5. ✅ Context-sensitive help in TUI mode

### Interactive Tutorial

1. ✅ `checklist tutorial` launches interactive learning mode
2. ✅ Step-by-step walkthrough of basic features
3. ✅ Hands-on practice with sample checklist
4. ✅ Progress tracking through tutorial sections
5. ✅ Tutorial can be resumed if interrupted

### User Documentation

1. ✅ Getting Started guide created
2. ✅ User manual with all features documented
3. ✅ FAQ section addressing common issues
4. ✅ Troubleshooting guide with solutions
5. ✅ Video tutorials for visual learners

### In-App Guidance

1. ✅ First-run experience with onboarding
2. ✅ Tooltips for complex features
3. ✅ Error messages include helpful suggestions
4. ✅ Examples shown for all commands
5. ✅ Quick reference card available

## Technical Implementation

### Help System Architecture

```typescript
// Help system structure
interface HelpSystem {
  commands: Map<string, CommandHelp>;
  tutorials: Tutorial[];
  examples: Example[];
  troubleshooting: Issue[];
}

interface CommandHelp {
  name: string;
  summary: string;
  description: string;
  usage: string[];
  options: Option[];
  examples: Example[];
  seeAlso: string[];
}

class HelpManager {
  /**
   * Display help for a specific command or topic
   */
  async showHelp(topic?: string): Promise<void> {
    if (!topic) {
      this.showGeneralHelp();
      return;
    }

    const command = this.commands.get(topic);
    if (command) {
      this.showCommandHelp(command);
    } else {
      this.suggestSimilarTopics(topic);
    }
  }

  /**
   * Interactive tutorial system
   */
  async runTutorial(section?: string): Promise<void> {
    const tutorial = new InteractiveTutorial({
      checkpointFile: '.checklist/.tutorial-progress',
      sections: [
        'introduction',
        'basic-commands',
        'managing-state',
        'using-templates',
        'advanced-features',
      ],
    });

    await tutorial.start(section);
  }
}
```

### Tutorial Implementation

```typescript
class InteractiveTutorial {
  private sections = [
    {
      id: 'introduction',
      title: 'Welcome to BMAD Checklist Manager',
      steps: [
        {
          instruction: "Let's start by initializing a new checklist",
          command: 'checklist init',
          validation: () => fs.existsSync('.checklist/'),
          hint: 'Type "checklist init" and press Enter',
        },
        {
          instruction: "Now let's check the status",
          command: 'checklist status',
          validation: (output) => output.includes('Current step:'),
          hint: 'The status command shows your current progress',
        },
      ],
    },
    {
      id: 'basic-commands',
      title: 'Essential Commands',
      steps: [
        {
          instruction: 'View your current checklist item',
          command: 'checklist current',
          validation: (output) => output.length > 0,
        },
        {
          instruction: 'Mark the current item as complete',
          command: 'checklist done',
          validation: (state) => state.currentStep > 0,
        },
        {
          instruction: 'Go back to the previous item',
          command: 'checklist back',
          validation: (state) => state.canGoBack,
        },
      ],
    },
  ];

  async runSection(sectionId: string): Promise<void> {
    const section = this.sections.find((s) => s.id === sectionId);

    console.log(chalk.blue(`\n=== ${section.title} ===\n`));

    for (const step of section.steps) {
      await this.runStep(step);
    }

    this.saveProgress(sectionId);
  }
}
```

### Documentation Structure

```
docs/user/
├── README.md                    # Documentation overview
├── getting-started/
│   ├── installation.md         # Installation guide
│   ├── quick-start.md          # 5-minute quickstart
│   ├── first-checklist.md      # Creating first checklist
│   └── basic-workflow.md       # Basic workflow tutorial
├── guides/
│   ├── commands.md             # All commands reference
│   ├── templates.md            # Using templates
│   ├── variables.md            # Variable substitution
│   ├── state-management.md     # Managing state
│   └── team-workflows.md       # Team collaboration
├── tutorials/
│   ├── beginner.md             # Beginner tutorial
│   ├── intermediate.md         # Intermediate concepts
│   ├── advanced.md             # Advanced features
│   └── video-links.md          # Video tutorial links
├── reference/
│   ├── cli-reference.md        # CLI command reference
│   ├── tui-reference.md        # TUI keyboard shortcuts
│   ├── config-options.md       # Configuration reference
│   └── template-syntax.md      # Template syntax guide
├── troubleshooting/
│   ├── common-issues.md        # Common problems
│   ├── error-messages.md       # Error message guide
│   ├── recovery.md             # State recovery
│   └── performance.md          # Performance tuning
└── faq.md                      # Frequently asked questions
```

### In-App Help Messages

```typescript
// Contextual help messages
const helpMessages = {
  'first-run': `
Welcome to BMAD Checklist Manager! 🎉

Quick Start:
1. Run 'checklist init' to create a new checklist
2. Use 'checklist next' to advance through items  
3. Mark items complete with 'checklist done'

Need help? Try:
- 'checklist tutorial' for interactive learning
- 'checklist help' for command reference
- 'checklist help [command]' for specific help
`,

  'error-template-not-found': `
Template file not found. 

Solutions:
1. Check the template path is correct
2. Use 'checklist templates' to list available templates
3. Create a new template with 'checklist template create'

Example:
  checklist init --template bmad-default
  checklist init ./my-template.yaml

See 'checklist help templates' for more information.
`,

  'error-state-corrupted': `
Workflow state appears corrupted.

Recovery options:
1. Restore from backup: 'checklist restore'
2. Reset to last checkpoint: 'checklist reset --checkpoint'
3. Start fresh: 'checklist reset --hard'

Your work is backed up in .checklist/backups/

See 'checklist help recovery' for details.
`,
};
```

### Man Page Generation

```bash
# Generate man pages from help content
checklist generate-man > checklist.1
man ./checklist.1
```

## Development Tasks

- [ ] Implement help command system
- [ ] Create interactive tutorial framework
- [ ] Write getting started guide
- [ ] Create command reference documentation
- [ ] Build troubleshooting guide
- [ ] Implement first-run experience
- [ ] Add contextual error help
- [ ] Generate man pages
- [ ] Create video tutorial scripts
- [ ] Set up documentation site

## Definition of Done

- [ ] All commands have help documentation
- [ ] Interactive tutorial covers basic workflow
- [ ] Getting started guide under 5 minutes
- [ ] Error messages include helpful context
- [ ] Man pages generated and installable
- [ ] Documentation site published
- [ ] Tutorial completion rate >80%

## Time Estimate

**16-20 hours** for complete help and tutorial system

## Dependencies

- Stories 4.1-4.7 complete (commands to document)
- Integrates with Story 4.8 (API documentation)

## Notes

- Keep help text concise and actionable
- Use progressive disclosure for complex topics
- Include real-world examples
- Test with new users for clarity
- Consider i18n for help text in future
- Monitor help command usage for improvements

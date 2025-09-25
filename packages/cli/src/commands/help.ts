/**
 * Help Command
 * Display help information for commands
 */

import type { CommandRegistry } from '../registry';
import type { CommandOption, ParsedOptions } from '../types';
import { BaseCommand } from './base';

export class HelpCommand extends BaseCommand {
  name = 'help';
  description = 'Display help information';
  aliases = ['h'];
  options: CommandOption[] = [];

  constructor(private registry: CommandRegistry) {
    super();
  }

  async action(options: ParsedOptions): Promise<void> {
    const commandName = options._[0];

    if (commandName) {
      // Show help for specific command
      const command = this.registry.get(commandName);
      if (command?.generateHelp) {
        console.log(command.generateHelp());
      } else {
        console.log(`Unknown command: ${commandName}`);
        const suggestions = this.registry.getSuggestions(commandName);
        if (suggestions.length > 0) {
          console.log(`Did you mean: ${suggestions.join(', ')}?`);
        }
      }
    } else {
      // Show general help
      this.showGeneralHelp();
    }
  }

  private showGeneralHelp(): void {
    this.printHeader();
    this.printCommands();
    this.printGlobalOptions();
    this.printExamples();
    this.printFooter();
  }

  private printHeader(): void {
    console.log(`
Checklist CLI - Manage your checklists and workflows

Usage: checklist [command] [options]

Commands:`);
  }

  private printCommands(): void {
    const commands = this.registry.getAllCommands();

    for (const command of commands) {
      if (command.name === 'help') continue;

      const aliases =
        command.aliases && command.aliases.length > 0
          ? ` (${command.aliases.join(', ')})`
          : '';
      console.log(
        `  ${command.name.padEnd(12)} ${command.description}${aliases}`
      );
    }
  }

  private printGlobalOptions(): void {
    console.log(`
Global Options:
  --help, -h       Show contextual help
  --version, -v    Display version info
  --config, -c     Specify config file
  --verbose        Enable verbose output
  --no-color       Disable colored output`);
  }

  private printExamples(): void {
    console.log(`
Examples:
  checklist init                    Initialize new project
  checklist run development         Run development workflow
  checklist add deployment          Add deployment template
  checklist status --verbose       Show detailed status
  checklist reset --force          Force reset state
  checklist list --filter dev      List templates matching 'dev'`);
  }

  private printFooter(): void {
    console.log(`
For help on a specific command:
  checklist help <command>
`);
  }
}

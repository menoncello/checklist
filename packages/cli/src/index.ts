#!/usr/bin/env bun

/**
 * CLI Core Interface - Main Entry Point
 * Implements Story 2.1: CLI Core Interface with argument parsing,
 * command registry, and Unix-standard error handling
 */

export const version = '0.0.1';

// Import all commands
import { AddCommand } from './commands/add';
import { HelpCommand } from './commands/help';
import { InitCommand } from './commands/init';
import { ListCommand } from './commands/list';
import { MigrateCommand } from './commands/migrate';
import { PerformanceCommand } from './commands/performance';
import { ResetCommand } from './commands/reset';
import { RunCommand } from './commands/run';
import { StatusCommand } from './commands/status';
import { ErrorHandler, CommandNotFoundError } from './errors';
import { CommandParser } from './parser';
import { CommandRegistry } from './registry';
import { ExitCode, type ParsedArgs } from './types';

class CLIApplication {
  private registry = new CommandRegistry();

  constructor() {
    this.registerCommands();
  }

  private registerCommands(): void {
    // Register all commands
    this.registry.register(new InitCommand());
    this.registry.register(new RunCommand());
    this.registry.register(new AddCommand());
    this.registry.register(new StatusCommand());
    this.registry.register(new ResetCommand());
    this.registry.register(new ListCommand());
    this.registry.register(new MigrateCommand());
    this.registry.register(new PerformanceCommand());

    // Help command needs registry reference
    this.registry.register(new HelpCommand(this.registry));
  }

  async run(): Promise<void> {
    try {
      // Parse arguments using Bun.argv for performance
      const parsedArgs = CommandParser.parse();

      // Validate input for security
      CommandParser.validateInput(parsedArgs);

      // Handle global flags first
      if (this.handleGlobalFlags(parsedArgs)) {
        return;
      }

      // Find and execute command
      const command = this.registry.get(parsedArgs.command);
      if (!command) {
        const suggestions = this.registry.getSuggestions(parsedArgs.command);
        throw new CommandNotFoundError(parsedArgs.command, suggestions);
      }

      // Execute the command
      await command.action(parsedArgs.options);

      // Exit successfully after command execution
      process.exit(ExitCode.SUCCESS);
    } catch (error) {
      const debug = this.hasDebugFlag();
      ErrorHandler.handle(error, debug);
    }
  }

  private handleGlobalFlags(parsedArgs: ParsedArgs): boolean {
    const { options, command } = parsedArgs;

    // Version flag (can be command or option)
    if (
      Boolean(options.version) ||
      Boolean(options.v) ||
      command === '--version' ||
      command === '-v'
    ) {
      console.log('checklist version 0.0.1');
      process.exit(ExitCode.SUCCESS);
    }

    // Help flag (can be command or option)
    if (
      Boolean(options.help) ||
      Boolean(options.h) ||
      command === '--help' ||
      command === '-h'
    ) {
      const helpCommand = new HelpCommand(this.registry);
      void helpCommand.action({ _: [] });
      process.exit(ExitCode.SUCCESS);
    }

    return false;
  }

  private hasDebugFlag(): boolean {
    return Bun.argv.includes('--debug');
  }
}

// Main execution
async function main(): Promise<void> {
  // Handle uncaught exceptions gracefully
  process.on('uncaughtException', (error) => {
    ErrorHandler.handle(error, Bun.argv.includes('--debug'));
  });

  process.on('unhandledRejection', (reason) => {
    ErrorHandler.handle(reason, Bun.argv.includes('--debug'));
  });

  const app = new CLIApplication();
  await app.run();
}

// Execute main function
void main().catch((error) => {
  ErrorHandler.handle(error, Bun.argv.includes('--debug'));
});

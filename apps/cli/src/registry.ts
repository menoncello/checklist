/**
 * Command Registry
 * Manages registration and lookup of CLI commands and their aliases
 */

import type { CLICommand } from './types';

export class CommandRegistry {
  private commands = new Map<string, CLICommand>();
  private aliases = new Map<string, string>();

  /**
   * Register a command and its aliases
   */
  register(command: CLICommand): void {
    this.commands.set(command.name, command);

    // Register aliases
    if (command.aliases && command.aliases.length > 0) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.name);
      }
    }
  }

  /**
   * Get command by name or alias
   */
  get(nameOrAlias: string): CLICommand | undefined {
    // Check direct command name first
    let command = this.commands.get(nameOrAlias);

    if (!command) {
      // Check aliases
      const commandName = this.aliases.get(nameOrAlias);
      if (commandName !== undefined) {
        command = this.commands.get(commandName);
      }
    }

    return command;
  }

  /**
   * Check if command exists
   */
  has(nameOrAlias: string): boolean {
    return this.commands.has(nameOrAlias) || this.aliases.has(nameOrAlias);
  }

  /**
   * Get all registered commands
   */
  getAllCommands(): CLICommand[] {
    return Array.from(this.commands.values());
  }

  /**
   * Get command suggestions for typos using Levenshtein distance
   */
  getSuggestions(input: string): string[] {
    const allNames = [...this.commands.keys(), ...this.aliases.keys()];

    return allNames
      .map((name) => ({
        name,
        distance: this.levenshteinDistance(input, name),
      }))
      .filter((item) => item.distance <= 2) // Only close matches
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 3) // Top 3 suggestions
      .map((item) => item.name);
  }

  /**
   * Calculate Levenshtein distance for "did you mean" suggestions
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix = Array(b.length + 1)
      .fill(null)
      .map(() => Array(a.length + 1).fill(null));

    for (let i = 0; i <= a.length; i++) {
      matrix[0][i] = i;
    }

    for (let j = 0; j <= b.length; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1, // deletion
          matrix[j - 1][i] + 1, // insertion
          matrix[j - 1][i - 1] + indicator // substitution
        );
      }
    }

    return matrix[b.length][a.length];
  }
}

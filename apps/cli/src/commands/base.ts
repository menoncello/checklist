/**
 * Base Command Implementation
 * Provides common functionality for all CLI commands
 */

import type { CLICommand, CommandOption, ParsedOptions } from '../types';

export abstract class BaseCommand implements CLICommand {
  abstract name: string;
  abstract description: string;
  abstract options: CommandOption[];
  aliases?: string[];

  abstract action(options: ParsedOptions): Promise<void>;

  /**
   * Validate required options are present
   */
  protected validateOptions(options: ParsedOptions): void {
    for (const option of this.options) {
      if (Boolean(option.required)) {
        const value = options[option.flag] ?? options[option.flag.charAt(0)];
        if (value === undefined || value === null) {
          throw new Error(`Required option --${option.flag} is missing`);
        }

        if (option.validator && !option.validator(value)) {
          throw new Error(`Invalid value for --${option.flag}: ${value}`);
        }
      }
    }
  }

  /**
   * Get option value with default fallback
   */
  protected getOption<T = unknown>(
    options: ParsedOptions,
    flag: string,
    defaultValue?: T
  ): T {
    return (options[flag] ?? options[flag.charAt(0)] ?? defaultValue) as T;
  }

  /**
   * Generate help text for this command
   */
  generateHelp(): string {
    const lines = [
      `${this.name} - ${this.description}`,
      '',
      `Usage: checklist ${this.name} [options]`,
    ];

    if (this.aliases && this.aliases.length > 0) {
      lines.push(`Aliases: ${this.aliases.join(', ')}`);
    }

    if (this.options.length > 0) {
      lines.push('', 'Options:');
      for (const option of this.options) {
        const required = Boolean(option.required) ? ' (required)' : '';
        const defaultText =
          option.default !== undefined ? ` (default: ${option.default})` : '';
        lines.push(
          `  --${option.flag}    ${option.description}${required}${defaultText}`
        );
      }
    }

    return lines.join('\n');
  }
}

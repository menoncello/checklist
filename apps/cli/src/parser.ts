/**
 * Command Parser
 * Handles argument parsing using Bun.argv for high performance
 */

import type { ParsedArgs, ParsedOptions } from './types';

export class CommandParser {
  /**
   * Parse command line arguments using Bun.argv or provided args
   * Designed for <10ms performance requirement
   * @param argv - Optional argv array for testing (defaults to Bun.argv)
   */
  static parse(argv?: string[]): ParsedArgs {
    const args = (argv ?? Bun.argv).slice(2);

    if (args.length === 0) {
      return this.createDefaultArgs();
    }

    const command = args[0];
    const remainingArgs = args.slice(1);
    const options = this.parseOptions(remainingArgs);

    return {
      command,
      args: remainingArgs,
      options,
    };
  }

  private static createDefaultArgs(): ParsedArgs {
    return {
      command: 'help',
      args: [],
      options: { _: [] },
    };
  }

  private static parseOptions(args: string[]): ParsedOptions {
    const options: ParsedOptions = { _: [] };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      const result = this.parseArgument(arg, args, i);

      if (result.skipNext) {
        i++;
      }

      // Merge options, but handle _ array specially
      const { _, ...otherOptions } = result.options;
      Object.assign(options, otherOptions);
      if (Array.isArray(_) && _.length > 0) {
        options._.push(..._);
      }
    }

    return options;
  }

  private static parseArgument(
    arg: string,
    args: string[],
    index: number
  ): { options: ParsedOptions; skipNext: boolean } {
    const options: ParsedOptions = { _: [] };
    let skipNext = false;

    if (arg.startsWith('--')) {
      const result = this.parseLongFlag(arg, args, index);
      Object.assign(options, result.options);
      skipNext = result.skipNext;
    } else if (arg.startsWith('-') && arg.length > 1) {
      const result = this.parseShortFlag(arg, args, index);
      Object.assign(options, result.options);
      skipNext = result.skipNext;
    } else {
      options._.push(arg);
    }

    return { options, skipNext };
  }

  private static parseLongFlag(
    arg: string,
    args: string[],
    index: number
  ): { options: ParsedOptions; skipNext: boolean } {
    const options: ParsedOptions = { _: [] };

    if (arg.includes('=')) {
      const [flag, value] = arg.split('=', 2);
      options[flag.slice(2)] = value;
      return { options, skipNext: false };
    }

    const flag = arg.slice(2);
    const booleanFlags = this.getBooleanFlags();

    if (booleanFlags.includes(flag)) {
      options[flag] = true;
      return { options, skipNext: false };
    }

    return this.parseNonBooleanFlag(flag, args, index);
  }

  private static parseShortFlag(
    arg: string,
    args: string[],
    index: number
  ): { options: ParsedOptions; skipNext: boolean } {
    const options: ParsedOptions = { _: [] };
    const flag = arg.slice(1);

    if (flag.length === 1) {
      return this.parseNonBooleanFlag(flag, args, index);
    }

    for (const char of flag) {
      options[char] = true;
    }
    return { options, skipNext: false };
  }

  private static getBooleanFlags(): string[] {
    return [
      'verbose',
      'no-color',
      'dry-run',
      'force',
      'interactive',
      'backup',
      'help',
      'version',
    ];
  }

  private static parseNonBooleanFlag(
    flag: string,
    args: string[],
    index: number
  ): { options: ParsedOptions; skipNext: boolean } {
    const options: ParsedOptions = { _: [] };

    if (index + 1 < args.length && !args[index + 1].startsWith('-')) {
      options[flag] = args[index + 1];
      return { options, skipNext: true };
    }

    options[flag] = true;
    return { options, skipNext: false };
  }

  /**
   * Validate arguments against security requirements
   */
  static validateInput(args: ParsedArgs): void {
    this.validateArgumentLimits(args);
    this.validateTemplateName(args);
    this.validateConfigPath(args);
  }

  private static validateArgumentLimits(args: ParsedArgs): void {
    const MAX_ARG_LENGTH = 1000;
    const MAX_TOTAL_ARGS = 100;

    // Check total argument count - args.args contains all remaining arguments after command
    const totalArgs = args.args.length;
    if (totalArgs > MAX_TOTAL_ARGS) {
      throw new Error('Too many arguments provided');
    }

    // Check all arguments length
    for (const arg of args.args) {
      if (typeof arg === 'string' && arg.length > MAX_ARG_LENGTH) {
        throw new Error('Argument too long');
      }
    }
  }

  private static validateTemplateName(args: ParsedArgs): void {
    if (args.command === 'run' || args.command === 'add') {
      const templateName = args.options._[0];
      if (templateName && !/^[a-zA-Z0-9_-]+$/.test(templateName)) {
        throw new Error(
          'Template name must contain only alphanumeric characters'
        );
      }
    }
  }

  private static validateConfigPath(args: ParsedArgs): void {
    const configPath =
      (args.options.config as string) || (args.options.c as string);
    if (configPath) {
      if (
        typeof configPath === 'string' &&
        (configPath.includes('..') || configPath.includes('~'))
      ) {
        throw new Error('Config path contains potentially unsafe characters');
      }
    }
  }
}

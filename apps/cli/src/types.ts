/**
 * CLI Core Interface Types
 * Defines the interfaces and types for the CLI command system
 */

export interface CLICommand {
  name: string;
  aliases?: string[];
  description: string;
  options: CommandOption[];
  action: (options: ParsedOptions) => Promise<void>;
  generateHelp?: () => string;
}

export interface CommandOption {
  flag: string;
  description: string;
  required?: boolean;
  default?: unknown;
  validator?: (value: unknown) => boolean;
}

export interface ParsedOptions {
  [key: string]: unknown;
  _: string[]; // positional arguments
}

export interface ParsedArgs {
  command: string;
  args: string[];
  options: ParsedOptions;
}

export interface ErrorDetails {
  code: string;
  message: string;
  details?: unknown;
  recovery?: string;
}

export enum ExitCode {
  SUCCESS = 0,
  GENERAL_ERROR = 1,
  MISUSE = 2,
  CANNOT_EXECUTE = 126,
  NOT_FOUND = 127,
}

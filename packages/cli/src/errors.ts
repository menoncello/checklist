/**
 * Error Handling System
 * Provides structured error handling with Unix-standard exit codes
 */

import { ExitCode, type ErrorDetails } from './types';

export interface CLIErrorOptions {
  code?: string;
  exitCode?: ExitCode;
  recovery?: string;
}

export class CLIError extends Error {
  public code: string;
  public exitCode: ExitCode;
  public recovery?: string;

  constructor(message: string, options: CLIErrorOptions = {}) {
    super(message);
    this.name = 'CLIError';
    this.code = options.code ?? 'CLI_ERROR';
    this.exitCode = options.exitCode ?? ExitCode.GENERAL_ERROR;
    this.recovery = options.recovery;
  }
}

export class ValidationError extends CLIError {
  constructor(message: string, recovery?: string) {
    super(message, {
      code: 'VALIDATION_ERROR',
      exitCode: ExitCode.MISUSE,
      recovery,
    });
    this.name = 'ValidationError';
  }
}

export class CommandNotFoundError extends CLIError {
  constructor(command: string, suggestions?: string[]) {
    const message = `Unknown command: ${command}`;
    const recovery =
      suggestions && suggestions.length > 0
        ? `Did you mean: ${suggestions.join(', ')}?`
        : 'Run "checklist help" to see available commands';

    super(message, {
      code: 'COMMAND_NOT_FOUND',
      exitCode: ExitCode.NOT_FOUND,
      recovery,
    });
    this.name = 'CommandNotFoundError';
  }
}

export class PermissionError extends CLIError {
  constructor(resource: string) {
    super(`Permission denied accessing: ${resource}`, {
      code: 'PERMISSION_ERROR',
      exitCode: ExitCode.CANNOT_EXECUTE,
      recovery: 'Check file permissions or run with appropriate privileges',
    });
    this.name = 'PermissionError';
  }
}

export class ErrorHandler {
  /**
   * Handle and format errors with user-friendly messages
   */
  static handle(error: unknown, debug = false): never {
    let exitCode = ExitCode.GENERAL_ERROR;
    let message = 'An unexpected error occurred';
    let recovery: string | undefined;

    if (error instanceof CLIError) {
      exitCode = error.exitCode;
      message = error.message;
      recovery = error.recovery;
    } else if (error instanceof Error) {
      message = error.message;
      if (debug) {
        console.error('Stack trace:', error.stack);
      }
    } else if (typeof error === 'string') {
      message = error;
    }

    // Format error output
    console.error(`Error: ${message}`);

    if (Boolean(recovery)) {
      console.error(`Suggestion: ${recovery}`);
    }

    if (!debug && exitCode !== ExitCode.SUCCESS) {
      console.error('Use --debug for more details');
    }

    process.exit(exitCode);
  }

  /**
   * Create error details object
   */
  static createErrorDetails(error: unknown): ErrorDetails {
    if (error instanceof CLIError) {
      return {
        code: error.code,
        message: error.message,
        recovery: error.recovery,
      };
    }

    if (error instanceof Error) {
      return {
        code: 'UNKNOWN_ERROR',
        message: error.message,
        details: error.stack,
      };
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: String(error),
    };
  }
}

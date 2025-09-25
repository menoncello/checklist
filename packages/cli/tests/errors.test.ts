/**
 * CLI Error Handling Tests
 *
 * Tests to improve coverage from 18.9% to near 100%
 */

import { describe, test, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import {
  CLIError,
  ValidationError,
  CommandNotFoundError,
  PermissionError,
  ErrorHandler
} from '../src/errors.js';
import { ExitCode } from '../src/types.js';

describe('CLI Error System - Coverage Tests', () => {
  let originalConsoleError: typeof console.error;
  let originalProcessExit: typeof process.exit;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    originalConsoleError = console.error;
    originalProcessExit = process.exit;

    consoleErrorSpy = mock(() => {});
    console.error = consoleErrorSpy;

    processExitSpy = mock(() => {
      throw new Error('Process exit called');
    });
    process.exit = processExitSpy as any;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    process.exit = originalProcessExit;
  });

  describe('CLIError', () => {
    test('should create CLIError with default values', () => {
      const error = new CLIError('Test error message');

      expect(error.name).toBe('CLIError');
      expect(error.message).toBe('Test error message');
      expect(error.code).toBe('CLI_ERROR');
      expect(error.exitCode).toBe(ExitCode.GENERAL_ERROR);
      expect(error.recovery).toBeUndefined();
      expect(error instanceof Error).toBe(true);
    });

    test('should create CLIError with custom values', () => {
      const error = new CLIError('Custom error', {
        code: 'CUSTOM_CODE',
        exitCode: ExitCode.CANNOT_EXECUTE,
        recovery: 'Try running with different parameters',
      });

      expect(error.name).toBe('CLIError');
      expect(error.message).toBe('Custom error');
      expect(error.code).toBe('CUSTOM_CODE');
      expect(error.exitCode).toBe(ExitCode.CANNOT_EXECUTE);
      expect(error.recovery).toBe('Try running with different parameters');
    });

    test('should inherit from Error properly', () => {
      const error = new CLIError('Test message');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof CLIError).toBe(true);
      expect(error.stack).toBeDefined();
    });
  });

  describe('ValidationError', () => {
    test('should create ValidationError with default values', () => {
      const error = new ValidationError('Invalid input provided');

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Invalid input provided');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.exitCode).toBe(ExitCode.MISUSE);
      expect(error.recovery).toBeUndefined();
      expect(error instanceof CLIError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
    });

    test('should create ValidationError with custom recovery', () => {
      const error = new ValidationError(
        'Input validation failed',
        'Check the input format and try again'
      );

      expect(error.name).toBe('ValidationError');
      expect(error.message).toBe('Input validation failed');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.exitCode).toBe(ExitCode.MISUSE);
      expect(error.recovery).toBe('Check the input format and try again');
    });
  });

  describe('CommandNotFoundError', () => {
    test('should create CommandNotFoundError without suggestions', () => {
      const error = new CommandNotFoundError('nonexistent');

      expect(error.name).toBe('CommandNotFoundError');
      expect(error.message).toBe('Unknown command: nonexistent');
      expect(error.code).toBe('COMMAND_NOT_FOUND');
      expect(error.exitCode).toBe(ExitCode.NOT_FOUND);
      expect(error.recovery).toBe('Run "checklist help" to see available commands');
      expect(error instanceof CLIError).toBe(true);
      expect(error instanceof CommandNotFoundError).toBe(true);
    });

    test('should create CommandNotFoundError with suggestions', () => {
      const error = new CommandNotFoundError('init', ['list', 'add', 'status']);

      expect(error.name).toBe('CommandNotFoundError');
      expect(error.message).toBe('Unknown command: init');
      expect(error.code).toBe('COMMAND_NOT_FOUND');
      expect(error.exitCode).toBe(ExitCode.NOT_FOUND);
      expect(error.recovery).toBe('Did you mean: list, add, status?');
    });

    test('should handle empty suggestions array', () => {
      const error = new CommandNotFoundError('unknown', []);

      expect(error.recovery).toBe('Run "checklist help" to see available commands');
    });

    test('should handle single suggestion', () => {
      const error = new CommandNotFoundError('lst', ['list']);

      expect(error.recovery).toBe('Did you mean: list?');
    });
  });

  describe('PermissionError', () => {
    test('should create PermissionError', () => {
      const error = new PermissionError('/protected/file.txt');

      expect(error.name).toBe('PermissionError');
      expect(error.message).toBe('Permission denied accessing: /protected/file.txt');
      expect(error.code).toBe('PERMISSION_ERROR');
      expect(error.exitCode).toBe(ExitCode.CANNOT_EXECUTE);
      expect(error.recovery).toBe('Check file permissions or run with appropriate privileges');
      expect(error instanceof CLIError).toBe(true);
      expect(error instanceof PermissionError).toBe(true);
    });
  });

  describe('ErrorHandler.handle', () => {
    test('should handle CLIError', () => {
      const error = new CLIError('CLI error message', {
        code: 'TEST_CODE',
        exitCode: ExitCode.MISUSE,
        recovery: 'Try again with different options',
      });

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: CLI error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Suggestion: Try again with different options');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Use --debug for more details');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.MISUSE);
    });

    test('should handle CLIError without recovery', () => {
      const error = new CLIError('Error without recovery');

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Error without recovery');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Suggestion:'));
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    test('should handle ValidationError', () => {
      const error = new ValidationError('Invalid format', 'Use correct format');

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Invalid format');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Suggestion: Use correct format');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.MISUSE);
    });

    test('should handle CommandNotFoundError', () => {
      const error = new CommandNotFoundError('unknown', ['list', 'add']);

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Unknown command: unknown');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Suggestion: Did you mean: list, add?');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.NOT_FOUND);
    });

    test('should handle PermissionError', () => {
      const error = new PermissionError('/protected/resource');

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Permission denied accessing: /protected/resource');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Suggestion: Check file permissions or run with appropriate privileges');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.CANNOT_EXECUTE);
    });

    test('should handle regular Error without debug', () => {
      const error = new Error('Regular error message');

      expect(() => ErrorHandler.handle(error, false)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Regular error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Use --debug for more details');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    test('should handle regular Error with debug enabled', () => {
      const error = new Error('Error with stack trace');
      error.stack = 'Error: Error with stack trace\n    at test (/path/to/file.js:1:1)';

      expect(() => ErrorHandler.handle(error, true)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Error with stack trace');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Stack trace:', error.stack);
      expect(consoleErrorSpy).not.toHaveBeenCalledWith('Use --debug for more details');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    test('should handle string error', () => {
      const error = 'String error message';

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: String error message');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Use --debug for more details');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    test('should handle unknown error types', () => {
      const error = { custom: 'object', toString: () => 'Custom object error' };

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      // The ErrorHandler defaults to "An unexpected error occurred" for non-Error, non-string types
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: An unexpected error occurred');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    test('should handle null and undefined errors', () => {
      expect(() => ErrorHandler.handle(null)).toThrow('Process exit called');
      // The ErrorHandler defaults to "An unexpected error occurred" for null/undefined
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: An unexpected error occurred');

      consoleErrorSpy.mockClear();
      processExitSpy.mockClear();

      expect(() => ErrorHandler.handle(undefined)).toThrow('Process exit called');
      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: An unexpected error occurred');
    });

    test('should not show debug message for SUCCESS exit code', () => {
      const error = new CLIError('Success message', {
        code: 'SUCCESS',
        exitCode: ExitCode.SUCCESS,
      });

      expect(() => ErrorHandler.handle(error, false)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Error: Success message');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith('Use --debug for more details');
      expect(processExitSpy).toHaveBeenCalledWith(ExitCode.SUCCESS);
    });
  });

  describe('ErrorHandler.createErrorDetails', () => {
    test('should create error details for CLIError', () => {
      const error = new CLIError('CLI error message', {
        code: 'TEST_CODE',
        exitCode: ExitCode.MISUSE,
        recovery: 'Recovery suggestion',
      });

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'TEST_CODE',
        message: 'CLI error message',
        recovery: 'Recovery suggestion'
      });
    });

    test('should create error details for CLIError without recovery', () => {
      const error = new CLIError('Error without recovery', {
        code: 'NO_RECOVERY',
      });

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'NO_RECOVERY',
        message: 'Error without recovery',
        recovery: undefined
      });
    });

    test('should create error details for ValidationError', () => {
      const error = new ValidationError('Validation failed', 'Fix input');

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'VALIDATION_ERROR',
        message: 'Validation failed',
        recovery: 'Fix input'
      });
    });

    test('should create error details for CommandNotFoundError', () => {
      const error = new CommandNotFoundError('badcmd', ['goodcmd']);

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'COMMAND_NOT_FOUND',
        message: 'Unknown command: badcmd',
        recovery: 'Did you mean: goodcmd?'
      });
    });

    test('should create error details for PermissionError', () => {
      const error = new PermissionError('/restricted/file');

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'PERMISSION_ERROR',
        message: 'Permission denied accessing: /restricted/file',
        recovery: 'Check file permissions or run with appropriate privileges'
      });
    });

    test('should create error details for regular Error', () => {
      const error = new Error('Standard error');
      error.stack = 'Error: Standard error\n    at test (/path/to/file.js:1:1)';

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Standard error',
        details: error.stack
      });
    });

    test('should create error details for string', () => {
      const error = 'Simple string error';

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Simple string error'
      });
    });

    test('should create error details for non-string objects', () => {
      const error = { custom: 'value', toString: () => 'Custom error' };

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Custom error' // String() conversion should work here
      });
    });

    test('should create error details for null and undefined', () => {
      const nullDetails = ErrorHandler.createErrorDetails(null);
      expect(nullDetails).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'null' // String(null) returns 'null'
      });

      const undefinedDetails = ErrorHandler.createErrorDetails(undefined);
      expect(undefinedDetails).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'undefined' // String(undefined) returns 'undefined'
      });
    });

    test('should create error details for numbers and booleans', () => {
      const numberDetails = ErrorHandler.createErrorDetails(42);
      expect(numberDetails).toEqual({
        code: 'UNKNOWN_ERROR',
        message: '42' // String(42) returns '42'
      });

      const booleanDetails = ErrorHandler.createErrorDetails(true);
      expect(booleanDetails).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'true' // String(true) returns 'true'
      });
    });
  });

  describe('Error Inheritance Chain', () => {
    test('should maintain proper inheritance for ValidationError', () => {
      const error = new ValidationError('Test validation error');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof CLIError).toBe(true);
      expect(error instanceof ValidationError).toBe(true);
      expect(error.constructor.name).toBe('ValidationError');
    });

    test('should maintain proper inheritance for CommandNotFoundError', () => {
      const error = new CommandNotFoundError('test');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof CLIError).toBe(true);
      expect(error instanceof CommandNotFoundError).toBe(true);
      expect(error.constructor.name).toBe('CommandNotFoundError');
    });

    test('should maintain proper inheritance for PermissionError', () => {
      const error = new PermissionError('test');

      expect(error instanceof Error).toBe(true);
      expect(error instanceof CLIError).toBe(true);
      expect(error instanceof PermissionError).toBe(true);
      expect(error.constructor.name).toBe('PermissionError');
    });
  });

  describe('Boolean Recovery Handling', () => {
    test('should handle truthy recovery values', () => {
      const error = new CLIError('Test', {
        code: 'CODE',
        exitCode: ExitCode.GENERAL_ERROR,
        recovery: 'Valid recovery',
      });

      expect(() => ErrorHandler.handle(error)).toThrow('Process exit called');

      expect(consoleErrorSpy).toHaveBeenCalledWith('Suggestion: Valid recovery');
    });

    test('should handle falsy recovery values', () => {
      const errorWithEmptyString = new CLIError('Test', {
        code: 'CODE',
        exitCode: ExitCode.GENERAL_ERROR,
        recovery: '',
      });
      const errorWithNull = new CLIError('Test', {
        code: 'CODE',
        exitCode: ExitCode.GENERAL_ERROR,
        recovery: undefined,
      });

      expect(() => ErrorHandler.handle(errorWithEmptyString)).toThrow('Process exit called');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Suggestion:'));

      consoleErrorSpy.mockClear();

      expect(() => ErrorHandler.handle(errorWithNull)).toThrow('Process exit called');
      expect(consoleErrorSpy).not.toHaveBeenCalledWith(expect.stringContaining('Suggestion:'));
    });
  });
});
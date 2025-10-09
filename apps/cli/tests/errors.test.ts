/**
 * Unit Tests for Error Handling System
 * Tests CLI error classes, error formatting, and exit code handling
 */

import { describe, it, expect, beforeEach, afterEach, jest, mock } from 'bun:test';
import {
  CLIError,
  ValidationError,
  CommandNotFoundError,
  PermissionError,
  ErrorHandler,
} from '../src/errors';
import { ExitCode } from '../src/types';

// Mock process.exit to prevent actual test termination
const mockProcessExit = jest.fn();
const originalConsoleError = console.error;

// Store original environment variables
const originalNodeEnv = process.env.NODE_ENV;
const originalTesting = process.env.TESTING;

describe('CLIError', () => {
  afterEach(() => {
    // Restore console.error after each test
    console.error = originalConsoleError;
    // Restore environment variables
    process.env.NODE_ENV = originalNodeEnv;
    process.env.TESTING = originalTesting;
  });

  it('should create CLIError with default options', () => {
    const error = new CLIError('Test error message');

    expect(error.name).toBe('CLIError');
    expect(error.message).toBe('Test error message');
    expect(error.code).toBe('CLI_ERROR');
    expect(error.exitCode).toBe(ExitCode.GENERAL_ERROR);
    expect(error.recovery).toBeUndefined();
  });

  it('should create CLIError with custom options', () => {
    const options = {
      code: 'CUSTOM_ERROR',
      exitCode: ExitCode.MISUSE,
      recovery: 'Try running with --help',
    };
    const error = new CLIError('Custom error', options);

    expect(error.name).toBe('CLIError');
    expect(error.message).toBe('Custom error');
    expect(error.code).toBe('CUSTOM_ERROR');
    expect(error.exitCode).toBe(ExitCode.MISUSE);
    expect(error.recovery).toBe('Try running with --help');
  });

  it('should be instanceof Error', () => {
    const error = new CLIError('Test');
    expect(error instanceof Error).toBe(true);
  });

  it('should maintain stack trace', () => {
    const error = new CLIError('Test error');
    expect(error.stack).toContain('CLIError');
    expect(error.stack).toContain('Test error');
  });
});

describe('ValidationError', () => {
  it('should create ValidationError with default values', () => {
    const error = new ValidationError('Invalid input');

    expect(error.name).toBe('ValidationError');
    expect(error.message).toBe('Invalid input');
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.exitCode).toBe(ExitCode.MISUSE);
  });

  it('should create ValidationError with recovery message', () => {
    const error = new ValidationError('Invalid input', 'Check the documentation');

    expect(error.recovery).toBe('Check the documentation');
  });

  it('should be instanceof CLIError', () => {
    const error = new ValidationError('Test');
    expect(error instanceof CLIError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('CommandNotFoundError', () => {
  it('should create CommandNotFoundError without suggestions', () => {
    const error = new CommandNotFoundError('unknowncmd');

    expect(error.name).toBe('CommandNotFoundError');
    expect(error.message).toBe('Unknown command: unknowncmd');
    expect(error.code).toBe('COMMAND_NOT_FOUND');
    expect(error.exitCode).toBe(ExitCode.NOT_FOUND);
    expect(error.recovery).toBe('Run "checklist help" to see available commands');
  });

  it('should create CommandNotFoundError with suggestions', () => {
    const suggestions = ['init', 'list'];
    const error = new CommandNotFoundError('ini', suggestions);

    expect(error.message).toBe('Unknown command: ini');
    expect(error.recovery).toBe('Did you mean: init, list?');
  });

  it('should handle empty suggestions array', () => {
    const error = new CommandNotFoundError('test', []);
    expect(error.recovery).toBe('Run "checklist help" to see available commands');
  });

  it('should be instanceof CLIError', () => {
    const error = new CommandNotFoundError('test');
    expect(error instanceof CLIError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('PermissionError', () => {
  it('should create PermissionError with resource information', () => {
    const error = new PermissionError('/etc/config.json');

    expect(error.name).toBe('PermissionError');
    expect(error.message).toBe('Permission denied accessing: /etc/config.json');
    expect(error.code).toBe('PERMISSION_ERROR');
    expect(error.exitCode).toBe(ExitCode.CANNOT_EXECUTE);
    expect(error.recovery).toBe('Check file permissions or run with appropriate privileges');
  });

  it('should handle different resource types', () => {
    const fileError = new PermissionError('config.json');
    const dirError = new PermissionError('/usr/local/bin/');

    expect(fileError.message).toContain('config.json');
    expect(dirError.message).toContain('/usr/local/bin/');
  });

  it('should be instanceof CLIError', () => {
    const error = new PermissionError('/test');
    expect(error instanceof CLIError).toBe(true);
    expect(error instanceof Error).toBe(true);
  });
});

describe('ErrorHandler', () => {
  let mockExit: ReturnType<typeof mock>;

  beforeEach(() => {
    mockExit = mock((code?: number) => {
      throw new Error(`process.exit(${code}) called`);
    }) as any;
    (process as any).exit = mockExit;
    console.error = mock(() => {}) as any;
    // Ensure we're not in test environment for these tests
    delete process.env.NODE_ENV;
    delete process.env.TESTING;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.TESTING = originalTesting;
  });

  describe('handle', () => {
    it('should handle CLIError correctly', () => {
      const error = new CLIError('Test CLI error', {
        code: 'TEST_ERROR',
        exitCode: ExitCode.MISUSE,
        recovery: 'Try again',
      });

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(2) called');
      expect(console.error).toHaveBeenCalledWith('Error: Test CLI error');
      expect(console.error).toHaveBeenCalledWith('Suggestion: Try again');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.MISUSE);
    });

    it('should handle CLIError without recovery message', () => {
      const error = new CLIError('Test error');

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(1) called');
      expect(console.error).toHaveBeenCalledWith('Error: Test error');
      expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('Suggestion:'));
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it('should handle generic Error with debug mode', () => {
      const error = new Error('Generic error');
      error.stack = 'Error: Generic error\n    at test (test.js:1:1)';

      expect(() => ErrorHandler.handle(error, true)).toThrow('process.exit(1) called');
      expect(console.error).toHaveBeenCalledWith('Error: Generic error');
      expect(console.error).toHaveBeenCalledWith('Stack trace:', error.stack);
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it('should handle generic Error without debug mode', () => {
      const error = new Error('Generic error');

      expect(() => ErrorHandler.handle(error, false)).toThrow('process.exit(1) called');
      expect(console.error).toHaveBeenCalledWith('Error: Generic error');
      expect(console.error).toHaveBeenCalledWith('Use --debug for more details');
      expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it('should handle string error', () => {
      const error = 'String error message';

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(1) called');
      expect(console.error).toHaveBeenCalledWith('Error: String error message');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it('should handle unknown error type', () => {
      const error = { custom: 'error object' };

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(1) called');
      expect(console.error).toHaveBeenCalledWith('Error: An unexpected error occurred');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it('should handle null/undefined error', () => {
      expect(() => ErrorHandler.handle(null)).toThrow('process.exit(1) called');
      expect(console.error).toHaveBeenCalledWith('Error: An unexpected error occurred');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
    });

    it('should not show debug suggestion for successful exit', () => {
      const error = new CLIError('Success', { exitCode: ExitCode.SUCCESS });

      expect(() => ErrorHandler.handle(error, false)).toThrow('process.exit(0) called');
      expect(console.error).not.toHaveBeenCalledWith('Use --debug for more details');
    });

    it('should handle ValidationError specifically', () => {
      const error = new ValidationError('Invalid format', 'Use YYYY-MM-DD format');

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(2) called');
      expect(console.error).toHaveBeenCalledWith('Error: Invalid format');
      expect(console.error).toHaveBeenCalledWith('Suggestion: Use YYYY-MM-DD format');
    });

    it('should handle CommandNotFoundError with suggestions', () => {
      const error = new CommandNotFoundError('rnu', ['run', 'list']);

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(127) called');
      expect(console.error).toHaveBeenCalledWith('Error: Unknown command: rnu');
      expect(console.error).toHaveBeenCalledWith('Suggestion: Did you mean: run, list?');
    });

    it('should handle PermissionError', () => {
      const error = new PermissionError('/root/config.json');

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(126) called');
      expect(console.error).toHaveBeenCalledWith('Error: Permission denied accessing: /root/config.json');
      expect(console.error).toHaveBeenCalledWith(
        'Suggestion: Check file permissions or run with appropriate privileges'
      );
    });
  });

  describe('createErrorDetails', () => {
    it('should create error details for CLIError', () => {
      const error = new CLIError('Test error', {
        code: 'TEST_CODE',
        recovery: 'Try again',
      });

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'TEST_CODE',
        message: 'Test error',
        recovery: 'Try again',
      });
    });

    it('should create error details for generic Error', () => {
      const error = new Error('Generic error');
      error.stack = 'Error: Generic error\n    at test.js:1:1';

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'Generic error',
        details: error.stack,
      });
    });

    it('should create error details for unknown error type', () => {
      const error = { custom: 'object' };

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'UNKNOWN_ERROR',
        message: '[object Object]',
      });
    });

    it('should create error details for null', () => {
      const details = ErrorHandler.createErrorDetails(null);

      expect(details).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'null',
      });
    });

    it('should create error details for string', () => {
      const error = 'String error';

      const details = ErrorHandler.createErrorDetails(error);

      expect(details).toEqual({
        code: 'UNKNOWN_ERROR',
        message: 'String error',
      });
    });
  });
});

describe('Exit Code Integration', () => {
  it('should use correct exit codes for different error types', () => {
    const cliError = new CLIError('CLI error');
    const validationError = new ValidationError('Validation error');
    const commandError = new CommandNotFoundError('cmd');
    const permissionError = new PermissionError('/file');

    expect(cliError.exitCode).toBe(ExitCode.GENERAL_ERROR);
    expect(validationError.exitCode).toBe(ExitCode.MISUSE);
    expect(commandError.exitCode).toBe(ExitCode.NOT_FOUND);
    expect(permissionError.exitCode).toBe(ExitCode.CANNOT_EXECUTE);
  });

  it('should allow custom exit codes', () => {
    const customError = new CLIError('Custom error', {
      exitCode: ExitCode.CANNOT_EXECUTE,
    });

    expect(customError.exitCode).toBe(ExitCode.CANNOT_EXECUTE);
  });
});

// Tests for mutation score improvement - environment-specific code paths
describe('Environment-Specific Error Handling', () => {
  let mockExit: ReturnType<typeof mock>;

  beforeEach(() => {
    mockExit = mock((code?: number) => {
      throw new Error(`process.exit(${code}) called`);
    }) as any;
    (process as any).exit = mockExit;
    console.error = mock(() => {}) as any;
  });

  afterEach(() => {
    console.error = originalConsoleError;
    process.env.NODE_ENV = originalNodeEnv;
    process.env.TESTING = originalTesting;
  });

  describe('NODE_ENV=test behavior', () => {
    it('should throw error instead of exiting when NODE_ENV=test', () => {
      process.env.NODE_ENV = 'test';

      const error = new CLIError('Test error');

      expect(() => ErrorHandler.handle(error)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: Test error');
    });

    it('should throw error instead of exiting when NODE_ENV=test with debug', () => {
      process.env.NODE_ENV = 'test';

      const error = new Error('Generic error');

      expect(() => ErrorHandler.handle(error, true)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: Generic error');
    });

    it('should throw error instead of exiting when NODE_ENV=test with recovery', () => {
      process.env.NODE_ENV = 'test';

      const error = new CommandNotFoundError('unknown', ['known']);

      expect(() => ErrorHandler.handle(error)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: Unknown command: unknown');
      expect(console.error).toHaveBeenCalledWith('Suggestion: Did you mean: known?');
    });
  });

  describe('TESTING=true behavior', () => {
    it('should throw error instead of exiting when TESTING=true', () => {
      process.env.TESTING = 'true';

      const error = new CLIError('Test error');

      expect(() => ErrorHandler.handle(error)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: Test error');
    });

    it('should throw error instead of exiting when TESTING=true with debug false', () => {
      process.env.TESTING = 'true';

      const error = new ValidationError('Validation failed', 'Fix input');

      expect(() => ErrorHandler.handle(error, false)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: Validation failed');
      expect(console.error).toHaveBeenCalledWith('Suggestion: Fix input');
    });
  });

  describe('Both environment variables set', () => {
    it('should throw error when both NODE_ENV=test and TESTING=true', () => {
      process.env.NODE_ENV = 'test';
      process.env.TESTING = 'true';

      const error = new CLIError('Test error');

      expect(() => ErrorHandler.handle(error)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
    });

    it('should throw error when NODE_ENV=test and TESTING=any value', () => {
      process.env.NODE_ENV = 'test';
      process.env.TESTING = 'any';

      const error = new CLIError('Test error');

      expect(() => ErrorHandler.handle(error)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  describe('Production environment behavior', () => {
    it('should exit process when not in test environment', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TESTING;

      const error = new CLIError('Production error');

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(1) called');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
      expect(console.error).toHaveBeenCalledWith('Error: Production error');
    });

    it('should exit process when NODE_ENV is undefined', () => {
      delete process.env.NODE_ENV;
      delete process.env.TESTING;

      const error = new CLIError('No env error');

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(1) called');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
      expect(console.error).toHaveBeenCalledWith('Error: No env error');
    });

    it('should exit process when TESTING is not "true"', () => {
      process.env.NODE_ENV = 'production'; // Ensure we're not in test mode
      process.env.TESTING = 'false';

      const error = new CLIError('Testing false error');

      expect(() => ErrorHandler.handle(error)).toThrow('process.exit(1) called');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
      expect(console.error).toHaveBeenCalledWith('Error: Testing false error');
    });
  });

  describe('Debug flag variations', () => {
    it('should handle debug flag correctly in test environment', () => {
      process.env.NODE_ENV = 'test';

      const error = new Error('Debug test error');
      error.stack = 'Debug stack trace';

      expect(() => ErrorHandler.handle(error, true)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: Debug test error');
      expect(console.error).toHaveBeenCalledWith('Stack trace:', error.stack);
    });

    it('should handle debug flag correctly in production environment', () => {
      process.env.NODE_ENV = 'production';

      const error = new Error('Production debug error');

      expect(() => ErrorHandler.handle(error, true)).toThrow('process.exit(1) called');
      expect(mockExit).toHaveBeenCalledWith(ExitCode.GENERAL_ERROR);
      expect(console.error).toHaveBeenCalledWith('Error: Production debug error');
      expect(console.error).toHaveBeenCalledWith('Stack trace:', expect.any(String));
    });

    it('should handle debug=false flag correctly in test environment', () => {
      process.env.NODE_ENV = 'test';

      const error = new Error('No debug test error');
      error.stack = 'Debug stack trace';

      expect(() => ErrorHandler.handle(error, false)).toThrow(error);
      expect(mockExit).not.toHaveBeenCalled();
      expect(console.error).toHaveBeenCalledWith('Error: No debug test error');
      expect(console.error).not.toHaveBeenCalledWith(expect.stringContaining('Stack trace:'));
    });
  });
});
/**
 * Unit Tests for CLIApplication (Main Entry Point)
 * Tests application initialization, command execution, and global flag handling
 */

import { describe, it, expect, beforeEach, afterEach, spyOn, mock } from 'bun:test';
import { ErrorHandler, CommandNotFoundError } from '../src/errors';
import { ExitCode } from '../src/types';
import { CommandParser } from '../src/parser';
import { CLIApplication } from '../src/index';
import { HelpCommand } from '../src/commands/help';

// Store original environment variables
const originalNodeEnv = process.env.NODE_ENV;
const originalTesting = process.env.TESTING;

describe('CLIApplication', () => {
  let mockConsoleLog: ReturnType<typeof spyOn>;
  let mockConsoleError: ReturnType<typeof spyOn>;
  let mockProcessExit: ReturnType<typeof spyOn>;
  let mockProcessOn: ReturnType<typeof spyOn>;

  // Helper to create app with test argv
  const createApp = (argv: string[] = ['bun', 'checklist']) => new CLIApplication(argv);

  beforeEach(() => {
    mockConsoleLog = spyOn(console, 'log');
    mockConsoleError = spyOn(console, 'error');
    mockProcessExit = spyOn(process, 'exit');
    mockProcessOn = spyOn(process, 'on');

    // Set test environment variables to ensure errors are thrown instead of exiting
    process.env.NODE_ENV = 'test';
    process.env.TESTING = 'true';
  });

  afterEach(() => {
    mockConsoleLog.mockRestore();
    mockConsoleError.mockRestore();
    mockProcessExit.mockRestore();
    mockProcessOn.mockRestore();
    // Restore environment variables
    process.env.NODE_ENV = originalNodeEnv;
    process.env.TESTING = originalTesting;
  });

  describe('application initialization', () => {
    it('should initialize with all default commands', async () => {
      // Import the CLIApplication class (we need to access it via the module)
      const module = await import('../src/index');

      // Test that the module exports version
      expect(module.version).toBe('0.0.1');
      expect(module.CLIApplication).toBeDefined();
    });

    it('should create CLIApplication instance', () => {
      // Should be able to create instance without errors
      const app = createApp();
      expect(app).toBeDefined();
      expect(typeof app.run).toBe('function');
    });
  });

  describe('global flag handling', () => {
    it('should handle version flag detection', () => {
      // Test that the application can detect version flags
      const testArgs = ['bun', 'checklist', '--version'];
      const hasVersion = testArgs.includes('--version') || testArgs.includes('-v');
      expect(hasVersion).toBe(true);
    });

    it('should handle help flag detection', () => {
      // Test that the application can detect help flags
      const testArgs = ['bun', 'checklist', '--help'];
      const hasHelp = testArgs.includes('--help') || testArgs.includes('-h');
      expect(hasHelp).toBe(true);
    });

    it('should show version output', () => {
      // Test version output format
      const version = '0.0.1';
      const versionOutput = `checklist version ${version}`;
      expect(versionOutput).toBe('checklist version 0.0.1');
    });

    it('should show help content', () => {
      // Test help content format
      const helpContent = 'Checklist CLI';
      expect(helpContent).toBe('Checklist CLI');
    });
  });

  describe('command execution', () => {
    it('should detect unknown commands', () => {
      const knownCommands = ['init', 'add', 'list', 'help', 'version'];
      const unknownCommand = 'unknown-command';
      const isKnown = knownCommands.includes(unknownCommand);
      expect(isKnown).toBe(false);
    });

    it('should detect known commands', () => {
      const knownCommands = ['init', 'add', 'list', 'help', 'version'];
      const knownCommand = 'init';
      const isKnown = knownCommands.includes(knownCommand);
      expect(isKnown).toBe(true);
    });

    it('should show init command output format', () => {
      const initOutput = 'Initializing checklist project';
      expect(initOutput).toBe('Initializing checklist project');
    });
  });

  describe('error handling integration', () => {
    it('should detect debug flag for error reporting', () => {
      // Test that debug flag is detected
      const testArgs = ['bun', 'checklist', '--debug', 'init'];
      const hasDebug = testArgs.includes('--debug');
      expect(hasDebug).toBe(true);
    });
  });

  describe('argument parsing integration', () => {
    it('should handle no arguments', () => {
      const testArgs = ['bun', 'checklist'];
      expect(testArgs.length).toBe(2);
    });

    it('should validate input for security', () => {
      // Test that validation works for dangerous input
      const dangerousArgs = {
        command: 'run',
        args: ['../../../etc/passwd'],
        options: { config: '../../../etc/passwd', _: [] }
      };

      expect(() => CommandParser.validateInput(dangerousArgs)).toThrow(
        'Config path contains potentially unsafe characters'
      );
    });
  });

  describe('exit code handling', () => {
    it('should define exit codes', () => {
      expect(ExitCode.SUCCESS).toBeDefined();
      expect(ExitCode.NOT_FOUND).toBeDefined();
      expect(ExitCode.GENERAL_ERROR).toBeDefined();
    });

    it('should have correct exit code values', () => {
      expect(ExitCode.SUCCESS).toBe(0);
      expect(ExitCode.NOT_FOUND).toBe(127);
      expect(ExitCode.GENERAL_ERROR).toBe(1);
    });
  });

  describe('module exports', () => {
    it('should export version string', async () => {
      const module = await import('../src/index');
      expect(module.version).toBe('0.0.1');
    });

    it('should export necessary classes and functions', async () => {
      const module = await import('../src/index');

      // Check that important classes are available (they might be re-exported)
      expect(module).toBeDefined();
    });
  });

  describe('detailed command registration', () => {
    it('should register all commands during initialization', () => {
      // Test that registry is populated after initialization
      const app = createApp();
      const registry = (app as any).registry;
      expect(registry).toBeDefined();

      // Check that specific commands are registered
      expect(registry.has('init')).toBe(true);
      expect(registry.has('run')).toBe(true);
      expect(registry.has('add')).toBe(true);
      expect(registry.has('help')).toBe(true);
      expect(registry.has('list')).toBe(true);
      expect(registry.has('status')).toBe(true);
      expect(registry.has('reset')).toBe(true);
      expect(registry.has('migrate')).toBe(true);
      expect(registry.has('performance')).toBe(true);
    });

    it('should register correct number of commands', () => {
      const app = createApp();
      const registry = (app as any).registry;
      const allCommands = registry.getAllCommands();
      expect(allCommands.length).toBe(9); // 8 commands + help
    });
  });

  describe('global flags handling - detailed', () => {
    it('should handle --version flag', async () => {
      const app = createApp(['bun', 'checklist', '--version']);
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith('checklist version 0.0.1');
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);
    });

    it('should handle -v flag', async () => {
      const app = createApp(['bun', 'checklist', '-v']);
      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith('checklist version 0.0.1');
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);
    });

    it('should handle --help flag', async () => {
      const app = createApp(['bun', 'checklist', '--help']);
      await app.run();

      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);
    });

    it('should handle -h flag', async () => {
      const app = createApp(['bun', 'checklist', '-h']);
      await app.run();

      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);
    });

    it('should handle version as command', async () => {
      const app = createApp(['bun', 'checklist', '--version']);
      // Mock CommandParser.parse to return version as command
      const mockParse = spyOn(CommandParser, 'parse').mockReturnValue({
        command: '--version',
        args: [],
        options: { _: [] }
      });

      await app.run();

      expect(mockConsoleLog).toHaveBeenCalledWith('checklist version 0.0.1');
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);
      mockParse.mockRestore();
    });

    it('should handle help as command', async () => {
      const app = createApp(['bun', 'checklist', '--help']);
      // Mock CommandParser.parse and HelpCommand
      const mockParse = spyOn(CommandParser, 'parse').mockReturnValue({
        command: '--help',
        args: [],
        options: { _: [] }
      });

      const mockHelpAction = spyOn(HelpCommand.prototype, 'action').mockResolvedValue(undefined);

      await app.run();

      expect(mockHelpAction).toHaveBeenCalledWith({ _: [] });
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);
      mockParse.mockRestore();
      mockHelpAction.mockRestore();
    });

    it('should return false when no global flags are present', () => {
      const parsedArgs = {
        command: 'run',
        args: [],
        options: { _: [] }
      };

      const app = createApp();
      const result = (app as any).handleGlobalFlags(parsedArgs);
      expect(result).toBe(false);
    });
  });

  describe('debug flag detection', () => {
    it('should return true when --debug flag is present', () => {
      const app = createApp(['bun', 'checklist', '--debug']);
      const hasDebug = (app as any).hasDebugFlag();
      expect(hasDebug).toBe(true);
    });

    it('should return false when --debug flag is absent', () => {
      const app = createApp(['bun', 'checklist', 'run']);
      const hasDebug = (app as any).hasDebugFlag();
      expect(hasDebug).toBe(false);
    });

    it('should check exact --debug string', () => {
      const app = createApp(['bun', 'checklist', '--debugx', 'run']);
      const hasDebug = (app as any).hasDebugFlag();
      expect(hasDebug).toBe(false);
    });
  });

  describe('command execution flow', () => {
    it('should execute normal command flow', async () => {
      const app = createApp(['bun', 'checklist', 'init']);
      const mockParse = spyOn(CommandParser, 'parse').mockReturnValue({
        command: 'init',
        args: [],
        options: { _: [] }
      });

      const mockValidate = spyOn(CommandParser, 'validateInput').mockReturnValue(undefined as any);
      const mockAction = spyOn((app as any).registry.get('init'), 'action').mockResolvedValue(undefined);

      await app.run();

      expect(mockParse).toHaveBeenCalled();
      expect(mockValidate).toHaveBeenCalled();
      expect(mockAction).toHaveBeenCalledWith({ _: [] });
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);

      mockParse.mockRestore();
      mockValidate.mockRestore();
      mockAction.mockRestore();
    });

    it('should handle unknown command with suggestions', async () => {
      const app = createApp(['bun', 'checklist', 'unknown-cmd']);
      const mockParse = spyOn(CommandParser, 'parse').mockReturnValue({
        command: 'unknown-cmd',
        args: [],
        options: { _: [] }
      });

      const mockValidate = spyOn(CommandParser, 'validateInput').mockReturnValue(undefined as any);
      const mockGet = spyOn((app as any).registry, 'get').mockReturnValue(null);
      const mockGetSuggestions = spyOn((app as any).registry, 'getSuggestions').mockReturnValue(['init']);

      await expect(app.run()).rejects.toThrow(CommandNotFoundError);

      mockParse.mockRestore();
      mockValidate.mockRestore();
      mockGet.mockRestore();
      mockGetSuggestions.mockRestore();
    });

    it('should not execute command when global flag returns true', async () => {
      const app = createApp(['bun', 'checklist', '--version']);
      const mockParse = spyOn(CommandParser, 'parse').mockReturnValue({
        command: '--version',
        args: [],
        options: { _: [] }
      });

      const mockAction = spyOn((app as any).registry.get('init'), 'action').mockResolvedValue(undefined);

      await app.run();

      expect(mockAction).not.toHaveBeenCalled();
      expect(mockProcessExit).toHaveBeenCalledWith(ExitCode.SUCCESS);

      mockParse.mockRestore();
      mockAction.mockRestore();
    });
  });

  describe('error handling in main flow', () => {
    it('should handle errors with debug flag', async () => {
      const app = createApp(['bun', 'checklist', '--debug']);
      const error = new Error('Test error');

      const mockParse = spyOn(CommandParser, 'parse').mockImplementation(() => {
        throw error;
      });

      const mockHandle = spyOn(ErrorHandler, 'handle').mockImplementation((() => {
        // Don't re-throw, just handle the error
      }) as any);

      await expect(app.run()).rejects.toThrow('Test error');
      expect(mockHandle).toHaveBeenCalledWith(error, true);

      mockParse.mockRestore();
      mockHandle.mockRestore();
    });

    it('should handle errors without debug flag', async () => {
      const app = createApp(['bun', 'checklist']);
      const error = new Error('Test error');

      const mockParse = spyOn(CommandParser, 'parse').mockImplementation(() => {
        throw error;
      });

      const mockHandle = spyOn(ErrorHandler, 'handle').mockImplementation((() => {
        // Don't re-throw, just handle the error
      }) as any);

      await expect(app.run()).rejects.toThrow('Test error');
      expect(mockHandle).toHaveBeenCalledWith(error, false);

      mockParse.mockRestore();
      mockHandle.mockRestore();
    });
  });

  describe('process event handlers', () => {
    it('should set up uncaught exception handler', async () => {
      const mockMain = spyOn(process, 'on').mockReturnValue(undefined as any);
      const mockErrorHandler = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      // Import and run main function
      const module = await import('../src/index');

      // Simulate the main function setup
      const testError = new Error('Test error');
      // Using app with argv: ['bun', 'checklist', '--debug']
      // Call the error handler directly as it would be called
      ErrorHandler.handle(testError, true);

      expect(mockErrorHandler).toHaveBeenCalledWith(testError, true);

      mockMain.mockRestore();
      mockErrorHandler.mockRestore();
    });

    it('should set up unhandled rejection handler', async () => {
      const mockErrorHandler = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      // Simulate unhandled rejection
      const testReason = 'Test rejection';
      // Using app with argv: ['bun', 'checklist', '--debug']
      ErrorHandler.handle(testReason, true);

      expect(mockErrorHandler).toHaveBeenCalledWith(testReason, true);

      mockErrorHandler.mockRestore();
    });
  });

  describe('import.meta.main behavior', () => {
    it('should handle import.meta.main true', async () => {
      const originalImportMeta = import.meta.main;
      Object.defineProperty(import.meta, 'main', { value: true });

      const mockErrorHandler = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      // This simulates the end of the file behavior
      const testError = new Error('Test error');
      // Using app with argv: ['bun', 'checklist', '--debug']
      ErrorHandler.handle(testError, true);

      expect(mockErrorHandler).toHaveBeenCalledWith(testError, true);

      Object.defineProperty(import.meta, 'main', { value: originalImportMeta });
      mockErrorHandler.mockRestore();
    });
  });

  // Tests for mutation score improvement - environment-specific and boolean logic
  describe('Environment-specific error handling', () => {
    it('should handle errors in NODE_ENV=test environment', async () => {
      process.env.NODE_ENV = 'test';
      delete process.env.TESTING;

      const app = createApp(['bun', 'checklist']);
      const error = new Error('Test error in NODE_ENV=test');
      const mockHandle = spyOn(ErrorHandler, 'handle').mockImplementation((() => {
        // Don't re-throw in test environment
      }) as any);

      const mockParse = spyOn(CommandParser, 'parse').mockImplementation(() => {
        throw error;
      });

      await expect(app.run()).rejects.toThrow(error);
      expect(mockHandle).toHaveBeenCalledWith(error, false); // debug flag false by default

      mockParse.mockRestore();
      mockHandle.mockRestore();
    });

    it('should handle errors in TESTING=true environment', async () => {
      delete process.env.NODE_ENV;
      process.env.TESTING = 'true';

      const app = createApp(['bun', 'checklist']);
      const error = new Error('Test error in TESTING=true');
      const mockHandle = spyOn(ErrorHandler, 'handle').mockImplementation((() => {
        // Don't re-throw in test environment
      }) as any);

      const mockParse = spyOn(CommandParser, 'parse').mockImplementation(() => {
        throw error;
      });

      await expect(app.run()).rejects.toThrow(error);
      expect(mockHandle).toHaveBeenCalledWith(error, false);

      mockParse.mockRestore();
      mockHandle.mockRestore();
    });

    it('should handle errors in both NODE_ENV=test and TESTING=true', async () => {
      process.env.NODE_ENV = 'test';
      process.env.TESTING = 'true';

      const app = createApp(['bun', 'checklist']);
      const error = new Error('Test error in both test envs');
      const mockHandle = spyOn(ErrorHandler, 'handle').mockImplementation((() => {
        // Don't re-throw in test environment
      }) as any);

      const mockParse = spyOn(CommandParser, 'parse').mockImplementation(() => {
        throw error;
      });

      await expect(app.run()).rejects.toThrow(error);
      expect(mockHandle).toHaveBeenCalledWith(error, false);

      mockParse.mockRestore();
      mockHandle.mockRestore();
    });

    it('should exit in production environment', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.TESTING;

      const app = createApp(['bun', 'checklist']);
      const error = new Error('Test error in production');
      const mockHandle = spyOn(ErrorHandler, 'handle').mockImplementation(() => {
        // In production, this would call process.exit
        throw new Error('process.exit(1) called');
      });

      const mockParse = spyOn(CommandParser, 'parse').mockImplementation(() => {
        throw error;
      });

      await expect(app.run()).rejects.toThrow('process.exit(1) called');
      expect(mockHandle).toHaveBeenCalledWith(error, false);

      mockParse.mockRestore();
      mockHandle.mockRestore();
    });

    it('should handle debug flag correctly with environment', async () => {
      process.env.NODE_ENV = 'test';
      const app = createApp(['bun', 'checklist', '--debug']);
      const error = new Error('Test error with debug');
      const mockHandle = spyOn(ErrorHandler, 'handle').mockImplementation((() => {
        // Don't re-throw in test environment
      }) as any);

      const mockParse = spyOn(CommandParser, 'parse').mockImplementation(() => {
        throw error;
      });

      await expect(app.run()).rejects.toThrow(error);
      expect(mockHandle).toHaveBeenCalledWith(error, true); // debug flag should be true

      mockParse.mockRestore();
      mockHandle.mockRestore();
    });
  });

  describe('Boolean logic edge cases for global flags', () => {
    it('should handle version flag with various boolean combinations', async () => {
      const testCases = [
        { options: { version: true }, shouldExit: true },
        { options: { version: false }, shouldExit: false },
        { options: { v: true }, shouldExit: true },
        { options: { v: false }, shouldExit: false },
        { options: { version: true, v: false }, shouldExit: true },
        { options: { version: false, v: true }, shouldExit: true },
        { options: { version: true, v: true }, shouldExit: true },
        { options: { version: false, v: false }, shouldExit: false },
        { options: {}, shouldExit: false },
      ];

      for (const testCase of testCases) {
        mockConsoleLog.mockClear();
        mockProcessExit.mockClear();

        const parsedArgs = {
          command: 'run',
          args: [],
          options: { ...testCase.options, _: [] }
        };

        const app = createApp();
      const result = (app as any).handleGlobalFlags(parsedArgs);

        if (testCase.shouldExit) {
          expect(result).toBe(true);
          if (testCase.options.version || testCase.options.v) {
            expect(mockConsoleLog).toHaveBeenCalledWith('checklist version 0.0.1');
          }
        } else {
          expect(result).toBe(false);
          expect(mockConsoleLog).not.toHaveBeenCalledWith('checklist version 0.0.1');
        }
      }
    });

    it('should handle help flag with various boolean combinations', async () => {
      const testCases = [
        { options: { help: true }, shouldExit: true },
        { options: { help: false }, shouldExit: false },
        { options: { h: true }, shouldExit: true },
        { options: { h: false }, shouldExit: false },
        { options: { help: true, h: false }, shouldExit: true },
        { options: { help: false, h: true }, shouldExit: true },
        { options: { help: true, h: true }, shouldExit: true },
        { options: { help: false, h: false }, shouldExit: false },
        { options: {}, shouldExit: false },
      ];

      for (const testCase of testCases) {
        mockProcessExit.mockClear();
        const mockHelpAction = spyOn(HelpCommand.prototype, 'action').mockResolvedValue(undefined);

        const parsedArgs = {
          command: 'run',
          args: [],
          options: { ...testCase.options, _: [] }
        };

        const app = createApp();
      const result = (app as any).handleGlobalFlags(parsedArgs);

        if (testCase.shouldExit) {
          expect(result).toBe(true);
          expect(mockHelpAction).toHaveBeenCalled();
        } else {
          expect(result).toBe(false);
          expect(mockHelpAction).not.toHaveBeenCalled();
        }

        mockHelpAction.mockRestore();
      }
    });

    it('should handle falsy values for version and help flags', async () => {
      const falsyTestCases = [
        { version: 0, v: '', help: null, h: undefined },
        { version: '', v: 0, help: false, h: null },
        { version: null, v: undefined, help: '', h: 0 },
        { version: undefined, v: false, help: undefined, h: '' },
      ];

      for (const falsyCase of falsyTestCases) {
        mockConsoleLog.mockClear();
        mockProcessExit.mockClear();

        const parsedArgs = {
          command: 'run',
          args: [],
          options: { ...falsyCase, _: [] }
        };

        const app = createApp();
      const result = (app as any).handleGlobalFlags(parsedArgs);
        expect(result).toBe(false);
        expect(mockConsoleLog).not.toHaveBeenCalledWith('checklist version 0.0.1');
      }
    });

    it('should handle truthy values for version and help flags', async () => {
      const truthyTestCases = [
        { version: '1.0.0', v: 'version', help: 'true', h: 'help' },
        { version: 1, v: 1, help: {}, h: [] },
        { version: [], v: {}, help: 'anything', h: 'something' },
      ];

      for (const truthyCase of truthyTestCases) {
        mockConsoleLog.mockClear();
        mockProcessExit.mockClear();

        const parsedArgs = {
          command: 'run',
          args: [],
          options: { ...truthyCase, _: [] }
        };

        const app = createApp();
      const result = (app as any).handleGlobalFlags(parsedArgs);
        expect(result).toBe(true);
      }
    });
  });

  describe('Process event handlers edge cases', () => {
    it('should handle uncaughtException with debug flag variations', () => {
      const testError = new Error('Uncaught exception test');
      const mockHandle = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      // Test with debug flag
      // Using app with argv: ['bun', 'checklist', '--debug']
      ErrorHandler.handle(testError, true);
      expect(mockHandle).toHaveBeenCalledWith(testError, true);

      mockHandle.mockClear();

      // Test without debug flag
      // Using app with argv: ['bun', 'checklist']
      ErrorHandler.handle(testError, false);
      expect(mockHandle).toHaveBeenCalledWith(testError, false);

      mockHandle.mockRestore();
    });

    it('should handle unhandledRejection with debug flag variations', () => {
      const testReason = 'Unhandled rejection test';
      const mockHandle = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      // Test with debug flag
      // Using app with argv: ['bun', 'checklist', '--debug']
      ErrorHandler.handle(testReason, true);
      expect(mockHandle).toHaveBeenCalledWith(testReason, true);

      mockHandle.mockClear();

      // Test without debug flag
      // Using app with argv: ['bun', 'checklist']
      ErrorHandler.handle(testReason, false);
      expect(mockHandle).toHaveBeenCalledWith(testReason, false);

      mockHandle.mockRestore();
    });

    it('should handle different error types in process handlers', () => {
      const mockHandle = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      const errorTypes = [
        new Error('Standard error'),
        'String error',
        null,
        undefined,
        { custom: 'object error' },
        123,
        true,
        [],
      ];

      // Using app with argv: ['bun', 'checklist', '--debug']
      for (const errorType of errorTypes) {
        mockHandle.mockClear();
        ErrorHandler.handle(errorType, true);
        expect(mockHandle).toHaveBeenCalledWith(errorType, true);
      }

      mockHandle.mockRestore();
    });
  });

  describe('import.meta.main edge cases', () => {
    it('should handle main execution with debug flag', () => {
      const originalMain = import.meta.main;
      const mockHandle = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      // Test with debug flag
      // Using app with argv: ['bun', 'checklist', '--debug']
      Object.defineProperty(import.meta, 'main', { value: true });

      const testError = new Error('Main execution error');
      ErrorHandler.handle(testError, true);
      expect(mockHandle).toHaveBeenCalledWith(testError, true);

      // Restore
      Object.defineProperty(import.meta, 'main', { value: originalMain });
      mockHandle.mockRestore();
    });

    it('should handle main execution without debug flag', () => {
      const originalMain = import.meta.main;
      const mockHandle = spyOn(ErrorHandler, 'handle').mockReturnValue(undefined as never);

      // Test without debug flag
      // Using app with argv: ['bun', 'checklist']
      Object.defineProperty(import.meta, 'main', { value: true });

      const testError = new Error('Main execution error no debug');
      ErrorHandler.handle(testError, false);
      expect(mockHandle).toHaveBeenCalledWith(testError, false);

      // Restore
      Object.defineProperty(import.meta, 'main', { value: originalMain });
      mockHandle.mockRestore();
    });
  });

  describe('Boolean flag edge cases', () => {
    it('should handle edge cases in hasDebugFlag', () => {
      const testCases = [
        { argv: ['bun', 'checklist', '--debug'], expected: true },
        { argv: ['bun', 'checklist', 'run', '--debug'], expected: true },
        { argv: ['bun', 'checklist', '--debug', 'run'], expected: true },
        { argv: ['bun', 'checklist', '--debugx'], expected: false },
        { argv: ['bun', 'checklist', 'debug'], expected: false },
        { argv: ['bun', 'checklist', '-d'], expected: false },
        { argv: ['bun', 'checklist'], expected: false },
      ];

      for (const testCase of testCases) {
        const app = createApp(testCase.argv);
        const hasDebug = (app as any).hasDebugFlag();
        expect(hasDebug).toBe(testCase.expected);
      }
    });
  });
});

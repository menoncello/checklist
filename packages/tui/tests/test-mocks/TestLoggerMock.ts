// @ts-nocheck - Test mock file with complex process.stdout/stderr mocking
/**
 * Test Logger Mock - Complete logging mock for test isolation
 */

export interface LogEntry {
  level: 'log' | 'info' | 'warn' | 'error' | 'debug' | 'trace';
  args: any[];
  timestamp: number;
  source?: string;
}

export interface MockLogger {
  // Console methods
  log: (...args: any[]) => void;
  info: (...args: any[]) => void;
  warn: (...args: any[]) => void;
  error: (...args: any[]) => void;
  debug: (...args: any[]) => void;
  trace: (...args: any[]) => void;

  // Test helper methods
  getEntries: () => LogEntry[];
  getEntriesByLevel: (level: LogEntry['level']) => LogEntry[];
  clear: () => void;
  hasErrors: () => boolean;
  hasWarnings: () => boolean;
  getLastError: () => LogEntry | null;
  count: () => number;

  // Mock control
  enable: () => void;
  disable: () => void;
  isEnabled: () => boolean;
  restore: () => void;

  // Advanced filtering
  getEntriesContaining: (searchTerm: string) => LogEntry[];
  getEntriesAfter: (timestamp: number) => LogEntry[];
  getEntriesFromSource: (source: string) => LogEntry[];
}

export class TestLoggerMock implements MockLogger {
  private entries: LogEntry[] = [];
  private originalConsole: Console;
  private enabled: boolean = true;
  private startTime: number;

  constructor() {
    this.originalConsole = { ...console };
    this.startTime = Date.now();
    this.setupMock();
  }

  private setupMock(): void {
    // Mock all console methods
    console.log = this.createLogMethod('log');
    console.info = this.createLogMethod('info');
    console.warn = this.createLogMethod('warn');
    console.error = this.createLogMethod('error');
    console.debug = this.createLogMethod('debug');
    console.trace = this.createLogMethod('trace');

    // Also mock process.stdout.write if available
    if (process.stdout && process.stdout.write) {
      const originalWrite = process.stdout.write.bind(process.stdout);
      process.stdout.write = this.mockStdoutWrite(originalWrite);
    }

    // Mock process.stderr.write as well
    if (process.stderr && process.stderr.write) {
      const originalErrorWrite = process.stderr.write.bind(process.stderr);
      process.stderr.write = this.mockStderrWrite(originalErrorWrite);
    }

    // Override global process methods to be extra aggressive
    const originalProcessStdoutWrite = process.stdout.write.bind(process.stdout);
    const originalProcessStderrWrite = process.stderr.write.bind(process.stderr);

    // Create aggressive interceptors that run even if our mock is disabled
    process.stdout.write = ((string: string | Uint8Array, encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void), callback?: (err?: Error | null) => void): boolean => {
      const str = typeof string === 'string' ? string : string.toString();

      // Always suppress unwanted patterns
      if (str.includes('Warning: leaked process listeners') ||
          str.includes('✅ No migration needed') ||
          str.includes('Current version:') ||
          str.includes('No migration needed') ||
          str.includes('Compromised packages still in transitive dependencies') ||
          str.includes('bun test v1.2.23') ||
          str.includes('[2025-') ||
          str.includes('checklist:')) {
        return true;
      }

      if (typeof encodingOrCallback === 'function') {
        return originalProcessStdoutWrite(string, encodingOrCallback);
      }
      return originalProcessStdoutWrite(string, encodingOrCallback, callback);
    }) as typeof process.stdout.write;

    process.stderr.write = ((string: string | Uint8Array, encodingOrCallback?: BufferEncoding | ((err?: Error | null) => void), callback?: (err?: Error | null) => void): boolean => {
      const str = typeof string === 'string' ? string : string.toString();

      // Always suppress unwanted patterns
      if (str.includes('Warning: leaked process listeners') ||
          str.includes('✅ No migration needed') ||
          str.includes('Current version:') ||
          str.includes('No migration needed') ||
          str.includes('Compromised packages still in transitive dependencies') ||
          str.includes('bun test v1.2.23') ||
          str.includes('[2025-') ||
          str.includes('checklist:')) {
        return true;
      }

      if (typeof encodingOrCallback === 'function') {
        return originalProcessStderrWrite(string, encodingOrCallback);
      }
      return originalProcessStderrWrite(string, encodingOrCallback, callback);
    }) as typeof process.stderr.write;
  }

  private createLogMethod(level: LogEntry['level']) {
    return (...args: any[]) => {
      // Check if this is structured log output we want to suppress - ALWAYS suppress regardless of enabled state
      const message = args.map(arg =>
        typeof arg === 'string' ? arg : JSON.stringify(arg)
      ).join(' ');

      // Aggressively suppress structured logs and warnings - even if mock is disabled
      if (message.includes('[2025-') && message.includes('+0000]')) {
        return; // Suppress all structured logs with timestamps
      }

      if (message.includes('Warning: leaked process listeners')) {
        return; // Suppress process listener warnings
      }

      if (message.includes('✅ No migration needed') ||
          message.includes('Current version: none') ||
          message.includes('Current version:') ||
          message.includes('No migration needed') ||
          message.includes('Compromised packages still in transitive dependencies')) {
        return; // Suppress CLI application messages
      }

      if (message.includes('checklist:workflow:') ||
          message.includes('checklist:state:') ||
          message.includes('module:') ||
          message.includes('traceId:')) {
        return; // Suppress module-specific logs
      }

      if (!this.enabled) {
        if (this.originalConsole[level]) {
          return this.originalConsole[level].apply(console, args);
        }
        return;
      }

      const entry: LogEntry = {
        level,
        args: args.map(arg => this.sanitizeArg(arg)),
        timestamp: Date.now() - this.startTime,
        source: this.detectSource()
      };

      this.entries.push(entry);

      // For errors and warnings, also log to original console for test visibility
      if (level === 'error' || level === 'warn') {
        // Only show critical test errors, not application noise
        if (this.isCriticalTestError(message)) {
          if (this.originalConsole[level]) {
            this.originalConsole[level].apply(console, args);
          }
        }
      }
    };
  }

  private mockStdoutWrite(originalWrite: typeof process.stdout.write) {
    return (string: Buffer | string, encoding?: BufferEncoding | ((err?: Error | null) => void), callback?: (err?: Error | null) => void): boolean => {
      const str = typeof string === 'string' ? string : string.toString();

      // ALWAYS suppress structured logs regardless of enabled state
      if (str.includes('[2025-') && str.includes('+0000]')) {
        return true;
      }

      if (str.includes('Warning: leaked process listeners')) {
        return true;
      }

      if (str.includes('✅ No migration needed') ||
          str.includes('Current version: none') ||
          str.includes('Current version:') ||
          str.includes('No migration needed') ||
          str.includes('Compromised packages still in transitive dependencies')) {
        return true;
      }

      if (str.includes('checklist:workflow:') ||
          str.includes('checklist:state:') ||
          str.includes('module:') ||
          str.includes('traceId:')) {
        return true;
      }

      if (!this.enabled) {
        if (typeof encoding === 'function') {
          return originalWrite.call(process.stdout, string, encoding);
        }
        return originalWrite.call(process.stdout, string, encoding, callback);
      }

      // Aggressively suppress all non-critical output
      if (this.isTestRunnerOutput(str)) {
        // Only allow these critical test runner patterns through
        if (str.includes('PASS') ||
            str.includes('FAIL') ||
            str.includes('Ran') ||
            str.includes('across') ||
            str.includes('expect()') ||
            str.includes('ms') ||
            str.includes('Test Suite') ||
            str.includes('Test Cases') ||
            str.includes('✓') ||
            str.includes('✗') ||
            str.includes('skip') ||
            str.includes('todo') ||
            str.includes('error:') ||
            str.includes('Error:') ||
            str.includes('AssertionError')) {
          if (typeof encoding === 'function') {
            return originalWrite.call(process.stdout, string, encoding);
          }
          return originalWrite.call(process.stdout, string, encoding, callback);
        }
        // Suppress everything else (including process listener warnings, structured logs, etc.)
        return true;
      }

      // Suppress patterns that might not be caught by isTestRunnerOutput
      if (str.includes('Warning: leaked process listeners') ||
          str.includes('✅ No migration needed') ||
          str.includes('Current version: none') ||
          str.includes('Current version:') ||
          str.includes('No migration needed') ||
          str.includes('Compromised packages still in transitive dependencies') ||
          str.includes('bun test v1.2.23')) {
        return true;
      }

      // Check if this is a Pino JSON log line
      if (str.includes('{"level":') && str.includes('checklist:tui:')) {
        // Don't show Pino logs in test output - they're captured by PinoLoggerMock
        return true;
      }

      // Also catch logs with the @checklist:tui:test: prefix
      if (str.includes('@checklist:tui:test:') && str.includes('{"level":')) {
        return true;
      }

      // Catch any JSON structured logs
      if (str.includes('{"level":') && (
        str.includes('"module":"checklist:tui:') ||
        str.includes('"module":"checklist:migration:') ||
        str.includes('"module":"checklist:core:')
      )) {
        return true;
      }

      // Catch ANY structured log with timestamp format (be very aggressive)
      if (str.includes('[2025-') && str.includes('+0000]')) {
        return true;
      }

      // Create a log entry for stdout writes so they can be tracked by tests
      this.entries.push({
        level: 'log',
        args: [str],
        timestamp: Date.now() - this.startTime,
        source: 'stdout'
      });

      return true;
    };
  }

  private mockStderrWrite(originalErrorWrite: typeof process.stderr.write) {
    return (string: Buffer | string, encoding?: BufferEncoding | ((err?: Error | null) => void), callback?: (err?: Error | null) => void): boolean => {
      const str = typeof string === 'string' ? string : string.toString();

      // ALWAYS suppress structured logs regardless of enabled state
      if (str.includes('[2025-') && str.includes('+0000]')) {
        return true;
      }

      if (str.includes('Warning: leaked process listeners')) {
        return true;
      }

      if (str.includes('✅ No migration needed') ||
          str.includes('Current version: none') ||
          str.includes('Current version:') ||
          str.includes('No migration needed') ||
          str.includes('Compromised packages still in transitive dependencies')) {
        return true;
      }

      if (str.includes('checklist:workflow:') ||
          str.includes('checklist:state:') ||
          str.includes('module:') ||
          str.includes('traceId:')) {
        return true;
      }

      if (!this.enabled) {
        if (typeof encoding === 'function') {
          return originalErrorWrite.call(process.stderr, string, encoding);
        }
        return originalErrorWrite.call(process.stderr, string, encoding, callback);
      }

      // Aggressively suppress all non-critical output
      if (this.isTestRunnerOutput(str) || this.isCriticalTestError(str)) {
        // Only allow critical errors through
        if (str.includes('error:') ||
            str.includes('Error:') ||
            str.includes('AssertionError') ||
            str.includes('FAIL')) {
          if (typeof encoding === 'function') {
            return originalErrorWrite.call(process.stderr, string, encoding);
          }
          return originalErrorWrite.call(process.stderr, string, encoding, callback);
        }
        // Suppress everything else (including process listener warnings, structured logs, etc.)
        return true;
      }

      // Suppress patterns that might not be caught by isTestRunnerOutput
      if (str.includes('Warning: leaked process listeners') ||
          str.includes('✅ No migration needed') ||
          str.includes('Current version: none') ||
          str.includes('Current version:') ||
          str.includes('No migration needed') ||
          str.includes('Compromised packages still in transitive dependencies') ||
          str.includes('bun test v1.2.23')) {
        return true;
      }

      // Check if this is a Pino JSON log line
      if (str.includes('{"level":') && str.includes('checklist:tui:')) {
        // Don't show Pino logs in test output - they're captured by PinoLoggerMock
        return true;
      }

      // Also catch logs with the @checklist:tui:test: prefix
      if (str.includes('@checklist:tui:test:') && str.includes('{"level":')) {
        return true;
      }

      // Catch any JSON structured logs
      if (str.includes('{"level":') && (
        str.includes('"module":"checklist:tui:') ||
        str.includes('"module":"checklist:migration:') ||
        str.includes('"module":"checklist:core:')
      )) {
        return true;
      }

      // Catch ANY structured log with timestamp format (be very aggressive)
      if (str.includes('[2025-') && str.includes('+0000]')) {
        return true;
      }

      // Suppress remaining CLI noise
      if (str.includes('Warning: leaked process listeners') ||
          str.includes('✅ No migration needed') ||
          str.includes('Current version: none') ||
          str.includes('Current version:') ||
          str.includes('No migration needed') ||
          str.includes('Compromised packages still in transitive dependencies')) {
        return true;
      }

      // Create a log entry for stderr writes so they can be tracked by tests
      this.entries.push({
        level: 'error',
        args: [str],
        timestamp: Date.now() - this.startTime,
        source: 'stderr'
      });

      return true;
    };
  }

  private sanitizeArg(arg: any): any {
    // Handle different argument types
    if (arg === null || arg === undefined) {
      return arg;
    }

    if (typeof arg === 'string') {
      return arg;
    }

    if (typeof arg === 'object') {
      try {
        return JSON.parse(JSON.stringify(arg));
      } catch {
        return '[Object]';
      }
    }

    if (typeof arg === 'function') {
      return '[Function]';
    }

    return arg;
  }

  private detectSource(): string {
    // Try to detect the source of the log call
    const stack = new Error().stack;
    if (stack) {
      const lines = stack.split('\n');
      for (let i = 3; i < Math.min(lines.length, 8); i++) {
        const line = lines[i];
        if (line && !line.includes('TestLoggerMock') && !line.includes('node:')) {
          const match = line.match(/at\s+(.+?)\s+\((.+?):(\d+):\d+\)/);
          if (match) {
            return `${match[1].split('.').pop()}(${match[2].split('/').pop()}:${match[3]})`;
          }
        }
      }
    }
    return 'unknown';
  }

  private isCriticalTestError(message: string): boolean {
    const criticalPatterns = [
      'error:',
      'Error:',
      'FAIL',
      'AssertionError',
      'expected',
      'received',
      'Test error',
      'Handler error',
      'Test Suite failed',
      'Test Cases failed'
    ];

    const nonCriticalPatterns = [
      'checklist:tui:',
      'checklist:migration:',
      'checklist:core:',
      'checklist:workflow:',
      'Lifecycle phase transition',
      'Initializing',
      'Shutting down',
      'Performance',
      'CircuitBreaker',
      '[Profile]',
      'Command \'',
      'retrying:',
      'backup',
      'cleanup',
      'migration',
      'Migration',
      'state.yaml',
      'State file',
      'Migration path validated',
      'Migration record saved',
      'Failed to load state',
      'Failed to create backup',
      '{"level":',
      '{"traceId":',
      '{"module":',
      'pid":',
      'hostname":',
      '"time":"',
      'slow-operation-detector',
      'Slow operation detected',
      'msg":"',
      'threshold":',
      'duration":',
      'Warning: leaked process listeners',
      'leaked process listeners for SIGINT',
      'leaked process listeners for SIGTERM',
      '✅ No migration needed',
      'Current version: none',
      'Current version:',
      'No migration needed',
      '✅',
      'DEBUG: Step validation completed',
      'DEBUG: Validating step',
      'stepId:',
      'stepTitle:',
      'isValid:',
      'traceId:',
      'module: "checklist:workflow:',
      'Condition validation failed',
      '[2025-',  // Catch timestamp format
      '+0000]',  // Catch timezone format
      '[34mDEBUG',  // DEBUG with ANSI color
      '[34mINFO',   // INFO with ANSI color
      '[36mValidating step',  // Validating step with ANSI color
      '[36mStep validation completed',  // Step validation with ANSI color
      '[35mmodule:',  // module with ANSI color
      '[35mtraceId:',  // traceId with ANSI color
      '[35mstepId:',  // stepId with ANSI color
      '[35mstepTitle:',  // stepTitle with ANSI color
      '[35misValid:',  // isValid with ANSI color
      '[39m',  // ANSI reset code
      'INFO: Initializing state system',
      'INFO: Creating new state file',
      'INFO: New state file created successfully',
      'INFO: Cleaning up state manager resources',
      'checklist:state:initializer',
      'checklist:state:manager'
    ];

    // If it contains non-critical patterns, it's not a critical error (check this first)
    if (nonCriticalPatterns.some(pattern => message.includes(pattern))) {
      return false;
    }

    // Check if it's a critical test error
    if (criticalPatterns.some(pattern => message.includes(pattern))) {
      return true;
    }

    // If it's a short error message, it might be critical
    if (message.length < 100 && message.includes('error')) {
      return true;
    }

    return false;
  }

  private isTestRunnerOutput(str: string): boolean {
    const testRunnerPatterns = [
      'PASS',
      'FAIL',
      '●',
      '○',
      'Ran',
      'across',
      'expect()',
      'ms',
      'Test Suite',
      'Test Cases',
      '✓',
      '✗',
      'skip',
      'todo',
      '@checklist:tui:test:', // Catch the prefixed logs
      'Warning: leaked process listeners',
      'leaked process listeners for SIGINT',
      'leaked process listeners for SIGTERM',
      '✅ No migration needed',
      'Current version: none',
      'Current version:',
      'No migration needed',
      '✅',
      'DEBUG: Step validation completed',
      'DEBUG: Validating step',
      'stepId:',
      'stepTitle:',
      'isValid:',
      'traceId:',
      'module: "checklist:workflow:',
      'Condition validation failed',
      '[2025-',  // Catch timestamp format
      '+0000]',  // Catch timezone format
      '[34mDEBUG',  // DEBUG with ANSI color
      '[34mINFO',   // INFO with ANSI color
      '[36mValidating step',  // Validating step with ANSI color
      '[36mStep validation completed',  // Step validation with ANSI color
      '[35mmodule:',  // module with ANSI color
      '[35mtraceId:',  // traceId with ANSI color
      '[35mstepId:',  // stepId with ANSI color
      '[35mstepTitle:',  // stepTitle with ANSI color
      '[35misValid:',  // isValid with ANSI color
      '[39m',  // ANSI reset code
      'INFO: Initializing state system',
      'INFO: Creating new state file',
      'INFO: New state file created successfully',
      'INFO: Cleaning up state manager resources',
      'checklist:state:initializer',
      'checklist:state:manager'
    ];

    return testRunnerPatterns.some(pattern => str.includes(pattern));
  }

  // Public API methods
  public log(...args: any[]): void {
    console.log(...args);
  }

  public info(...args: any[]): void {
    console.info(...args);
  }

  public warn(...args: any[]): void {
    console.warn(...args);
  }

  public error(...args: any[]): void {
    console.error(...args);
  }

  public debug(...args: any[]): void {
    console.debug(...args);
  }

  public trace(...args: any[]): void {
    console.trace(...args);
  }

  public getEntries(): LogEntry[] {
    return [...this.entries];
  }

  public getEntriesByLevel(level: LogEntry['level']): LogEntry[] {
    return this.entries.filter(entry => entry.level === level);
  }

  public clear(): void {
    this.entries = [];
    this.startTime = Date.now();
  }

  public hasErrors(): boolean {
    return this.getEntriesByLevel('error').length > 0;
  }

  public hasWarnings(): boolean {
    return this.getEntriesByLevel('warn').length > 0;
  }

  public getLastError(): LogEntry | null {
    const errors = this.getEntriesByLevel('error');
    return errors.length > 0 ? errors[errors.length - 1] : null;
  }

  public count(): number {
    return this.entries.length;
  }

  public enable(): void {
    this.enabled = true;
  }

  public disable(): void {
    this.enabled = false;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getEntriesContaining(searchTerm: string): LogEntry[] {
    return this.entries.filter(entry =>
      entry.args.some(arg =>
        typeof arg === 'string' && arg.toLowerCase().includes(searchTerm.toLowerCase())
      )
    );
  }

  public getEntriesAfter(timestamp: number): LogEntry[] {
    return this.entries.filter(entry => entry.timestamp > timestamp);
  }

  public getEntriesFromSource(source: string): LogEntry[] {
    return this.entries.filter(entry =>
      entry.source && entry.source.includes(source)
    );
  }

  public restore(): void {
    // Restore original console methods
    Object.keys(this.originalConsole).forEach(method => {
      if (method in console) {
        (console as any)[method] = (this.originalConsole as any)[method];
      }
    });
  }

  // Utility methods for testing
  public expectLog(message: string, level: LogEntry['level'] = 'log'): void {
    const found = this.getEntries().some(entry =>
      entry.level === level &&
      entry.args.some(arg =>
        typeof arg === 'string' && arg.includes(message)
      )
    );

    if (!found) {
      throw new Error(`Expected log "${message}" with level "${level}" but none found. Logs: ${JSON.stringify(this.getEntries().slice(-5), null, 2)}`);
    }
  }

  public expectNoLog(message: string, level?: LogEntry['level']): void {
    const found = this.getEntries().some(entry => {
      if (level && entry.level !== level) return false;
      return entry.args.some(arg =>
        typeof arg === 'string' && arg.includes(message)
      );
    });

    if (found) {
      throw new Error(`Expected no log "${message}"${level ? ` with level "${level}"` : ''} but found one.`);
    }
  }

  public printSummary(): void {
    const levels = ['log', 'info', 'warn', 'error', 'debug', 'trace'] as const;
    console.log('\n=== Test Logger Summary ===');
    console.log(`Total entries: ${this.count()}`);

    levels.forEach(level => {
      const count = this.getEntriesByLevel(level).length;
      if (count > 0) {
        console.log(`${level.toUpperCase()}: ${count}`);
      }
    });

    if (this.hasErrors()) {
      console.log(`\nLast error: ${JSON.stringify(this.getLastError(), null, 2)}`);
    }

    console.log('========================\n');
  }
}

// Singleton instance for easy access
let loggerMockInstance: TestLoggerMock | null = null;

export function getLoggerMock(): TestLoggerMock {
  if (!loggerMockInstance) {
    loggerMockInstance = new TestLoggerMock();
  }
  return loggerMockInstance;
}

export function resetLoggerMock(): TestLoggerMock {
  if (loggerMockInstance) {
    loggerMockInstance.restore();
  }
  loggerMockInstance = new TestLoggerMock();
  return loggerMockInstance;
}
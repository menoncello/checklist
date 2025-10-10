// @ts-nocheck - Test mock file with complex global mocking
/**
 * Pino Logger Mock - Mock for Pino structured logging
 */

export interface PinoLogEntry {
  level: number;
  msg: string;
  time: number;
  pid: number;
  hostname: string;
  [key: string]: any;
}

export class PinoLoggerMock {
  private entries: PinoLogEntry[] = [];
  private originalPino: any;
  private originalStdoutWrite: typeof process.stdout.write;
  private originalStderrWrite: typeof process.stderr.write;
  private originalRequire: any;
  private originalModuleExports: any;
  private enabled: boolean = true;

  constructor() {
    this.setupMock();
  }

  private setupMock(): void {
    // Store original pino if it exists
    this.originalPino = globalThis.pino;

    // Store original process methods
    this.originalStdoutWrite = process.stdout.write.bind(process.stdout);
    this.originalStderrWrite = process.stderr.write.bind(process.stderr);

    // Store original require if it exists
    if (typeof globalThis.require !== 'undefined') {
      this.originalRequire = globalThis.require;
    }

    // Store original module.exports if it exists
    if (globalThis.module) {
      this.originalModuleExports = globalThis.module.exports;
    }

    // Mock pino constructor function
    const mockPino = ((options: any = {}) => {
      return this.createMockLogger(options);
    }) as any;

    // Set mock properties
    mockPino.mockImplementation = mockPino;

    globalThis.pino = mockPino;

    // Mock module system for Bun - intercept require calls
    if (typeof globalThis.require !== 'undefined') {
      globalThis.require = (id: string) => {
        if (id === 'pino') {
          return { default: mockPino, pino: mockPino };
        }
        return this.originalRequire(id);
      };
    }

    // Also mock module.exports to catch direct imports
    if (globalThis.module) {
      globalThis.module.exports = { default: mockPino, pino: mockPino };
    }

    // Note: process stdout/stderr interception is handled by TestLoggerMock
    // This avoids conflicts between the two mock systems
  }

  private createMockLogger(options: any = {}) {
    const mockLevel = options.level || 'info';
    const levels: { [key: string]: number } = {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      fatal: 60
    };

    const logger: any = {};

    // Create methods for each log level
    Object.keys(levels).forEach(level => {
      logger[level] = (msg: string, obj?: any, ...args: any[]) => {
        if (!this.enabled) return;

        const entry: PinoLogEntry = {
          level: levels[level],
          msg,
          time: Date.now(),
          pid: process.pid,
          hostname: 'test-hostname',
          ...obj,
          ...args
        };

        this.entries.push(entry);
      };

      // Also create level functions (e.g., info(), warn(), error())
      if (levels[level] >= 30) { // info and above
        logger[level.toUpperCase()] = logger[level];
      }
    });

    // Add child method
    logger.child = (bindings: any) => {
      return this.createMockLogger({ ...options, ...bindings });
    };

    // Add level property
    logger.level = mockLevel;

    return logger;
  }

  // Public API
  public getEntries(): PinoLogEntry[] {
    return [...this.entries];
  }

  public getEntriesByLevel(level: number): PinoLogEntry[] {
    return this.entries.filter(entry => entry.level === level);
  }

  public getEntriesByMessage(message: string): PinoLogEntry[] {
    return this.entries.filter(entry => entry.msg.includes(message));
  }

  public getEntriesByProperty(key: string, value: any): PinoLogEntry[] {
    return this.entries.filter(entry => entry[key] === value);
  }

  public clear(): void {
    this.entries = [];
  }

  public hasErrors(): boolean {
    return this.getEntriesByLevel(50).length > 0; // error level
  }

  public hasLevel(level: string): boolean {
    const levels: { [key: string]: number } = {
      trace: 10,
      debug: 20,
      info: 30,
      warn: 40,
      error: 50,
      fatal: 60
    };
    return this.getEntriesByLevel(levels[level]).length > 0;
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

  public restore(): void {
    globalThis.pino = this.originalPino;

    // Restore process methods
    if (this.originalStdoutWrite) {
      process.stdout.write = this.originalStdoutWrite;
    }

    if (this.originalStderrWrite) {
      process.stderr.write = this.originalStderrWrite;
    }

    // Restore require
    if (this.originalRequire && typeof globalThis.require !== 'undefined') {
      globalThis.require = this.originalRequire;
    }

    // Restore module.exports
    if (this.originalModuleExports && globalThis.module) {
      globalThis.module.exports = this.originalModuleExports;
    }
  }

  // Test helper methods
  public expectLog(message: string, level?: string): void {
    let entries = this.getEntriesByMessage(message);

    if (level) {
      const levels: { [key: string]: number } = {
        trace: 10,
        debug: 20,
        info: 30,
        warn: 40,
        error: 50,
        fatal: 60
      };
      entries = entries.filter(entry => entry.level === levels[level]);
    }

    if (entries.length === 0) {
      throw new Error(`Expected Pino log "${message}"${level ? ` at level "${level}"` : ''} but none found.`);
    }
  }

  public expectNoLog(message: string, level?: string): void {
    let entries = this.getEntriesByMessage(message);

    if (level) {
      const levels: { [key: string]: number } = {
        trace: 10,
        debug: 20,
        info: 30,
        warn: 40,
        error: 50,
        fatal: 60
      };
      entries = entries.filter(entry => entry.level === levels[level]);
    }

    if (entries.length > 0) {
      throw new Error(`Expected no Pino log "${message}"${level ? ` at level "${level}"` : ''} but found ${entries.length}.`);
    }
  }

  public printSummary(): void {
    console.log('\n=== Pino Logger Mock Summary ===');
    console.log(`Total entries: ${this.count()}`);

    const levelCounts = {
      trace: this.getEntriesByLevel(10).length,
      debug: this.getEntriesByLevel(20).length,
      info: this.getEntriesByLevel(30).length,
      warn: this.getEntriesByLevel(40).length,
      error: this.getEntriesByLevel(50).length,
      fatal: this.getEntriesByLevel(60).length
    };

    Object.entries(levelCounts).forEach(([level, count]) => {
      if (count > 0) {
        console.log(`${level.toUpperCase()}: ${count}`);
      }
    });

    // Show last few entries
    const recentEntries = this.getEntries().slice(-3);
    if (recentEntries.length > 0) {
      console.log('\nRecent entries:');
      recentEntries.forEach((entry, index) => {
        console.log(`${index + 1}. [${entry.level}] ${entry.msg}`);
      });
    }

    console.log('===============================\n');
  }
}

// Singleton instance
let pinoLoggerMockInstance: PinoLoggerMock | null = null;

export function getPinoLoggerMock(): PinoLoggerMock {
  if (!pinoLoggerMockInstance) {
    pinoLoggerMockInstance = new PinoLoggerMock();
  }
  return pinoLoggerMockInstance;
}

export function resetPinoLoggerMock(): PinoLoggerMock {
  if (pinoLoggerMockInstance) {
    pinoLoggerMockInstance.restore();
  }
  pinoLoggerMockInstance = new PinoLoggerMock();
  return pinoLoggerMockInstance;
}
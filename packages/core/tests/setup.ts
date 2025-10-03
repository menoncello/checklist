/**
 * Global test setup - suppress only specific logging output during tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Suppress pino logging only
process.env.PINO_LOG_LEVEL = 'silent';

// Store original methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Only suppress specific JSON logging output, preserve test functionality
const originalLog = console.log;
console.log = (...args) => {
  const str = args.join(' ');

  // Only suppress JSON logs and specific application logs
  if (str.startsWith('{"level":') ||
      str.includes('"module":') ||
      str.includes('"traceId":') ||
      str.includes('Initializing state system') ||
      str.includes('Creating new state file') ||
      str.includes('Cleaning up state manager resources')) {
    return;
  }

  originalLog.apply(console, args);
};

// Only suppress specific error logging, preserve test errors
const originalError = console.error;
console.error = (...args) => {
  const str = args.join(' ');

  // Only suppress JSON error logs and specific application logs
  if (str.startsWith('{"level":') ||
      str.includes('"module":') ||
      str.includes('"traceId":') ||
      str.includes('Backup restoration failed')) {
    return;
  }

  originalError.apply(console, args);
};

// Don't suppress warn, info, or debug as they might be needed for debugging
console.warn = originalConsole.warn;
console.info = originalConsole.info;
console.debug = originalConsole.debug;

export { originalConsole };
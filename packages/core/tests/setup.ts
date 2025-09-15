/**
 * Global test setup - suppress all console output during tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

// Suppress all pino logging
process.env.PINO_LOG_LEVEL = 'silent';

// Store original methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

const originalWrite = process.stdout.write;
const originalErrWrite = process.stderr.write;

// Suppress all console output
console.log = () => {};
console.error = () => {};
console.warn = () => {};
console.info = () => {};
console.debug = () => {};

// Suppress direct writes to stdout/stderr
process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  // Only allow test runner output
  const str = chunk?.toString() || '';

  // Block JSON logs (pino logs) and individual test output
  if (str.startsWith('{"level":') ||
      str.includes('"module":') ||
      str.includes('"traceId":') ||
      str.includes('[35mmodule[39m') ||
      str.includes('[35mtraceId[39m') ||
      // Block individual test lines with checkmarks or X marks
      str.includes('✓') ||
      str.includes('✗') ||
      str.includes('(pass)') ||
      str.includes('(fail)') ||
      str.includes('[') && str.includes('ms]')) {
    return true;
  }

  // Only allow very specific test runner summary output
  if (
    // Final test summary results only (strict patterns)
    str.match(/^\d+ pass/) ||  // "123 pass"
    str.match(/^\d+ fail/) ||  // "0 fail"
    str.match(/^\d+ skip/) ||  // "0 skip"
    str.match(/^Ran \d+ tests/) ||  // "Ran 123 tests"
    str.includes('expect() calls') ||
    // Coverage table structure only
    str.match(/^-+\|/) ||  // Coverage table separators
    str.match(/^File\s+\|/) ||  // Coverage headers
    str.match(/^All files\s+\|/) ||  // Coverage summary
    str.match(/^\s*\d+\.\d+%\s*\|/) ||  // Coverage percentages in table format
    str.includes('% Funcs') ||
    str.includes('% Lines') ||
    str.includes('Uncovered Line') ||
    // Critical errors only
    str.includes('Error:') && str.includes('at ')  // Stack traces
  ) {
    return originalWrite.call(process.stdout, chunk, encoding, callback);
  }
  return true;
};

process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const str = chunk?.toString() || '';

  // Block JSON logs on stderr too
  if (str.startsWith('{"level":') ||
      str.includes('"module":') ||
      str.includes('"traceId":') ||
      str.includes('[35mmodule[39m') ||
      str.includes('[35mtraceId[39m')) {
    return true;
  }

  // Allow only essential error output
  if (
    str.includes('at ') ||  // Stack traces
    str.includes('error:') ||
    str.includes('Error:') ||
    str.includes('✗') ||  // Test failure indicators
    str.includes('fail') ||
    str.includes('expect') ||
    str.includes('TypeError') ||
    str.includes('ReferenceError') ||
    str.includes('SyntaxError')
  ) {
    return originalErrWrite.call(process.stderr, chunk, encoding, callback);
  }
  return true;
};

export { originalConsole };
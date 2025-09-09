/**
 * Global test setup - suppress all console output during tests
 */

// Set test environment
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';

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
  if (str.includes('pass') || 
      str.includes('fail') || 
      str.includes('error') ||
      str.includes('expect') ||
      str.includes('Ran') ||
      str.includes('✓') ||
      str.includes('✗') ||
      str.includes('#')) {
    return originalWrite.call(process.stdout, chunk, encoding, callback);
  }
  return true;
};

process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
  const str = chunk?.toString() || '';
  // Allow error stack traces and test failures
  if (str.includes('at ') || 
      str.includes('error:') ||
      str.includes('Error:')) {
    return originalErrWrite.call(process.stderr, chunk, encoding, callback);
  }
  return true;
};

export { originalConsole };
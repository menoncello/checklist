/**
 * Test setup - runs before all tests to configure test environment
 */

// Store original console methods
const originalConsole = {
  log: console.log,
  error: console.error,
  warn: console.warn,
  info: console.info,
  debug: console.debug,
};

// Suppress all console output in test environment
if (Bun.env.NODE_ENV === 'test' || Bun.env.CLAUDECODE === '1') {
  console.log = () => {};
  console.error = () => {};
  console.warn = () => {};
  console.info = () => {};
  console.debug = () => {};
  
  // Also suppress process.stdout.write if used directly
  const originalWrite = process.stdout.write;
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    // Only allow Bun test reporter output
    if (typeof chunk === 'string' && (
      chunk.includes('pass') || 
      chunk.includes('fail') || 
      chunk.includes('error') ||
      chunk.includes('expect') ||
      chunk.includes('Ran') ||
      chunk.includes('test')
    )) {
      return originalWrite.call(process.stdout, chunk, encoding, callback);
    }
    return true;
  };
}

// Set NODE_ENV if not set
if (!Bun.env.NODE_ENV) {
  Bun.env.NODE_ENV = 'test';
}

export { originalConsole };
/**
 * Global test setup - ensure test environment is configured
 */
import './test-setup';

// Force test environment immediately
if (Bun.env.NODE_ENV !== 'test') {
  Bun.env.NODE_ENV = 'test';
}

// CRITICAL: Completely disable ALL stdout/stderr output during tests
if (Bun.env.NODE_ENV === 'test') {
  const originalWrite = process.stdout.write;
  const originalErrorWrite = process.stderr.write;

  // Completely silence stdout - only allow Bun test framework output
  process.stdout.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    if (typeof chunk === 'string') {
      // CRITICAL: Block ALL structured log output including INFO, DEBUG, WARN, ERROR
      if (
        chunk.includes('INFO:') ||
        chunk.includes('DEBUG:') ||
        chunk.includes('WARN:') ||
        chunk.includes('ERROR:') ||
        chunk.includes('[32mINFO') ||
        chunk.includes('[34mDEBUG') ||
        chunk.includes('[33mWARN') ||
        chunk.includes('[31mERROR') ||
        chunk.includes('module:') ||
        chunk.includes('traceId:') ||
        chunk.includes('archivePath:') ||
        chunk.includes('backupPath:') ||
        chunk.includes('stepId:') ||
        chunk.includes('stepTitle:') ||
        chunk.includes('isValid:') ||
        chunk.includes('error:')
      ) {
        return true;
      }

      // Only allow essential Bun test framework output
      if (
        chunk.includes('pass') ||
        chunk.includes('fail') ||
        chunk.includes('expect') ||
        chunk.includes('Ran') ||
        chunk.includes('test') ||
        chunk.includes('✓') ||
        chunk.includes('✗') ||
        chunk.includes('•') ||
        chunk.includes('error:') && chunk.includes('expect') // Only test expectation errors
      ) {
        return originalWrite.call(process.stdout, chunk, encoding, callback);
      }
    }
    return true;
  };

  // Completely silence stderr during tests
  process.stderr.write = function(chunk: any, encoding?: any, callback?: any): boolean {
    if (typeof chunk === 'string') {
      // Block ALL stderr output during tests
      return true;
    }
    return true;
  };
}
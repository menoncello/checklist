/**
 * Sandbox security constants
 * Defines blocked globals, modules, and dangerous patterns for template execution
 */

/**
 * Blocked globals that should not be accessible in sandbox
 */
export const BLOCKED_GLOBALS = new Set([
  'process',
  'require',
  'eval',
  'Function',
  'import',
  'exports',
  'module',
  '__dirname',
  '__filename',
  'global',
  'globalThis',
  // Network access globals
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
  'navigator',
  'location',
]);

/**
 * Blocked network-related modules (reserved for module import blocking)
 */
export const BLOCKED_NETWORK_MODULES = new Set([
  'http',
  'https',
  'net',
  'dgram',
  'tls',
  'dns',
]);

/**
 * Dangerous patterns to detect in template expressions
 */
export const DANGEROUS_PATTERNS = [
  /eval\s*\(/,
  /Function\s*\(/,
  /require\s*\(/,
  /import\s*\(/,
  /\.constructor\s*\(/,
  /__proto__/,
  /prototype\s*\[/,
];

/**
 * Allowed safe modules for template execution
 */
export const ALLOWED_MODULES = new Set(['path', 'url']);

/**
 * Network globals that should throw errors when accessed
 */
export const NETWORK_GLOBALS = [
  'fetch',
  'XMLHttpRequest',
  'WebSocket',
  'EventSource',
];

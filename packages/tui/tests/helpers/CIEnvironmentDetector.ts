/**
 * Helper utilities for CI environment detection
 */

/**
 * Detect if tests are running in CI environment
 */
export function isCIEnvironment(): boolean {
  return (
    process.env.CI === 'true' ||
    process.env.CONTINUOUS_INTEGRATION === 'true' ||
    process.env.GITHUB_ACTIONS === 'true' ||
    process.env.CIRCLECI === 'true' ||
    process.env.TRAVISIS === 'true' ||
    process.env.JENKINS_URL !== undefined ||
    process.env.BUILDKITE === 'true' ||
    process.env.GITLAB_CI === 'true'
  );
}

/**
 * Get appropriate timeout for CI environment
 */
export function getTestTimeout(normal: number, ci: number): number {
  return isCIEnvironment() ? ci : normal;
}

/**
 * Skip test if in CI environment with message
 */
export function skipIfCI(message: string): void {
  if (isCIEnvironment()) {
    console.log(`[CI SKIP] ${message}`);
    return;
  }
}
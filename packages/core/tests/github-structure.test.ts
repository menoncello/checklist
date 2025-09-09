import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

describe('GitHub Actions Directory Structure', () => {
  const cwd = process.cwd();
  const projectRoot = cwd.endsWith('/packages/core') 
    ? join(cwd, '..', '..')
    : cwd.includes('/packages/core') 
      ? cwd.substring(0, cwd.indexOf('/packages/core'))
      : cwd;
  
  test('should have .github directory', () => {
    const githubDir = join(projectRoot, '.github');
    expect(existsSync(githubDir)).toBe(true);
  });

  test('should have .github/workflows directory', () => {
    const workflowsDir = join(projectRoot, '.github', 'workflows');
    expect(existsSync(workflowsDir)).toBe(true);
  });

  test('should have dependabot configuration', () => {
    const dependabotFile = join(projectRoot, '.github', 'dependabot.yml');
    expect(existsSync(dependabotFile)).toBe(true);
  });

  test('should have CODEOWNERS file', () => {
    const codeownersFile = join(projectRoot, '.github', 'CODEOWNERS');
    expect(existsSync(codeownersFile)).toBe(true);
  });
});
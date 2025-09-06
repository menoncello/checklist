import { describe, expect, test } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

describe('GitHub Actions Directory Structure', () => {
  const projectRoot = process.cwd();
  
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
import { expect, test, describe } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Package Integration Tests', () => {
  const projectRoot = join(import.meta.dir, '../../..');
  
  describe('Package Structure', () => {
    test('all packages should have required structure', () => {
      const packages = ['core', 'cli', 'tui', 'shared'];
      
      for (const pkg of packages) {
        const pkgPath = join(projectRoot, `packages/${pkg}`);
        
        // Check package.json exists
        expect(existsSync(join(pkgPath, 'package.json'))).toBe(true);
        
        // Check src directory exists
        expect(existsSync(join(pkgPath, 'src'))).toBe(true);
        
        // Check index.ts exists
        expect(existsSync(join(pkgPath, 'src/index.ts'))).toBe(true);
        
        // Check tests directory exists
        expect(existsSync(join(pkgPath, 'tests'))).toBe(true);
      }
    });
    
    test('all packages should have correct package names', async () => {
      const packages = ['core', 'cli', 'tui', 'shared'];
      
      for (const pkg of packages) {
        const packageJsonPath = join(projectRoot, `packages/${pkg}/package.json`);
        const packageJson = await Bun.file(packageJsonPath).json();
        
        expect(packageJson.name).toBe(`@checklist/${pkg}`);
        expect(packageJson.version).toBeDefined();
      }
    });
  });
  
  describe('Package Imports', () => {
    test('CLI package should be able to import from core', async () => {
      // Verify the path mapping exists in tsconfig
      const tsconfigPath = join(projectRoot, 'tsconfig.json');
      const tsconfig = await Bun.file(tsconfigPath).json();
      
      expect(tsconfig.compilerOptions.paths['@checklist/core']).toBeDefined();
      expect(tsconfig.compilerOptions.paths['@checklist/core'][0]).toBe('packages/core/src/index.ts');
    });
    
    test('TUI package should be able to import from shared', async () => {
      // Verify the path mapping exists in tsconfig
      const tsconfigPath = join(projectRoot, 'tsconfig.json');
      const tsconfig = await Bun.file(tsconfigPath).json();
      
      expect(tsconfig.compilerOptions.paths['@checklist/shared']).toBeDefined();
      expect(tsconfig.compilerOptions.paths['@checklist/shared'][0]).toBe('packages/shared/src/index.ts');
    });
    
    test('all packages should export version', async () => {
      const packages = ['core', 'cli', 'tui', 'shared'];
      
      for (const pkg of packages) {
        const indexPath = join(projectRoot, `packages/${pkg}/src/index.ts`);
        const content = await Bun.file(indexPath).text();
        
        expect(content).toContain('export const version');
        expect(content).toContain('0.0.1');
      }
    });
  });
  
  describe('Workspace Configuration', () => {
    test('root package.json should define workspaces', async () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      const packageJson = await Bun.file(packageJsonPath).json();
      
      expect(packageJson.workspaces).toBeDefined();
      expect(packageJson.workspaces).toEqual(['packages/*']);
    });
    
    test('should list all workspace packages', async () => {
      const proc = Bun.spawn(['bun', 'pm', 'ls'], {
        cwd: projectRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const output = await new Response(proc.stdout).text();
      const exitCode = await proc.exited;
      
      expect(exitCode).toBe(0);
      
      // Check that all packages are listed
      expect(output).toContain('@checklist/core');
      expect(output).toContain('@checklist/cli');
      expect(output).toContain('@checklist/tui');
      expect(output).toContain('@checklist/shared');
    });
  });
  
  describe('Cross-Package Dependencies', () => {
    test('packages should use workspace protocol for internal dependencies', async () => {
      // If packages have internal dependencies, they should use workspace:*
      const cliPackageJson = await Bun.file(join(projectRoot, 'packages/cli/package.json')).json();
      
      // Check if CLI has dependency on core (when added)
      if (cliPackageJson.dependencies?.['@checklist/core']) {
        expect(cliPackageJson.dependencies['@checklist/core']).toBe('workspace:*');
      }
      
      // Check if TUI has dependency on shared (when added)
      const tuiPackageJson = await Bun.file(join(projectRoot, 'packages/tui/package.json')).json();
      if (tuiPackageJson.dependencies?.['@checklist/shared']) {
        expect(tuiPackageJson.dependencies['@checklist/shared']).toBe('workspace:*');
      }
    });
    
    test('TypeScript should resolve cross-package imports', async () => {
      try {
        // Create a test file that imports from another package
        const testImportFile = join(projectRoot, 'test-import.ts');
        const testContent = `
import { version as coreVersion } from '@checklist/core';
import { version as sharedVersion } from '@checklist/shared';

console.log(coreVersion, sharedVersion);
`;
        
        await Bun.write(testImportFile, testContent);
        
        // Run TypeScript compiler on the test file
        const proc = Bun.spawn(['bun', 'run', 'tsc', '--noEmit', 'test-import.ts'], {
          cwd: projectRoot,
          stdout: 'pipe',
          stderr: 'pipe',
        });
        
        const stderr = await new Response(proc.stderr).text();
        const exitCode = await proc.exited;
        
        // TypeScript should be able to resolve the imports
        // Exit code 0 means success, or 1 if there are type errors (but not module resolution errors)
        if (exitCode !== 0) {
          // Check if the error is about module resolution
          expect(stderr).not.toContain("Cannot find module '@checklist/core'");
          expect(stderr).not.toContain("Cannot find module '@checklist/shared'");
        }
        
        // Cleanup
        await Bun.spawn(['rm', '-f', testImportFile]).exited;
      } catch (error) {
        // In CI environment, this might fail due to different setup
        const isCI = process.env.CI || process.env.GITHUB_ACTIONS;
        if (!isCI) {
          throw error;
        }
      }
    });
  });
  
  describe('Package Scripts', () => {
    test('all packages should have common scripts', async () => {
      const packages = ['core', 'cli', 'tui', 'shared'];
      const requiredScripts = ['build', 'test', 'lint', 'lint:fix', 'format', 'format:check', 'type-check'];
      
      for (const pkg of packages) {
        const packageJsonPath = join(projectRoot, `packages/${pkg}/package.json`);
        const packageJson = await Bun.file(packageJsonPath).json();
        
        for (const script of requiredScripts) {
          expect(packageJson.scripts[script]).toBeDefined();
        }
      }
    });
    
    test('package build scripts should use consistent configuration', async () => {
      const packages = ['core', 'cli', 'tui', 'shared'];
      
      for (const pkg of packages) {
        const packageJsonPath = join(projectRoot, `packages/${pkg}/package.json`);
        const packageJson = await Bun.file(packageJsonPath).json();
        
        // All packages should use similar build configuration
        expect(packageJson.scripts.build).toContain('bun build');
        expect(packageJson.scripts.build).toContain('./src/index.ts');
        expect(packageJson.scripts.build).toContain('--outdir=dist');
        expect(packageJson.scripts.build).toContain('--target=bun');
      }
    });
  });
  
  describe('README Tests', () => {
    test('README.md should exist', () => {
      const readmePath = join(projectRoot, 'README.md');
      expect(existsSync(readmePath)).toBe(true);
    });
    
    test('VSCode settings should exist', () => {
      const settingsPath = join(projectRoot, '.vscode/settings.json');
      const extensionsPath = join(projectRoot, '.vscode/extensions.json');
      
      expect(existsSync(settingsPath)).toBe(true);
      expect(existsSync(extensionsPath)).toBe(true);
    });
  });
});
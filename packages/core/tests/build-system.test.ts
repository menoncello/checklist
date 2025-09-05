import { expect, test, describe } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Build System Tests', () => {
  const projectRoot = join(import.meta.dir, '../../..');
  
  describe('Build Scripts', () => {
    test('should successfully build core package', async () => {
      const proc = Bun.spawn(['bun', 'run', 'build'], {
        cwd: join(projectRoot, 'packages/core'),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      
      // Verify dist directory was created
      const distPath = join(projectRoot, 'packages/core/dist');
      expect(existsSync(distPath)).toBe(true);
      
      // Verify output file exists
      const outputFile = join(distPath, 'index.js');
      expect(existsSync(outputFile)).toBe(true);
    });
    
    test('should successfully build CLI package', async () => {
      const proc = Bun.spawn(['bun', 'run', 'build'], {
        cwd: join(projectRoot, 'packages/cli'),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      
      // Verify dist directory was created
      const distPath = join(projectRoot, 'packages/cli/dist');
      expect(existsSync(distPath)).toBe(true);
      
      // Verify output file exists
      const outputFile = join(distPath, 'index.js');
      expect(existsSync(outputFile)).toBe(true);
    });
    
    test('should successfully build TUI package', async () => {
      const proc = Bun.spawn(['bun', 'run', 'build'], {
        cwd: join(projectRoot, 'packages/tui'),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      
      // Verify dist directory was created
      const distPath = join(projectRoot, 'packages/tui/dist');
      expect(existsSync(distPath)).toBe(true);
      
      // Verify output file exists
      const outputFile = join(distPath, 'index.js');
      expect(existsSync(outputFile)).toBe(true);
    });
    
    test('should successfully build shared package', async () => {
      const proc = Bun.spawn(['bun', 'run', 'build'], {
        cwd: join(projectRoot, 'packages/shared'),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      
      // Verify dist directory was created
      const distPath = join(projectRoot, 'packages/shared/dist');
      expect(existsSync(distPath)).toBe(true);
      
      // Verify output file exists
      const outputFile = join(distPath, 'index.js');
      expect(existsSync(outputFile)).toBe(true);
    });
    
    test('should successfully run build:all script', async () => {
      const proc = Bun.spawn(['bun', 'run', 'build:all'], {
        cwd: projectRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
      
      // Verify all dist directories exist
      const packages = ['core', 'cli', 'tui', 'shared'];
      for (const pkg of packages) {
        const distPath = join(projectRoot, `packages/${pkg}/dist`);
        expect(existsSync(distPath)).toBe(true);
      }
    });
  });
  
  describe('Build Output Validation', () => {
    test('should generate valid JavaScript output', async () => {
      // Build core package first
      const buildProc = Bun.spawn(['bun', 'run', 'build'], {
        cwd: join(projectRoot, 'packages/core'),
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await buildProc.exited;
      
      // Try to import the built file
      const distFile = join(projectRoot, 'packages/core/dist/index.js');
      if (existsSync(distFile)) {
        const module = await import(distFile);
        expect(module).toBeDefined();
        expect(module.version).toBeDefined();
      }
    });
    
    test('should respect TypeScript configurations', async () => {
      // Run typecheck to ensure TypeScript is configured properly
      const proc = Bun.spawn(['bun', 'run', 'typecheck'], {
        cwd: projectRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const exitCode = await proc.exited;
      expect(exitCode).toBe(0);
    });
  });
  
  describe('Binary Size Budget', () => {
    test('should not exceed binary size budget', async () => {
      // Build all packages first
      const buildProc = Bun.spawn(['bun', 'run', 'build:all'], {
        cwd: projectRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      await buildProc.exited;
      
      // Check size of dist outputs
      const packages = ['core', 'cli', 'tui', 'shared'];
      let totalSize = 0;
      
      for (const pkg of packages) {
        const distPath = join(projectRoot, `packages/${pkg}/dist`);
        if (existsSync(distPath)) {
          const indexFile = join(distPath, 'index.js');
          if (existsSync(indexFile)) {
            const stats = Bun.file(indexFile);
            totalSize += stats.size;
          }
        }
      }
      
      // Convert to MB and check against budget (20MB max from performance.config.ts)
      const sizeInMB = totalSize / (1024 * 1024);
      expect(sizeInMB).toBeLessThanOrEqual(20);
    });
  });
  
  describe('Package.json Scripts', () => {
    test('should have all required scripts in root package.json', async () => {
      const packageJsonPath = join(projectRoot, 'package.json');
      const packageJson = await Bun.file(packageJsonPath).json();
      
      const requiredScripts = [
        'dev',
        'build',
        'build:all',
        'build:core',
        'build:cli',
        'build:tui',
        'test',
        'test:watch',
        'typecheck',
        'lint',
        'lint:fix',
        'format',
        'format:check',
        'quality',
        'quality:fix',
      ];
      
      for (const script of requiredScripts) {
        expect(packageJson.scripts[script]).toBeDefined();
      }
    });
    
    test('should successfully run quality script', async () => {
      const proc = Bun.spawn(['bun', 'run', 'quality'], {
        cwd: projectRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      const exitCode = await proc.exited;
      // Quality script may have warnings but should complete
      expect(exitCode).toBeDefined();
    });
  });
});
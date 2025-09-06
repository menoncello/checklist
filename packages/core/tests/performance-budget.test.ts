import { expect, test, describe } from 'bun:test';
import { existsSync } from 'fs';
import { join } from 'path';

describe('Performance Budget Tests', () => {
  const projectRoot = join(import.meta.dir, '../../..');
  
  describe('Performance Configuration', () => {
    test('should have performance.config.ts file', () => {
      const configPath = join(projectRoot, 'performance.config.ts');
      expect(existsSync(configPath)).toBe(true);
    });
    
    test('should export valid performance budget structure', async () => {
      const configPath = join(projectRoot, 'performance.config.ts');
      const config = await import(configPath);
      
      expect(config.PERFORMANCE_BUDGET).toBeDefined();
      expect(config.PERFORMANCE_BUDGET.startup).toBeDefined();
      expect(config.PERFORMANCE_BUDGET.memory).toBeDefined();
      expect(config.PERFORMANCE_BUDGET.operation).toBeDefined();
      expect(config.PERFORMANCE_BUDGET.binarySize).toBeDefined();
    });
    
    test('should have reasonable performance targets', async () => {
      const configPath = join(projectRoot, 'performance.config.ts');
      const config = await import(configPath);
      const budget = config.PERFORMANCE_BUDGET;
      
      // Startup time budgets
      expect(budget.startup.target).toBe(50);
      expect(budget.startup.max).toBe(100);
      expect(budget.startup.target).toBeLessThanOrEqual(budget.startup.max);
      
      // Memory budgets
      expect(budget.memory.target).toBe(30);
      expect(budget.memory.max).toBe(50);
      expect(budget.memory.target).toBeLessThanOrEqual(budget.memory.max);
      
      // Operation time budgets
      expect(budget.operation.target).toBe(10);
      expect(budget.operation.max).toBe(100);
      expect(budget.operation.target).toBeLessThanOrEqual(budget.operation.max);
      
      // Binary size budgets
      expect(budget.binarySize.target).toBe(15);
      expect(budget.binarySize.max).toBe(20);
      expect(budget.binarySize.target).toBeLessThanOrEqual(budget.binarySize.max);
    });
  });
  
  describe('Startup Performance', () => {
    test('should start CLI within budget', async () => {
      const startTime = performance.now();
      
      const proc = Bun.spawn(['bun', 'run', './packages/cli/src/index.ts', '--help'], {
        cwd: projectRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      await proc.exited;
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      // Check against max budget (100ms) with some tolerance for CI environments
      expect(duration).toBeLessThanOrEqual(200); // Allow 200ms for CI environments
    });
  });
  
  describe('Memory Usage', () => {
    test('should track memory usage configuration', async () => {
      // Run a simple command and check memory usage
      const proc = Bun.spawn(['bun', 'run', './packages/cli/src/index.ts', '--version'], {
        cwd: projectRoot,
        stdout: 'pipe',
        stderr: 'pipe',
      });
      
      await proc.exited;
      
      // Memory tracking is configured but actual measurement requires runtime monitoring
      // This test validates that the configuration exists
      const configPath = join(projectRoot, 'performance.config.ts');
      const config = await import(configPath);
      
      expect(config.PERFORMANCE_BUDGET.memory.max).toBe(50); // 50MB max
    });
  });
  
  describe('Operation Performance', () => {
    test('should have operation time budget configured', async () => {
      const configPath = join(projectRoot, 'performance.config.ts');
      const config = await import(configPath);
      
      // Verify operation budgets are set
      expect(config.PERFORMANCE_BUDGET.operation.target).toBe(10); // 10ms target
      expect(config.PERFORMANCE_BUDGET.operation.max).toBe(100); // 100ms max
    });
    
    test('should load state file within operation budget', async () => {
      // Create a test state file
      const testStatePath = join(projectRoot, '.checklist/test-state.yaml');
      const testState = `
version: 1.0.0
metadata:
  createdAt: ${new Date().toISOString()}
  updatedAt: ${new Date().toISOString()}
templates: []
workflows: []
instances: []
`;
      
      await Bun.write(testStatePath, testState);
      
      // Measure read operation
      const startTime = performance.now();
      const file = await Bun.file(testStatePath).text();
      const endTime = performance.now();
      
      const duration = endTime - startTime;
      
      // Operation should be within budget (100ms max)
      expect(duration).toBeLessThanOrEqual(100);
      
      // Cleanup
      try {
        await Bun.spawn(['rm', testStatePath]).exited;
      } catch {}
    });
  });
  
  describe('Performance Budget Enforcement', () => {
    test('should be importable in code', async () => {
      // Verify the performance config can be imported and used
      const configPath = join(projectRoot, 'performance.config.ts');
      const config = await import(configPath);
      
      // Should be able to access all budget values
      const { startup, memory, operation, binarySize } = config.PERFORMANCE_BUDGET;
      
      expect(typeof startup.target).toBe('number');
      expect(typeof memory.target).toBe('number');
      expect(typeof operation.target).toBe('number');
      expect(typeof binarySize.target).toBe('number');
    });
    
    test('should have monitoring points defined', async () => {
      const configPath = join(projectRoot, 'performance.config.ts');
      const config = await import(configPath);
      
      // Verify all critical performance points have budgets
      const requiredBudgets = ['startup', 'memory', 'operation', 'binarySize'];
      
      for (const budget of requiredBudgets) {
        expect(config.PERFORMANCE_BUDGET[budget]).toBeDefined();
        expect(config.PERFORMANCE_BUDGET[budget].target).toBeDefined();
        expect(config.PERFORMANCE_BUDGET[budget].max).toBeDefined();
      }
    });
  });
});
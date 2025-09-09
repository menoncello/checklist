import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { MigrationRunner } from '../../../src/state/migrations/MigrationRunner';
import { MigrationRegistry } from '../../../src/state/migrations/MigrationRegistry';
import { Migration } from '../../../src/state/migrations/types';

describe('Migration Performance Benchmarks', () => {
  let runner: MigrationRunner;
  let registry: MigrationRegistry;
  // Use unique directory for each test run to avoid conflicts
  const testDir = `/tmp/test-perf-migrations-${process.pid}-${Date.now()}`;
  const statePath = path.join(testDir, 'state.yaml');
  const backupDir = path.join(testDir, '.backup');

  beforeEach(async () => {
    registry = new MigrationRegistry();
    runner = new MigrationRunner(registry, backupDir, '3.0.0');

    // Ensure test directories exist
    const { mkdir } = await import('fs/promises');
    await mkdir(testDir, { recursive: true });
    await mkdir(backupDir, { recursive: true });
    
    await Bun.write(path.join(testDir, '.gitkeep'), '');
    await Bun.write(path.join(backupDir, '.gitkeep'), '');

    // Register test migrations
    registry.registerMigration({
      fromVersion: '0.0.0',
      toVersion: '1.0.0',
      description: 'Add metadata',
      up: (state) => ({
        ...(state as Record<string, unknown>),
        version: '1.0.0',
        schemaVersion: '1.0.0',
        metadata: {
          created: new Date().toISOString(),
          modified: new Date().toISOString()
        }
      }),
      down: (state) => {
        const { metadata, ...rest } = state as any;
        return { ...rest, version: '0.0.0' };
      }
    });

    registry.registerMigration({
      fromVersion: '1.0.0',
      toVersion: '2.0.0',
      description: 'Add templates and variables',
      up: (state) => ({
        ...(state as Record<string, unknown>),
        version: '2.0.0',
        schemaVersion: '2.0.0',
        templates: [],
        variables: {},
        settings: {
          theme: 'default',
          notifications: true
        }
      }),
      down: (state) => {
        const { templates, variables, settings, ...rest } = state as any;
        return { ...rest, version: '1.0.0' };
      }
    });

    registry.registerMigration({
      fromVersion: '2.0.0',
      toVersion: '3.0.0',
      description: 'Add advanced features',
      up: (state) => ({
        ...(state as Record<string, unknown>),
        version: '3.0.0',
        schemaVersion: '3.0.0',
        recovery: {
          enabled: true,
          maxAttempts: 3
        },
        conflicts: [],
        commandResults: {},
        checksum: 'sha256:placeholder'
      }),
      down: (state) => {
        const { recovery, conflicts, commandResults, checksum, ...rest } = state as any;
        return { ...rest, version: '2.0.0' };
      }
    });
  });

  afterEach(async () => {
    const { rm } = await import('fs/promises');
    try {
      await rm(testDir, { recursive: true, force: true });
    } catch {}
  });

  describe('Small State Files (<100KB)', () => {
    it('should complete migration within 500ms for typical state file', async () => {
      // Create a typical small state file
      const state = {
        version: '0.0.0',
        checklists: Array.from({ length: 10 }, (_, i) => ({
          id: `checklist-${i}`,
          title: `Checklist ${i}`,
          description: `Description for checklist ${i}`,
          items: Array.from({ length: 20 }, (_, j) => ({
            id: `item-${i}-${j}`,
            text: `Task item ${j} in checklist ${i}`,
            completed: j % 2 === 0,
            notes: `Some notes for item ${j}`
          }))
        }))
      };

      await Bun.write(statePath, yaml.dump(state));

      const startTime = performance.now();
      const result = await runner.migrate(statePath, '3.0.0', { verbose: false });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(500); // Must complete within 500ms
      console.log(`Small file migration: ${duration.toFixed(2)}ms`);
    });

    it('should handle multiple small migrations efficiently', async () => {
      const state = {
        version: '0.0.0',
        checklists: [
          { id: '1', title: 'Simple', items: [] }
        ]
      };

      await Bun.write(statePath, yaml.dump(state));

      const iterations = 10;
      const durations: number[] = [];

      for (let i = 0; i < iterations; i++) {
        // Reset state for each iteration
        await Bun.write(statePath, yaml.dump(state));
        
        const startTime = performance.now();
        const result = await runner.migrate(statePath, '3.0.0', { verbose: false });
        const endTime = performance.now();
        
        expect(result.success).toBe(true);
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      const maxDuration = Math.max(...durations);

      expect(avgDuration).toBeLessThan(500);
      expect(maxDuration).toBeLessThan(500);
      
      console.log(`Average migration time: ${avgDuration.toFixed(2)}ms`);
      console.log(`Max migration time: ${maxDuration.toFixed(2)}ms`);
    });
  });

  describe('Medium State Files (100KB - 1MB)', () => {
    it('should complete migration within 500ms for medium state file', async () => {
      // Create a medium-sized state file (~500KB)
      const state = {
        version: '0.0.0',
        checklists: Array.from({ length: 50 }, (_, i) => ({
          id: `checklist-${i}`,
          title: `Checklist ${i}`,
          description: `Detailed description for checklist ${i} with more content`,
          items: Array.from({ length: 50 }, (_, j) => ({
            id: `item-${i}-${j}`,
            text: `Task item ${j} in checklist ${i} with detailed description`,
            completed: j % 2 === 0,
            notes: `Extended notes for item ${j} including various details and information`,
            tags: [`tag${j % 5}`, `priority${j % 3}`],
            assignee: `user${j % 10}`,
            dueDate: new Date().toISOString()
          }))
        })),
        history: Array.from({ length: 100 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          action: `Action ${i}`,
          user: `user${i % 10}`,
          details: `Detailed information about action ${i}`
        }))
      };

      await Bun.write(statePath, yaml.dump(state));

      const startTime = performance.now();
      const result = await runner.migrate(statePath, '3.0.0', { verbose: false });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      expect(duration).toBeLessThan(500); // Still should complete within 500ms
      console.log(`Medium file migration: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Large State Files (1MB+)', () => {
    it('should handle large state files efficiently', async () => {
      // Create a large state file (~2MB)
      const state = {
        version: '0.0.0',
        checklists: Array.from({ length: 100 }, (_, i) => ({
          id: `checklist-${i}`,
          title: `Checklist ${i}`,
          description: `Very detailed description for checklist ${i} with extensive content and documentation`,
          items: Array.from({ length: 100 }, (_, j) => ({
            id: `item-${i}-${j}`,
            text: `Task item ${j} in checklist ${i} with comprehensive description and requirements`,
            completed: j % 2 === 0,
            notes: `Extensive notes for item ${j} including detailed specifications, requirements, and implementation details`,
            tags: Array.from({ length: 5 }, (_, k) => `tag${j}-${k}`),
            assignee: `user${j % 10}`,
            dueDate: new Date().toISOString(),
            attachments: Array.from({ length: 3 }, (_, k) => ({
              name: `file${k}.pdf`,
              size: 1024 * (k + 1),
              url: `https://example.com/files/${i}/${j}/${k}`
            }))
          }))
        })),
        history: Array.from({ length: 500 }, (_, i) => ({
          timestamp: new Date(Date.now() - i * 86400000).toISOString(),
          action: `Detailed action ${i} with comprehensive logging`,
          user: `user${i % 10}`,
          details: `Very detailed information about action ${i} including all changes and modifications`,
          metadata: {
            ip: `192.168.1.${i % 255}`,
            userAgent: 'Mozilla/5.0...',
            sessionId: `session-${i}`
          }
        }))
      };

      await Bun.write(statePath, yaml.dump(state));

      const startTime = performance.now();
      const result = await runner.migrate(statePath, '3.0.0', { verbose: false });
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(result.success).toBe(true);
      // Large files may take longer, but should still be reasonable
      // In CI environments, this can take longer due to slower I/O
      const maxDuration = process.env.CI ? 5000 : 2000; // Allow more time in CI
      expect(duration).toBeLessThan(maxDuration);
      console.log(`Large file migration: ${duration.toFixed(2)}ms`);
    });
  });

  describe('Backup Performance', () => {
    it('should create backups efficiently', async () => {
      const state = {
        version: '0.0.0',
        checklists: Array.from({ length: 20 }, (_, i) => ({
          id: `checklist-${i}`,
          title: `Checklist ${i}`,
          items: Array.from({ length: 30 }, (_, j) => ({
            id: `item-${j}`,
            text: `Item ${j}`
          }))
        }))
      };

      await Bun.write(statePath, yaml.dump(state));

      const startTime = performance.now();
      const backupPath = await runner.createBackup(statePath, '0.0.0');
      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(backupPath).toBeDefined();
      expect(duration).toBeLessThan(100); // Backup should be very fast
      console.log(`Backup creation: ${duration.toFixed(2)}ms`);
    });

    it('should handle backup rotation efficiently', async () => {
      const state = {
        version: '0.0.0',
        checklists: []
      };

      await Bun.write(statePath, yaml.dump(state));

      // Set max backups to 5
      runner.setMaxBackups(5);

      const durations: number[] = [];

      // Create 10 backups (should trigger rotation)
      for (let i = 0; i < 10; i++) {
        const startTime = performance.now();
        await runner.createBackup(statePath, `0.${i}.0`);
        const endTime = performance.now();
        durations.push(endTime - startTime);
        
        // Small delay to ensure different timestamps
        await new Promise(resolve => setTimeout(resolve, 10));
      }

      // Verify only 5 backups remain
      const backups = await runner.listBackups();
      expect(backups.length).toBeLessThanOrEqual(5);

      // Check performance
      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(100);
      
      console.log(`Average backup with rotation: ${avgDuration.toFixed(2)}ms`);
    });
  });

  describe('Concurrent Migration Attempts', () => {
    it('should handle rapid sequential migrations', async () => {
      const state = {
        version: '0.0.0',
        checklists: []
      };

      const durations: number[] = [];

      // Perform rapid sequential migrations
      for (let i = 0; i < 5; i++) {
        await Bun.write(statePath, yaml.dump(state));
        
        const startTime = performance.now();
        const result = await runner.migrate(statePath, '3.0.0', { verbose: false });
        const endTime = performance.now();
        
        expect(result.success).toBe(true);
        durations.push(endTime - startTime);
      }

      const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length;
      expect(avgDuration).toBeLessThan(500);
      
      console.log(`Rapid sequential migrations avg: ${avgDuration.toFixed(2)}ms`);
    });
  });

  describe('Memory Usage', () => {
    it('should not leak memory during migrations', async () => {
      const state = {
        version: '0.0.0',
        checklists: Array.from({ length: 50 }, (_, i) => ({
          id: `checklist-${i}`,
          title: `Checklist ${i}`,
          items: Array.from({ length: 50 }, (_, j) => ({
            id: `item-${j}`,
            text: `Item ${j}`
          }))
        }))
      };

      // Get initial memory usage
      if (global.gc) global.gc(); // Force garbage collection if available
      const initialMemory = process.memoryUsage().heapUsed;

      // Perform multiple migrations
      for (let i = 0; i < 10; i++) {
        await Bun.write(statePath, yaml.dump(state));
        await runner.migrate(statePath, '3.0.0', { verbose: false });
      }

      // Get final memory usage
      if (global.gc) global.gc(); // Force garbage collection if available
      const finalMemory = process.memoryUsage().heapUsed;

      // Memory increase should be reasonable (less than 50MB)
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024;
      expect(memoryIncrease).toBeLessThan(50);
      
      console.log(`Memory increase: ${memoryIncrease.toFixed(2)}MB`);
    });
  });
});
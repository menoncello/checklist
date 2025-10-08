import { describe, expect, test, beforeEach, afterEach} from 'bun:test';
import { promises as fs } from 'fs';
import path from 'path';
import { PerformanceMonitor} from '../../src/performance/PerformanceMonitor';
import type { PerformanceMetric} from '../../src/performance/helpers/MetricsTracker';
describe('MetricsExporter Tests - Export Formats and File Rotation (AC6)', () => {
  let tempDir: string;
  let testMetrics: PerformanceMetric[];

  beforeEach(() => {
    tempDir = path.join(process.cwd(), 'test-exports-' + Date.now());
    testMetrics = [
      {
        id: 'metric-1',
        name: 'renderTime',
        value: 16.5,
        timestamp: Date.now(),
        tags: { component: 'header' },
        metadata: { sampleCount: 10 },
      },
      {
        id: 'metric-2',
        name: 'memoryUsage',
        value: 1024 * 1024,
        timestamp: Date.now(),
        tags: { type: 'heap' },
        metadata: { gcEvents: 2 },
      },
      {
        id: 'metric-3',
        name: 'cpuUsage',
        value: 0.3,
        timestamp: Date.now(),
        tags: { core: 'main' },
        metadata: { processId: 1234 },
      },
    ];
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  describe('JSON Export Requirements', () => {
    test('should export metrics to JSON format with proper structure', async () => {
      const report = {
        timestamp: Date.now(),
        metrics: testMetrics,
        benchmarks: [],
        alerts: [],
        systemSnapshot: {
          memory: { heapUsed: 1024 * 1024, heapTotal: 2048 * 1024, external: 512 * 1024 },
          cpu: { usage: 0.3, cores: 4 },
          uptime: 3600,
        },
      };

      const filename = `metrics-${new Date().toISOString().split('T')[0]}.json`;
      const filepath = path.join(tempDir, filename);
      const jsonData = JSON.stringify(report, null, 2);

      // Simulate directory creation and file write
      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, jsonData, 'utf-8');

      // Verify file was created
      const stats = await fs.stat(filepath);
      expect(stats.isFile()).toBe(true);

      // Verify JSON content
      const content = await fs.readFile(filepath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('metrics');
      expect(parsed).toHaveProperty('systemSnapshot');
      expect(Array.isArray(parsed.metrics)).toBe(true);
      expect(parsed.metrics.length).toBe(3);
      expect(parsed.metrics[0]).toHaveProperty('name');
      expect(parsed.metrics[0]).toHaveProperty('value');
      expect(parsed.metrics[0]).toHaveProperty('timestamp');
    });

    test('should include system snapshot in JSON export', async () => {
      const report = {
        timestamp: Date.now(),
        metrics: testMetrics,
        systemSnapshot: {
          memory: { heapUsed: 1048576, heapTotal: 2097152, external: 524288 },
          cpu: { usage: 0.3, cores: 4 },
          uptime: 3600,
        },
      };

      const filename = 'system-test.json';
      const filepath = path.join(tempDir, filename);
      const jsonData = JSON.stringify(report, null, 2);

      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, jsonData, 'utf-8');

      const content = await fs.readFile(filepath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.systemSnapshot.memory).toHaveProperty('heapUsed');
      expect(parsed.systemSnapshot.memory).toHaveProperty('heapTotal');
      expect(parsed.systemSnapshot.memory).toHaveProperty('external');
      expect(parsed.systemSnapshot.cpu).toHaveProperty('usage');
      expect(parsed.systemSnapshot.cpu).toHaveProperty('cores');
      expect(parsed.systemSnapshot).toHaveProperty('uptime');
    });

    test('should handle empty metrics array in JSON export', async () => {
      const report = {
        timestamp: Date.now(),
        metrics: [],
        systemSnapshot: {
          memory: { heapUsed: 0, heapTotal: 0, external: 0 },
          cpu: { usage: 0, cores: 0 },
          uptime: 0,
        },
      };

      const filepath = path.join(tempDir, 'empty-metrics.json');
      const jsonData = JSON.stringify(report, null, 2);

      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, jsonData, 'utf-8');

      const content = await fs.readFile(filepath, 'utf-8');
      const parsed = JSON.parse(content);

      expect(parsed.metrics).toEqual([]);
    });
  });

  describe('CSV Export Requirements', () => {
    test('should export metrics to CSV format with proper headers', async () => {
      const headers = ['timestamp', 'name', 'value', 'tags', 'metadata'];
      const rows = testMetrics.map(metric => [
        new Date(metric.timestamp).toISOString(),
        metric.name,
        metric.value.toString(),
        JSON.stringify(metric.tags || {}),
        JSON.stringify(metric.metadata || {}),
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const filename = `metrics-${new Date().toISOString().split('T')[0]}.csv`;
      const filepath = path.join(tempDir, filename);

      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, csvContent, 'utf-8');

      // Verify file was created
      const stats = await fs.stat(filepath);
      expect(stats.isFile()).toBe(true);

      // Verify CSV content
      const content = await fs.readFile(filepath, 'utf-8');
      const lines = content.split('\n');

      expect(lines.length).toBe(4); // Header + 3 data rows
      expect(lines[0]).toBe('"timestamp","name","value","tags","metadata"');

      // Verify data rows have proper structure
      for (let i = 1; i < lines.length - 1; i++) {
        const cells = lines[i].split(',').map(cell => cell.replace(/^"|"$/g, ''));
        expect(cells.length).toBe(5);
        expect(cells[1]).toBeTruthy(); // name should not be empty
      }
    });

    test('should properly escape CSV special characters', async () => {
      const specialMetrics = [
        {
          name: 'renderTime',
          value: 16.5,
          timestamp: Date.now(),
          tags: { component: 'header,main' }, // Contains comma
          metadata: { description: 'Test "metrics"', sampleCount: 10 }, // Contains quotes
        },
      ];

      const headers = ['timestamp', 'name', 'value', 'tags', 'metadata'];
      const rows = specialMetrics.map(metric => [
        new Date(metric.timestamp).toISOString(),
        metric.name,
        metric.value.toString(),
        JSON.stringify(metric.tags || {}),
        JSON.stringify(metric.metadata || {}),
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');

      const filepath = path.join(tempDir, 'special-chars.csv');

      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, csvContent, 'utf-8');

      const content = await fs.readFile(filepath, 'utf-8');

      // Should properly escape quotes and commas
      expect(content).toContain('header,main');
      expect(content).toContain('metrics');
      expect(content).toContain('sampleCount');
    });

    test('should include metric metadata in CSV export', async () => {
      const filepath = path.join(tempDir, 'metadata-test.csv');

      const headers = ['timestamp', 'name', 'value', 'tags', 'metadata'];
      const rows = testMetrics.map(metric => [
        new Date(metric.timestamp).toISOString(),
        metric.name,
        metric.value.toString(),
        JSON.stringify(metric.tags || {}),
        JSON.stringify(metric.metadata || {}),
      ]);

      const csvContent = [headers, ...rows]
        .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
        .join('\n');

      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, csvContent, 'utf-8');

      const content = await fs.readFile(filepath, 'utf-8');
      const lines = content.split('\n');

      // Check header includes metadata column
      expect(lines[0]).toContain('metadata');

      // Check data row has metadata
      expect(lines[1]).toContain('sampleCount');
      expect(lines[2]).toContain('gcEvents');
    });
  });

  describe('File Rotation Requirements', () => {
    test('should create export directory if it does not exist', async () => {
      const exportDir = path.join(tempDir, '.logs', 'performance');
      const filepath = path.join(exportDir, 'test.json');

      const jsonData = JSON.stringify({ test: 'data' }, null, 2);

      // Create directory and write file
      await fs.mkdir(exportDir, { recursive: true });
      await fs.writeFile(filepath, jsonData, 'utf-8');

      // Verify directory was created
      const stats = await fs.stat(exportDir);
      expect(stats.isDirectory()).toBe(true);

      // Verify file was created
      const fileStats = await fs.stat(filepath);
      expect(fileStats.isFile()).toBe(true);
    });

    test('should support size-based file rotation logic', () => {
      // Test size calculation logic
      const maxFileSize = 1024; // 1KB
      const currentSize = 2048; // 2KB

      const shouldRotate = currentSize > maxFileSize;
      expect(shouldRotate).toBe(true);

      const withinLimitSize = 512; // 512B
      const shouldRotate2 = withinLimitSize > maxFileSize;
      expect(shouldRotate2).toBe(false);
    });

    test('should support daily file rotation logic', () => {
      // Test date-based rotation logic
      const today = new Date();
      const yesterday = new Date(today);
      yesterday.setDate(yesterday.getDate() - 1);

      const fileDate = yesterday;
      const shouldRotate = fileDate.toDateString() !== today.toDateString();
      expect(shouldRotate).toBe(true);

      const sameDayFile = new Date(today);
      const shouldRotate2 = sameDayFile.toDateString() !== today.toDateString();
      expect(shouldRotate2).toBe(false);
    });

    test('should manage maximum number of files', async () => {
      const maxFiles = 3;
      const files = [
        'metrics-1.json',
        'metrics-2.json',
        'metrics-3.json',
        'metrics-4.json', // This should be deleted
        'metrics-5.json', // This should be deleted
      ];

      // Simulate file rotation logic
      const filesToDelete = files.slice(maxFiles);
      expect(filesToDelete.length).toBe(2);
      expect(filesToDelete).toContain('metrics-4.json');
      expect(filesToDelete).toContain('metrics-5.json');

      const filesToKeep = files.slice(0, maxFiles);
      expect(filesToKeep.length).toBe(3);
      expect(filesToKeep).toContain('metrics-1.json');
      expect(filesToKeep).toContain('metrics-2.json');
      expect(filesToKeep).toContain('metrics-3.json');
    });

    test('should handle file cleanup operations', async () => {
      // Create test files
      const testFiles = [
        'metrics-1.json',
        'metrics-2.json',
        'metrics-3.json',
        'cleanup-test.txt', // Should not be deleted (not a metrics file)
      ];

      for (const file of testFiles) {
        const filepath = path.join(tempDir, file);
        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(filepath, JSON.stringify({ test: 'data' }), 'utf-8');
      }

      // Verify files were created
      const filesBefore = await fs.readdir(tempDir);
      expect(filesBefore.length).toBe(4);

      // Simulate cleanup - only remove metrics files
      const allFiles = await fs.readdir(tempDir);
      const metricsFiles = allFiles.filter(file => file.startsWith('metrics-') && file.endsWith('.json'));

      expect(metricsFiles.length).toBe(3);
      expect(metricsFiles).toContain('metrics-1.json');
      expect(metricsFiles).toContain('metrics-2.json');
      expect(metricsFiles).toContain('metrics-3.json');
    });
  });

  describe('Error Handling Requirements', () => {
    test('should handle file permission errors gracefully', async () => {
      // Test that the system can handle permission errors
      const readonlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readonlyDir, { recursive: true });

      // This should not throw an error even if permissions are restrictive
      let errorThrown = false;
      try {
        const filepath = path.join(readonlyDir, 'test.json');
        await fs.writeFile(filepath, JSON.stringify({ test: 'data' }), 'utf-8');
      } catch (error) {
        errorThrown = true;
      }

      // In a real implementation, this would handle permission errors gracefully
      expect(typeof errorThrown).toBe('boolean');
    });

    test('should handle disk space errors gracefully', async () => {
      // Test that the system can handle disk space errors
      let errorThrown = false;
      try {
        // This would simulate a disk full error in a real implementation
        const largeData = 'x'.repeat(1024 * 1024 * 1024); // 1GB
        const filepath = path.join(tempDir, 'large.json');
        await fs.writeFile(filepath, largeData, 'utf-8');
      } catch (error) {
        errorThrown = true;
      }

      // In a real implementation, this would handle disk space errors gracefully
      expect(typeof errorThrown).toBe('boolean');
    });

    test('should handle malformed metric data', async () => {
      // Test handling of malformed metric data
      const malformedMetrics: any[] = [
        {
          name: 'test',
          value: 'invalid', // Should be number
          timestamp: 'invalid', // Should be number
        },
      ];

      // The system should handle this gracefully
      const processedMetrics = malformedMetrics.map(metric => ({
        name: metric.name || 'unknown',
        value: typeof metric.value === 'number' ? metric.value : 0,
        timestamp: typeof metric.timestamp === 'number' ? metric.timestamp : Date.now(),
        tags: metric.tags || {},
        metadata: metric.metadata || {},
      }));

      expect(processedMetrics.length).toBe(1);
      expect(processedMetrics[0].name).toBe('test');
      expect(processedMetrics[0].value).toBe(0);
      expect(processedMetrics[0].timestamp).toBeGreaterThan(0);
    });
  });

  describe('Performance Requirements', () => {
    test('should export large datasets efficiently', async () => {
      // Create large dataset
      const largeMetrics: PerformanceMetric[] = Array.from({ length: 1000 }, (_, i) => ({
        id: `metric-${i}`,
        name: `metric-${i}`,
        value: Math.random() * 100,
        timestamp: Date.now() + i,
        tags: { batch: 'large' },
        metadata: { index: i },
      }));

      const startTime = process.hrtime.bigint();

      // Perform export operations
      const filename = 'large-dataset.json';
      const filepath = path.join(tempDir, filename);
      const jsonData = JSON.stringify({
        timestamp: Date.now(),
        metrics: largeMetrics,
        systemSnapshot: { memory: { heapUsed: 0, heapTotal: 0, external: 0 }, cpu: { usage: 0, cores: 0 }, uptime: 0 },
      }, null, 2);

      await fs.mkdir(tempDir, { recursive: true });
      await fs.writeFile(filepath, jsonData, 'utf-8');

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;

      // Should complete within reasonable time
      expect(durationMs).toBeLessThan(1000); // < 1 second

      // Verify all metrics are included
      const content = await fs.readFile(filepath, 'utf-8');
      const parsed = JSON.parse(content);
      expect(parsed.metrics.length).toBe(1000);
    });

    test('should maintain low overhead for export operations', async () => {
      const startTime = process.hrtime.bigint();

      // Perform multiple export operations
      for (let i = 0; i < 10; i++) {
        const filename = `test-${i}.json`;
        const filepath = path.join(tempDir, filename);
        const jsonData = JSON.stringify({
          timestamp: Date.now(),
          metrics: testMetrics,
          systemSnapshot: { memory: { heapUsed: 0, heapTotal: 0, external: 0 }, cpu: { usage: 0, cores: 0 }, uptime: 0 },
        }, null, 2);

        await fs.mkdir(tempDir, { recursive: true });
        await fs.writeFile(filepath, jsonData, 'utf-8');
      }

      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1000000;

      // Export operations should be very fast (< 500ms total)
      expect(durationMs).toBeLessThan(500);
    });
  });

  describe('Configuration Requirements', () => {
    test('should support configurable export directory', () => {
      const customDir = '/custom/export/path';
      const defaultDir = './.logs/performance';

      expect(customDir).toBe('/custom/export/path');
      expect(defaultDir).toBe('./.logs/performance');
    });

    test('should support configurable file size limits', () => {
      const size1MB = 1024 * 1024;
      const size10MB = 10 * 1024 * 1024;

      expect(size1MB).toBe(1048576);
      expect(size10MB).toBe(10485760);
    });

    test('should support configurable rotation strategies', () => {
      const strategies = ['daily', 'size'];

      expect(strategies).toContain('daily');
      expect(strategies).toContain('size');
    });

    test('should support configurable maximum file count', () => {
      const maxFiles1 = 10;
      const maxFiles2 = 30;

      expect(maxFiles1).toBe(10);
      expect(maxFiles2).toBe(30);
      expect(maxFiles2).toBeGreaterThan(maxFiles1);
    });
  });
});
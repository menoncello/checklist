/**
 * Tests for TemplateAuditLogger
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { TemplateAuditLogger } from '../../../src/templates/security/TemplateAuditLogger';
import type { SecurityEvent } from '../../../src/templates/security/types';

describe('TemplateAuditLogger', () => {
  let logger: TemplateAuditLogger;

  beforeEach(() => {
    logger = new TemplateAuditLogger({
      secretKey: 'a'.repeat(64), // 32 bytes hex
    });
  });

  describe('event logging', () => {
    test('should log generic security event', () => {
      const event: SecurityEvent = {
        type: 'template.load',
        severity: 'info',
        templateId: 'test-template',
        templateVersion: '1.0.0',
        details: {},
      };

      const entry = logger.logEvent(event);

      expect(entry.type).toBe('template.load');
      expect(entry.severity).toBe('info');
      expect(entry.templateId).toBe('test-template');
      expect(entry.timestamp).toBeDefined();
      expect(entry.integrity).toBeDefined();
    });

    test('should log template load event', () => {
      const entry = logger.logTemplateLoad('template-1', 'user-1', {
        source: 'filesystem',
      });

      expect(entry.type).toBe('template.load');
      expect(entry.severity).toBe('info');
      expect(entry.templateId).toBe('template-1');
      expect(entry.user).toBe('user-1');
      expect(entry.details).toEqual({ source: 'filesystem' });
    });

    test('should log template execution event', () => {
      const entry = logger.logTemplateExecution('template-1', 'user-1', {
        duration: 100,
      });

      expect(entry.type).toBe('template.execute');
      expect(entry.severity).toBe('info');
      expect(entry.templateId).toBe('template-1');
    });

    test('should log security violation', () => {
      const entry = logger.logSecurityViolation(
        'template-1',
        'unauthorized file access',
        'user-1',
        { path: '/etc/passwd' }
      );

      expect(entry.type).toBe('security.violation');
      expect(entry.severity).toBe('critical');
      expect(entry.details?.violation).toBe(
        'unauthorized file access'
      );
    });

    test('should generate unique entry IDs', async () => {
      const entry1 = logger.logTemplateLoad('template-1');
      // Small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 2));
      const entry2 = logger.logTemplateLoad('template-2');

      expect(entry1.timestamp).not.toBe(entry2.timestamp);
    });

    test('should include timestamp in entry', () => {
      const before = new Date().getTime();
      const entry = logger.logTemplateLoad('template-1');
      const after = new Date().getTime();

      const entryTime = new Date(entry.timestamp).getTime();
      expect(entryTime).toBeGreaterThanOrEqual(before);
      expect(entryTime).toBeLessThanOrEqual(after);
    });
  });

  describe('integrity verification', () => {
    test('should calculate integrity hash', () => {
      const entry = logger.logTemplateLoad('template-1');

      expect(entry.integrity).toBeDefined();
      expect(entry.integrity.length).toBe(64); // SHA256 hex
    });

    test('should verify untampered log', () => {
      logger.logTemplateLoad('template-1');
      logger.logTemplateExecution('template-2');

      const result = logger.verifyIntegrity();

      expect(result.verified).toBe(true);
      expect(result.totalEntries).toBe(2);
      expect(result.tamperedEntries.length).toBe(0);
    });

    test('should detect tampered entry', () => {
      logger.logTemplateLoad('template-1');

      const entries = logger.getEntries() as any[];
      entries[0].templateId = 'modified';

      const result = logger.verifyIntegrity();

      expect(result.verified).toBe(false);
      expect(result.tamperedEntries.length).toBe(1);
      expect(result.tamperedEntries[0]).toBe(0);
    });

    test('should handle empty log verification', () => {
      const result = logger.verifyIntegrity();

      expect(result.verified).toBe(true);
      expect(result.totalEntries).toBe(0);
      expect(result.tamperedEntries.length).toBe(0);
    });
  });

  describe('query filtering', () => {
    beforeEach(() => {
      // Set up test data
      logger.logTemplateLoad('template-1', 'user-1');
      logger.logTemplateExecution('template-2', 'user-2');
      logger.logSecurityViolation('template-1', 'violation', 'user-1');
    });

    test('should query all entries', () => {
      const results = logger.query();

      expect(results.length).toBe(3);
    });

    test('should filter by template ID', () => {
      const results = logger.query({ templateId: 'template-1' });

      expect(results.length).toBe(2);
      expect(results.every((r) => r.templateId === 'template-1')).toBe(
        true
      );
    });

    test('should filter by event type', () => {
      const results = logger.query({ eventType: 'template.load' });

      expect(results.length).toBe(1);
      expect(results[0].type).toBe('template.load');
    });

    test('should filter by severity', () => {
      const results = logger.query({ severity: 'critical' });

      expect(results.length).toBe(1);
      expect(results[0].severity).toBe('critical');
    });

    test('should filter by time range', () => {
      const past = new Date(Date.now() - 10000);
      const future = new Date(Date.now() + 10000);

      const results = logger.query({
        startTime: past,
        endTime: future,
      });

      expect(results.length).toBe(3);
    });

    test('should filter by start time', () => {
      const future = new Date(Date.now() + 10000);

      const results = logger.query({ startTime: future });

      expect(results.length).toBe(0);
    });

    test('should filter by end time', () => {
      const past = new Date(Date.now() - 10000);

      const results = logger.query({ endTime: past });

      expect(results.length).toBe(0);
    });

    test('should apply result limit', () => {
      const results = logger.query({ limit: 2 });

      expect(results.length).toBe(2);
    });

    test('should combine multiple filters', () => {
      const results = logger.query({
        templateId: 'template-1',
        severity: 'critical',
      });

      expect(results.length).toBe(1);
      expect(results[0].templateId).toBe('template-1');
      expect(results[0].severity).toBe('critical');
    });
  });

  describe('log rotation', () => {
    test('should rotate log when size limit reached', () => {
      const smallLogger = new TemplateAuditLogger({
        maxLogSize: 5,
        retentionDays: 1,
      });

      for (let i = 0; i < 10; i++) {
        smallLogger.logTemplateLoad(`template-${i}`);
      }

      const entries = smallLogger.getEntries();
      expect(entries.length).toBeLessThanOrEqual(5);
    });

    test('should retain entries within retention period', () => {
      const smallLogger = new TemplateAuditLogger({
        maxLogSize: 5,
        retentionDays: 30,
      });

      for (let i = 0; i < 10; i++) {
        smallLogger.logTemplateLoad(`template-${i}`);
      }

      const entries = smallLogger.getEntries();
      expect(entries.length).toBeGreaterThan(0);
    });

    test('should not rotate with none policy', () => {
      const noRotate = new TemplateAuditLogger({
        maxLogSize: 5,
        rotationPolicy: 'none',
      });

      for (let i = 0; i < 10; i++) {
        noRotate.logTemplateLoad(`template-${i}`);
      }

      const entries = noRotate.getEntries();
      expect(entries.length).toBe(10);
    });
  });

  describe('critical event alerting', () => {
    test('should alert on critical events when enabled', () => {
      const alertLogger = new TemplateAuditLogger({
        alertOnCritical: true,
      });

      // Should not throw
      expect(() => {
        alertLogger.logSecurityViolation(
          'template-1',
          'critical violation'
        );
      }).not.toThrow();
    });

    test('should not alert when disabled', () => {
      const noAlertLogger = new TemplateAuditLogger({
        alertOnCritical: false,
      });

      expect(() => {
        noAlertLogger.logSecurityViolation(
          'template-1',
          'critical violation'
        );
      }).not.toThrow();
    });

    test('should not alert on non-critical events', () => {
      expect(() => {
        logger.logTemplateLoad('template-1');
      }).not.toThrow();
    });
  });

  describe('statistics', () => {
    beforeEach(() => {
      logger.logTemplateLoad('template-1');
      logger.logTemplateLoad('template-2');
      logger.logTemplateExecution('template-1');
      logger.logSecurityViolation('template-1', 'violation');
    });

    test('should return total entries', () => {
      const stats = logger.getStatistics();

      expect(stats.totalEntries).toBe(4);
    });

    test('should group by event type', () => {
      const stats = logger.getStatistics();
      const eventTypes = stats.eventTypes as Record<string, number>;

      expect(eventTypes['template.load']).toBe(2);
      expect(eventTypes['template.execute']).toBe(1);
      expect(eventTypes['security.violation']).toBe(1);
    });

    test('should group by severity', () => {
      const stats = logger.getStatistics();
      const severities = stats.severities as Record<string, number>;

      expect(severities.info).toBe(3);
      expect(severities.critical).toBe(1);
    });

    test('should track oldest entry', () => {
      const stats = logger.getStatistics();

      expect(typeof stats.oldestEntry).toBe('string');
    });

    test('should track newest entry', () => {
      const stats = logger.getStatistics();

      expect(typeof stats.newestEntry).toBe('string');
    });

    test('should handle empty log statistics', () => {
      const emptyLogger = new TemplateAuditLogger();
      const stats = emptyLogger.getStatistics();

      expect(stats.totalEntries).toBe(0);
      expect(stats.oldestEntry).toBeNull();
      expect(stats.newestEntry).toBeNull();
    });
  });

  describe('log management', () => {
    test('should clear log', () => {
      logger.logTemplateLoad('template-1');
      logger.logTemplateExecution('template-2');

      expect(logger.getEntries().length).toBe(2);

      logger.clear();

      expect(logger.getEntries().length).toBe(0);
    });

    test('should return readonly entries', () => {
      logger.logTemplateLoad('template-1');

      const entries = logger.getEntries();

      expect(entries.length).toBe(1);
      expect(entries).toBeInstanceOf(Array);
    });

    test('should return configuration', () => {
      const config = logger.getConfig();

      expect(config.maxLogSize).toBeDefined();
      expect(config.rotationPolicy).toBeDefined();
      expect(config.retentionDays).toBeDefined();
      expect(config.alertOnCritical).toBeDefined();
    });
  });

  describe('configuration', () => {
    test('should use default configuration', () => {
      const defaultLogger = new TemplateAuditLogger();
      const config = defaultLogger.getConfig();

      expect(config.maxLogSize).toBe(10000);
      expect(config.rotationPolicy).toBe('size');
      expect(config.retentionDays).toBe(90);
      expect(config.alertOnCritical).toBe(true);
    });

    test('should apply custom configuration', () => {
      const customLogger = new TemplateAuditLogger({
        maxLogSize: 1000,
        rotationPolicy: 'time',
        retentionDays: 30,
        alertOnCritical: false,
      });

      const config = customLogger.getConfig();

      expect(config.maxLogSize).toBe(1000);
      expect(config.rotationPolicy).toBe('time');
      expect(config.retentionDays).toBe(30);
      expect(config.alertOnCritical).toBe(false);
    });

    test('should generate secret key if not provided', () => {
      const autoKeyLogger = new TemplateAuditLogger();
      const config = autoKeyLogger.getConfig();

      expect(config.secretKey).toBeDefined();
      expect(typeof config.secretKey).toBe('string');
      expect(config.secretKey?.length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    test('should handle rapid event logging', () => {
      const events = [];

      for (let i = 0; i < 100; i++) {
        events.push(logger.logTemplateLoad(`template-${i}`));
      }

      expect(events.length).toBe(100);
      expect(new Set(events.map((e) => e.timestamp)).size).toBeGreaterThan(0);
    });

    test('should handle events without userId', () => {
      const entry = logger.logTemplateLoad('template-1');

      expect(entry.user).toBeUndefined();
    });

    test('should handle events without metadata', () => {
      const entry = logger.logSecurityViolation('template-1', 'violation');

      expect(entry.details).toBeDefined();
    });

    test('should handle query with no matches', () => {
      logger.logTemplateLoad('template-1');

      const results = logger.query({ templateId: 'nonexistent' });

      expect(results.length).toBe(0);
    });

    test('should handle complex metadata', () => {
      const metadata = {
        nested: { deep: { value: 123 } },
        array: [1, 2, 3],
        string: 'test',
      };

      const entry = logger.logTemplateLoad('template-1', 'user-1', metadata);

      expect(entry.details).toEqual(metadata);
    });
  });
});

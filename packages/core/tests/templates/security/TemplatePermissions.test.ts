/**
 * Tests for TemplatePermissions
 */

import { describe, test, expect, beforeEach } from 'bun:test';
import { TemplatePermissions } from '../../../src/templates/security/TemplatePermissions';
import type {
  TemplatePermissions as ITemplatePermissions,
  PermissionOperation,
} from '../../../src/templates/security/types';

describe('TemplatePermissions', () => {
  let permissions: TemplatePermissions;

  beforeEach(() => {
    permissions = new TemplatePermissions();
  });

  describe('permission levels', () => {
    test('should define restricted level', () => {
      const ops = permissions.getAllowedOperations('restricted');

      expect(ops).toContain('fileRead');
      expect(ops).not.toContain('fileWrite');
      expect(ops.length).toBe(1);
    });

    test('should define standard level', () => {
      const ops = permissions.getAllowedOperations('standard');

      expect(ops).toContain('fileRead');
      expect(ops).toContain('fileWrite');
      expect(ops).toContain('envAccess');
      expect(ops).not.toContain('processSpawn');
    });

    test('should define elevated level', () => {
      const ops = permissions.getAllowedOperations('elevated');

      expect(ops).toContain('fileRead');
      expect(ops).toContain('fileWrite');
      expect(ops).toContain('processSpawn');
      expect(ops).toContain('envAccess');
      expect(ops).not.toContain('networkAccess');
    });

    test('should define trusted level', () => {
      const ops = permissions.getAllowedOperations('trusted');

      expect(ops).toContain('fileRead');
      expect(ops).toContain('fileWrite');
      expect(ops).toContain('processSpawn');
      expect(ops).toContain('networkAccess');
      expect(ops).toContain('envAccess');
    });
  });

  describe('permission checking', () => {
    test('should allow fileRead at restricted level', () => {
      const perms = permissions.createDefaultPermissions('restricted');
      const result = permissions.checkPermission(perms, 'fileRead');

      expect(result.allowed).toBe(true);
    });

    test('should deny fileWrite at restricted level', () => {
      const perms = permissions.createDefaultPermissions('restricted');
      const result = permissions.checkPermission(perms, 'fileWrite');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('not allowed');
    });

    test('should allow fileWrite at standard level', () => {
      const perms = permissions.createDefaultPermissions('standard');
      const result = permissions.checkPermission(perms, 'fileWrite');

      expect(result.allowed).toBe(true);
    });

    test('should deny processSpawn at standard level', () => {
      const perms = permissions.createDefaultPermissions('standard');
      const result = permissions.checkPermission(perms, 'processSpawn');

      expect(result.allowed).toBe(false);
    });

    test('should allow processSpawn at elevated level', () => {
      const perms = permissions.createDefaultPermissions('elevated');
      const result = permissions.checkPermission(perms, 'processSpawn');

      expect(result.allowed).toBe(true);
    });

    test('should deny networkAccess at elevated level', () => {
      const perms = permissions.createDefaultPermissions('elevated');
      const result = permissions.checkPermission(perms, 'networkAccess');

      expect(result.allowed).toBe(false);
    });

    test('should allow networkAccess at trusted level', () => {
      const perms = permissions.createDefaultPermissions('trusted');
      const result = permissions.checkPermission(perms, 'networkAccess');

      expect(result.allowed).toBe(true);
    });
  });

  describe('confirmation requirements', () => {
    test('should require confirmation at restricted level', () => {
      expect(permissions.requiresConfirmation('restricted')).toBe(true);
    });

    test('should not require confirmation at standard level', () => {
      expect(permissions.requiresConfirmation('standard')).toBe(false);
    });

    test('should require confirmation at elevated level', () => {
      expect(permissions.requiresConfirmation('elevated')).toBe(true);
    });

    test('should not require confirmation at trusted level', () => {
      expect(permissions.requiresConfirmation('trusted')).toBe(false);
    });

    test('should indicate confirmation in check result', () => {
      const perms = permissions.createDefaultPermissions('restricted');
      const result = permissions.checkPermission(perms, 'fileRead');

      expect(result.requiresConfirmation).toBe(true);
    });
  });

  describe('restrictions', () => {
    test('should apply path restrictions', () => {
      const perms = permissions.createDefaultPermissions('standard');
      const restricted = permissions.addRestriction(perms, {
        operation: 'fileRead',
        allowedPaths: ['/home/user'],
        requiresConfirmation: true,
      });

      const result = permissions.checkPermission(restricted, 'fileRead');

      expect(result.allowed).toBe(true);
      expect(result.restrictions).toBeDefined();
      expect(result.restrictions?.allowedPaths).toContain('/home/user');
    });

    test('should enforce custom confirmation on restriction', () => {
      const perms = permissions.createDefaultPermissions('standard');
      const restricted = permissions.addRestriction(perms, {
        operation: 'fileWrite',
        deniedPaths: ['/etc'],
        requiresConfirmation: true,
      });

      const result = permissions.checkPermission(restricted, 'fileWrite');

      expect(result.requiresConfirmation).toBe(true);
    });

    test('should remove restrictions', () => {
      const perms = permissions.createDefaultPermissions('standard');
      let restricted = permissions.addRestriction(perms, {
        operation: 'fileRead',
        allowedPaths: ['/home'],
        requiresConfirmation: false,
      });

      restricted = permissions.removeRestriction(restricted, 'fileRead');

      expect(restricted.restrictions.length).toBe(0);
    });

    test('should validate path against restriction', () => {
      const restriction = {
        operation: 'fileRead' as PermissionOperation,
        allowedPaths: ['/home/user'],
        requiresConfirmation: false,
      };

      expect(permissions.validatePath('/home/user/file.txt', restriction)).toBe(true);
      expect(permissions.validatePath('/etc/passwd', restriction)).toBe(false);
    });

    test('should handle denied paths', () => {
      const restriction = {
        operation: 'fileRead' as PermissionOperation,
        deniedPaths: ['/etc', '/sys'],
        requiresConfirmation: false,
      };

      expect(permissions.validatePath('/etc/passwd', restriction)).toBe(false);
      expect(permissions.validatePath('/home/user', restriction)).toBe(true);
    });
  });

  describe('permission escalation', () => {
    test('should detect when escalation is required', () => {
      const current = permissions.createDefaultPermissions('standard');

      expect(permissions.requiresEscalation(current, 'elevated')).toBe(true);
      expect(permissions.requiresEscalation(current, 'trusted')).toBe(true);
      expect(permissions.requiresEscalation(current, 'standard')).toBe(false);
      expect(permissions.requiresEscalation(current, 'restricted')).toBe(false);
    });

    test('should upgrade permissions', () => {
      const current = permissions.createDefaultPermissions('standard');
      const upgraded = permissions.upgradePermission(current, 'elevated');

      expect(upgraded.level).toBe('elevated');
      expect(upgraded.allowedOperations).toContain('processSpawn');
    });

    test('should preserve restrictions on upgrade', () => {
      let current = permissions.createDefaultPermissions('standard');
      current = permissions.addRestriction(current, {
        operation: 'fileRead',
        allowedPaths: ['/home'],
        requiresConfirmation: false,
      });

      const upgraded = permissions.upgradePermission(current, 'elevated');

      expect(upgraded.restrictions.length).toBe(1);
      expect(upgraded.restrictions[0].operation).toBe('fileRead');
    });
  });

  describe('default permissions', () => {
    test('should create default standard permissions', () => {
      const perms = permissions.createDefaultPermissions();

      expect(perms.level).toBe('standard');
      expect(perms.allowedOperations).toContain('fileRead');
      expect(perms.allowedOperations).toContain('fileWrite');
      expect(perms.restrictions.length).toBe(0);
    });

    test('should create restricted permissions', () => {
      const perms = permissions.createRestrictedPermissions();

      expect(perms.level).toBe('restricted');
      expect(perms.allowedOperations).toContain('fileRead');
      expect(perms.allowedOperations.length).toBe(1);
    });

    test('should create restricted permissions with restrictions', () => {
      const perms = permissions.createRestrictedPermissions([
        {
          operation: 'fileRead',
          allowedPaths: ['/tmp'],
          requiresConfirmation: true,
        },
      ]);

      expect(perms.restrictions.length).toBe(1);
    });
  });

  describe('permission hierarchy', () => {
    test('should return permission hierarchy', () => {
      const hierarchy = permissions.getPermissionHierarchy();

      expect(hierarchy).toEqual([
        'restricted',
        'standard',
        'elevated',
        'trusted',
      ]);
    });

    test('should maintain hierarchy order', () => {
      const hierarchy = permissions.getPermissionHierarchy();

      expect(hierarchy.indexOf('restricted')).toBeLessThan(
        hierarchy.indexOf('standard')
      );
      expect(hierarchy.indexOf('standard')).toBeLessThan(
        hierarchy.indexOf('elevated')
      );
      expect(hierarchy.indexOf('elevated')).toBeLessThan(
        hierarchy.indexOf('trusted')
      );
    });
  });

  describe('edge cases', () => {
    test('should handle unknown operation gracefully', () => {
      const perms = permissions.createDefaultPermissions('standard');
      const result = permissions.checkPermission(
        perms,
        'unknownOp' as PermissionOperation
      );

      expect(result.allowed).toBe(false);
    });

    test('should handle multiple restrictions for same operation', () => {
      let perms = permissions.createDefaultPermissions('standard');
      perms = permissions.addRestriction(perms, {
        operation: 'fileRead',
        allowedPaths: ['/home'],
        requiresConfirmation: false,
      });
      perms = permissions.addRestriction(perms, {
        operation: 'fileWrite',
        deniedPaths: ['/etc'],
        requiresConfirmation: true,
      });

      expect(perms.restrictions.length).toBe(2);
    });

    test('should validate conflicting restriction configuration', () => {
      const perms = permissions.createDefaultPermissions('standard');
      const restricted = permissions.addRestriction(perms, {
        operation: 'fileRead',
        allowedPaths: ['/home'],
        deniedPaths: ['/etc'],
        requiresConfirmation: false,
      });

      const result = permissions.checkPermission(restricted, 'fileRead');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('both allowed and denied');
    });
  });

  describe('operation coverage', () => {
    test('should support all permission operations', () => {
      const operations: PermissionOperation[] = [
        'fileRead',
        'fileWrite',
        'processSpawn',
        'networkAccess',
        'envAccess',
      ];

      const perms = permissions.createDefaultPermissions('trusted');

      for (const op of operations) {
        const result = permissions.checkPermission(perms, op);
        expect(result.allowed).toBe(true);
      }
    });
  });
});

/**
 * Template permissions system for access control
 */

import { createLogger } from '../../utils/logger';
import type {
  TemplatePermissions as ITemplatePermissions,
  PermissionOperation,
  PermissionRestriction,
  PermissionCheckResult,
} from './types';

const logger = createLogger(
  'checklist:templates:security:template-permissions'
);

/**
 * Permission level configuration
 */
interface PermissionLevelConfig {
  allowedOperations: PermissionOperation[];
  requiresConfirmation: boolean;
}

/**
 * Template permissions manager
 */
export class TemplatePermissions {
  private readonly permissionLevels: Record<
    'restricted' | 'standard' | 'elevated' | 'trusted',
    PermissionLevelConfig
  >;

  constructor() {
    this.permissionLevels = this.initializePermissionLevels();

    logger.debug({
      msg: 'TemplatePermissions initialized',
      levels: Object.keys(this.permissionLevels),
    });
  }

  /**
   * Check if operation is permitted
   */
  checkPermission(
    permissions: ITemplatePermissions,
    operation: PermissionOperation
  ): PermissionCheckResult {
    const level = this.permissionLevels[permissions.level];

    if (!level.allowedOperations.includes(operation)) {
      return this.denyPermission(permissions.level, operation);
    }

    const restriction = permissions.restrictions.find(
      (r) => r.operation === operation
    );

    if (restriction) {
      return this.checkRestricted(restriction, level);
    }

    return this.grantPermission(permissions.level, operation, level);
  }

  /**
   * Deny permission with logging
   */
  private denyPermission(
    level: string,
    operation: PermissionOperation
  ): PermissionCheckResult {
    logger.warn({ msg: 'Permission denied', level, operation });
    return {
      allowed: false,
      reason: `Operation '${operation}' not allowed at permission level '${level}'`,
    };
  }

  /**
   * Check restricted operation
   */
  private checkRestricted(
    restriction: PermissionRestriction,
    level: PermissionLevelConfig
  ): PermissionCheckResult {
    const check = this.validateRestriction(restriction);
    if (!check.allowed) return check;

    return {
      allowed: true,
      requiresConfirmation:
        restriction.requiresConfirmation || level.requiresConfirmation,
      restrictions: restriction,
    };
  }

  /**
   * Grant permission with logging
   */
  private grantPermission(
    levelName: string,
    operation: PermissionOperation,
    level: PermissionLevelConfig
  ): PermissionCheckResult {
    logger.debug({
      msg: 'Permission granted',
      level: levelName,
      operation,
    });
    return {
      allowed: true,
      requiresConfirmation: level.requiresConfirmation,
    };
  }

  /**
   * Validate restriction configuration
   */
  private validateRestriction(
    restriction: PermissionRestriction
  ): PermissionCheckResult {
    // Ensure restriction has either allowed or denied paths
    if (
      restriction.allowedPaths &&
      restriction.deniedPaths &&
      restriction.allowedPaths.length > 0 &&
      restriction.deniedPaths.length > 0
    ) {
      return {
        allowed: false,
        reason: 'Restriction cannot have both allowed and denied paths',
      };
    }

    return { allowed: true };
  }

  /**
   * Validate path against restriction
   */
  validatePath(path: string, restriction: PermissionRestriction): boolean {
    // Check denied paths
    if (restriction.deniedPaths) {
      for (const denied of restriction.deniedPaths) {
        if (path.startsWith(denied)) {
          return false;
        }
      }
    }

    // Check allowed paths
    if (restriction.allowedPaths && restriction.allowedPaths.length > 0) {
      let allowed = false;
      for (const allowedPath of restriction.allowedPaths) {
        if (path.startsWith(allowedPath)) {
          allowed = true;
          break;
        }
      }
      return allowed;
    }

    return true;
  }

  /**
   * Create default permissions for template
   */
  createDefaultPermissions(
    level: 'restricted' | 'standard' | 'elevated' | 'trusted' = 'standard'
  ): ITemplatePermissions {
    const config = this.permissionLevels[level];

    return {
      level,
      allowedOperations: config.allowedOperations,
      restrictions: [],
    };
  }

  /**
   * Create restricted permissions
   */
  createRestrictedPermissions(
    restrictions?: PermissionRestriction[]
  ): ITemplatePermissions {
    return {
      level: 'restricted',
      allowedOperations: ['fileRead'],
      restrictions: restrictions ?? [],
    };
  }

  /**
   * Upgrade permission level
   */
  upgradePermission(
    current: ITemplatePermissions,
    target: 'standard' | 'elevated' | 'trusted'
  ): ITemplatePermissions {
    const targetConfig = this.permissionLevels[target];

    logger.info({
      msg: 'Permission upgrade requested',
      from: current.level,
      to: target,
    });

    return {
      level: target,
      allowedOperations: targetConfig.allowedOperations,
      restrictions: current.restrictions,
    };
  }

  /**
   * Check if permission escalation is required
   */
  requiresEscalation(
    current: ITemplatePermissions,
    required: 'restricted' | 'standard' | 'elevated' | 'trusted'
  ): boolean {
    const levels = ['restricted', 'standard', 'elevated', 'trusted'];
    const currentIndex = levels.indexOf(current.level);
    const requiredIndex = levels.indexOf(required);

    return requiredIndex > currentIndex;
  }

  /**
   * Get permission level hierarchy
   */
  getPermissionHierarchy(): string[] {
    return ['restricted', 'standard', 'elevated', 'trusted'];
  }

  /**
   * Get operations allowed at level
   */
  getAllowedOperations(
    level: 'restricted' | 'standard' | 'elevated' | 'trusted'
  ): PermissionOperation[] {
    return this.permissionLevels[level].allowedOperations;
  }

  /**
   * Check if confirmation is required
   */
  requiresConfirmation(
    level: 'restricted' | 'standard' | 'elevated' | 'trusted'
  ): boolean {
    return this.permissionLevels[level].requiresConfirmation;
  }

  /**
   * Initialize permission level configurations
   */
  private initializePermissionLevels(): Record<
    'restricted' | 'standard' | 'elevated' | 'trusted',
    PermissionLevelConfig
  > {
    return {
      restricted: this.restrictedConfig(),
      standard: this.standardConfig(),
      elevated: this.elevatedConfig(),
      trusted: this.trustedConfig(),
    };
  }

  private restrictedConfig(): PermissionLevelConfig {
    return {
      allowedOperations: ['fileRead'],
      requiresConfirmation: true,
    };
  }

  private standardConfig(): PermissionLevelConfig {
    return {
      allowedOperations: ['fileRead', 'fileWrite', 'envAccess'],
      requiresConfirmation: false,
    };
  }

  private elevatedConfig(): PermissionLevelConfig {
    return {
      allowedOperations: ['fileRead', 'fileWrite', 'processSpawn', 'envAccess'],
      requiresConfirmation: true,
    };
  }

  private trustedConfig(): PermissionLevelConfig {
    return {
      allowedOperations: [
        'fileRead',
        'fileWrite',
        'processSpawn',
        'networkAccess',
        'envAccess',
      ],
      requiresConfirmation: false,
    };
  }

  /**
   * Add restriction to permissions
   */
  addRestriction(
    permissions: ITemplatePermissions,
    restriction: PermissionRestriction
  ): ITemplatePermissions {
    return {
      ...permissions,
      restrictions: [...permissions.restrictions, restriction],
    };
  }

  /**
   * Remove restriction from permissions
   */
  removeRestriction(
    permissions: ITemplatePermissions,
    operation: PermissionOperation
  ): ITemplatePermissions {
    return {
      ...permissions,
      restrictions: permissions.restrictions.filter(
        (r) => r.operation !== operation
      ),
    };
  }
}

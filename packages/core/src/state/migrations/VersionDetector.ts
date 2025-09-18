import { VersionDetectionError } from './types';

/**
 * Version detection utilities
 */
export class VersionDetector {
  /**
   * Get explicit version from state
   */
  static getExplicitVersion(s: Record<string, unknown>): string | null {
    if (s.schemaVersion !== undefined && typeof s.schemaVersion === 'string') {
      return s.schemaVersion;
    }
    if (s.version !== undefined && typeof s.version === 'string') {
      return s.version;
    }
    return null;
  }

  /**
   * Validate state object
   */
  static validateStateObject(state: unknown): void {
    if (state === null || state === undefined || typeof state !== 'object') {
      throw new VersionDetectionError('Invalid state object');
    }
  }

  /**
   * Check if state has templates and variables
   */
  static hasTemplatesAndVariables(s: Record<string, unknown>): boolean {
    return s.templates !== undefined && s.variables !== undefined;
  }

  /**
   * Check if state has recovery or conflicts
   */
  static hasRecoveryOrConflicts(s: Record<string, unknown>): boolean {
    return s.recovery !== undefined || s.conflicts !== undefined;
  }

  /**
   * Check if state has metadata with timestamps
   */
  static hasMetadataWithTimestamps(s: Record<string, unknown>): boolean {
    if (s.metadata === undefined || typeof s.metadata !== 'object') {
      return false;
    }
    const metadata = s.metadata as Record<string, unknown>;
    // Check for either createdAt/updatedAt or created/modified
    return (
      (metadata.createdAt !== undefined && metadata.updatedAt !== undefined) ||
      (metadata.created !== undefined && metadata.modified !== undefined)
    );
  }

  /**
   * Check if state has checklists array
   */
  static hasChecklistsArray(s: Record<string, unknown>): boolean {
    return Array.isArray(s.checklists);
  }

  /**
   * Check if state has workflow fields
   */
  static hasWorkflowFields(s: Record<string, unknown>): boolean {
    return s.workflows !== undefined || s.activeWorkflow !== undefined;
  }

  /**
   * Infer version from state structure
   */
  static inferVersionFromStructure(s: Record<string, unknown>): string {
    if (this.hasTemplatesAndVariables(s)) {
      return this.hasRecoveryOrConflicts(s) ? '1.0.0' : '0.2.0';
    }

    if (this.hasMetadataWithTimestamps(s)) {
      return '0.1.0';
    }

    if (this.hasChecklistsArray(s) || this.hasWorkflowFields(s)) {
      return '0.0.0';
    }

    return '0.0.0';
  }
}

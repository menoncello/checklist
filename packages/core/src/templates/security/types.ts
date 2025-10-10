/**
 * Security-related type definitions for template system
 */

/**
 * Template signature information
 */
export interface TemplateSignature {
  algorithm: 'HMAC-SHA256';
  signature: string;
  timestamp: string;
  signer: string;
  publicKeyFingerprint?: string;
}

/**
 * Security metadata for templates
 */
export interface SecurityMetadata {
  signature?: TemplateSignature;
  permissions: TemplatePermissions;
  dangerousCommands: DangerousCommand[];
  trustLevel: 'untrusted' | 'community' | 'verified' | 'official';
  publisher?: PublisherInfo;
}

/**
 * Dangerous command detection result
 */
export interface DangerousCommand {
  commandId: string;
  stepId: string;
  pattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  reason: string;
  suggestion?: string;
}

/**
 * Template permissions configuration
 */
export interface TemplatePermissions {
  level: 'restricted' | 'standard' | 'elevated' | 'trusted';
  allowedOperations: PermissionOperation[];
  restrictions: PermissionRestriction[];
}

/**
 * Permission operation types
 */
export type PermissionOperation =
  | 'fileRead'
  | 'fileWrite'
  | 'processSpawn'
  | 'networkAccess'
  | 'envAccess';

/**
 * Permission restriction configuration
 */
export interface PermissionRestriction {
  operation: PermissionOperation;
  allowedPaths?: string[];
  deniedPaths?: string[];
  requiresConfirmation: boolean;
}

/**
 * Audit log entry
 */
export interface AuditEntry {
  timestamp: string;
  type:
    | 'template.load'
    | 'template.execute'
    | 'security.violation'
    | 'permission.escalation';
  severity: 'info' | 'warning' | 'critical';
  templateId: string;
  templateVersion: string;
  user: string;
  pid: number;
  details: Record<string, unknown>;
  integrity: string; // HMAC-SHA256 hash
  stackTrace?: string;
}

/**
 * Publisher information
 */
export interface PublisherInfo {
  id: string;
  name: string;
  trustLevel: 'untrusted' | 'community' | 'verified' | 'official';
  publicKey?: string;
  verifiedAt?: string;
  templates: string[];
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  requiresConfirmation?: boolean;
  reason?: string;
  restrictions?: PermissionRestriction;
}

/**
 * Signature verification result
 */
export interface SignatureVerificationResult {
  valid: boolean;
  signature?: TemplateSignature;
  error?: string;
}

/**
 * Path validation result
 */
export interface PathValidationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Audit log verification result
 */
export interface AuditVerificationResult {
  verified: boolean;
  tamperedEntries: number[];
  totalEntries: number;
}

/**
 * Security event for audit logging
 */
export interface SecurityEvent {
  type:
    | 'template.load'
    | 'template.execute'
    | 'security.violation'
    | 'permission.escalation';
  severity: 'info' | 'warning' | 'critical';
  templateId: string;
  templateVersion: string;
  details: Record<string, unknown>;
  includeStack?: boolean;
}

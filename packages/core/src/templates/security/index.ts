/**
 * Template security module exports
 */

export { TemplateSigner } from './TemplateSigner';
export type { TemplateSignerConfig } from './TemplateSigner';

export { DangerousCommandDetector } from './DangerousCommandDetector';
export type {
  DangerousCommandDetectorConfig,
  CommandPattern,
} from './DangerousCommandDetector';

export { FileSystemRestrictor } from './FileSystemRestrictor';
export type { FileSystemRestrictorConfig } from './FileSystemRestrictor';

export { CommandInjectionPreventer } from './CommandInjectionPreventer';
export type {
  CommandInjectionPreventerConfig,
  InjectionDetectionResult,
} from './CommandInjectionPreventer';

export { TemplatePermissions as TemplatePermissionsManager } from './TemplatePermissions';

export { TemplateAuditLogger } from './TemplateAuditLogger';
export type {
  TemplateAuditLoggerConfig,
  AuditLogQuery,
} from './TemplateAuditLogger';

export { TrustedPublisherRegistry } from './TrustedPublisherRegistry';
export type {
  TrustedPublisherRegistryConfig,
  TrustLevel,
  PublisherEntry,
  RegistryQuery,
} from './TrustedPublisherRegistry';

export type {
  TemplateSignature,
  SecurityMetadata,
  DangerousCommand,
  TemplatePermissions,
  PermissionOperation,
  PermissionRestriction,
  AuditEntry,
  PublisherInfo,
  PermissionCheckResult,
  SignatureVerificationResult,
  PathValidationResult,
  AuditVerificationResult,
  SecurityEvent,
} from './types';

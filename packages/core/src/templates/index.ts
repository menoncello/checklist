/**
 * Public API exports for the template system
 */

// Error classes
export {
  TemplateError,
  TemplateLoadError,
  TemplateValidationError,
  SandboxViolationError,
  TimeoutError,
  MemoryLimitError,
  TemplateInheritanceError,
  TemplateCacheError,
  ResourceLimitError,
  createTemplateError,
  isTemplateError,
  getRecoverySuggestion,
} from './errors';

export type { ErrorContext } from './errors';

// Type definitions
export type {
  Variable,
  Command,
  StepValidation,
  Step,
  TemplateMetadata,
  ChecklistTemplate,
  CachedTemplate,
  TemplateLoadOptions,
  TemplateValidationResult,
  TemplateMetadataResult,
  ResourceLimits,
  ResourceUsage,
  SandboxContext,
  TemplateInheritance,
  CacheStatistics,
  CacheEntry,
  TemplateDiscoveryResult,
} from './types';

// ResourceLimiter
export { ResourceLimiter } from './ResourceLimiter';

// TemplateValidator
export { TemplateValidator } from './TemplateValidator';

// TemplateLoader
export { TemplateLoader } from './TemplateLoader';

// TemplateSandbox
export { TemplateSandbox } from './TemplateSandbox';

// TemplateInheritance
export { TemplateInheritance } from './TemplateInheritance';

// TemplateCache
export { TemplateCache } from './TemplateCache';

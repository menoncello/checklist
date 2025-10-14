/**
 * Type definitions for the template system
 * Re-exports all types from domain-specific modules
 */

// Core template types
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
  TemplateInheritance,
  CacheStatistics,
  CacheEntry,
  TemplateDiscoveryResult,
} from './types/coreTypes';

export { TEMPLATE_MANIFEST_FILENAME } from './types/coreTypes';

// Marketplace types
export type {
  TemplateAuthor,
  TemplateRepository,
  TemplateDependency,
  TemplateManifest,
  TemplateIndex,
  TemplateIndexEntry,
  DependencyTree,
  DependencyNode,
} from './types/marketplaceTypes';

// Testing types
export type {
  TemplateTestCase,
  TemplateAssertion,
  TemplateTestResults,
  TestCaseResult,
  AssertionFailure,
} from './types/testingTypes';

// Resource and sandbox types
export type {
  ResourceLimits,
  ResourceUsage,
  SandboxContext,
} from './types/resourceTypes';

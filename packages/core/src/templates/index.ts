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
  VariableSubstitutionError,
  NestingDepthExceededError,
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
  CacheStatistics,
  CacheEntry,
  TemplateDiscoveryResult,
  // Marketplace types
  TemplateManifest,
  TemplateAuthor,
  TemplateRepository,
  TemplateDependency,
  TemplateIndex,
  TemplateIndexEntry,
  DependencyTree,
  DependencyNode,
  TemplateTestCase,
  TemplateAssertion,
  TemplateTestResults,
  TestCaseResult,
  AssertionFailure,
} from './types';

// Constants
export { TEMPLATE_MANIFEST_FILENAME } from './types';

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

// Variable Substitution
export { VariableSubstitutor } from './VariableSubstitutor';
export { SubstitutionPreview } from './SubstitutionPreview';

// Substitution types
export type {
  SubstitutionConfig,
  SubstitutionContext,
  SubstitutionError,
  SubstitutionResult,
  SubstitutionMetadata,
  VariablePosition,
  VariablePreview,
  SubstitutionPreview as SubstitutionPreviewResult,
} from './substitution-types';

// Advanced template features
export { ConditionalEvaluator } from './ConditionalEvaluator';
export { LoopEvaluator } from './LoopEvaluator';
export { TemplateFunctions } from './TemplateFunctions';
export { MathExpressionEvaluator } from './MathExpressionEvaluator';
export { TemplateEngine } from './TemplateEngine';

// Advanced types
export type {
  EvaluationContext,
  LoopContext,
  PerformanceMetrics,
  ConditionalBlock,
  ConditionalResult,
  LoopBlock,
  LoopResult,
  TemplateFunction,
  FunctionRegistry,
  MathExpression,
  MathResult,
} from './advanced-types';

// Manifest validation
export {
  validateManifest,
  validateManifestWithDetails,
  validateLicense,
  manifestSchema,
  COMMON_SPDX_LICENSES,
} from './ManifestValidator';

export type { LicenseValidationResult } from './ManifestValidator';

// Repository implementations
export { GitTemplateRepository } from './repositories/GitTemplateRepository';
export type { GitRepositoryConfig } from './repositories/GitTemplateRepository';

// Template registry
export { TemplateRegistry } from './TemplateRegistry';

// Version management
export { TemplateVersionManager } from './TemplateVersionManager';
export type {
  VersionResolutionOptions,
  VersionComparison,
} from './TemplateVersionManager';

// Dependency resolution
export {
  TemplateDependencyResolver,
  DependencyResolutionError,
  CircularDependencyError,
} from './TemplateDependencyResolver';
export type {
  DependencyResolverOptions,
  DependencyFetcher,
} from './TemplateDependencyResolver';

// Template testing
export { TemplateTestRunner, TestExecutionError } from './TemplateTestRunner';
export type { TestRunnerOptions } from './TemplateTestRunner';

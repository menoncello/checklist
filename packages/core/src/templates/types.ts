/**
 * Type definitions for the template system
 * Based on the ChecklistTemplate specification from the story
 */

/**
 * Variable definition in a template
 */
export interface Variable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array';
  required: boolean;
  default?: unknown;
  description: string;
  validation?: string;
}

/**
 * Command within a step
 */
export interface Command {
  id: string;
  type: 'bash' | 'node' | 'python' | 'custom';
  content: string;
  dangerous: boolean;
  requiresConfirmation: boolean;
}

/**
 * Step validation configuration
 */
export interface StepValidation {
  type: 'command' | 'file_exists' | 'custom' | 'regex';
  check: string;
  errorMessage?: string;
}

/**
 * Step definition in a template
 */
export interface Step {
  id: string;
  title: string;
  description: string;
  type: 'task' | 'confirmation' | 'input' | 'automated' | 'multi-command';
  commands: Command[];
  condition?: string;
  dependencies: string[];
  validation?: StepValidation;
  executionMode: 'sequential' | 'parallel';
  continueOnError?: boolean;
}

/**
 * Template metadata
 */
export interface TemplateMetadata {
  author: string;
  tags: string[];
  visibility: 'public' | 'private' | 'internal';
  created: string;
  updated: string;
  parent?: string;
}

/**
 * Complete template definition
 */
export interface ChecklistTemplate {
  id: string;
  name: string;
  version: string;
  description: string;
  variables: Variable[];
  steps: Step[];
  metadata: TemplateMetadata;
}

/**
 * Cached template with metadata
 */
export interface CachedTemplate {
  content: ChecklistTemplate;
  loadedAt: number;
  filePath: string;
}

/**
 * Template loading options
 */
export interface TemplateLoadOptions {
  skipValidation?: boolean;
  skipInheritance?: boolean;
  skipCache?: boolean;
  maxInheritanceDepth?: number;
  timeout?: number;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Template metadata extraction result
 */
export interface TemplateMetadataResult {
  id: string;
  name: string;
  version: string;
  description: string;
  path: string;
  size: number;
  modifiedAt: number;
}

/**
 * Resource usage limits
 */
export interface ResourceLimits {
  executionTime: number;
  memoryDelta: number;
  cpuUsage: number;
  fileHandles: number;
  processCount: number;
}

/**
 * Resource usage monitoring
 */
export interface ResourceUsage {
  memoryDelta: number;
  cpuUsage: number;
  fileHandles: number;
  processCount: number;
  duration: number;
}

/**
 * Sandbox execution context
 */
export interface SandboxContext {
  variables: Record<string, unknown>;
  console: {
    log: (...args: unknown[]) => void;
    error: (...args: unknown[]) => void;
  };
  Math: typeof Math;
  Date: {
    now: () => number;
    parse: (dateString: string) => number;
  };
  JSON: {
    parse: (text: string) => unknown;
    stringify: (value: unknown) => string;
  };
}

/**
 * Template inheritance configuration
 */
export interface TemplateInheritance {
  parentId: string;
  overrides?: {
    variables?: Partial<Record<string, Variable>>;
    steps?: Partial<Record<string, Step>>;
    metadata?: Partial<TemplateMetadata>;
  };
}

/**
 * Cache statistics
 */
export interface CacheStatistics {
  size: number;
  hits: number;
  misses: number;
  evictions: number;
}

/**
 * Cache entry metadata
 */
export interface CacheEntry {
  template: CachedTemplate;
  lastAccessed: number;
}

/**
 * Template discovery result
 */
export interface TemplateDiscoveryResult {
  path: string;
  id: string;
  name: string;
  version: string;
  size: number;
  modifiedAt: number;
}

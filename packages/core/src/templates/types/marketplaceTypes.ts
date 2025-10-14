/**
 * Marketplace types for template discovery and distribution
 * Types related to template marketplace functionality
 */

/**
 * Template author information
 * Can be a simple string or a detailed object with contact information
 */
export interface TemplateAuthor {
  name: string;
  email?: string;
  url?: string;
}

/**
 * Template repository configuration
 * Defines where the template is stored and how to access it
 */
export interface TemplateRepository {
  type: 'git';
  url: string;
  directory?: string;
}

/**
 * Template dependency definition
 * Defines a dependency on another template with version constraints
 */
export interface TemplateDependency {
  name: string;
  version: string;
  optional?: boolean;
}

/**
 * Template manifest for marketplace
 * Complete metadata and configuration for a shareable template
 *
 * @example
 * ```typescript
 * const manifest: TemplateManifest = {
 *   name: 'project-setup',
 *   version: '1.0.0',
 *   description: 'Setup a new project with best practices',
 *   author: 'John Doe',
 *   repository: {
 *     type: 'git',
 *     url: 'https://github.com/example/template.git'
 *   },
 *   dependencies: [
 *     { name: 'basic-checklist', version: '^1.0.0' }
 *   ],
 *   tags: ['setup', 'project'],
 *   license: 'MIT',
 *   files: ['template.yaml', 'README.md']
 * };
 * ```
 */
export interface TemplateManifest {
  /** Template name in kebab-case format */
  name: string;
  /** Semantic version (e.g., "1.0.0") */
  version: string;
  /** Brief description of the template purpose */
  description: string;
  /** Author name or detailed author object */
  author: string | TemplateAuthor;
  /** Git repository information */
  repository: TemplateRepository;
  /** Template dependencies with version constraints */
  dependencies?: TemplateDependency[];
  /** Searchable tags for template discovery */
  tags: string[];
  /** SPDX license identifier (e.g., "MIT", "Apache-2.0") */
  license: string;
  /** Documentation homepage URL */
  homepage?: string;
  /** Issue tracker URL */
  bugs?: string;
  /** Additional search keywords */
  keywords?: string[];
  /** Files included in the template */
  files: string[];
  /** Main template file path */
  main?: string;
  /** Version requirements for the BMAD system */
  engines?: {
    bmad?: string;
  };
}

/**
 * Template index format for marketplace discovery
 * Contains metadata about all available templates
 */
export interface TemplateIndex {
  /** Index format version */
  version: string;
  /** Last update timestamp (ISO-8601) */
  lastUpdated: string;
  /** List of available templates */
  templates: TemplateIndexEntry[];
}

/**
 * Single template entry in the index
 * Lightweight metadata for template discovery
 */
export interface TemplateIndexEntry {
  name: string;
  version: string;
  description: string;
  author: string;
  repository: string;
  tags: string[];
  downloads?: number;
  stars?: number;
}

/**
 * Dependency resolution tree
 * Result of resolving all template dependencies
 */
export interface DependencyTree {
  /** Root template manifest */
  root: TemplateManifest;
  /** Resolved dependency nodes */
  dependencies: Map<string, DependencyNode>;
  /** Installation order (topological sort) */
  installOrder: string[];
}

/**
 * Single node in the dependency tree
 */
export interface DependencyNode {
  /** Template manifest */
  manifest: TemplateManifest;
  /** Names of direct dependencies */
  dependencies: string[];
  /** Depth in the dependency tree */
  depth: number;
  /** Whether this is an optional dependency */
  optional: boolean;
}

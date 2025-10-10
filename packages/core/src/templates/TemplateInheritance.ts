/**
 * TemplateInheritance - Handles template inheritance and composition
 * Supports extending base templates with merging of steps, variables, and metadata
 */

import { TemplateInheritanceError } from './errors';
import type { ChecklistTemplate, TemplateMetadata } from './types';

interface InheritanceChain {
  templates: ChecklistTemplate[];
  visited: Set<string>;
}

/**
 * TemplateInheritance handles template extension and merging
 */
export class TemplateInheritance {
  private readonly templateLoader: (path: string) => Promise<ChecklistTemplate>;
  private readonly maxDepth: number;

  constructor(
    templateLoader: (path: string) => Promise<ChecklistTemplate>,
    maxDepth = 10
  ) {
    this.templateLoader = templateLoader;
    this.maxDepth = maxDepth;
  }

  /**
   * Resolve template inheritance chain
   */
  async resolveInheritance(
    template: ChecklistTemplate,
    templatePath: string
  ): Promise<ChecklistTemplate> {
    // If template doesn't extend anything, return as-is
    if (template.extends === undefined || template.extends === '') {
      return template;
    }

    // Build inheritance chain
    const chain = await this.buildInheritanceChain(template, templatePath);

    // Merge chain from base to derived
    return this.mergeChain(chain);
  }

  /**
   * Build inheritance chain from base to derived
   */
  private async buildInheritanceChain(
    template: ChecklistTemplate,
    templatePath: string
  ): Promise<InheritanceChain> {
    const chain: InheritanceChain = {
      templates: [],
      visited: new Set(),
    };

    await this.collectParents(template, templatePath, chain, 0);

    // Add the derived template at the end
    chain.templates.push(template);

    return chain;
  }

  /**
   * Collect parent templates recursively
   */
  private async collectParents(
    template: ChecklistTemplate,
    templatePath: string,
    chain: InheritanceChain,
    depth: number
  ): Promise<void> {
    this.validateDepth(depth, templatePath);

    // If no parent, we're at the base
    if (template.extends === undefined || template.extends === '') {
      chain.templates.push(template);
      return;
    }

    this.validateCircularDependency(template.extends, templatePath, chain);

    // Mark as visited
    chain.visited.add(template.extends);

    // Load parent template
    const parent = await this.loadParent(template.extends, templatePath);

    // Recursively collect parent's parents
    await this.collectParents(parent, template.extends, chain, depth + 1);

    // Add current template (except the original derived one)
    if (depth > 0) {
      chain.templates.push(template);
    }
  }

  /**
   * Validate inheritance depth
   */
  private validateDepth(depth: number, templatePath: string): void {
    if (depth >= this.maxDepth) {
      throw new TemplateInheritanceError(
        templatePath,
        'Max inheritance depth exceeded',
        { maxDepth: this.maxDepth, depth }
      );
    }
  }

  /**
   * Validate no circular dependencies
   */
  private validateCircularDependency(
    extendsPath: string,
    templatePath: string,
    chain: InheritanceChain
  ): void {
    if (chain.visited.has(extendsPath)) {
      throw new TemplateInheritanceError(
        templatePath,
        'Circular inheritance detected',
        {
          extends: extendsPath,
          chain: Array.from(chain.visited),
        }
      );
    }
  }

  /**
   * Load parent template
   */
  private async loadParent(
    parentPath: string,
    childPath: string
  ): Promise<ChecklistTemplate> {
    try {
      return await this.templateLoader(parentPath);
    } catch (error) {
      throw new TemplateInheritanceError(
        childPath,
        `Failed to load parent template: ${parentPath}`,
        { parentPath, error: (error as Error).message }
      );
    }
  }

  /**
   * Merge inheritance chain from base to derived
   */
  private mergeChain(chain: InheritanceChain): ChecklistTemplate {
    if (chain.templates.length === 0) {
      throw new Error('Empty inheritance chain');
    }

    // Start with base template
    let merged = this.cloneTemplate(chain.templates[0]);

    // Merge each template in order
    for (let i = 1; i < chain.templates.length; i++) {
      merged = this.mergeTemplates(merged, chain.templates[i]);
    }

    return merged;
  }

  /**
   * Merge two templates (base + derived)
   */
  private mergeTemplates(
    base: ChecklistTemplate,
    derived: ChecklistTemplate
  ): ChecklistTemplate {
    return {
      id: derived.id,
      name: derived.name,
      version: derived.version,
      description: derived.description,
      metadata: this.mergeMetadata(base.metadata, derived.metadata),
      variables: this.mergeVariables(base.variables, derived.variables),
      steps: this.mergeSteps(base.steps, derived.steps),
      extends: derived.extends,
    };
  }

  /**
   * Merge metadata (derived overrides base)
   */
  private mergeMetadata(
    base: TemplateMetadata,
    derived: TemplateMetadata
  ): TemplateMetadata {
    return {
      author:
        derived.author && derived.author !== ''
          ? derived.author
          : (base.author ?? ''),
      tags: this.mergeTags(base.tags ?? [], derived.tags ?? []),
      visibility: derived.visibility ?? base.visibility ?? 'private',
      created: base.created ?? new Date().toISOString(),
      updated: new Date().toISOString(),
      parent: derived.parent ?? base.parent,
    };
  }

  /**
   * Merge tags (union of both)
   */
  private mergeTags(baseTags: string[], derivedTags: string[]): string[] {
    const combined = new Set([...baseTags, ...derivedTags]);
    return Array.from(combined).sort();
  }

  /**
   * Merge variables (derived overrides base)
   */
  private mergeVariables(
    base: ChecklistTemplate['variables'],
    derived: ChecklistTemplate['variables']
  ): ChecklistTemplate['variables'] {
    const merged = new Map<string, (typeof base)[0]>();

    // Add all base variables
    for (const variable of base) {
      merged.set(variable.name, variable);
    }

    // Override with derived variables
    for (const variable of derived) {
      merged.set(variable.name, variable);
    }

    return Array.from(merged.values());
  }

  /**
   * Merge steps (derived overrides base by ID)
   */
  private mergeSteps(
    base: ChecklistTemplate['steps'],
    derived: ChecklistTemplate['steps']
  ): ChecklistTemplate['steps'] {
    const merged = new Map<string, (typeof base)[0]>();

    // Add all base steps
    for (const step of base) {
      merged.set(step.id, step);
    }

    // Override with derived steps
    for (const step of derived) {
      merged.set(step.id, step);
    }

    return Array.from(merged.values());
  }

  /**
   * Deep clone a template
   */
  private cloneTemplate(template: ChecklistTemplate): ChecklistTemplate {
    return JSON.parse(JSON.stringify(template)) as ChecklistTemplate;
  }

  /**
   * Get inheritance depth
   */
  getMaxDepth(): number {
    return this.maxDepth;
  }
}

/**
 * Integration tests for template marketplace foundation
 * Tests the interaction between all marketplace components
 */

import { describe, expect, test, beforeEach, afterEach } from 'bun:test';
import { join } from 'node:path';
import { mkdir, rm, writeFile } from 'node:fs/promises';
import {
  TemplateRegistry,
  TemplateVersionManager,
  TemplateDependencyResolver,
  GitTemplateRepository,
  validateManifest,
} from '../../src/templates';
import type {
  TemplateManifest,
  TemplateIndex,
  TemplateDependency,
} from '../../src/templates/types';

describe('Template Marketplace Integration', () => {
  const testDir = join(__dirname, '.tmp-integration');
  const indexPath = join(testDir, 'index.json');

  beforeEach(async () => {
    await mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  describe('Registry and Version Management', () => {
    test('should discover and resolve template versions', async () => {
      const index: TemplateIndex = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        templates: [
          {
            name: 'basic-template',
            version: '1.0.0',
            description: 'Basic template',
            author: 'Test Author',
            repository: 'https://github.com/test/basic',
            tags: ['basic'],
          },
          {
            name: 'basic-template',
            version: '1.5.0',
            description: 'Basic template v1.5',
            author: 'Test Author',
            repository: 'https://github.com/test/basic',
            tags: ['basic'],
          },
          {
            name: 'basic-template',
            version: '2.0.0',
            description: 'Basic template v2',
            author: 'Test Author',
            repository: 'https://github.com/test/basic',
            tags: ['basic'],
          },
        ],
      };

      await writeFile(indexPath, JSON.stringify(index));

      const registry = new TemplateRegistry(`file://${indexPath}`);
      const versionManager = new TemplateVersionManager();

      // Load templates from registry
      const loadedIndex = await registry.loadIndex();
      expect(loadedIndex.templates).toHaveLength(3);

      // Get all versions for a template
      const basicVersions = loadedIndex.templates
        .filter((t) => t.name === 'basic-template')
        .map((t) => t.version);

      expect(basicVersions).toHaveLength(3);

      // Resolve version constraint
      const resolved = versionManager.resolveVersion('^1.0.0', basicVersions);

      expect(resolved).toBe('1.5.0'); // Latest 1.x version
    });

    test('should search templates and verify versions', async () => {
      const index: TemplateIndex = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        templates: [
          {
            name: 'web-app',
            version: '1.0.0',
            description: 'Web application template',
            author: 'Dev Team',
            repository: 'https://github.com/test/web-app',
            tags: ['web', 'frontend'],
          },
          {
            name: 'api-service',
            version: '2.1.0',
            description: 'API service template',
            author: 'Dev Team',
            repository: 'https://github.com/test/api',
            tags: ['api', 'backend'],
          },
        ],
      };

      await writeFile(indexPath, JSON.stringify(index));

      const registry = new TemplateRegistry(`file://${indexPath}`);
      const versionManager = new TemplateVersionManager();

      // Search for templates
      const webTemplates = await registry.searchTemplates('web');
      expect(webTemplates).toHaveLength(1);
      expect(webTemplates[0].name).toBe('web-app');

      // Check version compatibility
      const isCompatible = versionManager.isVersionCompatible(
        webTemplates[0].version,
        '>=1.0.0'
      );
      expect(isCompatible).toBe(true);
    });
  });

  describe('Manifest Validation and Dependencies', () => {
    test('should validate manifest and resolve dependencies', async () => {
      const manifest: TemplateManifest = {
        name: 'advanced-template',
        version: '1.0.0',
        description: 'Advanced template with dependencies',
        author: 'Test Author',
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'https://github.com/test/advanced',
        },
        tags: ['advanced'],
        files: ['template.yaml'],
        dependencies: [
          {
            name: 'base-template',
            version: '^1.0.0',
          },
          {
            name: 'utils-template',
            version: '~2.0.0',
          },
        ],
      };

      // Validate manifest
      const isValid = validateManifest(manifest);
      expect(isValid).toBe(true);

      // Resolve dependencies
      const resolver = new TemplateDependencyResolver();

      const fetcher = async (name: string): Promise<TemplateDependency[]> => {
        if (name === 'base-template') {
          return [];
        }
        if (name === 'utils-template') {
          return [];
        }
        return [];
      };

      const tree = await resolver.buildDependencyTree(
        manifest.dependencies ?? [],
        fetcher
      );

      expect(tree.dependencies).toHaveLength(2);
      expect(tree.totalCount).toBe(2);
    });

    test('should detect circular dependencies', async () => {
      const manifest: TemplateManifest = {
        name: 'circular-template',
        version: '1.0.0',
        description: 'Template with circular dependency',
        author: 'Test Author',
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'https://github.com/test/circular',
        },
        tags: ['test'],
        files: ['template.yaml'],
        dependencies: [
          {
            name: 'dep-a',
            version: '1.0.0',
          },
        ],
      };

      const resolver = new TemplateDependencyResolver();

      const fetcher = async (name: string): Promise<TemplateDependency[]> => {
        if (name === 'dep-a') {
          return [{ name: 'dep-b', version: '1.0.0' }];
        }
        if (name === 'dep-b') {
          return [{ name: 'dep-a', version: '1.0.0' }];
        }
        return [];
      };

      await expect(
        resolver.buildDependencyTree(manifest.dependencies ?? [], fetcher)
      ).rejects.toThrow(/circular dependency/i);
    });
  });

  describe('End-to-End Workflow', () => {
    test('should complete full template discovery and installation workflow', async () => {
      const index: TemplateIndex = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        templates: [
          {
            name: 'project-starter',
            version: '1.2.0',
            description: 'Project starter template',
            author: 'Dev Team',
            repository: 'https://github.com/test/starter',
            tags: ['starter', 'project'],
          },
          {
            name: 'base-config',
            version: '2.0.0',
            description: 'Base configuration',
            author: 'Dev Team',
            repository: 'https://github.com/test/base',
            tags: ['config'],
          },
        ],
      };

      await writeFile(indexPath, JSON.stringify(index));

      // Step 1: Discover templates
      const registry = new TemplateRegistry(`file://${indexPath}`);
      const templates = await registry.searchTemplates('starter');

      expect(templates).toHaveLength(1);
      const template = templates[0];

      // Step 2: Check version compatibility
      const versionManager = new TemplateVersionManager();
      const isCompatible = versionManager.isVersionCompatible(
        template.version,
        '>=1.0.0'
      );

      expect(isCompatible).toBe(true);

      // Step 3: Validate would-be dependencies
      const resolver = new TemplateDependencyResolver();
      const deps: TemplateDependency[] = [
        {
          name: 'base-config',
          version: '^2.0.0',
        },
      ];

      const isValidConstraints = resolver.validateDependencyConstraints(deps);
      expect(isValidConstraints).toBe(true);

      // Step 4: Resolve dependencies
      const fetcher = async (): Promise<TemplateDependency[]> => [];

      const depTree = await resolver.buildDependencyTree(deps, fetcher);

      expect(depTree.totalCount).toBe(1);

      // Step 5: Flatten for installation
      const installOrder = resolver.flattenDependencyTree(depTree);

      expect(installOrder).toHaveLength(1);
      expect(installOrder[0].name).toBe('base-config');
    });

    test('should handle template with multiple dependencies', async () => {
      const manifest: TemplateManifest = {
        name: 'complex-template',
        version: '3.0.0',
        description: 'Complex template with multiple deps',
        author: 'Dev Team',
        license: 'MIT',
        repository: {
          type: 'git',
          url: 'https://github.com/test/complex',
        },
        tags: ['complex'],
        files: ['template.yaml'],
        dependencies: [
          { name: 'dep1', version: '^1.0.0' },
          { name: 'dep2', version: '~2.0.0' },
          { name: 'dep3', version: '>=3.0.0 <4.0.0' },
        ],
      };

      // Validate manifest
      expect(validateManifest(manifest)).toBe(true);

      // Resolve all dependencies
      const resolver = new TemplateDependencyResolver();

      const fetcher = async (name: string): Promise<TemplateDependency[]> => {
        if (name === 'dep1') {
          return [{ name: 'dep1-sub', version: '1.0.0' }];
        }
        return [];
      };

      const tree = await resolver.buildDependencyTree(
        manifest.dependencies ?? [],
        fetcher
      );

      expect(tree.totalCount).toBe(4); // 3 direct + 1 sub-dependency

      // Flatten and check order
      const installOrder = resolver.flattenDependencyTree(tree);

      expect(installOrder).toHaveLength(4);
      expect(installOrder[0].name).toBe('dep1-sub'); // Deepest first
    });
  });

  describe('Version Conflict Detection', () => {
    test('should detect version conflicts in dependency tree', async () => {
      const resolver = new TemplateDependencyResolver();

      const fetcher = async (name: string): Promise<TemplateDependency[]> => {
        if (name === 'parent-a') {
          return [{ name: 'shared', version: '1.0.0' }];
        }
        if (name === 'parent-b') {
          return [{ name: 'shared', version: '2.0.0' }];
        }
        return [];
      };

      const tree = await resolver.buildDependencyTree(
        [
          { name: 'parent-a', version: '1.0.0' },
          { name: 'parent-b', version: '1.0.0' },
        ],
        fetcher
      );

      const conflicts = resolver.findConflicts(tree);

      expect(conflicts).toHaveLength(1);
      expect(conflicts[0].name).toBe('shared');
      expect(conflicts[0].versions).toContain('1.0.0');
      expect(conflicts[0].versions).toContain('2.0.0');
    });
  });

  describe('Cache Behavior', () => {
    test('should cache registry index across multiple calls', async () => {
      const index: TemplateIndex = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        templates: [
          {
            name: 'cached-template',
            version: '1.0.0',
            description: 'Template for cache test',
            author: 'Test',
            repository: 'https://github.com/test/cached',
            tags: ['test'],
          },
        ],
      };

      await writeFile(indexPath, JSON.stringify(index));

      const registry = new TemplateRegistry(`file://${indexPath}`);

      // Load multiple times
      const index1 = await registry.loadIndex();
      const index2 = await registry.loadIndex();
      const index3 = await registry.loadIndex();

      // Should be same reference (cached)
      expect(index1).toBe(index2);
      expect(index2).toBe(index3);
    });

    test('should refresh index when explicitly requested', async () => {
      const index: TemplateIndex = {
        version: '1.0.0',
        lastUpdated: new Date().toISOString(),
        templates: [],
      };

      await writeFile(indexPath, JSON.stringify(index));

      const registry = new TemplateRegistry(`file://${indexPath}`);

      // Load once
      const index1 = await registry.loadIndex();
      expect(index1.templates).toHaveLength(0);

      // Update index file
      index.templates.push({
        name: 'new-template',
        version: '1.0.0',
        description: 'New template',
        author: 'Test',
        repository: 'https://github.com/test/new',
        tags: ['new'],
      });

      await writeFile(indexPath, JSON.stringify(index));

      // Refresh and load
      await registry.refreshIndex();
      const index2 = await registry.loadIndex();

      expect(index2.templates).toHaveLength(1);
    });
  });
});

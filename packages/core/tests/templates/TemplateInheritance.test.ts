import { describe, expect, test, beforeEach } from 'bun:test';
import { TemplateInheritance } from '../../src/templates/TemplateInheritance';
import { TemplateInheritanceError } from '../../src/templates/errors';
import type {
  ChecklistTemplate,
  Step,
  Variable,
  Command,
} from '../../src/templates/types';

describe('TemplateInheritance', () => {
  let inheritance: TemplateInheritance;
  const templates = new Map<string, ChecklistTemplate>();

  // Helper to create minimal valid templates
  const createTemplate = (
    overrides: Partial<ChecklistTemplate> & { id: string; name: string }
  ): ChecklistTemplate => ({
    version: '1.0.0',
    description: overrides.description ?? 'Template description',
    metadata: {
      author: '',
      tags: [],
      visibility: 'private',
      created: '2024-01-01T00:00:00Z',
      updated: '2024-01-01T00:00:00Z',
      ...overrides.metadata,
    },
    variables: [],
    steps: [],
    ...overrides,
  });

  // Helper to create valid steps
  const createStep = (overrides: Partial<Step> & { id: string }): Step => ({
    title: 'Step Title',
    description: 'Step description',
    type: 'task',
    executionMode: 'sequential',
    commands: [],
    dependencies: [],
    ...overrides,
  });

  // Helper to create valid commands
  const createCommand = (
    overrides: Partial<Command> & { id: string; content: string }
  ): Command => ({
    ...overrides,
  });

  // Mock template loader
  const mockLoader = async (path: string): Promise<ChecklistTemplate> => {
    const template = templates.get(path);
    if (template === undefined) {
      throw new Error(`Template not found: ${path}`);
    }
    return template;
  };

  beforeEach(() => {
    templates.clear();
    inheritance = new TemplateInheritance(mockLoader, 10);
  });

  describe('Constructor', () => {
    test('should create inheritance resolver with default max depth', () => {
      const resolver = new TemplateInheritance(mockLoader);
      expect(resolver.getMaxDepth()).toBe(10);
    });

    test('should create inheritance resolver with custom max depth', () => {
      const resolver = new TemplateInheritance(mockLoader, 5);
      expect(resolver.getMaxDepth()).toBe(5);
    });
  });

  describe('Simple Inheritance', () => {
    test('should return template without extends as-is', async () => {
      const template = createTemplate({
        id: 'simple-template',
        name: 'Simple Template',
      });

      const result = await inheritance.resolveInheritance(
        template,
        'simple.yaml'
      );

      expect(result).toEqual(template);
    });

    test('should resolve single-level inheritance', async () => {
      const base = createTemplate({
        id: 'base-template',
        name: 'Base Template',
        variables: [
          {
            name: 'baseVar',
            type: 'string',
            description: 'Base variable',
            required: true,
          },
        ],
        steps: [
          createStep({
            id: 'step1',
            title: 'Base Step 1',
            description: 'First step from base',
          }),
        ],
      });

      const derived = createTemplate({
        id: 'derived-template',
        name: 'Derived Template',
        extends: 'base.yaml',
        variables: [
          {
            name: 'derivedVar',
            type: 'string',
            description: 'Derived variable',
            required: false,
          },
        ],
        steps: [
          createStep({
            id: 'step2',
            title: 'Derived Step 2',
            description: 'Second step from derived',
          }),
        ],
      });

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.name).toBe('Derived Template');
      expect(result.variables).toHaveLength(2);
      expect(result.steps).toHaveLength(2);
      expect(result.variables.find((v) => v.name === 'baseVar')).toBeDefined();
      expect(
        result.variables.find((v) => v.name === 'derivedVar')
      ).toBeDefined();
    });

    test('should override base metadata with derived', async () => {
      const base: ChecklistTemplate = {
        id: 'base',
        name: 'Base',
        version: '1.0.0',
        description: 'Base description',
        metadata: {
          author: 'Base Author',
          tags: ['base'],
          visibility: 'private',
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
        variables: [],
        steps: [],
      };

      const derived: ChecklistTemplate = {
        id: 'derived',
        name: 'Derived',
        version: '1.0.0',
        description: 'Derived description',
        extends: 'base.yaml',
        metadata: {
          author: '',
          tags: [],
          visibility: 'private',
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
        variables: [],
        steps: [],
      };

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.name).toBe('Derived');
      expect(result.description).toBe('Derived description');
      expect(result.metadata.author).toBe('Base Author');
      expect(result.metadata.tags).toEqual(['base']);
    });
  });

  describe('Variable Merging', () => {
    test('should merge variables from base and derived', async () => {
      const base = createTemplate({
        id: 'base',
        name: 'Base',
        variables: [
          { name: 'var1', type: 'string', description: 'Var 1', required: true },
          {
            name: 'var2',
            type: 'number',
            description: 'Var 2',
            required: false,
          },
        ],
      });

      const derived = createTemplate({
        id: 'derived',
        name: 'Derived',
        extends: 'base.yaml',
        variables: [
          {
            name: 'var3',
            type: 'boolean',
            description: 'Var 3',
            required: true,
          },
        ],
      });

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.variables).toHaveLength(3);
      expect(result.variables.map((v) => v.name).sort()).toEqual([
        'var1',
        'var2',
        'var3',
      ]);
    });

    test('should override base variables with same name', async () => {
      const base = createTemplate({
        id: 'base',
        name: 'Base',
        variables: [
          { name: 'port', type: 'string', description: 'Port', required: true },
        ],
      });

      const derived = createTemplate({
        id: 'derived',
        name: 'Derived',
        extends: 'base.yaml',
        variables: [
          {
            name: 'port',
            type: 'number',
            description: 'Port number',
            required: false,
            default: 3000,
          },
        ],
      });

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].type).toBe('number');
      expect(result.variables[0].default).toBe(3000);
    });
  });

  describe('Step Merging', () => {
    test('should merge steps from base and derived', async () => {
      const base = createTemplate({
        id: 'base',
        name: 'Base',
        steps: [
          createStep({ id: 'step1', title: 'Step 1' }),
          createStep({ id: 'step2', title: 'Step 2' }),
        ],
      });

      const derived = createTemplate({
        id: 'derived',
        name: 'Derived',
        extends: 'base.yaml',
        steps: [createStep({ id: 'step3', title: 'Step 3' })],
      });

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.steps).toHaveLength(3);
      expect(result.steps.map((s) => s.id).sort()).toEqual([
        'step1',
        'step2',
        'step3',
      ]);
    });

    test('should override base steps with same id', async () => {
      const base = createTemplate({
        id: 'base',
        name: 'Base',
        steps: [createStep({ id: 'step1', title: 'Base Step' })],
      });

      const derived = createTemplate({
        id: 'derived',
        name: 'Derived',
        extends: 'base.yaml',
        steps: [
          createStep({
            id: 'step1',
            title: 'Derived Step',
            description: 'Overridden step',
            commands: [createCommand({ id: 'cmd1', content: 'echo "derived"' })],
          }),
        ],
      });

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.steps).toHaveLength(1);
      expect(result.steps[0].title).toBe('Derived Step');
      expect(result.steps[0].description).toBe('Overridden step');
      expect(result.steps[0].commands).toHaveLength(1);
    });
  });

  describe('Tag Merging', () => {
    test('should merge tags from base and derived', async () => {
      const base = createTemplate({
        id: 'base',
        name: 'Base',
        metadata: {
          author: '',
          tags: ['base', 'common'],
          visibility: 'private',
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
      });

      const derived = createTemplate({
        id: 'derived',
        name: 'Derived',
        extends: 'base.yaml',
        metadata: {
          author: '',
          tags: ['derived', 'common'],
          visibility: 'private',
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
      });

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.metadata.tags).toEqual(['base', 'common', 'derived']);
    });

    test('should handle empty tags', async () => {
      const base = createTemplate({
        id: 'base',
        name: 'Base',
      });

      const derived = createTemplate({
        id: 'derived',
        name: 'Derived',
        extends: 'base.yaml',
        metadata: {
          author: '',
          tags: ['derived'],
          visibility: 'private',
          created: '2024-01-01T00:00:00Z',
          updated: '2024-01-01T00:00:00Z',
        },
      });

      templates.set('base.yaml', base);

      const result = await inheritance.resolveInheritance(
        derived,
        'derived.yaml'
      );

      expect(result.metadata.tags).toEqual(['derived']);
    });
  });

  describe('Multi-level Inheritance', () => {
    test('should resolve three-level inheritance chain', async () => {
      const grandparent = createTemplate({
        id: 'grandparent',
        name: 'Grandparent',
        variables: [
          { name: 'gpVar', type: 'string', description: 'GP var', required: true },
        ],
        steps: [
          createStep({
            id: 'gpStep',
            title: 'GP Step',
            description: 'GP step',
          }),
        ],
      });

      const parent = createTemplate({
        id: 'parent',
        name: 'Parent',
        extends: 'grandparent.yaml',
        variables: [
          { name: 'pVar', type: 'string', description: 'P var', required: true },
        ],
        steps: [
          createStep({
            id: 'pStep',
            title: 'P Step',
            description: 'P step',
          }),
        ],
      });

      const child = createTemplate({
        id: 'child',
        name: 'Child',
        extends: 'parent.yaml',
        variables: [
          { name: 'cVar', type: 'string', description: 'C var', required: true },
        ],
        steps: [
          createStep({
            id: 'cStep',
            title: 'C Step',
            description: 'C step',
          }),
        ],
      });

      templates.set('grandparent.yaml', grandparent);
      templates.set('parent.yaml', parent);

      const result = await inheritance.resolveInheritance(child, 'child.yaml');

      expect(result.name).toBe('Child');
      expect(result.variables).toHaveLength(3);
      expect(result.steps).toHaveLength(3);
      expect(result.variables.map((v) => v.name).sort()).toEqual([
        'cVar',
        'gpVar',
        'pVar',
      ]);
      expect(result.steps.map((s) => s.id).sort()).toEqual([
        'cStep',
        'gpStep',
        'pStep',
      ]);
    });

    test('should override variables across inheritance chain', async () => {
      const grandparent = createTemplate({
        id: 'gp',
        name: 'GP',
        variables: [
          { name: 'port', type: 'string', description: 'Port', required: true },
        ],
      });

      const parent = createTemplate({
        id: 'p',
        name: 'P',
        extends: 'gp.yaml',
        variables: [
          {
            name: 'port',
            type: 'number',
            description: 'Port num',
            required: true,
          },
        ],
      });

      const child = createTemplate({
        id: 'c',
        name: 'C',
        extends: 'p.yaml',
        variables: [
          {
            name: 'port',
            type: 'number',
            description: 'Port number',
            required: false,
            default: 8080,
          },
        ],
      });

      templates.set('gp.yaml', grandparent);
      templates.set('p.yaml', parent);

      const result = await inheritance.resolveInheritance(child, 'c.yaml');

      expect(result.variables).toHaveLength(1);
      expect(result.variables[0].name).toBe('port');
      expect(result.variables[0].type).toBe('number');
      expect(result.variables[0].default).toBe(8080);
    });
  });

  describe('Error Handling', () => {
    test('should detect circular inheritance', async () => {
      const template1 = createTemplate({
        id: 'template1',
        name: 'Template 1',
        extends: 'template2.yaml',
      });

      const template2 = createTemplate({
        id: 'template2',
        name: 'Template 2',
        extends: 'template1.yaml',
      });

      templates.set('template1.yaml', template1);
      templates.set('template2.yaml', template2);

      await expect(
        inheritance.resolveInheritance(template1, 'template1.yaml')
      ).rejects.toThrow(TemplateInheritanceError);
    });

    test('should detect self-referencing inheritance', async () => {
      const template = createTemplate({
        id: 'self',
        name: 'Self',
        extends: 'self.yaml',
      });

      templates.set('self.yaml', template);

      await expect(
        inheritance.resolveInheritance(template, 'self.yaml')
      ).rejects.toThrow(TemplateInheritanceError);
    });

    test('should handle missing parent template', async () => {
      const template = createTemplate({
        id: 'template',
        name: 'Template',
        extends: 'missing.yaml',
      });

      await expect(
        inheritance.resolveInheritance(template, 'template.yaml')
      ).rejects.toThrow(TemplateInheritanceError);
    });

    test('should enforce max inheritance depth', async () => {
      const shallowInheritance = new TemplateInheritance(mockLoader, 2);

      const t1 = createTemplate({
        id: 't1',
        name: 'T1',
      });

      const t2 = createTemplate({
        id: 't2',
        name: 'T2',
        extends: 't1.yaml',
      });

      const t3 = createTemplate({
        id: 't3',
        name: 'T3',
        extends: 't2.yaml',
      });

      templates.set('t1.yaml', t1);
      templates.set('t2.yaml', t2);

      await expect(
        shallowInheritance.resolveInheritance(t3, 't3.yaml')
      ).rejects.toThrow(TemplateInheritanceError);
    });

    test('should include context in inheritance errors', async () => {
      const template = createTemplate({
        id: 'template',
        name: 'Template',
        extends: 'missing.yaml',
      });

      try {
        await inheritance.resolveInheritance(template, 'template.yaml');
        expect(true).toBe(false); // Should not reach
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateInheritanceError);
        const inheritanceError = error as TemplateInheritanceError;
        expect(inheritanceError.context?.details).toHaveProperty('parentPath');
      }
    });
  });
});

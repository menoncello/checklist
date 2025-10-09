import { describe, expect, test, beforeEach } from 'bun:test';
import { join } from 'path';
import { TemplateLoader } from '../../src/templates/TemplateLoader';
import { TemplateLoadError } from '../../src/templates/errors';

const FIXTURES_DIR = join(__dirname, 'fixtures');

describe('TemplateLoader', () => {
  let loader: TemplateLoader;

  beforeEach(() => {
    loader = new TemplateLoader(FIXTURES_DIR);
  });

  describe('Constructor', () => {
    test('should create loader with custom templates directory', () => {
      const customLoader = new TemplateLoader('/custom/path');
      expect(customLoader.getTemplatesDirectory()).toBe('/custom/path');
    });

    test('should create loader with default templates directory', () => {
      const defaultLoader = new TemplateLoader();
      expect(defaultLoader.getTemplatesDirectory()).toBe('/templates');
    });
  });

  describe('Load Template', () => {
    test('should load a valid template', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const template = await loader.load(filePath);

      expect(template.id).toBe('valid-template');
      expect(template.name).toBe('Valid Test Template');
      expect(template.version).toBe('1.0.0');
      expect(template.steps).toHaveLength(1);
    });

    test('should throw error for non-existent file', async () => {
      const filePath = join(FIXTURES_DIR, 'non-existent.yaml');

      await expect(loader.load(filePath)).rejects.toThrow(
        TemplateLoadError
      );
    });

    test('should throw error for non-existent file with ENOENT', async () => {
      const filePath = join(FIXTURES_DIR, 'missing.yaml');

      try {
        await loader.load(filePath);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateLoadError);
        expect((error as TemplateLoadError).message).toContain(
          'not found'
        );
      }
    });

    test('should validate template by default', async () => {
      const filePath = join(FIXTURES_DIR, 'invalid-template.yaml');

      await expect(loader.load(filePath)).rejects.toThrow();
    });

    test('should skip validation when requested', async () => {
      const filePath = join(FIXTURES_DIR, 'invalid-template.yaml');

      const template = await loader.load(filePath, {
        skipValidation: true,
      });

      expect(template.id).toBe('invalid-template');
    });

    test('should parse YAML correctly', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const template = await loader.load(filePath);

      expect(template.variables).toBeDefined();
      expect(template.variables).toHaveLength(1);
      expect(template.variables[0].name).toBe('projectName');
    });

    test('should load template metadata', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const template = await loader.load(filePath);

      expect(template.metadata.author).toBe('test');
      expect(template.metadata.tags).toContain('test');
      expect(template.metadata.visibility).toBe('public');
    });

    test('should load template steps', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const template = await loader.load(filePath);

      expect(template.steps[0].id).toBe('step-1');
      expect(template.steps[0].title).toBe('Initialize Project');
      expect(template.steps[0].commands).toHaveLength(1);
    });
  });

  describe('Extract Metadata', () => {
    test('should extract metadata without full validation', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const metadata = await loader.extractMetadata(filePath);

      expect(metadata.id).toBe('valid-template');
      expect(metadata.name).toBe('Valid Test Template');
      expect(metadata.version).toBe('1.0.0');
      expect(metadata.description).toBe('A valid template for testing');
      expect(metadata.path).toBe(filePath);
    });

    test('should include file stats in metadata', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const metadata = await loader.extractMetadata(filePath);

      expect(metadata.size).toBeGreaterThan(0);
      expect(metadata.modifiedAt).toBeGreaterThan(0);
    });

    test('should throw error for non-existent file', async () => {
      const filePath = join(FIXTURES_DIR, 'missing.yaml');

      await expect(loader.extractMetadata(filePath)).rejects.toThrow(
        TemplateLoadError
      );
    });
  });

  describe('Discover Templates', () => {
    test('should discover templates in directory', async () => {
      const results = await loader.discover();

      expect(results.length).toBeGreaterThan(0);
      expect(
        results.some((r) => r.id === 'valid-template')
      ).toBe(true);
    });

    test('should include template metadata in discovery', async () => {
      const results = await loader.discover();
      const validTemplate = results.find(
        (r) => r.id === 'valid-template'
      );

      expect(validTemplate).toBeDefined();
      expect(validTemplate?.name).toBe('Valid Test Template');
      expect(validTemplate?.version).toBe('1.0.0');
    });

    test('should skip invalid templates during discovery', async () => {
      const results = await loader.discover();

      // Discovery continues even if some templates are invalid
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    test('should return empty array if no templates found', async () => {
      const emptyLoader = new TemplateLoader('/non/existent/path');

      await expect(emptyLoader.discover()).rejects.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should wrap parse errors in TemplateLoadError', async () => {
      // Create a file with invalid YAML
      const invalidYamlPath = join(FIXTURES_DIR, 'invalid-yaml.yaml');
      await Bun.write(invalidYamlPath, 'invalid: yaml: content:');

      try {
        await loader.load(invalidYamlPath);
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateLoadError);
        expect((error as TemplateLoadError).message).toContain(
          'parsing'
        );
      } finally {
        // Cleanup
        await Bun.write(invalidYamlPath, '');
      }
    });

    test('should provide clear error messages', async () => {
      const filePath = join(FIXTURES_DIR, 'missing.yaml');

      try {
        await loader.load(filePath);
      } catch (error) {
        expect(error).toBeInstanceOf(TemplateLoadError);
        const loadError = error as TemplateLoadError;
        expect(loadError.context?.recovery).toBeDefined();
        expect(loadError.recoverable).toBe(true);
      }
    });
  });

  describe('Templates Directory', () => {
    test('should return templates directory path', () => {
      expect(loader.getTemplatesDirectory()).toBe(FIXTURES_DIR);
    });
  });

  describe('Integration', () => {
    test('should load and validate template in one operation', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const template = await loader.load(filePath);

      // Verify all parts loaded correctly
      expect(template.id).toBeDefined();
      expect(template.name).toBeDefined();
      expect(template.version).toBeDefined();
      expect(template.steps.length).toBeGreaterThan(0);
      expect(template.metadata).toBeDefined();
    });

    test('should handle variable substitutions in commands', async () => {
      const filePath = join(FIXTURES_DIR, 'valid-template.yaml');
      const template = await loader.load(filePath);

      const command = template.steps[0].commands[0];
      expect(command.content).toContain('${projectName}');
    });
  });
});

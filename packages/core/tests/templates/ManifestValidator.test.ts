/**
 * Tests for TemplateManifest validation
 * Covers manifest schema validation, SPDX license validation, and security checks
 */

import { describe, expect, test } from 'bun:test';
import {
  validateManifest,
  validateManifestWithDetails,
  validateLicense,
  isPathTraversal,
  COMMON_SPDX_LICENSES,
} from '../../src/templates/ManifestValidator';
import type { TemplateManifest } from '../../src/templates/types';

describe('ManifestValidator', () => {
  describe('validateManifest', () => {
    test('should validate a complete valid manifest', () => {
      const manifest: TemplateManifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test', 'validation'],
        license: 'MIT',
        files: ['template.yaml', 'README.md'],
      };

      expect(validateManifest(manifest)).toBe(true);
    });

    test('should validate manifest with author object', () => {
      const manifest: TemplateManifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: {
          name: 'Test Author',
          email: 'test@example.com',
          url: 'https://example.com',
        },
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(true);
    });

    test('should validate manifest with optional fields', () => {
      const manifest: TemplateManifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template with optional fields',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
          directory: 'templates/project',
        },
        dependencies: [
          { name: 'base-template', version: '^1.0.0' },
          { name: 'optional-template', version: '~2.1.0', optional: true },
        ],
        tags: ['test', 'validation'],
        license: 'Apache-2.0',
        homepage: 'https://example.com',
        bugs: 'https://github.com/test/template/issues',
        keywords: ['testing', 'validation'],
        files: ['template.yaml', 'README.md', 'LICENSE'],
        main: 'template.yaml',
        engines: {
          bmad: '>=1.0.0',
        },
      };

      expect(validateManifest(manifest)).toBe(true);
    });

    test('should reject manifest missing required name field', () => {
      const manifest = {
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest missing required version field', () => {
      const manifest = {
        name: 'test-template',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest missing required description field', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with invalid name format (uppercase)', () => {
      const manifest = {
        name: 'TestTemplate',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with invalid name format (spaces)', () => {
      const manifest = {
        name: 'test template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with invalid version format', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should accept manifest with prerelease version', () => {
      const manifest: TemplateManifest = {
        name: 'test-template',
        version: '1.0.0-beta.1',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(true);
    });

    test('should reject manifest with description too short', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'Short',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with too many tags', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: [
          'tag1',
          'tag2',
          'tag3',
          'tag4',
          'tag5',
          'tag6',
          'tag7',
          'tag8',
          'tag9',
          'tag10',
          'tag11',
        ],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with empty tags array', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: [],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with invalid repository type', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'svn',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with invalid dependency structure', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        dependencies: [{ name: 'base-template' }],
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with empty files array', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: [],
      };

      expect(validateManifest(manifest)).toBe(false);
    });
  });

  describe('validateLicense', () => {
    test('should accept MIT license', () => {
      const result = validateLicense('MIT');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should accept Apache-2.0 license', () => {
      const result = validateLicense('Apache-2.0');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should accept GPL-3.0 license', () => {
      const result = validateLicense('GPL-3.0');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should accept BSD-3-Clause license', () => {
      const result = validateLicense('BSD-3-Clause');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should accept ISC license', () => {
      const result = validateLicense('ISC');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should accept UNLICENSED identifier', () => {
      const result = validateLicense('UNLICENSED');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should accept "SEE LICENSE IN LICENSE.txt" pattern', () => {
      const result = validateLicense('SEE LICENSE IN LICENSE.txt');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should accept "SEE LICENSE IN LICENSE" pattern', () => {
      const result = validateLicense('SEE LICENSE IN LICENSE');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeUndefined();
    });

    test('should warn on unrecognized license but not fail', () => {
      const result = validateLicense('Custom-License-1.0');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
      expect(result.warning).toContain('Unrecognized license');
    });

    test('should warn on proprietary license identifier', () => {
      const result = validateLicense('Proprietary');
      expect(result.valid).toBe(true);
      expect(result.warning).toBeDefined();
    });

    test('should have all common SPDX licenses', () => {
      // Verify that all common licenses are recognized
      expect(COMMON_SPDX_LICENSES).toContain('MIT');
      expect(COMMON_SPDX_LICENSES).toContain('Apache-2.0');
      expect(COMMON_SPDX_LICENSES).toContain('GPL-3.0');
      expect(COMMON_SPDX_LICENSES).toContain('BSD-3-Clause');
      expect(COMMON_SPDX_LICENSES).toContain('ISC');
      expect(COMMON_SPDX_LICENSES).toContain('UNLICENSED');
    });
  });

  describe('validateManifestWithDetails', () => {
    test('should return detailed errors for invalid manifest', () => {
      const manifest = {
        name: 'TEST',
        version: '1.0',
        description: 'Short',
        author: 'Test',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: [],
        license: 'MIT',
        files: [],
      };

      const result = validateManifestWithDetails(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    test('should return warnings for unrecognized license', () => {
      const manifest: TemplateManifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'Unknown-License',
        files: ['template.yaml'],
      };

      const result = validateManifestWithDetails(manifest);

      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
      expect(result.warnings[0]).toContain('Unrecognized license');
    });

    test('should return no errors or warnings for valid manifest', () => {
      const manifest: TemplateManifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      const result = validateManifestWithDetails(manifest);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings).toHaveLength(0);
    });
  });

  // P0 Security Tests for Path Traversal (SEC-002)
  describe('path traversal security (P0)', () => {
    test('isPathTraversal should detect ../ pattern', () => {
      expect(isPathTraversal('../../../etc/passwd')).toBe(true);
      expect(isPathTraversal('foo/../bar')).toBe(true);
      expect(isPathTraversal('../../malicious')).toBe(true);
    });

    test('isPathTraversal should detect ..\\ pattern (Windows)', () => {
      expect(isPathTraversal('..\\..\\windows\\system32')).toBe(true);
      expect(isPathTraversal('foo\\..\\bar')).toBe(true);
    });

    test('isPathTraversal should detect absolute Unix paths', () => {
      expect(isPathTraversal('/etc/passwd')).toBe(true);
      expect(isPathTraversal('/root/.ssh/id_rsa')).toBe(true);
    });

    test('isPathTraversal should detect absolute Windows paths', () => {
      expect(isPathTraversal('C:\\Windows\\System32')).toBe(true);
      expect(isPathTraversal('D:\\sensitive\\data')).toBe(true);
    });

    test('isPathTraversal should detect null bytes', () => {
      expect(isPathTraversal('file.txt\0malicious')).toBe(true);
    });

    test('isPathTraversal should accept safe relative paths', () => {
      expect(isPathTraversal('template.yaml')).toBe(false);
      expect(isPathTraversal('src/template.yaml')).toBe(false);
      expect(isPathTraversal('foo/bar/baz.txt')).toBe(false);
    });

    test('should reject manifest with path traversal in name - caught by schema', () => {
      // Name with ../ won't pass schema pattern ^[a-z0-9-]+$
      const manifest = {
        name: '../../../malicious',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml'],
      };

      // Schema validation fails first (pattern mismatch)
      expect(validateManifest(manifest)).toBe(false);
    });

    test('should reject manifest with path traversal in files array', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml', '../../../etc/passwd'],
      };

      expect(() => validateManifest(manifest)).toThrow(/path traversal/i);
    });

    test('should reject manifest with absolute path in files array', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['/etc/passwd', 'template.yaml'],
      };

      expect(() => validateManifest(manifest)).toThrow(/path traversal/i);
    });

    test('should reject manifest with Windows absolute path in files', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['C:\\Windows\\System32\\malicious.dll'],
      };

      expect(() => validateManifest(manifest)).toThrow(/path traversal/i);
    });

    test('should accept manifest with safe relative paths in files', () => {
      const manifest: TemplateManifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['template.yaml', 'src/config.yaml', 'docs/README.md'],
      };

      expect(validateManifest(manifest)).toBe(true);
    });

    test('validateManifestWithDetails should return error for path traversal', () => {
      const manifest = {
        name: 'test-template',
        version: '1.0.0',
        description: 'A test template for validation',
        author: 'Test Author',
        repository: {
          type: 'git',
          url: 'https://github.com/test/template.git',
        },
        tags: ['test'],
        license: 'MIT',
        files: ['../../../malicious'],
      };

      const result = validateManifestWithDetails(manifest);

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toMatch(/path traversal/i);
    });
  });
});

/**
 * Tests for template authoring documentation validation
 * Ensures documentation is complete, accurate, and up-to-date
 */

import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';

const docsDir = join(__dirname, '..', '..', '..', '..', 'docs', 'guides');
const templateAuthoringDoc = join(docsDir, 'template-authoring.md');

describe('Template Authoring Documentation', () => {
  describe('File Existence', () => {
    test('should have template-authoring.md file', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const exists = await file.exists();

      expect(exists).toBe(true);
    });

    test('should not be empty', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      expect(content.length).toBeGreaterThan(1000); // Substantial content
    });
  });

  describe('Required Sections', () => {
    let docContent: string;

    // Load doc once for all tests
    test('should load documentation content', async () => {
      const file = Bun.file(templateAuthoringDoc);
      docContent = await file.text();

      expect(docContent).toBeDefined();
    });

    test('should have manifest format section', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should document manifest format
      expect(content).toMatch(/manifest.*format/i);
      expect(content).toMatch(/template\.json|template\.manifest\.json/i);
    });

    test('should document all required manifest fields', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // All required fields should be documented
      const requiredFields = [
        'name',
        'version',
        'description',
        'author',
        'repository',
        'tags',
        'license',
        'files',
      ];

      for (const field of requiredFields) {
        expect(content).toMatch(new RegExp(field, 'i'));
      }
    });

    test('should have Git repository structure section', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should explain Git repository requirements
      expect(content).toMatch(/git.*repository|repository.*structure/i);
      expect(content).toMatch(/template\.yaml|template\.json/i);
    });

    test('should document variable usage', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should explain how to use variables
      expect(content).toMatch(/variable|substitution/i);
      expect(content).toMatch(/\$\{.*\}|\{\{.*\}\}/); // Variable syntax examples
    });

    test('should document dependency declaration', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should explain dependency management
      expect(content).toMatch(/dependenc(y|ies)/i);
      expect(content).toMatch(/version|constraint/i);
    });

    test('should have testing guidelines section', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should explain how to write tests
      expect(content).toMatch(/test|testing/i);
      expect(content).toMatch(/tests\.json|test.*case/i);
    });

    test('should document test case format', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should explain test case structure
      expect(content).toMatch(/assertion|assert/i);
      expect(content).toMatch(/equals|contains|exists/i); // Assertion types
    });

    test('should have security best practices section', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should include security guidance
      expect(content).toMatch(/security|safe|dangerous/i);
    });

    test('should document dangerous commands', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should warn about dangerous patterns
      expect(content).toMatch(/rm.*-rf|dangerous.*command|avoid/i);
    });

    test('should have troubleshooting section', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should help with common issues
      expect(content).toMatch(/troubleshoot|common.*issue|problem|error/i);
    });
  });

  describe('Code Examples', () => {
    test('should include manifest example', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should have JSON code blocks with manifest examples
      expect(content).toMatch(/```json[\s\S]*"name":/);
      expect(content).toMatch(/```json[\s\S]*"version":/);
    });

    test('should include template.yaml example', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should have YAML code blocks
      expect(content).toMatch(/```ya?ml/i);
    });

    test('should include test case example', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should show how to write tests
      expect(content).toMatch(/```json[\s\S]*"assertions":/i);
    });

    test('should include variable substitution example', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should demonstrate variable usage ({{variableName}} syntax)
      expect(content).toMatch(/\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/); // {{variableName}}
    });
  });

  describe('Documentation Structure', () => {
    test('should have proper markdown headers', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should use markdown headers
      expect(content).toMatch(/^#+ /m); // At least one header
    });

    test('should have table of contents or clear structure', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should be well-organized
      const headerCount = (content.match(/^#{1,3} /gm) ?? []).length;
      expect(headerCount).toBeGreaterThan(5); // Multiple sections
    });

    test('should use code blocks appropriately', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should have multiple code examples
      const codeBlocks = (content.match(/```/g) ?? []).length;
      expect(codeBlocks).toBeGreaterThanOrEqual(6); // At least 3 code blocks (open + close)
    });
  });

  describe('Content Quality', () => {
    test('should have sufficient content length', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Story requirement: 606 lines documented
      const lines = content.split('\n').length;
      expect(lines).toBeGreaterThan(200); // Substantial documentation
    });

    test('should not have TODO or FIXME markers', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Documentation should be complete
      expect(content).not.toMatch(/TODO|FIXME|XXX/);
    });

    test('should not have placeholder text', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should not have common placeholders
      expect(content).not.toMatch(/\[INSERT.*\]|\[TODO\]|Lorem ipsum/i);
    });

    test('should use consistent terminology', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should consistently reference key concepts
      const manifestCount = (content.match(/manifest/gi) ?? []).length;
      const templateCount = (content.match(/template/gi) ?? []).length;

      expect(manifestCount).toBeGreaterThan(5);
      expect(templateCount).toBeGreaterThan(10);
    });
  });

  describe('Links and References', () => {
    test('should reference example templates', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should point to examples
      expect(content).toMatch(/example|sample/i);
    });

    test('should not have broken internal links', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Extract markdown links: [text](path)
      const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
      const links = Array.from(content.matchAll(linkPattern));

      for (const match of links) {
        const linkPath = match[2];

        // Skip external URLs and anchors
        if (linkPath.startsWith('http') || linkPath.startsWith('#')) {
          continue;
        }

        // Internal relative paths should be valid
        // Note: This is a basic check - full validation would require resolving paths
        expect(linkPath).not.toMatch(/undefined|null|TODO/i);
      }
    });
  });

  describe('Practical Usability', () => {
    test('should provide step-by-step instructions', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should have numbered or bulleted lists for steps
      expect(content).toMatch(/^[\d\-\*] /m); // List items
    });

    test('should include practical examples', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should show real examples, not just theory
      const exampleCount = (content.match(/example|e\.g\.|for instance/gi) ?? []).length;
      expect(exampleCount).toBeGreaterThan(5);
    });

    test('should explain "why" not just "what"', async () => {
      const file = Bun.file(templateAuthoringDoc);
      const content = await file.text();

      // Should provide rationale and context
      expect(content).toMatch(/because|reason|why|purpose|benefit/i);
    });
  });
});

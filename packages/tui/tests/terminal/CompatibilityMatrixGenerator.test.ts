import { describe, it, expect, beforeEach } from 'bun:test';
import { CompatibilityMatrixGenerator } from '../../src/terminal/CompatibilityMatrixGenerator';
import type { CompatibilityMatrix } from '../../src/terminal/CompatibilityMatrixGenerator';

describe('CompatibilityMatrixGenerator', () => {
  let generator: CompatibilityMatrixGenerator;

  beforeEach(() => {
    generator = new CompatibilityMatrixGenerator();
  });

  describe('Matrix Generation', () => {
    it('should generate a complete compatibility matrix', async () => {
      const matrix = await generator.generateMatrix();

      expect(matrix).toBeDefined();
      expect(matrix.version).toBe('1.0.0');
      expect(matrix.generatedAt).toBeDefined();
      expect(matrix.terminals).toBeInstanceOf(Array);
      expect(matrix.recommendations).toBeInstanceOf(Map);
      expect(matrix.knownIssues).toBeInstanceOf(Map);
      expect(matrix.workarounds).toBeInstanceOf(Map);
    });

    it('should include all required terminals', async () => {
      const matrix = await generator.generateMatrix();
      const terminalNames = matrix.terminals.map((t) => t.name);

      // Check for required terminals
      expect(terminalNames).toContain('macOS Terminal.app');
      expect(terminalNames).toContain('iTerm2');
      expect(terminalNames).toContain('Alacritty');
      expect(terminalNames).toContain('Windows Terminal');
    });

    it('should set lastUpdated timestamp for all entries', async () => {
      const matrix = await generator.generateMatrix();
      const now = new Date();

      for (const terminal of matrix.terminals) {
        const lastUpdated = new Date(terminal.lastUpdated);
        expect(lastUpdated.getTime()).toBeLessThanOrEqual(now.getTime());
        expect(now.getTime() - lastUpdated.getTime()).toBeLessThan(1000); // Within 1 second
      }
    });

    it('should include feature extraction for each terminal', async () => {
      const matrix = await generator.generateMatrix();

      for (const terminal of matrix.terminals) {
        expect(terminal.features).toBeDefined();
        expect(['none', 'basic', '256', 'truecolor']).toContain(
          terminal.features.colors
        );
        expect(['none', 'basic', 'extended', 'emoji']).toContain(
          terminal.features.unicode
        );
        expect(['none', 'basic', 'advanced']).toContain(
          terminal.features.mouse
        );
      }
    });
  });

  describe('Markdown Export', () => {
    it('should export matrix as valid Markdown', async () => {
      const matrix = await generator.generateMatrix();
      const markdown = generator.exportAsMarkdown(matrix);

      expect(markdown).toContain('# Terminal Compatibility Matrix');
      expect(markdown).toContain('## Supported Terminals');
      expect(markdown).toContain('| Terminal | Version | Platform | Colors | Unicode | Mouse | Notes |');
      expect(markdown).toContain('## Recommendations');
    });

    it('should include all terminals in Markdown table', async () => {
      const matrix = await generator.generateMatrix();
      const markdown = generator.exportAsMarkdown(matrix);

      for (const terminal of matrix.terminals) {
        expect(markdown).toContain(`| ${terminal.name}`);
      }
    });

    it('should include known issues in Markdown', async () => {
      const matrix = await generator.generateMatrix();
      const markdown = generator.exportAsMarkdown(matrix);

      if (matrix.knownIssues.size > 0) {
        expect(markdown).toContain('## Known Issues');
      }
    });

    it('should include workarounds in Markdown', async () => {
      const matrix = await generator.generateMatrix();
      const markdown = generator.exportAsMarkdown(matrix);

      if (matrix.workarounds.size > 0) {
        expect(markdown).toContain('## Workarounds');
      }
    });
  });

  describe('JSON Export', () => {
    it('should export matrix as valid JSON', async () => {
      const matrix = await generator.generateMatrix();
      const json = generator.exportAsJSON(matrix);

      const parsed = JSON.parse(json);
      expect(parsed).toBeDefined();
      expect(parsed.version).toBe(matrix.version);
      expect(parsed.terminals).toBeInstanceOf(Array);
      expect(parsed.recommendations).toBeInstanceOf(Object);
      expect(parsed.knownIssues).toBeInstanceOf(Object);
      expect(parsed.workarounds).toBeInstanceOf(Object);
    });

    it('should preserve all terminal data in JSON export', async () => {
      const matrix = await generator.generateMatrix();
      const json = generator.exportAsJSON(matrix);
      const parsed = JSON.parse(json);

      expect(parsed.terminals.length).toBe(matrix.terminals.length);
      for (let i = 0; i < matrix.terminals.length; i++) {
        expect(parsed.terminals[i].name).toBe(matrix.terminals[i].name);
        expect(parsed.terminals[i].features).toEqual(
          matrix.terminals[i].features
        );
      }
    });
  });

  describe('Matrix Validation', () => {
    it('should validate required terminals are present', async () => {
      const matrix = await generator.generateMatrix();
      const errors = generator.validateMatrix(matrix);

      // Should have no errors for required terminals
      const terminalErrors = errors.filter(e => e.includes('Missing required terminal'));
      expect(terminalErrors).toHaveLength(0);
    });

    it('should detect missing required terminals', () => {
      const incompleteMatrix: CompatibilityMatrix = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        terminals: [
          {
            name: 'CustomTerminal',
            platform: 'linux',
            capabilities: {
              color: true,
              color256: false,
              trueColor: false,
              unicode: true,
              mouse: false,
              altScreen: false,
              cursorShape: false,
            },
            features: {
              colors: 'basic',
              unicode: 'basic',
              mouse: 'none',
            },
            tested: true,
            lastUpdated: new Date().toISOString(),
          },
        ],
        recommendations: new Map(),
        knownIssues: new Map(),
        workarounds: new Map(),
      };

      const errors = generator.validateMatrix(incompleteMatrix);
      expect(errors).toContain('Missing required terminal: macOS Terminal.app');
      expect(errors).toContain('Missing required terminal: iTerm2');
      expect(errors).toContain('Missing required terminal: Alacritty');
      expect(errors).toContain('Missing required terminal: Windows Terminal');
    });

    it('should detect outdated terminal data', () => {
      const oldDate = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000); // 31 days ago

      const outdatedMatrix: CompatibilityMatrix = {
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        terminals: [
          {
            name: 'macOS Terminal.app',
            platform: 'darwin',
            capabilities: {
              color: true,
              color256: true,
              trueColor: false,
              unicode: true,
              mouse: true,
              altScreen: true,
              cursorShape: false,
            },
            features: {
              colors: '256',
              unicode: 'basic',
              mouse: 'basic',
            },
            tested: true,
            lastUpdated: oldDate.toISOString(),
          },
        ],
        recommendations: new Map(),
        knownIssues: new Map(),
        workarounds: new Map(),
      };

      const errors = generator.validateMatrix(outdatedMatrix);
      expect(errors).toContain('Terminal data outdated: macOS Terminal.app');
    });
  });

  describe('Recommendations', () => {
    it('should generate color support recommendations', async () => {
      const matrix = await generator.generateMatrix();

      const colorRecommendation = matrix.recommendations.get('Best Color Support');
      if (matrix.terminals.some((t) => t.features.colors === 'truecolor')) {
        expect(colorRecommendation).toBeDefined();
        expect(colorRecommendation).toContain('For the best color experience');
      }
    });

    it('should generate performance recommendations', async () => {
      const matrix = await generator.generateMatrix();

      const perfRecommendation = matrix.recommendations.get('Performance');
      expect(perfRecommendation).toBeDefined();
      expect(perfRecommendation).toContain('GPU-accelerated');
    });
  });

  describe('Version Management', () => {
    it('should allow setting custom version', async () => {
      generator.setVersion('2.0.0');
      const matrix = await generator.generateMatrix();

      expect(matrix.version).toBe('2.0.0');
    });

    it('should use default version if not set', async () => {
      const matrix = await generator.generateMatrix();
      expect(matrix.version).toBe('1.0.0');
    });
  });
});
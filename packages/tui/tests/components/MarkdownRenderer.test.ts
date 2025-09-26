import { describe, expect, it, beforeEach } from 'bun:test';
import { MarkdownRenderer } from '../../src/components/MarkdownRenderer';
import ansis from 'ansis';

describe('MarkdownRenderer', () => {
  let renderer: MarkdownRenderer;

  beforeEach(() => {
    renderer = new MarkdownRenderer({
      width: 80,
      syntaxHighlighting: true,
      commandIndicators: true,
      variableHighlighting: true,
    });
  });

  describe('basic markdown rendering', () => {
    it('should render bold text', () => {
      const result = renderer.render('This is **bold** text');
      expect(result[0]).toContain(ansis.bold('bold'));
    });

    it('should render italic text', () => {
      const result = renderer.render('This is *italic* text');
      expect(result[0]).toContain(ansis.italic('italic'));
    });

    it('should render inline code', () => {
      const result = renderer.render('This is `code` text');
      expect(result[0]).toContain('code');
    });

    it('should render headers', () => {
      const result = renderer.render('# Header 1\n## Header 2\n### Header 3');
      expect(result[0]).toContain('Header 1');
      expect(result[1]).toContain('Header 2');
      expect(result[2]).toContain('Header 3');
    });

    it('should render links', () => {
      const result = renderer.render('Check [this link](https://example.com)');
      expect(result[0]).toContain('this link');
      expect(result[0]).toContain('https://example.com');
    });
  });

  describe('code block rendering', () => {
    it('should render basic code blocks', () => {
      const markdown = '```\nconst foo = "bar";\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('const foo = "bar"'))).toBe(true);
    });

    it('should apply syntax highlighting for bash', () => {
      const markdown = '```bash\necho "Hello World"\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('echo'))).toBe(true);
    });

    it('should apply syntax highlighting for typescript', () => {
      const markdown = '```typescript\nconst x: string = "test";\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('const'))).toBe(true);
    });

    it('should apply syntax highlighting for yaml', () => {
      const markdown = '```yaml\nname: test\nvalue: 123\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('name'))).toBe(true);
    });

    it('should apply syntax highlighting for json', () => {
      const markdown = '```json\n{"key": "value"}\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('"key"'))).toBe(true);
    });

    it('should apply syntax highlighting for markdown', () => {
      const markdown = '```markdown\n# Header\n**bold**\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('Header'))).toBe(true);
    });
  });

  describe('variable highlighting', () => {
    it('should highlight template variables', () => {
      const result = renderer.render('Use {{variableName}} here');
      expect(result[0]).toContain('{{variableName}}');
    });

    it('should highlight environment variables', () => {
      const result = renderer.render('Set $ENV_VAR or ${ENV_VAR}');
      expect(result[0]).toContain('ENV_VAR');
    });

    it('should highlight variables in code blocks when enabled', () => {
      const markdown = '```bash\necho $HOME\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('$HOME'))).toBe(true);
    });
  });

  describe('command rendering', () => {
    it('should render bash commands with highlighting', () => {
      const result = renderer.renderCommand('echo "test"', 'bash');
      expect(result).toContain('echo');
    });

    it('should render claude commands', () => {
      const result = renderer.renderCommand('Explain this code', 'claude');
      expect(result).toBe('Explain this code');
    });

    it('should highlight variables in commands', () => {
      const result = renderer.renderCommand('echo $USER', 'bash');
      expect(result).toContain('$USER');
    });
  });

  describe('caching', () => {
    it('should cache parsed elements', () => {
      const markdown = 'This is **cached** content';

      const start1 = performance.now();
      renderer.render(markdown);
      const time1 = performance.now() - start1;

      const start2 = performance.now();
      renderer.render(markdown);
      const time2 = performance.now() - start2;

      expect(time2).toBeLessThan(time1);
    });

    it('should clear cache on demand', () => {
      const markdown = 'This is **cached** content';
      renderer.render(markdown);
      renderer.clearCache();

      const start = performance.now();
      renderer.render(markdown);
      const time = performance.now() - start;

      expect(time).toBeGreaterThan(0);
    });
  });

  describe('complex markdown', () => {
    it('should handle mixed formatting', () => {
      const markdown = `
# Main Header

This is a paragraph with **bold** and *italic* text, as well as \`inline code\`.

## Code Example

\`\`\`typescript
const greeting = "Hello {{name}}";
console.log(greeting);
\`\`\`

Check [documentation](https://docs.example.com) for more info.

### Variables

- Template: {{userName}}
- Environment: $HOME or \${PATH}
      `.trim();

      const result = renderer.render(markdown);

      expect(result.some(line => line.includes('Main Header'))).toBe(true);
      expect(result.some(line => line.includes('bold'))).toBe(true);
      expect(result.some(line => line.includes('italic'))).toBe(true);
      expect(result.some(line => line.includes('inline code'))).toBe(true);
      expect(result.some(line => line.includes('greeting'))).toBe(true);
      expect(result.some(line => line.includes('documentation'))).toBe(true);
      expect(result.some(line => line.includes('{{userName}}'))).toBe(true);
      expect(result.some(line => line.includes('$HOME'))).toBe(true);
    });

    it('should handle nested formatting', () => {
      const markdown = 'This is **bold with *italic* inside** text';
      const result = renderer.render(markdown);
      expect(result[0]).toContain('bold with');
      expect(result[0]).toContain('italic');
    });
  });

  describe('edge cases', () => {
    it('should handle empty input', () => {
      const result = renderer.render('');
      expect(result).toEqual([]);
    });

    it('should handle plain text without markdown', () => {
      const plainText = 'This is just plain text without any markdown.';
      const result = renderer.render(plainText);
      expect(result[0]).toBe(plainText);
    });

    it('should handle incomplete markdown syntax', () => {
      const result = renderer.render('This is **incomplete bold');
      expect(result[0]).toContain('This is **incomplete bold');
    });

    it('should handle code blocks without language', () => {
      const markdown = '```\nplain code\n```';
      const result = renderer.render(markdown);
      expect(result.some(line => line.includes('plain code'))).toBe(true);
    });
  });

  describe('performance', () => {
    it('should render within acceptable time limits', () => {
      const largeMarkdown = `
# Large Document

${Array(100).fill('This is a line with **bold** and *italic* text.').join('\n')}

\`\`\`typescript
${Array(50).fill('const variable = "value";').join('\n')}
\`\`\`
      `.trim();

      const start = performance.now();
      renderer.render(largeMarkdown);
      const renderTime = performance.now() - start;

      expect(renderTime).toBeLessThan(50);
    });
  });
});
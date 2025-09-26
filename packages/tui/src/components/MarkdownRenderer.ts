import { createLogger } from '@checklist/core/utils/logger';
import ansis from 'ansis';
import {
  MarkdownElementRenderer,
  type ParsedElement,
} from './MarkdownElementRenderer';
import { MarkdownSyntaxHighlighter } from './MarkdownSyntaxHighlighter';

const logger = createLogger('checklist:tui:markdown-renderer');

export interface MarkdownRendererOptions {
  width: number;
  syntaxHighlighting?: boolean;
  commandIndicators?: boolean;
  variableHighlighting?: boolean;
}

export class MarkdownRenderer {
  private options: Required<MarkdownRendererOptions>;
  private parseCache: Map<string, ParsedElement[]> = new Map();
  private highlighter: MarkdownSyntaxHighlighter;
  private elementRenderer: MarkdownElementRenderer;

  constructor(options: MarkdownRendererOptions) {
    this.options = {
      width: options.width,
      syntaxHighlighting: options.syntaxHighlighting ?? true,
      commandIndicators: options.commandIndicators ?? true,
      variableHighlighting: options.variableHighlighting ?? true,
    };
    this.highlighter = new MarkdownSyntaxHighlighter();
    this.elementRenderer = new MarkdownElementRenderer();
  }

  public render(markdown: string): string[] {
    const cached = this.parseCache.get(markdown);
    const elements = cached ?? this.parse(markdown);

    if (!cached) {
      this.parseCache.set(markdown, elements);
    }

    return this.elementsToLines(elements);
  }

  private parse(markdown: string): ParsedElement[] {
    const elements: ParsedElement[] = [];

    if (markdown === '') {
      return elements;
    }

    const lines = markdown.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('```')) {
        const blockResult = this.parseCodeBlock(lines, i);
        elements.push(blockResult.element);
        i = blockResult.endIndex;
      } else if (line.startsWith('#')) {
        elements.push(this.parseHeader(line));
      } else {
        const inlineElements = this.parseInlineElements(line);
        if (inlineElements.length > 0) {
          elements.push(...inlineElements);
        } else if (line.length > 0) {
          elements.push({ type: 'text', content: line });
        }
      }
    }

    return elements;
  }

  private parseCodeBlock(
    lines: string[],
    startIndex: number
  ): { element: ParsedElement; endIndex: number } {
    const startLine = lines[startIndex];
    const language = startLine.slice(3).trim() || 'text';
    const codeLines: string[] = [];

    let endIndex = startIndex + 1;
    while (endIndex < lines.length && !lines[endIndex].startsWith('```')) {
      codeLines.push(lines[endIndex]);
      endIndex++;
    }

    return {
      element: {
        type: 'codeblock',
        content: codeLines.join('\n'),
        language,
      },
      endIndex,
    };
  }

  private parseHeader(line: string): ParsedElement {
    const match = line.match(/^(#{1,6})\s+(.*)$/);
    if (!match) {
      return { type: 'text', content: line };
    }

    return {
      type: 'header',
      content: match[2],
      level: match[1].length,
    };
  }

  private parseInlineElements(line: string): ParsedElement[] {
    const elements: ParsedElement[] = [];
    let remaining = line;

    while (remaining.length > 0) {
      const match = this.findEarliestMatch(remaining);

      if (!match) {
        elements.push({ type: 'text', content: remaining });
        break;
      }

      if (match.index > 0) {
        elements.push({
          type: 'text',
          content: remaining.slice(0, match.index),
        });
      }

      elements.push(match.element);
      remaining = remaining.slice(match.index + match.length);
    }

    return elements;
  }

  private findEarliestMatch(
    text: string
  ): { element: ParsedElement; index: number; length: number } | null {
    const patterns = [
      { regex: /\*\*([^*]+)\*\*/, type: 'bold' as const },
      { regex: /\*([^*]+)\*/, type: 'italic' as const },
      { regex: /`([^`]+)`/, type: 'code' as const },
      { regex: /\[([^\]]+)\]\(([^)]+)\)/, type: 'link' as const },
    ];

    let earliest: {
      element: ParsedElement;
      index: number;
      length: number;
    } | null = null;

    for (const pattern of patterns) {
      const match = text.match(pattern.regex);
      if (match?.index === undefined) continue;

      if (earliest === null || match.index < earliest.index) {
        const element: ParsedElement =
          pattern.type === 'link'
            ? { type: 'link', content: match[1], url: match[2] }
            : { type: pattern.type, content: match[1] };
        earliest = { element, index: match.index, length: match[0].length };
      }
    }

    return earliest;
  }

  private elementsToLines(elements: ParsedElement[]): string[] {
    const lines: string[] = [];
    let currentLine = '';

    for (const element of elements) {
      const rendered = this.renderElement(element);
      if (element.type === 'codeblock' || element.type === 'header') {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = '';
        }
        if (element.type === 'codeblock') {
          lines.push(...rendered.split('\n'));
        } else {
          lines.push(rendered);
        }
      } else {
        currentLine += rendered;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  private renderElement(element: ParsedElement): string {
    const renderer = this.getRenderer(element.type);
    return renderer(element);
  }

  private getRenderer(
    type: ParsedElement['type']
  ): (element: ParsedElement) => string {
    const renderers: Record<
      ParsedElement['type'],
      (element: ParsedElement) => string
    > = {
      text: (el) => this.renderText(el.content),
      bold: (el) => this.elementRenderer.renderBold(el.content),
      italic: (el) => this.elementRenderer.renderItalic(el.content),
      code: (el) => this.elementRenderer.renderCode(el.content),
      codeblock: (el) =>
        this.renderCodeBlock(el.content, el.language ?? 'text'),
      link: (el) => this.elementRenderer.renderLink(el.content, el.url),
      header: (el) =>
        this.elementRenderer.renderHeader(el.content, el.level ?? 1),
    };
    return renderers[type] ?? ((el) => el.content);
  }

  private renderText(content: string): string {
    const text = this.elementRenderer.renderText(content);
    return this.options.variableHighlighting
      ? this.highlighter.highlightVariables(text)
      : text;
  }

  private renderCodeBlock(content: string, language: string): string {
    const lines = content.split('\n');
    const highlighted = this.options.syntaxHighlighting
      ? this.applySyntaxHighlighting(lines, language)
      : lines;

    return highlighted
      .map((line) =>
        ansis.bgGray.white(` ${line.padEnd(this.options.width - 2)} `)
      )
      .join('\n');
  }

  private applySyntaxHighlighting(lines: string[], language: string): string[] {
    const lang = language.toLowerCase();
    return this.getHighlightedLines(lines, lang);
  }

  private getHighlightedLines(lines: string[], lang: string): string[] {
    if (this.isBashLang(lang)) return this.highlighter.highlightBash(lines);
    if (this.isTypeScriptLang(lang))
      return this.highlighter.highlightTypeScript(lines);
    if (this.isYamlLang(lang)) return this.highlighter.highlightYaml(lines);
    if (lang === 'json') return this.highlighter.highlightJson(lines);
    if (this.isMarkdownLang(lang))
      return this.highlighter.highlightMarkdown(lines);
    return lines;
  }

  private isBashLang(lang: string): boolean {
    return lang === 'bash' || lang === 'shell' || lang === 'sh';
  }

  private isTypeScriptLang(lang: string): boolean {
    return lang === 'typescript' || lang === 'ts';
  }

  private isYamlLang(lang: string): boolean {
    return lang === 'yaml' || lang === 'yml';
  }

  private isMarkdownLang(lang: string): boolean {
    return lang === 'markdown' || lang === 'md';
  }

  public renderCommand(command: string, type: string): string {
    let rendered = command;

    if (this.options.variableHighlighting) {
      rendered = this.highlighter.highlightVariables(rendered);
    }

    if (this.options.syntaxHighlighting) {
      if (type === 'bash') {
        rendered = this.highlighter.highlightBash([rendered])[0];
      }
    }

    return rendered;
  }

  public clearCache(): void {
    this.parseCache.clear();
    logger.debug({ msg: 'Parse cache cleared' });
  }
}

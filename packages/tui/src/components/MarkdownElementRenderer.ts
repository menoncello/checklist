import ansis from 'ansis';

export interface ParsedElement {
  type: 'text' | 'bold' | 'italic' | 'code' | 'codeblock' | 'link' | 'header';
  content: string;
  language?: string;
  level?: number;
  url?: string;
}

export class MarkdownElementRenderer {
  public renderText(content: string): string {
    return content;
  }

  public renderBold(content: string): string {
    return ansis.bold(content);
  }

  public renderItalic(content: string): string {
    return ansis.italic(content);
  }

  public renderCode(content: string): string {
    return ansis.bgGray.white(` ${content} `);
  }

  public renderLink(content: string, url?: string): string {
    return `${ansis.underline.blue(content)} (${ansis.gray(url ?? '')})`;
  }

  public renderHeader(content: string, level: number): string {
    const prefix = '#'.repeat(level);
    if (level === 1) {
      return ansis.bold.cyan(`${prefix} ${content}`);
    } else if (level === 2) {
      return ansis.bold.green(`${prefix} ${content}`);
    } else {
      return ansis.bold(`${prefix} ${content}`);
    }
  }
}

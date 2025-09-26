import ansis from 'ansis';

export class MarkdownSyntaxHighlighter {
  public highlightBash(lines: string[]): string[] {
    return lines.map((line) => {
      let highlighted = line;
      highlighted = highlighted.replace(
        /\b(echo|cd|ls|pwd|mkdir|rm|cp|mv|cat|grep|sed|awk|bun|npm|git)\b/g,
        ansis.cyan('$1')
      );
      highlighted = highlighted.replace(/#.*$/g, ansis.gray('$&'));
      highlighted = highlighted.replace(
        /(['"])([^'"]*)\1/g,
        ansis.yellow('$1$2$1')
      );
      return highlighted;
    });
  }

  public highlightTypeScript(lines: string[]): string[] {
    return lines.map((line) => {
      let highlighted = line;
      highlighted = highlighted.replace(
        /\b(const|let|var|function|class|interface|type|import|export|from|async|await|return|if|else|for|while|try|catch|throw|new)\b/g,
        ansis.magenta('$1')
      );
      highlighted = highlighted.replace(/\/\/.*$/g, ansis.gray('$&'));
      highlighted = highlighted.replace(
        /(['"`])([^'"`]*)\1/g,
        ansis.green('$1$2$1')
      );
      highlighted = highlighted.replace(
        /\b(true|false|null|undefined)\b/g,
        ansis.blue('$1')
      );
      return highlighted;
    });
  }

  public highlightYaml(lines: string[]): string[] {
    return lines.map((line) => {
      let highlighted = line;
      highlighted = highlighted.replace(
        /^(\s*)([^:]+):/g,
        (match, spaces, key) => {
          return `${spaces}${ansis.blue(key)}:`;
        }
      );
      highlighted = highlighted.replace(/#.*$/g, ansis.gray('$&'));
      highlighted = highlighted.replace(
        /:\s*(['"])([^'"]*)\1/g,
        `: ${ansis.green('$1$2$1')}`
      );
      return highlighted;
    });
  }

  public highlightJson(lines: string[]): string[] {
    return lines.map((line) => {
      let highlighted = line;
      highlighted = highlighted.replace(
        /"([^"]+)":/g,
        `${ansis.blue('"$1"')}:`
      );
      highlighted = highlighted.replace(
        /:\s*"([^"]*)"/g,
        `: ${ansis.green('"$1"')}`
      );
      highlighted = highlighted.replace(
        /:\s*(true|false|null|\d+)/g,
        `: ${ansis.yellow('$1')}`
      );
      return highlighted;
    });
  }

  public highlightMarkdown(lines: string[]): string[] {
    return lines.map((line) => {
      let highlighted = line;
      highlighted = highlighted.replace(/^(#{1,6})\s+/g, ansis.cyan('$1 '));
      highlighted = highlighted.replace(
        /\*\*([^*]+)\*\*/g,
        ansis.bold('**$1**')
      );
      highlighted = highlighted.replace(/\*([^*]+)\*/g, ansis.italic('*$1*'));
      highlighted = highlighted.replace(/`([^`]+)`/g, ansis.bgGray('`$1`'));
      return highlighted;
    });
  }

  public highlightVariables(text: string): string {
    let highlighted = text;
    highlighted = highlighted.replace(/\{\{(\w+)\}\}/g, ansis.cyan('{{$1}}'));
    highlighted = highlighted.replace(/\$\{?(\w+)\}?/g, ansis.magenta('$&'));
    return highlighted;
  }
}

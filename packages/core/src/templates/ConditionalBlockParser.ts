/**
 * Conditional Block Parser - Parses {{#if}}...{{/if}} blocks
 */

/**
 * Conditional block structure
 */
export interface ConditionalBlock {
  fullMatch: string;
  ifCondition: string;
  ifContent: string;
  elseIfBlocks: Array<{ condition: string; content: string }>;
  elseContent?: string;
}

/**
 * Parses conditional blocks from templates
 */
export class ConditionalBlockParser {
  /**
   * Parse all conditional blocks
   */
  parse(template: string): ConditionalBlock[] {
    const blocks: ConditionalBlock[] = [];
    let index = 0;

    while (index < template.length) {
      const result = this.parseNextBlock(template, index);
      if (result === null) break;

      blocks.push(result.block);
      index = result.nextIndex;
    }

    return blocks;
  }

  /**
   * Parse next block
   */
  private parseNextBlock(
    template: string,
    startIndex: number
  ): { block: ConditionalBlock; nextIndex: number } | null {
    const ifStart = template.indexOf('{{#if ', startIndex);
    if (ifStart === -1) return null;

    const ifCondEnd = template.indexOf('}}', ifStart);
    if (ifCondEnd === -1) return null;

    const condition = template.substring(ifStart + 6, ifCondEnd).trim();
    const contentStart = ifCondEnd + 2;

    const endResult = this.findMatchingEnd(template, contentStart);
    if (endResult === null) return null;

    const fullMatch = template.substring(ifStart, endResult.ifEnd + 7);
    const parts = this.splitParts(endResult.innerContent);

    return {
      block: {
        fullMatch,
        ifCondition: condition,
        ifContent: parts.ifContent,
        elseIfBlocks: parts.elseIfBlocks,
        elseContent: parts.elseContent,
      },
      nextIndex: endResult.ifEnd + 7,
    };
  }

  /**
   * Find matching {{/if}}
   */
  private findMatchingEnd(
    template: string,
    contentStart: number
  ): { ifEnd: number; innerContent: string } | null {
    let depth = 1;
    let pos = contentStart;

    while (pos < template.length && depth > 0) {
      if (template.substring(pos, pos + 6) === '{{#if ') {
        depth++;
        pos += 6;
      } else if (template.substring(pos, pos + 7) === '{{/if}}') {
        depth--;
        if (depth === 0) {
          return {
            ifEnd: pos,
            innerContent: template.substring(contentStart, pos),
          };
        }
        pos += 7;
      } else {
        pos++;
      }
    }

    return null;
  }

  /**
   * Split into if, else-if, and else parts
   */
  private splitParts(content: string): {
    ifContent: string;
    elseIfBlocks: Array<{ condition: string; content: string }>;
    elseContent?: string;
  } {
    const elseIfBlocks: Array<{ condition: string; content: string }> = [];
    const result = this.processParts(content, elseIfBlocks);

    return {
      ifContent: result.ifContent !== '' ? result.ifContent : content,
      elseIfBlocks,
      elseContent: result.elseContent,
    };
  }

  /**
   * Process all parts (if, else-if, else)
   */
  private processParts(
    content: string,
    elseIfBlocks: Array<{ condition: string; content: string }>
  ): { ifContent: string; elseContent?: string } {
    let pos = 0;
    let ifContent = '';

    while (pos < content.length) {
      const result = this.processNextPart(
        content,
        pos,
        ifContent,
        elseIfBlocks
      );

      if (result.type === 'else') {
        return { ifContent: result.ifContent, elseContent: result.elseContent };
      }
      if (result.type === 'done') break;

      ifContent = result.ifContent;
      pos = result.nextPos;
    }

    return { ifContent };
  }

  /**
   * Process next part (else-if or else)
   */
  private processNextPart(
    content: string,
    currentPos: number,
    ifContent: string,
    elseIfBlocks: Array<{ condition: string; content: string }>
  ): {
    type: 'else-if' | 'else' | 'skip' | 'done';
    ifContent: string;
    nextPos: number;
    elseContent?: string;
  } {
    const elseIfIdx = content.indexOf('{{else if ', currentPos);
    const elseIdx = content.indexOf('{{else}}', currentPos);

    if (this.shouldProcessElseIf(elseIfIdx, elseIdx, content)) {
      return this.processElseIfBlock(
        content,
        elseIfIdx,
        ifContent,
        elseIfBlocks
      );
    }

    if (this.shouldProcessElse(elseIdx, content)) {
      return this.processElseBlock(content, elseIdx, ifContent);
    }

    return this.skipToNext(elseIfIdx, elseIdx, currentPos);
  }

  private shouldProcessElseIf(
    elseIfIdx: number,
    elseIdx: number,
    content: string
  ): boolean {
    return (
      elseIfIdx !== -1 &&
      (elseIdx === -1 || elseIfIdx < elseIdx) &&
      this.isAtDepthZero(content.substring(0, elseIfIdx))
    );
  }

  private shouldProcessElse(elseIdx: number, content: string): boolean {
    return elseIdx !== -1 && this.isAtDepthZero(content.substring(0, elseIdx));
  }

  private processElseIfBlock(
    content: string,
    elseIfIdx: number,
    ifContent: string,
    elseIfBlocks: Array<{ condition: string; content: string }>
  ) {
    const newIfContent =
      ifContent === '' ? content.substring(0, elseIfIdx) : ifContent;
    const condStart = elseIfIdx + 10;
    const condEnd = content.indexOf('}}', condStart);
    const condition = content.substring(condStart, condEnd).trim();
    const contentStart = condEnd + 2;
    const contentEnd = this.findContentEnd(content, contentStart);

    elseIfBlocks.push({
      condition,
      content: content.substring(contentStart, contentEnd),
    });

    return {
      type: 'else-if' as const,
      ifContent: newIfContent,
      nextPos: contentEnd,
    };
  }

  private processElseBlock(
    content: string,
    elseIdx: number,
    ifContent: string
  ) {
    return {
      type: 'else' as const,
      ifContent: ifContent === '' ? content.substring(0, elseIdx) : ifContent,
      nextPos: content.length,
      elseContent: content.substring(elseIdx + 8),
    };
  }

  private skipToNext(elseIfIdx: number, elseIdx: number, currentPos: number) {
    if (elseIfIdx !== -1) {
      return {
        type: 'skip' as const,
        ifContent: '',
        nextPos: elseIfIdx + 1,
      };
    }
    if (elseIdx !== -1) {
      return {
        type: 'skip' as const,
        ifContent: '',
        nextPos: elseIdx + 1,
      };
    }
    return { type: 'done' as const, ifContent: '', nextPos: currentPos };
  }

  /**
   * Find where else-if content ends
   */
  private findContentEnd(content: string, start: number): number {
    const nextElseIf = content.indexOf('{{else if ', start);
    const nextElse = content.indexOf('{{else}}', start);

    if (
      nextElseIf !== -1 &&
      this.isAtDepthZero(content.substring(0, nextElseIf))
    ) {
      return nextElseIf;
    }
    if (nextElse !== -1 && this.isAtDepthZero(content.substring(0, nextElse))) {
      return nextElse;
    }
    return content.length;
  }

  /**
   * Check if at depth zero
   */
  private isAtDepthZero(beforeText: string): boolean {
    let depth = 0;
    let pos = 0;

    while (pos < beforeText.length) {
      if (beforeText.substring(pos, pos + 6) === '{{#if ') {
        depth++;
        pos += 6;
      } else if (beforeText.substring(pos, pos + 7) === '{{/if}}') {
        depth--;
        pos += 7;
      } else {
        pos++;
      }
    }

    return depth === 0;
  }
}

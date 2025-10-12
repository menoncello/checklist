/**
 * Loop Block Parser - Parses {{#each}}...{{/each}} blocks
 */

/**
 * Loop block structure
 */
export interface LoopBlock {
  fullMatch: string;
  itemsVar: string;
  content: string;
}

/**
 * Parses loop blocks from templates
 */
export class LoopBlockParser {
  /**
   * Parse loop blocks from template
   */
  parse(template: string): LoopBlock[] {
    const blocks: LoopBlock[] = [];

    let index = 0;
    while (index < template.length) {
      const result = this.parseNextLoopBlock(template, index);
      if (result === null) break;

      blocks.push(result.block);
      index = result.nextIndex;
    }

    return blocks;
  }

  /**
   * Parse next loop block
   */
  private parseNextLoopBlock(
    template: string,
    startIndex: number
  ): {
    block: LoopBlock;
    nextIndex: number;
  } | null {
    const eachStart = template.indexOf('{{#each ', startIndex);
    if (eachStart === -1) return null;

    const eachVarEnd = template.indexOf('}}', eachStart);
    if (eachVarEnd === -1) return null;

    const itemsVar = template.substring(eachStart + 8, eachVarEnd).trim();
    const contentStart = eachVarEnd + 2;

    const endResult = this.findMatchingEachEnd(template, contentStart);
    if (endResult === null) return null;

    const { eachEnd, content } = endResult;
    const fullMatch = template.substring(eachStart, eachEnd + 9);

    return {
      block: { fullMatch, itemsVar, content },
      nextIndex: eachEnd + 9,
    };
  }

  /**
   * Find matching {{/each}}
   */
  private findMatchingEachEnd(
    template: string,
    contentStart: number
  ): { eachEnd: number; content: string } | null {
    let depth = 1;
    let pos = contentStart;

    while (pos < template.length && depth > 0) {
      if (template.substring(pos, pos + 8) === '{{#each ') {
        depth++;
        pos += 8;
      } else if (template.substring(pos, pos + 9) === '{{/each}}') {
        depth--;
        if (depth === 0) {
          const eachEnd = pos;
          const content = template.substring(contentStart, eachEnd);
          return { eachEnd, content };
        }
        pos += 9;
      } else {
        pos++;
      }
    }

    return null;
  }
}

export interface ParsedSequence {
  key?: string;
  modifiers: {
    ctrl?: boolean;
    alt?: boolean;
    shift?: boolean;
    meta?: boolean;
  };
  sequence: string;
  consumed: number;
}

export class EscapeSequenceParser {
  static parse(data: string, startIndex: number = 0): ParsedSequence | null {
    if (startIndex >= data.length || data[startIndex] !== '\x1b') {
      return null;
    }

    const remaining = data.slice(startIndex + 1);
    if (remaining.length === 0) {
      return { key: 'escape', modifiers: {}, sequence: '\x1b', consumed: 1 };
    }

    // CSI sequences (Control Sequence Introducer)
    if (remaining[0] === '[') {
      return this.parseCSISequence(remaining.slice(1), startIndex);
    }

    // OSC sequences (Operating System Command)
    if (remaining[0] === ']') {
      return this.parseOSCSequence(remaining.slice(1), startIndex);
    }

    // Function key sequences
    if (remaining[0] === 'O') {
      return this.parseFunctionKeySequence(remaining.slice(1), startIndex);
    }

    // Alt + key combinations
    if (remaining.length >= 1) {
      return this.parseAltSequence(remaining[0], startIndex);
    }

    return null;
  }

  private static parseCSISequence(sequence: string, baseIndex: number): ParsedSequence | null {
    const match = sequence.match(/^(\d*(?:;\d*)*)?([A-Za-z~])/);
    if (!match) return null;

    const [fullMatch, params, finalChar] = match;
    const consumed = baseIndex + 2 + fullMatch.length;

    return {
      key: this.mapCSISequence(finalChar, params),
      modifiers: this.parseCSIModifiers(params),
      sequence: `\x1b[${fullMatch}`,
      consumed
    };
  }

  private static parseOSCSequence(sequence: string, baseIndex: number): ParsedSequence | null {
    const endIndex = sequence.indexOf('\x07'); // BEL terminator
    if (endIndex === -1) return null;

    return {
      key: 'osc',
      modifiers: {},
      sequence: `\x1b]${sequence.slice(0, endIndex + 1)}`,
      consumed: baseIndex + 3 + endIndex
    };
  }

  private static parseFunctionKeySequence(sequence: string, baseIndex: number): ParsedSequence | null {
    if (sequence.length === 0) return null;

    const keyMap: Record<string, string> = {
      'P': 'f1', 'Q': 'f2', 'R': 'f3', 'S': 'f4',
      'H': 'home', 'F': 'end'
    };

    const key = keyMap[sequence[0]];
    return key ? {
      key,
      modifiers: {},
      sequence: `\x1bO${sequence[0]}`,
      consumed: baseIndex + 3
    } : null;
  }

  private static parseAltSequence(char: string, baseIndex: number): ParsedSequence {
    return {
      key: char.toLowerCase(),
      modifiers: { alt: true },
      sequence: `\x1b${char}`,
      consumed: baseIndex + 2
    };
  }

  private static mapCSISequence(finalChar: string, params?: string): string {
    const keyMap: Record<string, string> = {
      'A': 'up', 'B': 'down', 'C': 'right', 'D': 'left',
      'H': 'home', 'F': 'end', '~': 'special'
    };

    if (finalChar === '~' && params) {
      const num = parseInt(params.split(';')[0]);
      const specialKeys: Record<number, string> = {
        1: 'home', 2: 'insert', 3: 'delete', 4: 'end',
        5: 'pageup', 6: 'pagedown', 15: 'f5', 17: 'f6',
        18: 'f7', 19: 'f8', 20: 'f9', 21: 'f10',
        23: 'f11', 24: 'f12'
      };
      return specialKeys[num] || 'unknown';
    }

    return keyMap[finalChar] || finalChar;
  }

  private static parseCSIModifiers(params?: string): ParsedSequence['modifiers'] {
    if (!params) return {};

    const parts = params.split(';');
    if (parts.length < 2) return {};

    const modifierCode = parseInt(parts[1]) - 1;
    return {
      shift: !!(modifierCode & 1),
      alt: !!(modifierCode & 2),
      ctrl: !!(modifierCode & 4),
      meta: !!(modifierCode & 8)
    };
  }
}
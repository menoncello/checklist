export interface ControlCharacter {
  key: string;
  char: string;
  ctrl: boolean;
  name?: string;
}

export class ControlCharacterParser {
  private static readonly controlChars: Record<number, ControlCharacter> = {
    0: { key: 'ctrl+@', char: '\x00', ctrl: true, name: 'null' },
    1: { key: 'ctrl+a', char: '\x01', ctrl: true },
    2: { key: 'ctrl+b', char: '\x02', ctrl: true },
    3: { key: 'ctrl+c', char: '\x03', ctrl: true, name: 'break' },
    4: { key: 'ctrl+d', char: '\x04', ctrl: true, name: 'eof' },
    5: { key: 'ctrl+e', char: '\x05', ctrl: true },
    6: { key: 'ctrl+f', char: '\x06', ctrl: true },
    7: { key: 'ctrl+g', char: '\x07', ctrl: true, name: 'bell' },
    8: { key: 'backspace', char: '\x08', ctrl: false, name: 'backspace' },
    9: { key: 'tab', char: '\x09', ctrl: false, name: 'tab' },
    10: { key: 'enter', char: '\x0a', ctrl: false, name: 'linefeed' },
    11: { key: 'ctrl+k', char: '\x0b', ctrl: true },
    12: { key: 'ctrl+l', char: '\x0c', ctrl: true, name: 'formfeed' },
    13: { key: 'enter', char: '\x0d', ctrl: false, name: 'return' },
    14: { key: 'ctrl+n', char: '\x0e', ctrl: true },
    15: { key: 'ctrl+o', char: '\x0f', ctrl: true },
    16: { key: 'ctrl+p', char: '\x10', ctrl: true },
    17: { key: 'ctrl+q', char: '\x11', ctrl: true, name: 'xon' },
    18: { key: 'ctrl+r', char: '\x12', ctrl: true },
    19: { key: 'ctrl+s', char: '\x13', ctrl: true, name: 'xoff' },
    20: { key: 'ctrl+t', char: '\x14', ctrl: true },
    21: { key: 'ctrl+u', char: '\x15', ctrl: true },
    22: { key: 'ctrl+v', char: '\x16', ctrl: true },
    23: { key: 'ctrl+w', char: '\x17', ctrl: true },
    24: { key: 'ctrl+x', char: '\x18', ctrl: true },
    25: { key: 'ctrl+y', char: '\x19', ctrl: true },
    26: { key: 'ctrl+z', char: '\x1a', ctrl: true, name: 'suspend' },
    27: { key: 'escape', char: '\x1b', ctrl: false, name: 'escape' },
    28: { key: 'ctrl+\\', char: '\x1c', ctrl: true },
    29: { key: 'ctrl+]', char: '\x1d', ctrl: true },
    30: { key: 'ctrl+^', char: '\x1e', ctrl: true },
    31: { key: 'ctrl+_', char: '\x1f', ctrl: true },
    127: { key: 'delete', char: '\x7f', ctrl: false, name: 'delete' },
  };

  static parse(charCode: number): ControlCharacter | null {
    return this.controlChars[charCode] ?? null;
  }

  static isControlCharacter(charCode: number): boolean {
    return charCode in this.controlChars;
  }

  static getControlCharacterName(charCode: number): string | undefined {
    return this.controlChars[charCode]?.name;
  }

  static getAllControlCharacters(): ControlCharacter[] {
    return Object.values(this.controlChars);
  }

  static parseFromString(
    str: string,
    index: number = 0
  ): ControlCharacter | null {
    if (index >= str.length) return null;
    return this.parse(str.charCodeAt(index));
  }

  static isSpecialKey(key: string): boolean {
    const specialKeys = ['backspace', 'tab', 'enter', 'escape', 'delete'];
    return specialKeys.includes(key);
  }

  static formatKeyName(control: ControlCharacter): string {
    if (control.name != null && control.name !== '') {
      return control.name;
    }
    return control.key;
  }
}

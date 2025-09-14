import type { EnvironmentInfo } from './EnvironmentDetector';

export class TerminalCapabilitiesDetector {
  static supportsColor(env: EnvironmentInfo): boolean {
    if (env.colorTerm !== undefined && env.colorTerm.length > 0) return true;
    if (env.term.includes('color')) return true;
    if (env.term.includes('xterm')) return true;
    if (env.term.includes('screen')) return true;

    const knownColorTerminals = [
      'iterm',
      'alacritty',
      'kitty',
      'wezterm',
      'terminal',
      'gnome',
      'konsole',
    ];

    return knownColorTerminals.some(term => env.term.toLowerCase().includes(term));
  }

  static supports256Colors(env: EnvironmentInfo): boolean {
    if (env.term.includes('256')) return true;
    if (env.colorTerm === 'truecolor') return true;
    if (env.colorTerm === '24bit') return true;

    const terminals256 = [
      'xterm-256color',
      'screen-256color',
      'tmux-256color',
      'alacritty',
      'kitty',
    ];

    return terminals256.includes(env.term);
  }

  static supportsTrueColor(env: EnvironmentInfo): boolean {
    if (env.colorTerm === 'truecolor') return true;
    if (env.colorTerm === '24bit') return true;

    const trueColorTerminals = [
      'alacritty',
      'kitty',
      'wezterm',
      'iterm2',
    ];

    return trueColorTerminals.some(term =>
      env.term.toLowerCase().includes(term) ||
      (env.termProgram && env.termProgram.toLowerCase().includes(term))
    );
  }

  static supportsUnicode(env: EnvironmentInfo): boolean {
    if (env.lang && env.lang.toUpperCase().includes('UTF')) return true;
    if (env.lc_all && env.lc_all.toUpperCase().includes('UTF')) return true;

    const unicodeTerminals = [
      'alacritty',
      'kitty',
      'wezterm',
      'iterm',
      'gnome-terminal',
    ];

    return unicodeTerminals.some(term =>
      env.term.toLowerCase().includes(term) ||
      (env.termProgram && env.termProgram.toLowerCase().includes(term))
    );
  }

  static supportsMouseReporting(env: EnvironmentInfo): boolean {
    const mouseCapableTerminals = [
      'xterm',
      'alacritty',
      'kitty',
      'wezterm',
      'iterm',
      'gnome',
      'konsole',
    ];

    return mouseCapableTerminals.some(term => env.term.toLowerCase().includes(term));
  }

  static getColorDepthLevel(colorDepth?: number): 'monochrome' | 'basic' | '256' | 'truecolor' {
    if (!colorDepth) return 'basic';
    if (colorDepth >= 24) return 'truecolor';
    if (colorDepth >= 8) return '256';
    if (colorDepth >= 4) return 'basic';
    return 'monochrome';
  }
}
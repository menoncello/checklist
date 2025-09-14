export class TerminalVersionDetector {
  static getTerminalType(env: { term: string; termProgram?: string }): string {
    return env.termProgram ?? env.term;
  }

  static getVersion(_env: { termProgram?: string }): string | null {
    const programVersion = this.getTermProgramVersion();
    if (
      programVersion !== null &&
      programVersion !== undefined &&
      programVersion !== ''
    ) {
      return programVersion;
    }
    return null;
  }

  static getTermProgramVersion(): string | null {
    const versionChecks = [
      { env: 'TERM_PROGRAM_VERSION', name: '' },
      { env: 'ITERM_SESSION_ID', name: 'iTerm2' },
      { env: 'ALACRITTY_VERSION', name: 'Alacritty' },
      { env: 'KITTY_VERSION', name: 'Kitty' },
      { env: 'WEZTERM_VERSION', name: 'WezTerm' },
    ];

    for (const { env, name } of versionChecks) {
      const version = Bun.env[env];
      if (version !== undefined && version.length > 0) {
        return name ? `${name} ${version}` : version;
      }
    }

    return null;
  }

  static detectTerminalFamily(env: {
    term: string;
    termProgram?: string;
  }): string {
    const term = env.term.toLowerCase();
    const program = env.termProgram?.toLowerCase();

    if (program?.includes('iterm') === true) return 'iTerm2';
    if (program?.includes('apple_terminal') === true) return 'Terminal.app';
    if (program?.includes('vscode') === true) return 'VS Code';
    if (term.includes('alacritty')) return 'Alacritty';
    if (term.includes('kitty')) return 'Kitty';
    if (term.includes('wezterm')) return 'WezTerm';
    if (term.includes('gnome')) return 'GNOME Terminal';
    if (term.includes('konsole')) return 'Konsole';
    if (term.includes('xterm')) return 'xterm';
    if (term.includes('screen')) return 'GNU Screen';
    if (term.includes('tmux')) return 'tmux';

    return 'Unknown';
  }

  static isKnownTerminal(env: { term: string; termProgram?: string }): boolean {
    const family = this.detectTerminalFamily(env);
    return family !== 'Unknown';
  }

  static getTerminalFeatures(env: { term: string; termProgram?: string }): {
    supportsImages: boolean;
    supportsHyperlinks: boolean;
    supportsNotifications: boolean;
  } {
    const family = this.detectTerminalFamily(env);

    switch (family) {
      case 'iTerm2':
        return {
          supportsImages: true,
          supportsHyperlinks: true,
          supportsNotifications: true,
        };
      case 'Kitty':
        return {
          supportsImages: true,
          supportsHyperlinks: true,
          supportsNotifications: false,
        };
      case 'WezTerm':
        return {
          supportsImages: true,
          supportsHyperlinks: true,
          supportsNotifications: false,
        };
      default:
        return {
          supportsImages: false,
          supportsHyperlinks: false,
          supportsNotifications: false,
        };
    }
  }
}

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

    // Check program-based terminals first
    const programFamily = this.detectByProgram(program);
    if (programFamily !== null) {
      return programFamily;
    }

    // Check term-based terminals
    const termFamily = this.detectByTerm(term);
    if (termFamily !== null) {
      return termFamily;
    }

    return 'Unknown';
  }

  private static detectByProgram(program?: string): string | null {
    if (program === undefined || program === null || program === '')
      return null;

    const programMap: Record<string, string> = {
      iterm: 'iTerm2',
      apple_terminal: 'Terminal.app',
      vscode: 'VS Code',
    };

    for (const [key, value] of Object.entries(programMap)) {
      if (program.includes(key)) {
        return value;
      }
    }

    return null;
  }

  private static detectByTerm(term: string): string | null {
    const termMap: Record<string, string> = {
      alacritty: 'Alacritty',
      kitty: 'Kitty',
      wezterm: 'WezTerm',
      gnome: 'GNOME Terminal',
      konsole: 'Konsole',
      xterm: 'xterm',
      screen: 'GNU Screen',
      tmux: 'tmux',
    };

    for (const [key, value] of Object.entries(termMap)) {
      if (term.includes(key)) {
        return value;
      }
    }

    return null;
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
    return this.getFeaturesForFamily(family);
  }

  private static getFeaturesForFamily(family: string): {
    supportsImages: boolean;
    supportsHyperlinks: boolean;
    supportsNotifications: boolean;
  } {
    return this.getFeatureMap()[family] ?? this.getDefaultFeatures();
  }

  private static getFeatureMap(): Record<
    string,
    {
      supportsImages: boolean;
      supportsHyperlinks: boolean;
      supportsNotifications: boolean;
    }
  > {
    return {
      iTerm2: {
        supportsImages: true,
        supportsHyperlinks: true,
        supportsNotifications: true,
      },
      Kitty: {
        supportsImages: true,
        supportsHyperlinks: true,
        supportsNotifications: false,
      },
      WezTerm: {
        supportsImages: true,
        supportsHyperlinks: true,
        supportsNotifications: false,
      },
    };
  }

  private static getDefaultFeatures() {
    return {
      supportsImages: false,
      supportsHyperlinks: false,
      supportsNotifications: false,
    };
  }
}

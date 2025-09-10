export interface TTYInfo {
  isTTY: boolean;
  columns: number;
  rows: number;
  colorDepth?: number;
}

export interface EnvironmentInfo {
  term: string;
  termProgram?: string;
  colorTerm?: string;
  lang?: string;
  lc_all?: string;
  ssh?: boolean;
  tmux?: boolean;
  screen?: boolean;
}

export class TerminalInfo {
  private environmentInfo: EnvironmentInfo;
  private ttyInfo: TTYInfo;
  private platformInfo: NodeJS.Platform;

  constructor() {
    this.platformInfo = process.platform;
    this.environmentInfo = this.gatherEnvironmentInfo();
    this.ttyInfo = this.gatherTTYInfo();
  }

  private gatherEnvironmentInfo(): EnvironmentInfo {
    return {
      term: Bun.env.TERM ?? 'unknown',
      termProgram: Bun.env.TERM_PROGRAM,
      colorTerm: Bun.env.COLORTERM,
      lang: Bun.env.LANG,
      lc_all: Bun.env.LC_ALL,
      ssh: Boolean(
        (Bun.env.SSH_TTY !== undefined && Bun.env.SSH_TTY.length > 0) ||
          (Bun.env.SSH_CONNECTION !== undefined &&
            Bun.env.SSH_CONNECTION.length > 0)
      ),
      tmux: Boolean(Bun.env.TMUX !== undefined && Bun.env.TMUX.length > 0),
      screen: Boolean(Bun.env.STY !== undefined && Bun.env.STY.length > 0),
    };
  }

  private gatherTTYInfo(): TTYInfo {
    return {
      isTTY: Boolean(process.stdout.isTTY && process.stdin.isTTY),
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
      colorDepth:
        (
          process.stdout as unknown as { getColorDepth?: () => number }
        ).getColorDepth?.() ?? undefined,
    };
  }

  public getTerminalType(): string {
    return this.environmentInfo.term;
  }

  public getTerminalProgram(): string | undefined {
    return this.environmentInfo.termProgram;
  }

  public getVersion(): string | null {
    // Try to extract version information from environment
    const termProgram = this.environmentInfo.termProgram;
    const termProgramVersion = Bun.env.TERM_PROGRAM_VERSION;

    if (
      termProgram !== undefined &&
      termProgram.length > 0 &&
      termProgramVersion !== undefined &&
      termProgramVersion.length > 0
    ) {
      return `${termProgram} ${termProgramVersion}`;
    }

    // Check for specific terminal version environment variables
    if (
      Bun.env.ALACRITTY_VERSION !== undefined &&
      Bun.env.ALACRITTY_VERSION.length > 0
    ) {
      return `Alacritty ${Bun.env.ALACRITTY_VERSION}`;
    }

    if (
      Bun.env.KITTY_VERSION !== undefined &&
      Bun.env.KITTY_VERSION.length > 0
    ) {
      return `Kitty ${Bun.env.KITTY_VERSION}`;
    }

    if (
      Bun.env.WEZTERM_VERSION !== undefined &&
      Bun.env.WEZTERM_VERSION.length > 0
    ) {
      return `WezTerm ${Bun.env.WEZTERM_VERSION}`;
    }

    return null;
  }

  public getPlatform(): string {
    return this.platformInfo;
  }

  public getTTYInfo(): TTYInfo {
    // Return fresh TTY info as it can change
    return {
      ...this.ttyInfo,
      columns: process.stdout.columns ?? 80,
      rows: process.stdout.rows ?? 24,
    };
  }

  public isTTY(): boolean {
    return this.ttyInfo.isTTY;
  }

  public getSize(): { width: number; height: number } {
    return {
      width: process.stdout.columns ?? 80,
      height: process.stdout.rows ?? 24,
    };
  }

  public supportsColor(): boolean {
    // Check common indicators for color support
    if (
      this.environmentInfo.colorTerm !== undefined &&
      this.environmentInfo.colorTerm.length > 0
    )
      return true;
    if (this.environmentInfo.term.includes('color')) return true;
    if (this.environmentInfo.term.includes('xterm')) return true;
    if (this.environmentInfo.term.includes('screen')) return true;

    // Known color-capable terminals
    const colorTerminals = [
      'alacritty',
      'kitty',
      'gnome-terminal',
      'konsole',
      'terminal.app',
      'iterm',
      'wezterm',
      'hyper',
    ];

    const termProgram = this.environmentInfo.termProgram?.toLowerCase() ?? '';
    return colorTerminals.some((term) => termProgram.includes(term));
  }

  public isRemoteSession(): boolean {
    return this.environmentInfo.ssh ?? false;
  }

  public isInTmux(): boolean {
    return this.environmentInfo.tmux ?? false;
  }

  public isInScreen(): boolean {
    return this.environmentInfo.screen ?? false;
  }

  public isInMultiplexer(): boolean {
    return this.isInTmux() || this.isInScreen();
  }

  public getMultiplexerType(): string | null {
    if (this.isInTmux()) return 'tmux';
    if (this.isInScreen()) return 'screen';
    return null;
  }

  public getEncoding(): string {
    // Determine terminal encoding
    const lang = this.environmentInfo.lang ?? this.environmentInfo.lc_all ?? '';

    if (lang.includes('UTF-8') || lang.includes('utf8')) return 'utf8';
    if (lang.includes('ISO-8859')) return 'latin1';

    // Default to UTF-8 for modern terminals
    return 'utf8';
  }

  public getLocale(): string {
    return this.environmentInfo.lang ?? this.environmentInfo.lc_all ?? 'C';
  }

  public detectTerminalFamily(): TerminalFamily {
    const term = this.environmentInfo.term.toLowerCase();
    const termProgram = this.environmentInfo.termProgram?.toLowerCase() ?? '';

    // Check by TERM_PROGRAM first (more reliable)
    if (termProgram.includes('iterm')) return 'iterm';
    if (termProgram.includes('terminal')) return 'terminal_app';
    if (termProgram.includes('hyper')) return 'hyper';
    if (termProgram.includes('alacritty')) return 'alacritty';
    if (termProgram.includes('kitty')) return 'kitty';
    if (termProgram.includes('wezterm')) return 'wezterm';

    // Check by TERM variable
    if (term.includes('xterm')) return 'xterm';
    if (term.includes('screen')) return 'screen';
    if (term.includes('tmux')) return 'tmux';
    if (term.includes('alacritty')) return 'alacritty';
    if (term.includes('kitty')) return 'kitty';

    // Platform-specific defaults
    if (this.platformInfo === 'darwin') {
      if (termProgram === 'apple_terminal') return 'terminal_app';
      return 'xterm'; // Default fallback for macOS
    }

    if (this.platformInfo === 'win32') {
      if (Bun.env.WT_SESSION !== undefined && Bun.env.WT_SESSION.length > 0)
        return 'windows_terminal';
      return 'cmd'; // Default fallback for Windows
    }

    // Linux/Unix fallback
    return 'xterm';
  }

  public getCapabilityHints(): TerminalCapabilityHints {
    const family = this.detectTerminalFamily();
    const term = this.environmentInfo.term;

    return {
      likelySupportsColor: this.supportsColor(),
      likelySupports256Color:
        term.includes('256') ||
        ['iterm', 'alacritty', 'kitty', 'wezterm'].includes(family),
      likelySupportsUnicode: this.getEncoding() === 'utf8',
      likelySupportsMouseEvents: [
        'xterm',
        'iterm',
        'alacritty',
        'kitty',
      ].includes(family),
      likelySupportsAlternateScreen: !['cmd', 'dumb'].includes(family),
      likelySupportsWindowTitle:
        !this.isRemoteSession() && !['cmd', 'dumb'].includes(family),
      likelySupportsClipboard: [
        'iterm',
        'alacritty',
        'kitty',
        'wezterm',
      ].includes(family),
    };
  }

  public isModernTerminal(): boolean {
    const modernTerminals = [
      'iterm',
      'alacritty',
      'kitty',
      'wezterm',
      'hyper',
      'windows_terminal',
    ];
    return modernTerminals.includes(this.detectTerminalFamily());
  }

  public isLegacyTerminal(): boolean {
    const term = this.environmentInfo.term;
    return term === 'dumb' || term === 'vt100' || term === 'vt52';
  }

  public supportsAnsiEscapes(): boolean {
    return !this.isLegacyTerminal() && this.isTTY();
  }

  public getRelevantEnvVars(): Record<string, string> {
    const relevantVars = [
      'TERM',
      'TERM_PROGRAM',
      'TERM_PROGRAM_VERSION',
      'COLORTERM',
      'LANG',
      'LC_ALL',
      'TMUX',
      'STY',
      'SSH_TTY',
      'SSH_CONNECTION',
      'ALACRITTY_VERSION',
      'KITTY_VERSION',
      'WEZTERM_VERSION',
      'WT_SESSION',
    ];

    const envVars: Record<string, string> = {};

    for (const varName of relevantVars) {
      const value = Bun.env[varName];
      if (value !== undefined && value.length > 0) {
        envVars[varName] = value;
      }
    }

    return envVars;
  }

  public refresh(): void {
    // Refresh dynamic information
    this.environmentInfo = this.gatherEnvironmentInfo();
    this.ttyInfo = this.gatherTTYInfo();
  }

  public getDebugInfo(): TerminalDebugInfo {
    return {
      platform: this.platformInfo,
      ttyInfo: this.getTTYInfo(),
      environmentInfo: this.environmentInfo,
      terminalFamily: this.detectTerminalFamily(),
      version: this.getVersion(),
      encoding: this.getEncoding(),
      locale: this.getLocale(),
      multiplexer: this.getMultiplexerType(),
      isModern: this.isModernTerminal(),
      isLegacy: this.isLegacyTerminal(),
      capabilityHints: this.getCapabilityHints(),
      relevantEnvVars: this.getRelevantEnvVars(),
    };
  }

  public generateCompatibilityReport(): CompatibilityReport {
    const hints = this.getCapabilityHints();
    const family = this.detectTerminalFamily();

    return {
      terminalIdentification: {
        family,
        term: this.environmentInfo.term,
        program: this.environmentInfo.termProgram,
        version: this.getVersion(),
        platform: this.platformInfo,
      },
      basicCompatibility: {
        isTTY: this.isTTY(),
        supportsAnsi: this.supportsAnsiEscapes(),
        encoding: this.getEncoding(),
        isRemote: this.isRemoteSession(),
        inMultiplexer: this.isInMultiplexer(),
      },
      featureSupport: {
        color: hints.likelySupportsColor ? 'likely' : 'unlikely',
        color256: hints.likelySupports256Color ? 'likely' : 'unlikely',
        unicode: hints.likelySupportsUnicode ? 'likely' : 'unlikely',
        mouse: hints.likelySupportsMouseEvents ? 'likely' : 'unlikely',
        altScreen: hints.likelySupportsAlternateScreen ? 'likely' : 'unlikely',
        windowTitle: hints.likelySupportsWindowTitle ? 'likely' : 'unlikely',
        clipboard: hints.likelySupportsClipboard ? 'likely' : 'unlikely',
      },
      recommendations: this.generateRecommendations(family, hints),
    };
  }

  private generateRecommendations(
    family: TerminalFamily,
    hints: TerminalCapabilityHints
  ): string[] {
    const recommendations: string[] = [];

    if (this.isLegacyTerminal()) {
      recommendations.push(
        'Consider upgrading to a modern terminal emulator for better feature support'
      );
    }

    if (!hints.likelySupportsColor) {
      recommendations.push(
        'Enable color support or use a color-capable terminal for better visual experience'
      );
    }

    if (this.isRemoteSession() && hints.likelySupportsClipboard) {
      recommendations.push(
        'Configure SSH forwarding for clipboard functionality over remote sessions'
      );
    }

    if (this.isInMultiplexer()) {
      recommendations.push(
        'Some terminal features may be limited inside terminal multiplexers'
      );
    }

    if (family === 'cmd') {
      recommendations.push(
        'Consider using Windows Terminal or WSL for better ANSI support on Windows'
      );
    }

    return recommendations;
  }
}

export type TerminalFamily =
  | 'xterm'
  | 'iterm'
  | 'terminal_app'
  | 'alacritty'
  | 'kitty'
  | 'wezterm'
  | 'hyper'
  | 'screen'
  | 'tmux'
  | 'windows_terminal'
  | 'cmd'
  | 'dumb'
  | 'unknown';

export interface TerminalCapabilityHints {
  likelySupportsColor: boolean;
  likelySupports256Color: boolean;
  likelySupportsUnicode: boolean;
  likelySupportsMouseEvents: boolean;
  likelySupportsAlternateScreen: boolean;
  likelySupportsWindowTitle: boolean;
  likelySupportsClipboard: boolean;
}

export interface TerminalDebugInfo {
  platform: NodeJS.Platform;
  ttyInfo: TTYInfo;
  environmentInfo: EnvironmentInfo;
  terminalFamily: TerminalFamily;
  version: string | null;
  encoding: string;
  locale: string;
  multiplexer: string | null;
  isModern: boolean;
  isLegacy: boolean;
  capabilityHints: TerminalCapabilityHints;
  relevantEnvVars: Record<string, string>;
}

export interface CompatibilityReport {
  terminalIdentification: {
    family: TerminalFamily;
    term: string;
    program?: string;
    version: string | null;
    platform: NodeJS.Platform;
  };
  basicCompatibility: {
    isTTY: boolean;
    supportsAnsi: boolean;
    encoding: string;
    isRemote: boolean;
    inMultiplexer: boolean;
  };
  featureSupport: {
    color: 'likely' | 'unlikely';
    color256: 'likely' | 'unlikely';
    unicode: 'likely' | 'unlikely';
    mouse: 'likely' | 'unlikely';
    altScreen: 'likely' | 'unlikely';
    windowTitle: 'likely' | 'unlikely';
    clipboard: 'likely' | 'unlikely';
  };
  recommendations: string[];
}

export type EnvironmentInfo = {
  term: string;
  termProgram?: string;
  colorTerm?: string;
  lang?: string;
  lc_all?: string;
  ssh?: boolean;
  tmux?: boolean;
  screen?: boolean;
};

export class EnvironmentDetector {
  static gatherEnvironmentInfo(): EnvironmentInfo {
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

  static isRemoteSession(env: EnvironmentInfo): boolean {
    return env.ssh === true;
  }

  static getSessionType(env: EnvironmentInfo): string {
    if (env.ssh === true) return 'SSH';
    if (env.tmux === true) return 'tmux';
    if (env.screen === true) return 'screen';
    return 'local';
  }

  static getTerminalProgram(env: EnvironmentInfo): string | undefined {
    return env.termProgram;
  }

  static hasColorSupport(env: EnvironmentInfo): boolean {
    if (env.colorTerm !== undefined && env.colorTerm.length > 0) return true;
    if (env.term.includes('color')) return true;
    if (env.term.includes('xterm')) return true;
    if (env.term.includes('screen')) return true;
    return false;
  }

  static detect(): EnvironmentInfo {
    return EnvironmentDetector.gatherEnvironmentInfo();
  }
}

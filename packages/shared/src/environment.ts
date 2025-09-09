/**
 * Environment detection and fallback utilities
 */

/**
 * Environment information
 */
export interface Environment {
  platform: NodeJS.Platform;
  arch: string;
  nodeVersion: string;
  bunVersion: string;
  isCI: boolean;
  isDevelopment: boolean;
  isProduction: boolean;
  isTTY: boolean;
  hasNetwork: boolean;
  user: string;
  home: string;
  shell: string;
}

/**
 * Detect current environment
 */
export function detectEnvironment(): Environment {
  return {
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    bunVersion: Bun.version,
    isCI: Boolean(
      process.env.CI ??
        process.env.CONTINUOUS_INTEGRATION ??
        process.env.GITHUB_ACTIONS
    ),
    isDevelopment:
      process.env.NODE_ENV === 'development' ||
      process.env.NODE_ENV === undefined,
    isProduction: process.env.NODE_ENV === 'production',
    isTTY: Boolean(process.stdout.isTTY),
    hasNetwork: process.env.OFFLINE === undefined || process.env.OFFLINE === '',
    user: process.env.USER ?? process.env.USERNAME ?? 'unknown',
    home: process.env.HOME ?? process.env.USERPROFILE ?? '',
    shell: process.env.SHELL ?? process.env.ComSpec ?? '',
  };
}

/**
 * Platform-specific path utilities
 */
export const paths = {
  /**
   * Get user data directory
   */
  userData(): string {
    const env = detectEnvironment();

    switch (env.platform) {
      case 'darwin':
        return `${env.home}/Library/Application Support/checklist`;
      case 'win32':
        return `${process.env.APPDATA ?? `${env.home}/AppData/Roaming`}/checklist`;
      default:
        return `${process.env.XDG_DATA_HOME ?? `${env.home}/.local/share`}/checklist`;
    }
  },

  /**
   * Get user config directory
   */
  userConfig(): string {
    const env = detectEnvironment();

    switch (env.platform) {
      case 'darwin':
        return `${env.home}/Library/Preferences/checklist`;
      case 'win32':
        return `${process.env.APPDATA ?? `${env.home}/AppData/Roaming`}/checklist`;
      default:
        return `${process.env.XDG_CONFIG_HOME ?? `${env.home}/.config`}/checklist`;
    }
  },

  /**
   * Get temp directory
   */
  temp(): string {
    return process.env.TMPDIR ?? process.env.TEMP ?? process.env.TMP ?? '/tmp';
  },

  /**
   * Get cache directory
   */
  cache(): string {
    const env = detectEnvironment();

    switch (env.platform) {
      case 'darwin':
        return `${env.home}/Library/Caches/checklist`;
      case 'win32':
        return `${process.env.LOCALAPPDATA ?? `${env.home}/AppData/Local`}/checklist/Cache`;
      default:
        return `${process.env.XDG_CACHE_HOME ?? `${env.home}/.cache`}/checklist`;
    }
  },
};

/**
 * Feature detection with fallbacks
 */
export const features = {
  /**
   * Check if clipboard is available
   */
  async hasClipboard(): Promise<boolean> {
    try {
      // Dynamic import to avoid errors if not available
      const { isClipboardAvailable } = await import('./clipboard');
      return await isClipboardAvailable();
    } catch {
      return false;
    }
  },

  /**
   * Check if git is available
   */
  async hasGit(): Promise<boolean> {
    try {
      const proc = Bun.spawn(['git', '--version'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      return (await proc.exited) === 0;
    } catch {
      return false;
    }
  },

  /**
   * Check if terminal supports color
   */
  hasColor(): boolean {
    const env = detectEnvironment();

    // CI environments usually support color
    if (env.isCI) return true;

    // Check for explicit color support
    if (process.env.COLORTERM !== undefined && process.env.COLORTERM !== '')
      return true;
    if (
      process.env.TERM !== undefined &&
      process.env.TERM !== '' &&
      process.env.TERM.includes('color')
    )
      return true;

    // Windows Terminal and ConEmu support color
    if (
      (process.env.WT_SESSION !== undefined && process.env.WT_SESSION !== '') ||
      (process.env.ConEmuDir !== undefined && process.env.ConEmuDir !== '')
    )
      return true;

    // Default based on TTY
    return env.isTTY;
  },

  /**
   * Check if terminal supports Unicode
   */
  hasUnicode(): boolean {
    const locale = process.env.LANG ?? process.env.LC_ALL ?? '';
    return /UTF-?8$/i.test(locale);
  },
};

/**
 * Graceful degradation utilities
 */
export const fallbacks = {
  /**
   * Get clipboard fallback
   */
  clipboard: {
    async write(_text: string): Promise<void> {
      // Clipboard not available in this environment
      throw new Error('Clipboard write not available in this environment');
    },

    async read(): Promise<string> {
      // Clipboard not available in this environment
      throw new Error('Clipboard read not available in this environment');
    },
  },

  /**
   * Get color fallback
   */
  color(text: string): string {
    return text; // Return plain text without colors
  },

  /**
   * Get Unicode fallback
   */
  unicode(char: string, fallback: string): string {
    return features.hasUnicode() ? char : fallback;
  },
};

/**
 * Platform-specific command utilities
 */
export const commands = {
  /**
   * Open file or URL in default application
   */
  open(target: string): string[] {
    const env = detectEnvironment();

    switch (env.platform) {
      case 'darwin':
        return ['open', target];
      case 'win32':
        return ['cmd', '/c', 'start', '""', target];
      default:
        return ['xdg-open', target];
    }
  },

  /**
   * Clear terminal screen
   */
  clear(): string {
    const env = detectEnvironment();
    return env.platform === 'win32' ? 'cls' : 'clear';
  },

  /**
   * Get shell command prefix
   */
  shell(): string[] {
    const env = detectEnvironment();

    if (env.platform === 'win32') {
      return ['cmd', '/c'];
    }

    return [env.shell || '/bin/sh', '-c'];
  },
};

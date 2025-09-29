/**
 * Helper functions for terminal size validation
 */

export interface SizeAdjustment {
  widthNeeded: number;
  heightNeeded: number;
  percentageIncrease: number;
}

export interface SizeParams {
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
}

export interface SizeConfig {
  minWidth: number;
  minHeight: number;
  enableSuggestions: boolean;
}

/**
 * Generate validation message based on current size
 */
export function generateValidationMessage(
  params: SizeParams,
  isValid: boolean
): string {
  const { width, height, minWidth, minHeight } = params;
  if (isValid) {
    return `Terminal size OK: ${width}x${height}`;
  }

  const widthShort = Math.max(0, minWidth - width);
  const heightShort = Math.max(0, minHeight - height);

  let message = `Terminal too small: ${width}x${height} (need ${minWidth}x${minHeight}`;

  if (widthShort > 0 && heightShort > 0) {
    message += `, missing ${widthShort} columns and ${heightShort} rows`;
  } else if (widthShort > 0) {
    message += `, missing ${widthShort} columns`;
  } else if (heightShort > 0) {
    message += `, missing ${heightShort} rows`;
  }

  message += ')';

  return message;
}

/**
 * Generate suggestions for terminal size issues
 */
export function generateSizeSuggestions(
  size: { width: number; height: number },
  config: SizeConfig
): string[] {
  const { width, height } = size;
  const { minWidth, minHeight, enableSuggestions } = config;
  if (!enableSuggestions) {
    return [];
  }

  const widthNeeded = Math.max(0, minWidth - width);
  const heightNeeded = Math.max(0, minHeight - height);

  // Only generate suggestions if terminal is actually too small
  if (widthNeeded === 0 && heightNeeded === 0) {
    return [];
  }

  // General suggestions
  const suggestions: string[] = [];
  if (widthNeeded > 0) {
    suggestions.push(`Make terminal wider by at least ${widthNeeded} columns`);
  }
  if (heightNeeded > 0) {
    suggestions.push(`Make terminal taller by at least ${heightNeeded} rows`);
  }

  // Add platform and terminal-specific suggestions
  const platformSuggestions = generatePlatformSuggestions();
  const terminalSuggestions = generateTerminalSpecificSuggestions();

  return [...suggestions, ...platformSuggestions, ...terminalSuggestions];
}

/**
 * Generate platform-specific suggestions
 */
export function generatePlatformSuggestions(): string[] {
  if (process.platform === 'darwin') {
    return [
      'On macOS: Drag corner of terminal window or use ⌘+ to zoom',
      'Try: osascript -e \'tell application "Terminal" to set bounds of front window to {0, 0, 800, 600}\'',
    ];
  } else if (process.platform === 'linux') {
    return [
      'On Linux: Drag corner of terminal window',
      'Try using a terminal multiplexer like tmux or screen',
    ];
  } else if (process.platform === 'win32') {
    return [
      'On Windows: Drag corner of terminal window or use Properties > Layout',
    ];
  }
  return [];
}

/**
 * Generate terminal-specific suggestions
 */
export function generateTerminalSpecificSuggestions(): string[] {
  const term = Bun.env.TERM ?? '';
  const termProgram = Bun.env.TERM_PROGRAM ?? '';

  if (termProgram.toLowerCase().includes('iterm')) {
    return ['iTerm2: Use ⌘+Enter for fullscreen mode'];
  } else if (termProgram.toLowerCase().includes('alacritty')) {
    return ['Alacritty: Check config file for default window size'];
  } else if (term.includes('xterm')) {
    return [
      'Consider using a modern terminal like iTerm2, Alacritty, or Kitty',
    ];
  }

  return [];
}

/**
 * Calculate percentage increase for terminal resize
 */
export function calculatePercentageIncrease(
  current: { width: number; height: number },
  needed: { width: number; height: number },
  min: { width: number; height: number }
): number {
  const { width: currentWidth, height: currentHeight } = current;
  const { width: widthNeeded, height: heightNeeded } = needed;
  const { width: minWidth, height: minHeight } = min;
  const currentArea = currentWidth * currentHeight;
  const requiredArea = minWidth * minHeight;

  if (currentArea === 0) return 100;
  if (widthNeeded > 0 && heightNeeded === 0) {
    return (widthNeeded / currentWidth) * 100;
  }
  if (heightNeeded > 0 && widthNeeded === 0) {
    return (heightNeeded / currentHeight) * 100;
  }
  return Math.max(0, ((requiredArea - currentArea) / currentArea) * 100);
}

/**
 * Attempt to resize macOS terminal
 */
export async function resizeMacOSTerminal(
  minWidth: number,
  minHeight: number
): Promise<boolean> {
  try {
    const { spawn } = await import('child_process');

    return new Promise((resolve) => {
      const script = `
        tell application "Terminal"
          set bounds of front window to {0, 0, ${minWidth * 8}, ${minHeight * 16}}
        end tell
      `;

      const proc = spawn('osascript', ['-e', script]);

      proc.on('close', (code) => {
        resolve(code === 0);
      });

      proc.on('error', () => {
        resolve(false);
      });
    });
  } catch {
    return false;
  }
}

/**
 * Attempt to resize Linux terminal
 */
export function resizeLinuxTerminal(): Promise<boolean> {
  // Linux terminal resizing is complex and varies by terminal
  // This is a placeholder implementation
  return Promise.resolve(false);
}

/**
 * Attempt to resize Windows terminal
 */
export function resizeWindowsTerminal(): Promise<boolean> {
  // Windows terminal resizing is complex
  // This is a placeholder implementation
  return Promise.resolve(false);
}

/**
 * Generate user-friendly error message for terminal size issues
 */
export function generateSizeErrorMessage(
  size: { width: number; height: number },
  config: SizeConfig
): string {
  const { width: currentWidth, height: currentHeight } = size;
  const { minWidth, minHeight, enableSuggestions } = config;
  const isValid = currentWidth >= minWidth && currentHeight >= minHeight;

  if (isValid) {
    return '';
  }

  let message = `Terminal size too small: ${currentWidth}x${currentHeight} (minimum: ${minWidth}x${minHeight})\n\n`;

  if (enableSuggestions) {
    const suggestions = generateSizeSuggestions(
      { width: currentWidth, height: currentHeight },
      { minWidth, minHeight, enableSuggestions }
    );

    if (suggestions.length > 0) {
      message += 'Suggestions:\n';
      suggestions.forEach((suggestion, index) => {
        message += `${index + 1}. ${suggestion}\n`;
      });
    }
  }

  return message.trim();
}

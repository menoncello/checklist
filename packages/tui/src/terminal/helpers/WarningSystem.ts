import type { TerminalCapabilities } from '../../framework/UIFramework';

export class WarningSystem {
  private acknowledgedWarnings = new Set<string>();

  public getWarnings(capabilities?: TerminalCapabilities): string[] {
    const warnings: string[] = [];

    if (capabilities) {
      if (!capabilities.color) {
        warnings.push(
          'Limited color support detected. Display will be monochrome. Some features may not display correctly.'
        );
      }
      if (!capabilities.unicode) {
        warnings.push(
          'Limited Unicode support detected. Using ASCII fallbacks. Some characters may not display correctly.'
        );
      }
      if (!capabilities.mouse) {
        warnings.push('mouse support not available - use keyboard navigation');
      }
      if (!capabilities.altScreen) {
        warnings.push(
          'Alternate screen buffer not available. Display may be limited.'
        );
      }
    }

    return warnings;
  }

  public getSuggestions(capabilities?: TerminalCapabilities): string[] {
    const suggestions: string[] = [];

    if (capabilities) {
      if (!capabilities.trueColor && !capabilities.color256) {
        suggestions.push(
          'Consider upgrade to a terminal with 256-color or true color support (iTerm2, Alacritty, Windows Terminal)'
        );
      }
      if (!capabilities.unicode) {
        suggestions.push(
          'Enable UTF-8 support in your terminal settings for better character display'
        );
      }
      if (!capabilities.mouse) {
        suggestions.push(
          'Enable mouse support in your terminal settings for enhanced interaction'
        );
      }
    }

    return suggestions;
  }

  public getRecommendations(
    capabilities?: TerminalCapabilities,
    platform?: string
  ): string[] {
    const recommendations: string[] = [];

    if (platform === 'darwin') {
      recommendations.push(
        'For best experience on macOS, we recommend iTerm2 or Alacritty'
      );
    } else if (platform === 'win32') {
      recommendations.push(
        'For best experience on Windows, we recommend Windows Terminal'
      );
    } else if (platform === 'linux') {
      recommendations.push(
        'For best experience on Linux, we recommend Alacritty or GNOME Terminal'
      );
    }

    if (capabilities?.trueColor === false) {
      recommendations.push(
        'Enable true color support for best visual experience'
      );
    }

    return recommendations;
  }

  public getSizeWarning(
    size: {
      width: number;
      height: number;
    },
    capabilities?: TerminalCapabilities
  ): string | null {
    let message = '';
    if (size.width < 80) {
      message = `Terminal width too small: ${size.width} columns (minimum 80 required)`;
    } else if (size.height < 24) {
      message = `Terminal height too small: ${size.height} rows (minimum 24 required)`;
    } else {
      return null;
    }

    // Add color formatting if terminal supports it
    if (capabilities?.color === true) {
      // Add red color for warnings: \x1b[31m (red) and \x1b[0m (reset)
      return `\x1b[31m${message}\x1b[0m`;
    }

    return message;
  }

  public getFeatureWarning(
    feature: string,
    capabilities?: TerminalCapabilities
  ): string | null {
    if (!capabilities) return null;

    switch (feature) {
      case 'mouse':
        return capabilities.mouse
          ? null
          : 'Mouse support not available - use keyboard navigation';
      case 'color':
        return capabilities.color
          ? null
          : 'Color support not available - display will be monochrome';
      case 'unicode':
        return capabilities.unicode
          ? null
          : 'Unicode support limited - some characters may not display correctly';
      case 'altScreen':
        return capabilities.altScreen
          ? null
          : 'Alternate screen buffer not available - display may be limited';
      default:
        return null;
    }
  }

  public getFallbackSuggestions(capabilities?: TerminalCapabilities): string[] {
    const fallbacks: string[] = [];

    if (capabilities) {
      if (!capabilities.unicode) {
        fallbacks.push(
          'Use ASCII characters for box drawing and special symbols'
        );
      }
      if (!capabilities.color) {
        fallbacks.push('Use text attributes (bold, underline) for emphasis');
      }
      if (!capabilities.mouse) {
        fallbacks.push(
          'Use keyboard shortcuts: arrows for navigation, Enter for selection'
        );
      }
    }

    return fallbacks;
  }

  public isWarningAcknowledged(warning: string): boolean {
    return this.acknowledgedWarnings.has(warning);
  }

  public acknowledgeWarning(warning: string): void {
    this.acknowledgedWarnings.add(warning);
  }
}

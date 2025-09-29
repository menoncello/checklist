import type { TerminalCompatibilityEntry } from './TerminalDataCollector';

export class CompatibilityRecommendations {
  public generateRecommendations(
    terminals: TerminalCompatibilityEntry[]
  ): Map<string, string> {
    const recommendations = new Map<string, string>();

    // Platform-specific recommendations
    recommendations.set('macOS', 'iTerm2 for best feature support');
    recommendations.set('Windows', 'Windows Terminal or ConEmu');
    recommendations.set('Linux', 'Alacritty or GNOME Terminal');
    recommendations.set(
      'cross-platform',
      'Alacritty for consistent experience'
    );

    // Feature-specific recommendations based on terminals
    if (terminals.some((t) => t.features.colors === 'truecolor')) {
      recommendations.set(
        'Best Color Support',
        'For the best color experience, use terminals with true color support like iTerm2, Alacritty, or Windows Terminal'
      );
    }

    // Performance recommendations
    recommendations.set(
      'Performance',
      'For optimal performance, choose GPU-accelerated terminals like Alacritty or Windows Terminal'
    );

    return recommendations;
  }

  public collectKnownIssues(): Map<string, string[]> {
    const issues = new Map<string, string[]>();

    issues.set('macOS Terminal.app', [
      'Limited 256-color support',
      'No true color support',
      'Basic mouse support only',
    ]);

    issues.set('Git Bash', [
      'Windows-only',
      'Limited Unicode support',
      'No true color support',
    ]);

    return issues;
  }

  public collectWorkarounds(): Map<string, string> {
    const workarounds = new Map<string, string>();

    workarounds.set(
      'no-truecolor',
      'Use 256-color palette as fallback for terminals without true color support'
    );
    workarounds.set(
      'no-unicode',
      'Replace Unicode characters with ASCII equivalents'
    );
    workarounds.set(
      'no-mouse',
      'Provide keyboard shortcuts for all mouse actions'
    );

    return workarounds;
  }

  public findBestTerminal(
    terminals: TerminalCompatibilityEntry[],
    requirements: Record<string, string>
  ): TerminalCompatibilityEntry | undefined {
    let bestTerminal: TerminalCompatibilityEntry | undefined;
    let bestScore = 0;

    for (const terminal of terminals) {
      const score = this.calculateTerminalScore(terminal, requirements);
      if (score > bestScore) {
        bestScore = score;
        bestTerminal = terminal;
      }
    }

    return bestTerminal;
  }

  private calculateTerminalScore(
    terminal: TerminalCompatibilityEntry,
    requirements: Record<string, string>
  ): number {
    let score = 0;

    if (
      requirements.color === 'truecolor' &&
      terminal.features.colors === 'truecolor'
    ) {
      score += 1;
    }

    if (
      requirements.unicode === 'extended' &&
      terminal.features.unicode !== 'none'
    ) {
      score += 1;
    }

    if (
      requirements.mouse === 'advanced' &&
      terminal.features.mouse === 'advanced'
    ) {
      score += 1;
    }

    return score;
  }
}

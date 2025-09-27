import { BaseComponent } from './BaseComponent';

export type FeedbackStatus = 'executing' | 'success' | 'error' | 'cancelled';

export interface CommandFeedback {
  key: string;
  status: FeedbackStatus;
  message?: string;
  timestamp: number;
}

export interface NavigationFeedbackOptions {
  showDuration?: number;
  maxHistory?: number;
  enableAnimations?: boolean;
}

/**
 * NavigationFeedback - Visual feedback system for navigation commands
 */
export class NavigationFeedback extends BaseComponent {
  public readonly id = 'navigation-feedback';

  private readonly options: Required<NavigationFeedbackOptions>;
  private currentFeedback?: CommandFeedback;
  private feedbackHistory: CommandFeedback[] = [];
  private hideTimer?: Timer;
  private animationFrame?: number;

  constructor(options: NavigationFeedbackOptions = {}) {
    super();
    this.options = {
      showDuration: options.showDuration ?? 2000,
      maxHistory: options.maxHistory ?? 50,
      enableAnimations: options.enableAnimations ?? true,
    };
  }

  public showCommandFeedback(
    key: string,
    status: FeedbackStatus,
    message?: string
  ): void {
    const feedback: CommandFeedback = {
      key,
      status,
      message,
      timestamp: Date.now(),
    };

    this.currentFeedback = feedback;
    this.addToHistory(feedback);

    // Clear existing timer
    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }

    // Set new timer for non-error feedback
    if (status !== 'error') {
      this.hideTimer = setTimeout(() => {
        this.hideFeedback();
      }, this.options.showDuration);
    }

    this.markDirty();
  }

  public hideFeedback(): void {
    this.currentFeedback = undefined;
    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
    this.markDirty();
  }

  public showProgress(key: string, progress: number, total: number): void {
    const percentage = Math.round((progress / total) * 100);
    const message = `${progress}/${total} (${percentage}%)`;

    this.showCommandFeedback(key, 'executing', message);
  }

  public showKeyboardHints(
    shortcuts: Array<{ key: string; description: string }>
  ): string {
    if (shortcuts.length === 0) {
      return '';
    }

    const maxKeyLength = Math.max(...shortcuts.map((s) => s.key.length));
    const hints = shortcuts
      .map((shortcut) => {
        const key = shortcut.key.padEnd(maxKeyLength);
        return this.formatText(`${key} - ${shortcut.description}`, {
          style: { dim: true },
        });
      })
      .join('  ');

    return hints;
  }

  private addToHistory(feedback: CommandFeedback): void {
    this.feedbackHistory.unshift(feedback);

    if (this.feedbackHistory.length > this.options.maxHistory) {
      this.feedbackHistory = this.feedbackHistory.slice(
        0,
        this.options.maxHistory
      );
    }
  }

  private renderCurrentFeedback(): string {
    const current = this.currentFeedback;
    if (current === undefined) {
      return '';
    }

    const { key, status, message } = current;
    const keyDisplay = key === 'Enter' ? '↵' : key;

    const { icon, color } = this.getStatusDisplay(status);

    const keyText = this.formatText(`[${keyDisplay}]`, {
      style: {
        bold: true,
        color: color as 'blue' | 'green' | 'red' | 'yellow',
      },
    });

    let iconText = this.formatText(icon, {
      style: {
        color: color as 'blue' | 'green' | 'red' | 'yellow',
      },
    });

    if (this.options.enableAnimations && status === 'executing') {
      iconText = this.getAnimatedIcon();
    }

    let feedbackText = `${keyText} ${iconText}`;

    if (message !== undefined) {
      const messageText = this.formatText(message, { style: { dim: true } });
      feedbackText += ` ${messageText}`;
    }

    return feedbackText;
  }

  private getStatusDisplay(status: FeedbackStatus) {
    switch (status) {
      case 'executing':
        return { icon: '⟳', color: 'blue' };
      case 'success':
        return { icon: '✓', color: 'green' };
      case 'error':
        return { icon: '✗', color: 'red' };
      case 'cancelled':
        return { icon: '⊘', color: 'yellow' };
    }
  }

  private getAnimatedIcon(): string {
    const frames = ['⟳', '⟲', '⟳', '⟲'];
    const frameIndex = Math.floor(Date.now() / 250) % frames.length;
    const animatedIcon = this.formatText(frames[frameIndex], {
      style: { color: 'blue' },
    });

    this.animationFrame ??= setTimeout(() => {
      this.animationFrame = undefined;
      if (this.currentFeedback?.status === 'executing') {
        this.markDirty();
      }
    }, 16) as unknown as number;

    return animatedIcon;
  }

  private renderStatusIndicators(): string {
    const recentFeedback = this.feedbackHistory.slice(0, 5);
    if (recentFeedback.length === 0) {
      return '';
    }

    const indicators = recentFeedback
      .map((feedback) => this.getStatusIndicator(feedback))
      .filter(Boolean)
      .join(' ');

    return indicators.length > 0 ? ` ${indicators}` : '';
  }

  private getStatusIndicator(feedback: CommandFeedback): string {
    const statusConfig = {
      success: { icon: '●', color: 'green' as const },
      error: { icon: '●', color: 'red' as const },
      cancelled: { icon: '○', color: 'yellow' as const },
      executing: { icon: '◐', color: 'blue' as const },
    };

    const config = statusConfig[feedback.status];
    if (config === undefined) return '';

    return this.formatText(config.icon, {
      style: {
        color: config.color,
        dim: true,
      },
    });
  }

  public render(_props: unknown): string {
    const currentFeedback = this.renderCurrentFeedback();
    const statusIndicators = this.renderStatusIndicators();

    if (currentFeedback === '' && statusIndicators === '') {
      return '';
    }

    const width = this.getWidth();
    let content = currentFeedback + statusIndicators;

    content = this.truncateContentForWidth(content, width);

    const padding = Math.max(0, Math.floor((width - content.length) / 2));
    const paddedContent = ' '.repeat(padding) + content;

    return paddedContent;
  }

  private truncateContentForWidth(content: string, width: number): string {
    if (content.length <= width) {
      return content;
    }

    // Remove ANSI escape codes for length calculation
    const plainText = content.replace(/\x1b\[[0-9;]*m/g, '');

    if (plainText.length <= width) {
      return content;
    }

    return this.truncatePlainText(plainText, width);
  }

  private truncatePlainText(plainText: string, width: number): string {
    const ellipsis = '...';
    const maxPlainLength = width - ellipsis.length;
    const words = plainText.split(' ');
    let truncatedPlain = '';
    let totalLength = 0;

    for (const word of words) {
      const wordLength = word.length;
      const separatorLength = truncatedPlain.length > 0 ? 1 : 0;
      const newLength = totalLength + wordLength + separatorLength;

      if (newLength <= maxPlainLength) {
        if (truncatedPlain.length > 0) {
          truncatedPlain += ' ';
          totalLength += 1;
        }
        truncatedPlain += word;
        totalLength += wordLength;
      } else {
        break;
      }
    }

    return truncatedPlain + ellipsis;
  }

  public getFeedbackHistory(): readonly CommandFeedback[] {
    return [...this.feedbackHistory];
  }

  public getCurrentFeedback(): CommandFeedback | undefined {
    return this.currentFeedback !== undefined
      ? { ...this.currentFeedback }
      : undefined;
  }

  public clearHistory(): void {
    this.feedbackHistory = [];
    this.markDirty();
  }

  public getStats() {
    const now = Date.now();
    const recentFeedback = this.feedbackHistory.filter(
      (f) => now - f.timestamp < 60000
    );

    const statusCounts = recentFeedback.reduce(
      (counts, feedback) => {
        const currentCount = counts[feedback.status] ?? 0;
        counts[feedback.status] = currentCount + 1;
        return counts;
      },
      {} as Record<FeedbackStatus, number>
    );

    return {
      totalFeedback: this.feedbackHistory.length,
      recentFeedback: recentFeedback.length,
      statusCounts,
      hasCurrentFeedback: this.currentFeedback !== undefined,
    };
  }

  protected cleanup(): void {
    super.cleanup();

    if (this.hideTimer !== undefined) {
      clearTimeout(this.hideTimer);
    }

    if (this.animationFrame !== undefined) {
      clearTimeout(this.animationFrame);
    }

    this.currentFeedback = undefined;
    this.feedbackHistory = [];
  }
}

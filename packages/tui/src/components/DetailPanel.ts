import type { Step, Command } from '@checklist/core/types';
import { createLogger } from '@checklist/core/utils/logger';
import type { ViewSystem } from '../views/ViewSystem';
import { BaseComponent } from './BaseComponent';
import { ComponentRegistry } from './ComponentRegistry';

import { MarkdownRenderer } from './MarkdownRenderer';

const logger = createLogger('checklist:tui:detail-panel');

export interface DetailPanelOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  viewSystem?: ViewSystem;
}

export interface DetailPanelState {
  currentStep: Step | null;
  scrollPosition: number;
  isVisible: boolean;
}

export class DetailPanel extends BaseComponent {
  public readonly id = 'detail-panel';
  private detailState: DetailPanelState;
  private content: string[] = [];
  private markdownRenderer: MarkdownRenderer;
  private renderCache: Map<string, string[]> = new Map();
  private registry?: ComponentRegistry;
  private scrollOffset = 0;
  private viewportHeight: number;
  private viewportWidth: number;

  constructor(options: DetailPanelOptions) {
    super({
      x: options.x,
      y: options.y,
      width: options.width,
      height: options.height,
    });

    this.detailState = {
      currentStep: null,
      scrollPosition: 0,
      isVisible: true,
    };
    this.state = { currentStep: null, scrollPosition: 0, isVisible: true };
    this.viewportWidth = options.width;
    this.viewportHeight = options.height;
    this.markdownRenderer = new MarkdownRenderer({
      width: options.width - 2,
      syntaxHighlighting: true,
      commandIndicators: true,
      variableHighlighting: true,
    });
    logger.debug({ msg: 'DetailPanel initialized', options });
  }
  public setRegistry(registry: ComponentRegistry): void {
    this.registry = registry;
  }
  public updateStep(step: Step): void {
    const startTime = performance.now();
    this.updateStepState(step);
    const renderedContent = this.getOrRenderContent(step);
    this.updateContentAndScroll(renderedContent);
    this.logUpdatePerformance(step, startTime, renderedContent.length);
  }
  private updateStepState(step: Step): void {
    this.detailState.currentStep = step;
    this.detailState.scrollPosition = 0;
    this.state.currentStep = step;
    this.state.scrollPosition = 0;
  }

  private getOrRenderContent(step: Step): string[] {
    const cacheKey = this.getCacheKey(step);
    const cached = this.renderCache.get(cacheKey);
    if (cached !== undefined) {
      return cached;
    }
    const rendered = this.renderContent(step);
    this.renderCache.set(cacheKey, rendered);
    return rendered;
  }

  private updateContentAndScroll(content: string[]): void {
    this.content = content;
    this.scrollOffset = 0;
  }

  private logUpdatePerformance(
    step: Step,
    startTime: number,
    contentLines: number
  ): void {
    const updateTime = performance.now() - startTime;
    logger.debug({
      msg: 'Step updated',
      stepId: step.id,
      updateTime,
      contentLines,
    });
    if (updateTime > 50) {
      logger.warn({
        msg: 'Panel update exceeded 50ms threshold',
        stepId: step.id,
        updateTime,
      });
    }
  }
  private getCacheKey(step: Step): string {
    return `${step.id}-${step.title}-${step.description}`;
  }
  private renderContent(step: Step): string[] {
    const lines: string[] = [this.renderStepTitle(step), ''];
    if (step.description !== undefined && step.description !== '')
      lines.push(...this.markdownRenderer.render(step.description), '');
    if (step.commands !== undefined && step.commands.length > 0)
      lines.push(this.renderCommandsSection(step.commands), '');
    lines.push(this.renderCopyInstruction());
    return lines;
  }
  private renderStepTitle(step: Step): string {
    return `\x1b[1m${step.title}\x1b[0m`;
  }

  private renderCommandsSection(commands: Command[]): string {
    const lines: string[] = ['Commands:'];
    for (const command of commands) {
      const indicator = this.getCommandIndicator(command.type);
      const formattedCommand = this.markdownRenderer.renderCommand(
        command.content,
        command.type
      );
      lines.push(`  ${indicator} ${formattedCommand}`);
    }
    return lines.join('\n');
  }

  private getCommandIndicator(type: Command['type']): string {
    const indicators = {
      claude: '\x1b[36m🤖\x1b[0m',
      bash: '\x1b[32m$\x1b[0m',
      internal: '\x1b[33m⚙\x1b[0m',
    };
    return indicators[type] || '\x1b[90m>\x1b[0m';
  }
  private renderCopyInstruction(): string {
    return '\x1b[90mPress Ctrl+C to copy the current step content\x1b[0m';
  }
  public async copyToClipboard(): Promise<void> {
    if (!this.detailState.currentStep) {
      logger.warn({ msg: 'No current step to copy' });
      return;
    }
    try {
      const clipboardy = await import('clipboardy');
      const content = this.getPlainTextContent(this.detailState.currentStep);
      await clipboardy.default.write(content);
      logger.info({
        msg: 'Content copied to clipboard',
        stepId: this.detailState.currentStep.id,
      });
      this.showCopyFeedback();
    } catch (error) {
      logger.error({ msg: 'Failed to copy to clipboard', error });
      this.showCopyError(error);
    }
  }

  private getPlainTextContent(step: Step): string {
    const parts: string[] = [step.title];

    if (step.description !== undefined && step.description !== '') {
      parts.push('', step.description);
    }

    if (step.commands !== undefined && step.commands.length > 0) {
      parts.push('', 'Commands:');
      for (const command of step.commands) {
        parts.push(`  ${command.content}`);
      }
    }

    return parts.join('\n');
  }

  private showCopyFeedback(): void {
    const originalContent = [...this.content];
    this.content = [
      ...originalContent.slice(0, -1),
      '\x1b[32m✓ Copied to clipboard!\x1b[0m',
    ];
    setTimeout(() => {
      this.content = originalContent;
    }, 2000);
  }

  private showCopyError(error: unknown): void {
    const originalContent = [...this.content];
    const errorMessage =
      error instanceof Error ? error.message : 'Unknown error';
    this.content = [
      ...originalContent.slice(0, -1),
      `\x1b[31m✗ Copy failed: ${errorMessage}\x1b[0m`,
      '\x1b[90mSelect text manually to copy\x1b[0m',
    ];
    setTimeout(() => {
      this.content = originalContent;
    }, 3000);
  }

  public clearCache(): void {
    this.renderCache.clear();
    logger.debug({ msg: 'Render cache cleared' });
  }
  public setVisible(visible: boolean): void {
    this.detailState.isVisible = visible;
    this.state.isVisible = visible;
  }

  public getDetailState(): DetailPanelState {
    return { ...this.detailState };
  }
  public getState(): Record<string, unknown> {
    return { ...this.state };
  }

  public handleKeyPress(key: string): boolean {
    if (key === 'c') {
      void this.copyToClipboard();
      return true;
    }
    return this.handleScrollKey(key);
  }
  private handleScrollKey(key: string): boolean {
    const maxScroll = Math.max(0, this.content.length - this.viewportHeight);
    if (key === 'ArrowUp' || key === 'k') {
      if (this.scrollOffset > 0) this.scrollOffset--;
      return true;
    }
    if (key === 'ArrowDown' || key === 'j') {
      if (this.scrollOffset < maxScroll) this.scrollOffset++;
      return true;
    }
    return this.handlePageKeys(key);
  }
  private handlePageKeys(key: string): boolean {
    const maxScroll = Math.max(0, this.content.length - this.viewportHeight);
    if (key === 'PageUp') {
      this.scrollOffset = Math.max(
        0,
        this.scrollOffset - this.viewportHeight + 1
      );
      return true;
    }
    if (key === 'PageDown') {
      this.scrollOffset = Math.min(
        maxScroll,
        this.scrollOffset + this.viewportHeight - 1
      );
      return true;
    }
    if (key === 'Home') {
      this.scrollOffset = 0;
      return true;
    }
    if (key === 'End') {
      this.scrollOffset = maxScroll;
      return true;
    }
    return false;
  }
  public render(_props: unknown = {}): string {
    if (!this.detailState.isVisible) return '';
    const visibleContent = this.content.slice(
      this.scrollOffset,
      this.scrollOffset + this.viewportHeight
    );
    return visibleContent.join('\n');
  }
  public renderLines(): string[] {
    if (!this.detailState.isVisible) return [];
    return this.content.slice(
      this.scrollOffset,
      this.scrollOffset + this.viewportHeight
    );
  }

  public getContent(): string[] {
    return [...this.content];
  }
  public dispose(): void {
    this.clearCache();
    this.content = [];
    logger.debug({ msg: 'DetailPanel disposed' });
  }
}

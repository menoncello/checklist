import type { Step } from '@checklist/core/types';
import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:detail-panel-clipboard');

export class DetailPanelClipboardHandler {
  public async copyToClipboard(step: Step): Promise<boolean> {
    if (step === null || step === undefined) {
      logger.warn({ msg: 'No step data available to copy' });
      return false;
    }

    try {
      const textContent = this.getPlainTextContent(step);
      const clipboard = await import('clipboardy');
      await clipboard.default.write(textContent);
      return true;
    } catch (error) {
      logger.error({ msg: 'Failed to copy to clipboard', error });
      return false;
    }
  }

  private getPlainTextContent(step: Step): string {
    const lines: string[] = [];
    lines.push(step.title);

    if (
      step.description !== null &&
      step.description !== undefined &&
      step.description.trim() !== ''
    ) {
      lines.push('');
      lines.push(step.description);
    }

    if (
      step.commands !== null &&
      step.commands !== undefined &&
      step.commands.length > 0
    ) {
      lines.push('');
      lines.push('Commands:');
      step.commands.forEach((cmd) => {
        lines.push(`- ${cmd.content}`);
      });
    }

    return lines.join('\n');
  }

  public renderCopyInstruction(): string {
    return '\n\x1b[2mPress \x1b[1mc\x1b[0m\x1b[2m to copy step content to clipboard\x1b[0m';
  }
}

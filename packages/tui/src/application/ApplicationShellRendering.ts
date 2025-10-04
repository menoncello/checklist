import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:tui:application-shell-rendering');

export class ApplicationShellRendering {
  public generateSplashScreen(version: string): string {
    const splashLines = [
      '',
      '╔══════════════════════════════════════════════════════════════╗',
      '║                    BMAD Checklist Manager                     ║',
      '║                          Terminal UI                          ║',
      `║                           Version ${version.padEnd(15)}                       ║`,
      '╚══════════════════════════════════════════════════════════════╝',
      '',
    ];

    return splashLines.join('\\n');
  }

  public renderError(error: Error): string {
    return `Error: ${error.message}`;
  }

  public logRenderPerformance(duration: number): void {
    if (duration > 50) {
      logger.warn({
        msg: 'Render time exceeds 50ms threshold',
        duration,
      });
    }
  }
}

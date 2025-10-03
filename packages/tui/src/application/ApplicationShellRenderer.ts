import { createLogger } from '@checklist/core/utils/logger';
import { SplitPaneLayout } from '../layout/SplitPaneLayout';
import { PerformanceMonitor } from '../performance/PerformanceMonitor';
import { ApplicationShellRendering } from './ApplicationShellRendering';

const logger = createLogger('checklist:tui:application-shell-renderer');

export class ApplicationShellRenderer {
  constructor(
    private splitPaneLayout: SplitPaneLayout,
    private performanceMonitor: PerformanceMonitor,
    private rendering: ApplicationShellRendering
  ) {}

  public render(): void {
    try {
      const renderStart = performance.now();
      this.performRender();
      const renderDuration = performance.now() - renderStart;
      this.logRenderPerformance(renderDuration);
    } catch (error) {
      logger.error({
        msg: 'Render failed',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private performRender(): void {
    const leftContent = this.splitPaneLayout.getLeftPanelContent();
    const rightContent = this.splitPaneLayout.getRightPanelContent();
    const output = this.splitPaneLayout.render(leftContent, rightContent);
    process.stdout.write(output);
  }

  private logRenderPerformance(duration: number): void {
    this.performanceMonitor.recordMetricValue('render_time', duration, {
      phase: 'render',
    });
    this.rendering.logRenderPerformance(duration);
  }
}

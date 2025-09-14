export type DebugPanel = 'logs' | 'metrics' | 'components' | 'events' | 'performance';

export interface KeypressHandlerContext {
  isVisible: boolean;
  config: {
    enabled: boolean;
    hotkeys: Record<string, string>;
  };
  selectedPanel: DebugPanel;
  toggle(): void;
  clearLogs(): void;
  exportLogs(): void;
  emit(event: string, data: unknown): void;
}

export class KeypressHandlers {
  static handle(key: string, context: KeypressHandlerContext): boolean {
    if (!context.config.enabled) return false;

    const { hotkeys } = context.config;

    // Toggle handler
    if (key === hotkeys.toggle) {
      context.toggle();
      return true;
    }

    if (!context.isVisible) return false;

    // Panel switching handlers
    const panelHandlers: Record<string, DebugPanel> = {
      [hotkeys.logs]: 'logs',
      [hotkeys.metrics]: 'metrics',
      [hotkeys.components]: 'components',
      [hotkeys.events]: 'events',
      [hotkeys.performance]: 'performance',
    };

    const panel = panelHandlers[key];
    if (panel) {
      return this.switchToPanel(panel, context);
    }

    // Action handlers
    if (key === hotkeys.clear) {
      context.clearLogs();
      return true;
    }

    if (key === hotkeys.export) {
      context.exportLogs();
      return true;
    }

    return false;
  }

  private static switchToPanel(panel: DebugPanel, context: KeypressHandlerContext): boolean {
    context.selectedPanel = panel;
    context.emit('panelChanged', { panel });
    return true;
  }
}
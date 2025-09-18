export class DebugKeyHandler {
  static handleToggleKey(context: Record<string, unknown>): boolean {
    const toggle = context.toggle as () => void;
    toggle();
    return true;
  }

  static handleVisiblePanelKeys(
    key: string,
    hotkeys: {
      clear: string;
      export: string;
      logs: string;
      metrics: string;
      components: string;
      events: string;
      performance: string;
    },
    context: Record<string, unknown>
  ): boolean {
    const panelKey = this.getPanelForKey(key, hotkeys);
    if (panelKey !== null) {
      return this.switchToPanel(panelKey, context);
    }

    if (key === hotkeys.clear) {
      return this.handleClearKey(context);
    }

    if (key === hotkeys.export) {
      return this.handleExportKey(context);
    }

    return false;
  }

  static getPanelForKey(
    key: string,
    hotkeys: {
      logs: string;
      metrics: string;
      components: string;
      events: string;
      performance: string;
    }
  ): string | null {
    const panelMap: Record<string, string> = {
      [hotkeys.logs]: 'logs',
      [hotkeys.metrics]: 'metrics',
      [hotkeys.components]: 'components',
      [hotkeys.events]: 'events',
      [hotkeys.performance]: 'performance',
    };
    return panelMap[key] || null;
  }

  static switchToPanel(
    panel: string,
    context: Record<string, unknown>
  ): boolean {
    context.selectedPanel = panel;
    const emit = context.emit as (event: string, data: unknown) => void;
    emit('panelChanged', { panel });
    return true;
  }

  static handleClearKey(context: Record<string, unknown>): boolean {
    const clearLogs = context.clearLogs as () => void;
    clearLogs();
    return true;
  }

  static handleExportKey(context: Record<string, unknown>): boolean {
    const exportLogs = context.exportLogs as () => void;
    exportLogs();
    return true;
  }
}

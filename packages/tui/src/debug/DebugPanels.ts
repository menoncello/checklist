import { DebugManager, ComponentDebugInfo } from './DebugManager';

export class DebugPanelRenderer {
  private debugManager: DebugManager;

  constructor(debugManager: DebugManager) {
    this.debugManager = debugManager;
  }

  renderLogsPanel(
    width: number,
    height: number,
    scrollOffset: number
  ): string[] {
    const logs = this.debugManager.getLogs();
    const visibleLogs = logs.slice(scrollOffset, scrollOffset + height);
    const lines = visibleLogs.map((log) => {
      const timestamp = new Date(log.timestamp).toLocaleTimeString();
      const icon = this.getLevelIcon(log.level);
      return this.truncateLine(
        `${icon} ${timestamp} [${log.category}] ${log.message}`,
        width
      );
    });
    return this.padLines(lines, height);
  }

  renderMetricsPanel(width: number, height: number): string[] {
    const m = this.debugManager.getMetrics();
    const lines = [
      '📊 Performance Metrics',
      '',
      `⏱️  Render Time: ${m.renderTime.toFixed(2)}ms`,
      `🧩 Components: ${m.componentCount}`,
      `🎯 Events: ${m.eventCount}`,
      `💾 Memory: ${(m.memoryUsage / 1024 / 1024).toFixed(2)}MB`,
      `📈 FPS: ${m.fps.toFixed(1)}`,
      `🕐 Last Update: ${m.lastUpdate !== undefined && m.lastUpdate !== null ? new Date(m.lastUpdate).toLocaleTimeString() : 'N/A'}`,
    ];

    if (typeof process !== 'undefined') {
      lines.push(
        '',
        '🖥️  System Info',
        `Node.js: ${process.version}`,
        `Platform: ${process.platform}`,
        `Uptime: ${Math.floor(process.uptime())}s`
      );
    }
    return this.padLines(lines, height);
  }

  renderComponentsPanel(
    width: number,
    height: number,
    scrollOffset: number
  ): string[] {
    const tree = this.debugManager.getComponentTree();
    const lines: string[] = [];

    if (tree !== null && tree !== undefined) {
      lines.push('🧩 Component Tree', '');
      this.addComponentTree(tree as ComponentDebugInfo, lines, 0, width);
    } else {
      lines.push('No component tree available');
    }

    const visible = lines.slice(scrollOffset, scrollOffset + height);
    return this.padLines(visible, height);
  }

  renderPerformancePanel(
    width: number,
    height: number,
    scrollOffset: number
  ): string[] {
    const perfLogs = this.debugManager
      .getLogs()
      .filter((log) => log.category === 'Profiler')
      .slice(scrollOffset, scrollOffset + height);

    const lines = ['⚡ Performance Profiling', ''];

    if (perfLogs.length === 0) {
      lines.push(
        'No performance data available',
        'Enable profiling in debug config'
      );
    } else {
      perfLogs.forEach((log) => {
        const timestamp = new Date(log.timestamp).toLocaleTimeString();
        lines.push(this.truncateLine(`${timestamp} ${log.message}`, width));
      });
    }
    return this.padLines(lines, height);
  }

  renderConsolePanel(width: number, height: number): string[] {
    const lines = [
      '💻 Debug Console',
      '',
      'Available commands:',
      '  clear - Clear logs',
      '  export - Export current panel',
      '  metrics - Show current metrics',
      '  gc - Trigger garbage collection',
      '',
      'Hotkeys:',
      '  1-5 - Switch panels',
      '  ↑↓ - Scroll',
      '  PgUp/PgDn - Page scroll',
      '  Home - Go to top',
      '  c - Clear (in logs panel)',
      '  e - Export current panel',
    ];
    return this.padLines(lines, height);
  }

  private addComponentTree(
    comp: ComponentDebugInfo,
    lines: string[],
    depth: number,
    width: number
  ): void {
    const indent = '  '.repeat(depth);
    const prefix = depth > 0 ? '├─ ' : '';
    const icon = (comp.state as unknown as string) === 'mounted' ? '✅' : '⏸️';
    lines.push(
      this.truncateLine(
        `${icon} ${indent}${prefix}${comp.name} (${comp.id})`,
        width
      )
    );
    (comp.children ?? []).forEach((child) =>
      this.addComponentTree(child, lines, depth + 1, width)
    );
  }

  private getLevelIcon(level: string): string {
    switch (level) {
      case 'debug':
        return '🔍';
      case 'info':
        return 'ℹ️';
      case 'warn':
        return '⚠️';
      case 'error':
        return '❌';
      default:
        return '•';
    }
  }

  private truncateLine(line: string, maxWidth: number): string {
    if (line.length <= maxWidth) {
      return line.padEnd(maxWidth, ' ');
    }
    return line.slice(0, maxWidth - 3) + '...';
  }

  private padLines(lines: string[], targetHeight: number): string[] {
    while (lines.length < targetHeight) lines.push('');
    return lines;
  }
}

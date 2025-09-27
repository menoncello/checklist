export type DebugLogEntry = {
  timestamp: number;
  level: 'debug' | 'info' | 'warn' | 'error';
  category: string;
  message: string;
  data?: unknown;
};

export type ComponentDebugInfo = {
  id: string;
  name: string;
  props?: Record<string, unknown>;
  state?: Record<string, unknown>;
  children?: ComponentDebugInfo[];
};

export type DebugConfig = {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  showOverlay: boolean;
  showMetrics: boolean;
  showComponentTree: boolean;
  showEventLog: boolean;
  showPerformanceMetrics: boolean;
  maxLogEntries: number;
  enableProfiling: boolean;
  hotkeys: Record<string, string>;
  overlayPosition?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
};

export class DebugLogManager {
  private logs: DebugLogEntry[] = [];
  private maxEntries: number;

  constructor(maxEntries: number = 1000) {
    this.maxEntries = maxEntries;
  }

  log(
    level: 'debug' | 'info' | 'warn' | 'error',
    category: string,
    message: string,
    data?: unknown
  ): void {
    const entry: DebugLogEntry = {
      timestamp: Date.now(),
      level,
      category,
      message,
      data,
    };

    this.logs.push(entry);

    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }
  }

  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  getLogsByLevel(level: string): DebugLogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }

  getLogsByCategory(category: string): DebugLogEntry[] {
    return this.logs.filter((log) => log.category === category);
  }

  clear(): void {
    this.logs = [];
  }

  clearLogs(): void {
    this.clear();
  }

  private isValidFilterValue(value: string | number | undefined): boolean {
    return (
      value !== undefined &&
      value !== null &&
      (typeof value === 'number' ? value > 0 : value.trim() !== '')
    );
  }

  filterLogs(filter: {
    level?: string;
    category?: string;
    limit?: number;
  }): DebugLogEntry[] {
    let filteredLogs = [...this.logs];

    if (this.isValidFilterValue(filter.level)) {
      filteredLogs = filteredLogs.filter((log) => log.level === filter.level);
    }

    if (this.isValidFilterValue(filter.category)) {
      filteredLogs = filteredLogs.filter(
        (log) => log.category === filter.category
      );
    }

    if (this.isValidFilterValue(filter.limit)) {
      filteredLogs = filteredLogs.slice(-(filter.limit as number));
    }

    return filteredLogs;
  }
}

export class DebugEventManager {
  private handlers: Map<string, Set<Function>> = new Map();

  emit(event: string, data?: unknown): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.forEach((handler) => handler(data));
    }
  }

  on(event: string, handler: Function): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, new Set());
    }
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.add(handler);
    }
  }

  off(event: string, handler: Function): void {
    const eventHandlers = this.handlers.get(event);
    if (eventHandlers) {
      eventHandlers.delete(handler);
    }
  }

  clear(): void {
    this.handlers.clear();
  }
}

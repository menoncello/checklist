export interface DebugConfig {
  enabled: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  overlayPosition: 'top' | 'bottom' | 'left' | 'right';
  showMetrics: boolean;
  showLogs: boolean;
  maxLogEntries: number;
  enableProfiling?: boolean;
  hotkeys?: Record<string, string>;
  showEventLog?: boolean;
  showOverlay?: boolean;
}

export interface DebugLogEntry {
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  data?: unknown;
  source?: string;
  category?: string;
}

export interface DebugMetrics {
  fps: number;
  memoryUsage: number;
  renderTime: number;
  componentCount: number;
  eventCount: number;
  lastUpdate?: number;
}

export interface ComponentDebugInfo {
  id: string;
  name: string;
  renderCount: number;
  lastRenderTime: number;
  props: Record<string, unknown>;
  state: Record<string, unknown>;
  type?: string;
  children?: ComponentDebugInfo[];
}

export class DebugLogManager {
  private logs: DebugLogEntry[] = [];
  private maxEntries = 100;

  constructor(maxEntries?: number) {
    if (maxEntries !== undefined && maxEntries > 0) {
      this.maxEntries = maxEntries;
    }
  }

  addLog(entry: DebugLogEntry): void {
    this.logs.push(entry);
    if (this.logs.length > this.maxEntries) {
      this.logs.shift();
    }
  }

  getLogs(): DebugLogEntry[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  filterLogs(level: string): DebugLogEntry[] {
    return this.logs.filter((log) => log.level === level);
  }
}

export class DebugEventManager {
  private listeners: Map<string, Set<(data: unknown) => void>> = new Map();

  on(event: string, callback: (data: unknown) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.add(callback);
    }
  }

  off(event: string, callback: (data: unknown) => void): void {
    this.listeners.get(event)?.delete(callback);
  }

  emit(event: string, data: unknown): void {
    this.listeners.get(event)?.forEach((callback) => callback(data));
  }

  clear(): void {
    this.listeners.clear();
  }
}

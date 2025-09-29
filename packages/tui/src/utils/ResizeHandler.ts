export interface ResizeEvent {
  width: number;
  height: number;
  previousWidth: number;
  previousHeight: number;
  timestamp: number;
}

export interface ResizeHandlerConfig {
  debounceMs: number;
  throttleMs: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number;
  maxHeight: number;
  enableLogging: boolean;
}

export class ResizeHandler {
  private config: ResizeHandlerConfig;
  private eventHandlers = new Map<string, Set<Function>>();
  private currentWidth: number = 0;
  private currentHeight: number = 0;
  private previousWidth: number = 0;
  private previousHeight: number = 0;
  private lastResizeTime: number = 0;
  private debounceTimer: Timer | null = null;
  private throttleTimer: Timer | null = null;
  private isThrottling: boolean = false;
  private resizeHistory: ResizeEvent[] = [];
  private maxHistorySize: number = 100;

  constructor(config: Partial<ResizeHandlerConfig> = {}) {
    this.config = {
      debounceMs: 150,
      throttleMs: 50,
      minWidth: 80, // Minimum terminal width
      minHeight: 24, // Minimum terminal height
      maxWidth: 500,
      maxHeight: 200,
      enableLogging: false,
      ...config,
    };

    this.initialize();
  }

  private initialize(): void {
    this.updateCurrentSize();
    this.setupResizeListener();

    if (this.config.enableLogging) {
      console.log(
        `ResizeHandler initialized: ${this.currentWidth}x${this.currentHeight}`
      );
    }
  }

  private updateCurrentSize(): void {
    this.previousWidth = this.currentWidth;
    this.previousHeight = this.currentHeight;
    this.currentWidth = process.stdout.columns ?? 80;
    this.currentHeight = process.stdout.rows ?? 24;
  }

  private setupResizeListener(): void {
    process.on('SIGWINCH', () => {
      this.handleResize();
    });
  }

  private handleResize(): void {
    this.updateCurrentSize();

    const resizeEvent = this.createResizeEvent();

    if (!this.isValidResize(resizeEvent)) {
      if (this.config.enableLogging) {
        console.log(
          `Invalid resize ignored: ${resizeEvent.width}x${resizeEvent.height}`
        );
      }
      return;
    }

    this.recordResize(resizeEvent);

    // Handle throttling
    if (this.config.throttleMs > 0) {
      this.handleThrottledResize(resizeEvent);
    } else {
      this.processResize(resizeEvent);
    }

    // Handle debouncing
    if (this.config.debounceMs > 0) {
      this.handleDebouncedResize(resizeEvent);
    }
  }

  private createResizeEvent(): ResizeEvent {
    return {
      width: this.currentWidth,
      height: this.currentHeight,
      previousWidth: this.previousWidth,
      previousHeight: this.previousHeight,
      timestamp: Date.now(),
    };
  }

  private isValidResize(event: ResizeEvent): boolean {
    // Check minimum dimensions
    if (
      event.width < this.config.minWidth ||
      event.height < this.config.minHeight
    ) {
      return false;
    }

    // Check maximum dimensions
    if (
      event.width > this.config.maxWidth ||
      event.height > this.config.maxHeight
    ) {
      return false;
    }

    // Check if size actually changed
    if (
      event.width === event.previousWidth &&
      event.height === event.previousHeight
    ) {
      return false;
    }

    return true;
  }

  private handleThrottledResize(event: ResizeEvent): void {
    if (this.isThrottling) return;

    this.isThrottling = true;
    this.processResize(event);

    this.throttleTimer = setTimeout(() => {
      this.isThrottling = false;
    }, this.config.throttleMs);
  }

  private handleDebouncedResize(event: ResizeEvent): void {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.debounceTimer = setTimeout(() => {
      this.emit('debouncedResize', event);
      this.debounceTimer = null;
    }, this.config.debounceMs);
  }

  private processResize(event: ResizeEvent): void {
    this.lastResizeTime = event.timestamp;

    if (this.config.enableLogging) {
      console.log(
        `Terminal resized: ${event.previousWidth}x${event.previousHeight} → ${event.width}x${event.height}`
      );
    }

    this.emit('resize', event);
    this.emit('immediateResize', event);
  }

  private recordResize(event: ResizeEvent): void {
    this.resizeHistory.push(event);

    // Trim history if it exceeds max size
    if (this.resizeHistory.length > this.maxHistorySize) {
      this.resizeHistory = this.resizeHistory.slice(-this.maxHistorySize);
    }
  }

  public getCurrentSize(): { width: number; height: number } {
    return {
      width: this.currentWidth,
      height: this.currentHeight,
    };
  }

  public getPreviousSize(): { width: number; height: number } {
    return {
      width: this.previousWidth,
      height: this.previousHeight,
    };
  }

  public hasChanged(): boolean {
    return (
      this.currentWidth !== this.previousWidth ||
      this.currentHeight !== this.previousHeight
    );
  }

  public getResizeHistory(): ResizeEvent[] {
    return [...this.resizeHistory];
  }

  public getLastResizeTime(): number {
    return this.lastResizeTime;
  }

  public getTimeSinceLastResize(): number {
    return Date.now() - this.lastResizeTime;
  }

  public isWithinBounds(width: number, height: number): boolean {
    return (
      width >= this.config.minWidth &&
      width <= this.config.maxWidth &&
      height >= this.config.minHeight &&
      height <= this.config.maxHeight
    );
  }

  public constrainSize(
    width: number,
    height: number
  ): { width: number; height: number } {
    return {
      width: Math.max(
        this.config.minWidth,
        Math.min(this.config.maxWidth, width)
      ),
      height: Math.max(
        this.config.minHeight,
        Math.min(this.config.maxHeight, height)
      ),
    };
  }

  public updateConfig(newConfig: Partial<ResizeHandlerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (this.config.enableLogging) {
      console.log('ResizeHandler configuration updated');
    }
  }

  public getConfig(): ResizeHandlerConfig {
    return { ...this.config };
  }

  public getMetrics() {
    const history = this.resizeHistory;
    const recentResizes = history.filter(
      (event) => Date.now() - event.timestamp < 60000 // Last minute
    );

    return {
      currentSize: this.getCurrentSize(),
      previousSize: this.getPreviousSize(),
      hasChanged: this.hasChanged(),
      lastResizeTime: this.lastResizeTime,
      timeSinceLastResize: this.getTimeSinceLastResize(),
      totalResizes: history.length,
      recentResizes: recentResizes.length,
      isThrottling: this.isThrottling,
      isDebouncePending: this.debounceTimer !== null,
      averageResizeInterval: this.calculateAverageResizeInterval(),
      resizeFrequency: this.calculateResizeFrequency(),
    };
  }

  private calculateAverageResizeInterval(): number {
    if (this.resizeHistory.length < 2) return 0;

    const intervals: number[] = [];
    for (let i = 1; i < this.resizeHistory.length; i++) {
      intervals.push(
        this.resizeHistory[i].timestamp - this.resizeHistory[i - 1].timestamp
      );
    }

    return (
      intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length
    );
  }

  private calculateResizeFrequency(): number {
    if (this.resizeHistory.length < 2) return 0;

    const timespan =
      this.resizeHistory[this.resizeHistory.length - 1].timestamp -
      this.resizeHistory[0].timestamp;

    return (this.resizeHistory.length - 1) / (timespan / 1000); // Resizes per second
  }

  public reset(): void {
    this.resizeHistory = [];
    this.lastResizeTime = 0;
    this.isThrottling = false;

    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }

    if (this.throttleTimer) {
      clearTimeout(this.throttleTimer);
      this.throttleTimer = null;
    }

    this.updateCurrentSize();

    if (this.config.enableLogging) {
      console.log('ResizeHandler reset');
    }
  }

  public destroy(): void {
    this.reset();
    this.eventHandlers.clear();

    if (this.config.enableLogging) {
      console.log('ResizeHandler destroyed');
    }
  }

  public on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    const handlers = this.eventHandlers.get(event);
    if (handlers != null) {
      handlers.add(handler);
    }
  }

  public off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.delete(handler);
    }
  }

  private emit(event: string, data?: unknown): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      handlers.forEach((handler) => {
        try {
          handler(data);
        } catch (error) {
          if (this.config.enableLogging) {
            console.error(`Error in resize handler for '${event}':`, error);
          }
        }
      });
    }
  }
}

import { EventEmitter } from 'events';
import { DebugIntegration } from '../debug';
import { ErrorBoundary } from '../errors/ErrorBoundary';
import { KeyboardHandler } from '../events/KeyboardHandler';
import { PerformanceManager } from '../performance';
import { ScreenManager } from '../screens/ScreenManager';
import { ApplicationLoop } from './ApplicationLoop';

export interface TUIFrameworkState {
  isInitialized: boolean;
  isRunning: boolean;
  currentScreen: string | null;
  componentCount: number;
  errorCount: number;
  startupTime: number;
}

export interface EventHandlerContext {
  applicationLoop?: ApplicationLoop;
  keyboardHandler?: KeyboardHandler;
  screenManager?: ScreenManager;
  errorBoundary?: ErrorBoundary;
  performanceManager?: PerformanceManager;
  debugIntegration?: DebugIntegration;
  state: TUIFrameworkState;
  eventEmitter: EventEmitter;
}

export class EventHandlerSetup {
  private context: EventHandlerContext;

  constructor(context: EventHandlerContext) {
    this.context = context;
  }

  setupAllEventHandlers(): void {
    this.setupApplicationLoopHandlers();
    this.setupKeyboardHandlers();
    this.setupScreenManagerHandlers();
    this.setupErrorHandlers();
    this.setupPerformanceHandlers();
  }

  private setupApplicationLoopHandlers(): void {
    if (!this.context.applicationLoop) return;

    this.context.applicationLoop.on('frame', (data: unknown) => {
      this.handleFrame(data);
    });
  }

  private setupKeyboardHandlers(): void {
    if (!this.context.keyboardHandler) return;

    this.context.keyboardHandler.on('keypress', (data: unknown) => {
      this.handleKeyPress(data);
    });
  }

  private setupScreenManagerHandlers(): void {
    if (!this.context.screenManager) return;

    this.context.screenManager.on('screenChanged', (data: unknown) => {
      this.handleScreenChange(data);
    });
  }

  private setupErrorHandlers(): void {
    if (!this.context.errorBoundary) return;

    this.context.errorBoundary.on('errorCaught', (data: unknown) => {
      this.context.state.errorCount++;
      this.context.debugIntegration?.log(
        'error',
        'Framework',
        'Error caught by boundary',
        data
      );
    });
  }

  private setupPerformanceHandlers(): void {
    if (!this.context.performanceManager) return;

    this.context.performanceManager.on('memoryWarning', (data: unknown) => {
      this.context.debugIntegration?.log(
        'warn',
        'Performance',
        'Memory warning detected',
        data
      );
    });

    this.context.performanceManager.on('performanceIssue', (data: unknown) => {
      this.context.debugIntegration?.log(
        'warn',
        'Performance',
        'Performance issue detected',
        data
      );
    });
  }

  private handleKeyPress(data: unknown): void {
    if (!this.isValidKeyPressData(data)) return;

    const keyData = data as { key: string; shift: boolean; ctrl: boolean; meta: boolean };

    const currentScreen = this.context.screenManager?.getCurrentScreen();
    if (!this.canHandleKeyPress(currentScreen)) return;

    this.context.eventEmitter.emit('input', keyData);
  }

  private canHandleKeyPress(screen: unknown): boolean {
    return screen !== null && screen !== undefined;
  }

  private isValidKeyPressData(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'key' in data &&
      typeof (data as { key: unknown }).key === 'string'
    );
  }

  private handleScreenChange(data: unknown): void {
    if (!this.isValidScreenData(data)) return;

    const screenData = data as { screenId: string };
    this.context.state.currentScreen = screenData.screenId;

    this.context.eventEmitter.emit('screenChanged', {
      screenId: screenData.screenId,
      timestamp: Date.now(),
    });
  }

  private isValidScreenData(data: unknown): boolean {
    return (
      typeof data === 'object' &&
      data !== null &&
      'screenId' in data &&
      typeof (data as { screenId: unknown }).screenId === 'string'
    );
  }

  private handleFrame(_data: unknown): void {
    this.context.eventEmitter.emit('frame', { timestamp: Date.now() });
  }
}
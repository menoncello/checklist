import { Screen } from '../framework/UIFramework';
import { ScreenStack } from './ScreenStack';

export interface ScreenTransition {
  type: 'push' | 'pop' | 'replace';
  fromScreen?: Screen;
  toScreen?: Screen;
  timestamp: number;
  duration?: number;
}

export interface ScreenManagerConfig {
  enableTransitions: boolean;
  transitionDuration: number;
  maxStackSize: number;
  enableHistory: boolean;
  historySize: number;
}

export class ScreenManager {
  private stack: ScreenStack;
  private config: ScreenManagerConfig;
  private transitionHistory: ScreenTransition[] = [];
  private eventHandlers = new Map<string, Set<Function>>();
  private activeTransition: ScreenTransition | null = null;

  constructor(config: Partial<ScreenManagerConfig> = {}) {
    this.config = {
      enableTransitions: true,
      transitionDuration: 200,
      maxStackSize: 50,
      enableHistory: true,
      historySize: 100,
      ...config,
    };

    this.stack = new ScreenStack(this.config.maxStackSize);
    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.stack.on('overflow', (data: unknown) => {
      this.emit('stackOverflow', data);
    });

    this.stack.on('underflow', () => {
      this.emit('stackUnderflow');
    });

    this.stack.on('change', (data: unknown) => {
      this.emit('stackChange', data);
    });
  }

  public async pushScreen(screen: Screen): Promise<void> {
    const currentScreen = this.stack.current();
    await this.exitCurrentScreen(currentScreen);

    const transition = this.createTransition('push', currentScreen, screen);
    await this.executeTransition(transition, async () => {
      this.stack.push(screen);
      await this.enterScreen(screen);
    });

    this.emit('screenPushed', { screen, stack: this.stack.getStack() });
  }

  public async popScreen(): Promise<Screen | null> {
    const currentScreen = this.stack.current();
    if (!currentScreen) return null;

    await this.exitCurrentScreen(currentScreen);
    const poppedScreen = this.stack.pop();
    const newCurrentScreen = this.stack.current();

    const transition = this.createTransition(
      'pop',
      poppedScreen,
      newCurrentScreen
    );
    await this.executeTransition(transition, async () => {
      await this.enterScreen(newCurrentScreen);
    });

    this.emit('screenPopped', {
      screen: poppedScreen,
      currentScreen: newCurrentScreen,
      stack: this.stack.getStack(),
    });

    return poppedScreen;
  }

  public async replaceScreen(screen: Screen): Promise<Screen | null> {
    const currentScreen = this.stack.current();
    await this.exitCurrentScreen(currentScreen);

    const replacedScreen = this.stack.replace(screen);

    const transition = this.createTransition('replace', replacedScreen, screen);
    await this.executeTransition(transition, async () => {
      await this.enterScreen(screen);
    });

    this.emit('screenReplaced', {
      oldScreen: replacedScreen,
      newScreen: screen,
      stack: this.stack.getStack(),
    });

    return replacedScreen;
  }

  public getCurrentScreen(): Screen | null {
    return this.stack.current();
  }

  public getScreenStack(): Screen[] {
    return this.stack.getStack();
  }

  public getStackSize(): number {
    return this.stack.size();
  }

  public canPop(): boolean {
    return this.stack.size() > 1;
  }

  public async clearStack(): Promise<void> {
    const screens = this.stack.getStack();

    // Exit all screens in reverse order
    for (let i = screens.length - 1; i >= 0; i--) {
      const screen = screens[i];
      if (screen.onExit) {
        await this.executeScreenMethod(screen.onExit);
      }
    }

    this.stack.clear();
    this.emit('stackCleared');
  }

  public handleResize(width: number, height: number): void {
    const currentScreen = this.getCurrentScreen();
    if (currentScreen?.onResize) {
      this.executeScreenMethod(() =>
        currentScreen.onResize?.(width, height)
      ).catch((error) =>
        this.emit('resizeError', { screen: currentScreen, error })
      );
    }

    this.emit('resize', { width, height, screen: currentScreen });
  }

  public handleInput(input: string): void {
    const currentScreen = this.getCurrentScreen();
    if (currentScreen) {
      try {
        currentScreen.handleInput(input);
        this.emit('input', { input, screen: currentScreen });
      } catch (error) {
        this.emit('inputError', { input, screen: currentScreen, error });
      }
    }
  }

  /**
   * Exit current screen if it has onExit method
   */
  private async exitCurrentScreen(screen: Screen | null): Promise<void> {
    if (screen?.onExit) {
      await this.executeScreenMethod(screen.onExit);
    }
  }

  /**
   * Enter screen if it has onEnter method
   */
  private async enterScreen(screen: Screen | null): Promise<void> {
    if (screen?.onEnter) {
      await this.executeScreenMethod(screen.onEnter);
    }
  }

  /**
   * Create a screen transition object
   */
  private createTransition(
    type: 'push' | 'pop' | 'replace',
    fromScreen: Screen | null,
    toScreen: Screen | null
  ): ScreenTransition {
    return {
      type,
      fromScreen: fromScreen ?? undefined,
      toScreen: toScreen ?? undefined,
      timestamp: Date.now(),
    };
  }

  /**
   * Execute transition with error handling and timing
   */
  private async executeTransition(
    transition: ScreenTransition,
    transitionLogic: () => Promise<void>
  ): Promise<void> {
    this.activeTransition = transition;
    this.emit('transitionStart', transition);

    try {
      await transitionLogic();

      if (this.config.enableTransitions) {
        await this.performTransition(transition);
      }

      this.finalizeTransition(transition);
    } catch (error) {
      this.emit('transitionError', { transition, error });
      throw error;
    } finally {
      this.activeTransition = null;
    }
  }

  /**
   * Finalize transition with timing and events
   */
  private finalizeTransition(transition: ScreenTransition): void {
    transition.duration = Date.now() - transition.timestamp;
    this.recordTransition(transition);
    this.emit('transitionEnd', transition);
  }

  private async executeScreenMethod(
    method: (() => void | Promise<void>) | undefined
  ): Promise<void> {
    if (method == null) return;
    try {
      const result = method();
      if (result instanceof Promise) {
        await result;
      }
    } catch (error) {
      this.emit('screenMethodError', error);
      throw error;
    }
  }

  private async performTransition(
    _transition: ScreenTransition
  ): Promise<void> {
    if (!this.config.enableTransitions) return;

    // Simple delay-based transition for now
    // Could be enhanced with more sophisticated transition effects
    return new Promise((resolve) => {
      setTimeout(resolve, this.config.transitionDuration);
    });
  }

  private recordTransition(transition: ScreenTransition): void {
    if (!this.config.enableHistory) return;

    this.transitionHistory.push(transition);

    // Trim history if it exceeds the limit
    if (this.transitionHistory.length > this.config.historySize) {
      this.transitionHistory = this.transitionHistory.slice(
        -this.config.historySize
      );
    }
  }

  public getTransitionHistory(): ScreenTransition[] {
    return [...this.transitionHistory];
  }

  public getActiveTransition(): ScreenTransition | null {
    return this.activeTransition;
  }

  public isTransitioning(): boolean {
    return this.activeTransition !== null;
  }

  public updateConfig(newConfig: Partial<ScreenManagerConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.stack.setMaxSize(this.config.maxStackSize);
  }

  public getConfig(): ScreenManagerConfig {
    return { ...this.config };
  }

  public getMetrics() {
    const history = this.transitionHistory;
    const pushTransitions = history.filter((t) => t.type === 'push');
    const popTransitions = history.filter((t) => t.type === 'pop');
    const replaceTransitions = history.filter((t) => t.type === 'replace');

    return {
      totalTransitions: history.length,
      pushCount: pushTransitions.length,
      popCount: popTransitions.length,
      replaceCount: replaceTransitions.length,
      averageTransitionTime:
        history.reduce((sum, t) => sum + (t.duration ?? 0), 0) /
        Math.max(1, history.length),
      currentStackSize: this.stack.size(),
      maxStackSize: this.config.maxStackSize,
    };
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
          console.error(
            `Error in screen manager event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

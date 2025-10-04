import { createLogger } from '@checklist/core/utils/logger';
import { EventBus } from '../events/EventBus';
import { KeyboardHandler, KeyEvent } from '../events/KeyboardHandler';
import { InputEvent } from '../framework/ApplicationLoop';
import { LifecycleManager, LifecycleHooks } from '../framework/Lifecycle';
import { InputRouterBindings } from './InputRouterBindings';
import { InputRouterConfigManager } from './InputRouterConfig';
import {
  ComponentHandler,
  FocusState,
  InputContext,
} from './InputRouterConfig';
import { InputRouterFocus } from './InputRouterFocus';
import { InputRouterHandlers } from './InputRouterHandlers';

const logger = createLogger('checklist:tui:input-router');

export class InputRouter implements LifecycleHooks {
  private configManager: InputRouterConfigManager;
  private keyboardHandler: KeyboardHandler;
  private eventBus: EventBus;
  private inputRouterBindings: InputRouterBindings;
  private inputRouterHandlers: InputRouterHandlers;
  private inputRouterFocus: InputRouterFocus;
  private context: InputContext;
  private initialized = false;
  private isHandlingFocusChange = false;

  constructor(config: Partial<unknown> = {}) {
    this.configManager = new InputRouterConfigManager(config);
    this.keyboardHandler = new KeyboardHandler();
    this.eventBus = new EventBus();
    this.context = this.configManager.createDefaultContext();

    this.inputRouterFocus = new InputRouterFocus({
      onPanelSwitch: (newPanel) => this.handlePanelSwitch(newPanel),
      onFocusChange: (newFocus) => this.handleFocusChange(newFocus),
    });

    this.inputRouterBindings = new InputRouterBindings(
      this.keyboardHandler,
      this.configManager.getConfig(),
      {
        switchPanel: (panel) => this.inputRouterFocus.switchPanel(panel),
        handleNavigationKey: (direction) => this.handleNavigationKey(direction),
        handleInterrupt: () => this.handleInterrupt(),
        handleEscape: () => this.handleEscape(),
      }
    );

    this.inputRouterHandlers = new InputRouterHandlers(this.eventBus, {
      registerComponentHandler: (handler) =>
        this.registerComponentHandler(handler),
      unregisterComponentHandler: (handlerId) =>
        this.unregisterComponentHandler(handlerId),
      handleFocusChange: (focusState) => this.handleFocusChange(focusState),
      handlePanelInput: (input: unknown, panel: 'left' | 'right') =>
        this.handlePanelInput(input, panel),
    });
  }

  public async onInitialize(): Promise<void> {
    logger.info({ msg: 'Initializing Input Router' });

    try {
      await this.inputRouterHandlers.setupDefaultHandlers();
      this.initialized = true;

      logger.info({
        msg: 'Input Router initialized successfully',
        config: this.configManager.getConfig(),
      });
    } catch (error) {
      logger.error({
        msg: 'Failed to initialize Input Router',
        error: (error as Error).message,
      });
      throw error;
    }
  }

  public async onShutdown(): Promise<void> {
    logger.info({ msg: 'Shutting down Input Router' });

    try {
      this.keyboardHandler.destroy();
      this.eventBus.destroy();
      this.context.activeHandlers.clear();
      this.context.globalHandlers.clear();
      this.context.inputBuffer = [];
      this.initialized = false;
      this.isHandlingFocusChange = false;

      logger.info({ msg: 'Input Router shutdown complete' });
    } catch (error) {
      logger.error({
        msg: 'Error during Input Router shutdown',
        error: (error as Error).message,
      });
    }
  }

  public registerHooks(lifecycleManager: LifecycleManager): void {
    lifecycleManager.registerHooks(this);
  }

  public routeInput(input: InputEvent, focusState: FocusState): void {
    if (!this.initialized) {
      logger.warn({ msg: 'Input Router not initialized, ignoring input' });
      return;
    }

    try {
      this.processInput(input, focusState);
      this.publishInputEvent(input, focusState);
    } catch (error) {
      this.handleInputError(input, error as Error);
    }
  }

  private processInput(input: InputEvent, focusState: FocusState): void {
    this.context.lastInputTime = Date.now();
    this.context.focus = { ...focusState };

    const keyEvent = this.convertToKeyEvent(input);
    this.context.inputBuffer.push(input);

    this.keyboardHandler.handleInput(Buffer.from(input.raw));

    if (!this.wasInputHandled(keyEvent)) {
      this.routeToComponent(keyEvent, focusState);
    }

    this.cleanupInputBuffer();
  }

  private publishInputEvent(input: InputEvent, focusState: FocusState): void {
    this.eventBus.publish('input-received', {
      input,
      focusState,
      timestamp: Date.now(),
    });
  }

  private handleInputError(input: InputEvent, error: Error): void {
    logger.error({
      msg: 'Error routing input',
      input,
      error: error.message,
    });

    this.eventBus.publish('input-error', {
      input,
      error,
      timestamp: Date.now(),
    });
  }

  private convertToKeyEvent(input: InputEvent): KeyEvent {
    return {
      key: input.key ?? '',
      modifiers: input.modifiers ?? {},
      timestamp: Date.now(),
      meta: {
        type: input.type,
        raw: input.raw,
        x: input.x,
        y: input.y,
        button: input.button,
      },
    };
  }

  private wasInputHandled(_keyEvent: KeyEvent): boolean {
    return false;
  }

  private routeToComponent(keyEvent: KeyEvent, focusState: FocusState): void {
    const focusedComponent = focusState.focusedComponent;
    if (focusedComponent === undefined || focusedComponent === null) {
      return;
    }

    const handler = this.context.activeHandlers.get(focusedComponent);
    if (handler?.canReceiveFocus === true) {
      const handled = handler.handleInput(keyEvent);
      if (handled instanceof Promise) {
        handled.catch((error) => {
          logger.error({
            msg: 'Error in component handler',
            componentId: focusedComponent,
            error: error.message,
          });
        });
      }
    }
  }

  private cleanupInputBuffer(): void {
    const fiveSecondsAgo = Date.now() - 5000;
    this.context.inputBuffer = this.context.inputBuffer.filter(
      (input: InputEvent) => input.timestamp > fiveSecondsAgo
    );
  }

  private handlePanelSwitch(newPanel: 'left' | 'right'): void {
    logger.info({ msg: 'Panel switched', newPanel });
  }

  private handleFocusChange(focusState: FocusState): void {
    if (this.isHandlingFocusChange) {
      logger.debug({
        msg: 'Focus change already in progress, skipping',
        focusState,
      });
      return;
    }

    this.isHandlingFocusChange = true;
    try {
      this.context.focus = focusState;
      this.eventBus.publish('focus-changed', {
        focusState,
        timestamp: Date.now(),
      });
    } finally {
      this.isHandlingFocusChange = false;
    }
  }

  private handleNavigationKey(direction: string): void {
    logger.debug({ msg: 'Navigation key pressed', direction });
  }

  private handleInterrupt(): void {
    logger.info({ msg: 'Interrupt signal received' });
    this.eventBus.publish('interrupt', { timestamp: Date.now() });
  }

  private handleEscape(): void {
    logger.debug({ msg: 'Escape key pressed' });
    this.eventBus.publish('escape', { timestamp: Date.now() });
  }

  private handlePanelInput(input: unknown, panel: 'left' | 'right'): boolean {
    // Stub implementation for panel input handling
    logger.debug({ msg: 'Panel input handled', input, panel });
    return false;
  }

  public registerComponentHandler(handler: ComponentHandler): void {
    this.context.activeHandlers.set(handler.id, handler);
    logger.debug({
      msg: 'Component handler registered',
      handlerId: handler.id,
      panel: handler.panel,
    });
  }

  public unregisterComponentHandler(handlerId: string): void {
    this.context.activeHandlers.delete(handlerId);
    logger.debug({
      msg: 'Component handler unregistered',
      handlerId,
    });
  }

  public getFocusState(): FocusState {
    return this.inputRouterFocus.getCurrentFocusState();
  }

  public getContext(): InputContext {
    return {
      focus: { ...this.context.focus },
      activeHandlers: new Map(this.context.activeHandlers),
      globalHandlers: new Map(this.context.globalHandlers),
      inputBuffer: [...this.context.inputBuffer],
      lastInputTime: this.context.lastInputTime,
    };
  }
}

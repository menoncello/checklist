import { createLogger } from '@checklist/core/utils/logger';
import { EventBus, BusMessage } from '../events/EventBus';
import { ComponentHandler, FocusState } from './InputRouterConfig';

const logger = createLogger('checklist:tui:input-router-handlers');

export class InputRouterHandlers {
  private handlers: Map<string, ComponentHandler> = new Map();

  constructor(
    private eventBus: EventBus,
    private callbacks: {
      registerComponentHandler: (handler: ComponentHandler) => void;
      unregisterComponentHandler: (handlerId: string) => void;
      handleFocusChange: (focusState: FocusState) => void;
      handlePanelInput: (input: unknown, panel: 'left' | 'right') => boolean;
    }
  ) {
    this.setupEventBusHandlers();
  }

  private setupEventBusHandlers(): void {
    this.eventBus.subscribe(
      'input-router:focus-change',
      (message: BusMessage) => {
        // Only process if this is actually a focus change event
        if (message.type === 'input-router:focus-change') {
          this.callbacks.handleFocusChange(message.data as FocusState);
        }
      },
      { type: 'input-router:focus-change' }
    );

    this.eventBus.subscribe(
      'input-router:register-handler',
      (message: BusMessage) => {
        const handler = message.data as ComponentHandler;
        this.callbacks.registerComponentHandler(handler);
      },
      { type: 'input-router:register-handler' }
    );

    this.eventBus.subscribe(
      'input-router:unregister-handler',
      (message: BusMessage) => {
        const handlerId = message.data as string;
        this.callbacks.unregisterComponentHandler(handlerId);
      },
      { type: 'input-router:unregister-handler' }
    );
  }

  public async setupDefaultHandlers(): Promise<void> {
    this.callbacks.registerComponentHandler({
      id: 'left-panel',
      panel: 'left',
      handleInput: (input) => this.callbacks.handlePanelInput(input, 'left'),
      canReceiveFocus: true,
      priority: 10,
    });

    this.callbacks.registerComponentHandler({
      id: 'right-panel',
      panel: 'right',
      handleInput: (input) => this.callbacks.handlePanelInput(input, 'right'),
      canReceiveFocus: true,
      priority: 10,
    });
  }

  public registerComponentHandler(handler: ComponentHandler): void {
    this.handlers.set(handler.id, handler);
    logger.debug({
      msg: 'Component handler registered',
      handlerId: handler.id,
      panel: handler.panel,
    });
  }

  public unregisterComponentHandler(handlerId: string): void {
    this.handlers.delete(handlerId);
    logger.debug({
      msg: 'Component handler unregistered',
      handlerId,
    });
  }

  public getHandler(handlerId: string): ComponentHandler | undefined {
    return this.handlers.get(handlerId);
  }

  public getAllHandlers(): ComponentHandler[] {
    return Array.from(this.handlers.values());
  }

  public getHandlersForPanel(panel: 'left' | 'right'): ComponentHandler[] {
    return this.getAllHandlers().filter((handler) => handler.panel === panel);
  }

  private handlePanelInput(input: unknown, panel: 'left' | 'right'): boolean {
    logger.debug({
      msg: 'Handling panel input',
      panel,
      input: (input as { key?: string })?.key ?? 'unknown',
    });
    return false;
  }
}

import { KeyboardHandler } from '../events/KeyboardHandler';
import { InputRouterConfig } from './InputRouterConfig';

export class InputRouterBindings {
  private keyboardHandler: KeyboardHandler;
  private config: InputRouterConfig;

  constructor(
    keyboardHandler: KeyboardHandler,
    config: InputRouterConfig,
    private callbacks: {
      switchPanel: (panel: 'left' | 'right') => void;
      handleNavigationKey: (direction: string) => void;
      handleInterrupt: () => void;
      handleEscape: () => void;
    }
  ) {
    this.keyboardHandler = keyboardHandler;
    this.config = config;
    this.setupKeyboardBindings();
  }

  private setupKeyboardBindings(): void {
    this.setupPanelSwitchingBindings();
    this.setupComponentNavigationBindings();
    this.setupGlobalBindings();
  }

  private setupPanelSwitchingBindings(): void {
    if (!this.config.enablePanelSwitching) {
      return;
    }

    this.config.focusSwitchKeys.leftToRight.forEach((key) => {
      this.keyboardHandler.bind(
        key,
        () => this.callbacks.switchPanel('right'),
        {
          description: `Switch focus from left to right panel (${key})`,
          priority: 90,
        }
      );
    });

    this.config.focusSwitchKeys.rightToLeft.forEach((key) => {
      this.keyboardHandler.bind(key, () => this.callbacks.switchPanel('left'), {
        description: `Switch focus from right to left panel (${key})`,
        priority: 90,
      });
    });
  }

  private setupComponentNavigationBindings(): void {
    if (!this.config.enableComponentNavigation) {
      return;
    }

    Object.entries(this.config.navigationKeys).forEach(([direction, keys]) => {
      keys.forEach((key) => {
        this.keyboardHandler.bind(
          key,
          () => this.callbacks.handleNavigationKey(direction),
          {
            description: `Navigate ${direction} (${key})`,
            priority: 80,
          }
        );
      });
    });
  }

  private setupGlobalBindings(): void {
    this.keyboardHandler.bind(
      'ctrl+c',
      () => this.callbacks.handleInterrupt(),
      {
        description: 'Interrupt application',
        priority: 100,
      }
    );

    this.keyboardHandler.bind('escape', () => this.callbacks.handleEscape(), {
      description: 'Escape/cancel action',
      priority: 95,
    });
  }

  public updateConfig(newConfig: InputRouterConfig): void {
    this.config = newConfig;
  }

  public destroy(): void {
    this.keyboardHandler.destroy();
  }
}

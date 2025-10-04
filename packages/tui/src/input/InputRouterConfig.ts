import { InputEvent } from '../framework/ApplicationLoop';

export interface FocusState {
  activePanel: 'left' | 'right';
  focusedComponent?: string;
  focusHistory: Array<{
    panel: 'left' | 'right';
    component?: string;
    timestamp: number;
  }>;
}

export interface InputRouterConfig {
  enablePanelSwitching: boolean;
  enableComponentNavigation: boolean;
  focusSwitchKeys: {
    leftToRight: string[];
    rightToLeft: string[];
  };
  navigationKeys: {
    up: string[];
    down: string[];
    left: string[];
    right: string[];
    tab: string[];
    shiftTab: string[];
  };
}

export interface ComponentHandler {
  id: string;
  panel: 'left' | 'right';
  handleInput: (input: unknown) => boolean | Promise<boolean>;
  canReceiveFocus: boolean;
  priority: number;
}

export interface InputContext {
  focus: FocusState;
  activeHandlers: Map<string, ComponentHandler>;
  globalHandlers: Map<string, ComponentHandler>;
  inputBuffer: InputEvent[];
  lastInputTime: number;
}

export class InputRouterConfigManager {
  private config: InputRouterConfig;

  constructor(config: Partial<InputRouterConfig> = {}) {
    this.config = {
      enablePanelSwitching: true,
      enableComponentNavigation: true,
      focusSwitchKeys: {
        leftToRight: ['tab', 'right'],
        rightToLeft: ['shift+tab', 'left'],
      },
      navigationKeys: {
        up: ['up', 'k'],
        down: ['down', 'j'],
        left: ['left', 'h'],
        right: ['right', 'l'],
        tab: ['tab'],
        shiftTab: ['shift+tab'],
      },
      ...config,
    };
  }

  public getConfig(): InputRouterConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<InputRouterConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  public createDefaultContext(): InputContext {
    return {
      focus: {
        activePanel: 'left',
        focusedComponent: undefined,
        focusHistory: [],
      },
      activeHandlers: new Map(),
      globalHandlers: new Map(),
      inputBuffer: [],
      lastInputTime: 0,
    };
  }
}

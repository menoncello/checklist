import { createLogger } from '@checklist/core/utils/logger';
import { FocusState } from './InputRouterConfig';

const logger = createLogger('checklist:tui:input-router-focus');

export class InputRouterFocus {
  private focusHistory: Array<{
    panel: 'left' | 'right';
    component?: string;
    timestamp: number;
  }> = [];

  constructor(
    private callbacks: {
      onPanelSwitch?: (newPanel: 'left' | 'right') => void;
      onFocusChange?: (newFocus: FocusState) => void;
    } = {}
  ) {}

  public switchPanel(newPanel: 'left' | 'right'): FocusState {
    const currentState = this.getCurrentFocusState();

    if (currentState.activePanel !== newPanel) {
      this.recordFocusChange(currentState.activePanel, newPanel);

      const newState: FocusState = {
        activePanel: newPanel,
        focusedComponent: undefined,
        focusHistory: [...this.focusHistory],
      };

      logger.info({
        msg: 'Panel focus switched',
        fromPanel: currentState.activePanel,
        toPanel: newPanel,
      });

      this.callbacks.onPanelSwitch?.(newPanel);
      this.callbacks.onFocusChange?.(newState);

      return newState;
    }

    return currentState;
  }

  public setFocusedComponent(
    componentId: string,
    panel: 'left' | 'right'
  ): FocusState {
    const newState: FocusState = {
      activePanel: panel,
      focusedComponent: componentId,
      focusHistory: [...this.focusHistory],
    };

    logger.debug({
      msg: 'Component focused',
      componentId,
      panel,
    });

    this.callbacks.onFocusChange?.(newState);

    return newState;
  }

  public getCurrentFocusState(): FocusState {
    const lastEntry = this.focusHistory[this.focusHistory.length - 1];

    return {
      activePanel: lastEntry?.panel ?? 'left',
      focusedComponent: lastEntry?.component,
      focusHistory: [...this.focusHistory],
    };
  }

  public getFocusHistory(): Array<{
    panel: 'left' | 'right';
    component?: string;
    timestamp: number;
  }> {
    return [...this.focusHistory];
  }

  public clearFocusHistory(): void {
    this.focusHistory = [];
    logger.debug({ msg: 'Focus history cleared' });
  }

  private recordFocusChange(
    fromPanel: 'left' | 'right',
    toPanel: 'left' | 'right'
  ): void {
    this.focusHistory.push({
      panel: toPanel,
      timestamp: Date.now(),
    });

    this.cleanupOldHistory();
  }

  private cleanupOldHistory(): void {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    this.focusHistory = this.focusHistory.filter(
      (entry) => entry.timestamp > fiveMinutesAgo
    );
  }

  public navigateToPreviousFocus(): FocusState | null {
    if (this.focusHistory.length < 2) {
      return null;
    }

    this.focusHistory.pop();
    const previousEntry = this.focusHistory[this.focusHistory.length - 1];

    const newState: FocusState = {
      activePanel: previousEntry.panel,
      focusedComponent: previousEntry.component,
      focusHistory: [...this.focusHistory],
    };

    logger.info({
      msg: 'Navigated to previous focus',
      panel: previousEntry.panel,
      component: previousEntry.component,
    });

    this.callbacks.onFocusChange?.(newState);

    return newState;
  }
}

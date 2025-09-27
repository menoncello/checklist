import type { DebugConfig } from './helpers/ConfigInitializer';

export class DebugKeyboardHandler {
  private config: DebugConfig;
  private actionHandler: (action: string) => void;

  constructor(config: DebugConfig, actionHandler: (action: string) => void) {
    this.config = config;
    this.actionHandler = actionHandler;
  }

  setup(): void {
    // Setup would be done in the actual TUI framework
  }

  handleKeyPress(key: string): boolean {
    const action = this.config.hotkeys[key];
    if (action) {
      this.actionHandler(action);
      return true;
    }
    return false;
  }
}

export interface TerminalState {
  initialized: boolean;
  supportsColor: boolean;
  supportsUnicode: boolean;
  width: number;
  height: number;
  originalMode?: number;
  capabilities: Map<string, boolean>;
  fallbackMode: boolean;
}

export class TerminalStateManager {
  private state: TerminalState;

  constructor() {
    this.state = {
      initialized: false,
      supportsColor: false,
      supportsUnicode: false,
      width: 80,
      height: 24,
      capabilities: new Map(),
      fallbackMode: false,
    };
  }

  public getState(): TerminalState {
    return { ...this.state };
  }

  public setState(newState: Partial<TerminalState>): void {
    this.state = { ...this.state, ...newState };
  }

  public setInitialized(value: boolean): void {
    this.state.initialized = value;
  }

  public setSupportsColor(value: boolean): void {
    this.state.supportsColor = value;
  }

  public setSupportsUnicode(value: boolean): void {
    this.state.supportsUnicode = value;
  }

  public setDimensions(width: number, height: number): void {
    this.state.width = width;
    this.state.height = height;
  }

  public setOriginalMode(mode: number): void {
    this.state.originalMode = mode;
  }

  public setCapability(name: string, value: boolean): void {
    this.state.capabilities.set(name, value);
  }

  public getCapability(name: string): boolean {
    return this.state.capabilities.get(name) ?? false;
  }

  public setFallbackMode(value: boolean): void {
    this.state.fallbackMode = value;
  }

  public reset(): void {
    this.state = {
      initialized: false,
      supportsColor: false,
      supportsUnicode: false,
      width: 80,
      height: 24,
      capabilities: new Map(),
      fallbackMode: false,
    };
  }

  public createDefaultState(): TerminalState {
    return {
      initialized: false,
      supportsColor: false,
      supportsUnicode: false,
      width: 80,
      height: 24,
      capabilities: new Map(),
      fallbackMode: false,
    };
  }
}

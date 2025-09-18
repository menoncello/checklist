import { Screen } from '../framework/UIFramework';

export class ScreenStack {
  private stack: Screen[] = [];
  private maxSize: number;
  private eventHandlers = new Map<string, Set<Function>>();

  constructor(maxSize: number = 50) {
    this.maxSize = maxSize;
  }

  public push(screen: Screen): void {
    if (this.stack.length >= this.maxSize) {
      const removedScreen = this.stack.shift();
      this.emit('overflow', {
        removedScreen,
        newScreen: screen,
        stackSize: this.stack.length,
      });
    }

    this.stack.push(screen);
    this.emit('push', { screen, stackSize: this.stack.length });
    this.emit('change', {
      operation: 'push',
      screen,
      stackSize: this.stack.length,
    });
  }

  public pop(): Screen | null {
    if (this.stack.length === 0) {
      this.emit('underflow');
      return null;
    }

    const screen = this.stack.pop() ?? null;
    if (screen) {
      this.emit('pop', { screen, stackSize: this.stack.length });
      this.emit('change', {
        operation: 'pop',
        screen,
        stackSize: this.stack.length,
      });
    }

    return screen;
  }

  public replace(screen: Screen): Screen | null {
    if (this.stack.length === 0) {
      this.push(screen);
      return null;
    }

    const oldScreen = this.stack[this.stack.length - 1];
    this.stack[this.stack.length - 1] = screen;

    this.emit('replace', {
      oldScreen,
      newScreen: screen,
      stackSize: this.stack.length,
    });
    this.emit('change', {
      operation: 'replace',
      oldScreen,
      newScreen: screen,
      stackSize: this.stack.length,
    });

    return oldScreen;
  }

  public current(): Screen | null {
    return this.stack.length > 0 ? this.stack[this.stack.length - 1] : null;
  }

  public previous(): Screen | null {
    return this.stack.length > 1 ? this.stack[this.stack.length - 2] : null;
  }

  public at(index: number): Screen | null {
    if (index < 0 || index >= this.stack.length) return null;
    return this.stack[index];
  }

  public indexOf(screen: Screen): number {
    return this.stack.indexOf(screen);
  }

  public findById(id: string): Screen | null {
    return this.stack.find((screen) => screen.id === id) ?? null;
  }

  public findByName(name: string): Screen | null {
    return this.stack.find((screen) => screen.name === name) ?? null;
  }

  public remove(screen: Screen): boolean {
    const index = this.stack.indexOf(screen);
    if (index === -1) return false;

    this.stack.splice(index, 1);
    this.emit('remove', {
      screen,
      index,
      stackSize: this.stack.length,
    });
    this.emit('change', {
      operation: 'remove',
      screen,
      index,
      stackSize: this.stack.length,
    });

    return true;
  }

  public removeById(id: string): Screen | null {
    const screen = this.findById(id);
    if (screen && this.remove(screen)) {
      return screen;
    }
    return null;
  }

  public clear(): void {
    const clearedScreens = [...this.stack];
    this.stack = [];

    this.emit('clear', {
      clearedScreens,
      count: clearedScreens.length,
    });
    this.emit('change', {
      operation: 'clear',
      clearedScreens,
      stackSize: 0,
    });
  }

  public size(): number {
    return this.stack.length;
  }

  public isEmpty(): boolean {
    return this.stack.length === 0;
  }

  public isFull(): boolean {
    return this.stack.length >= this.maxSize;
  }

  public getStack(): Screen[] {
    return [...this.stack];
  }

  public getScreenIds(): string[] {
    return this.stack.map((screen) => screen.id);
  }

  public getScreenNames(): string[] {
    return this.stack.map((screen) => screen.name);
  }

  public contains(screen: Screen): boolean {
    return this.stack.includes(screen);
  }

  public containsId(id: string): boolean {
    return this.stack.some((screen) => screen.id === id);
  }

  public containsName(name: string): boolean {
    return this.stack.some((screen) => screen.name === name);
  }

  public setMaxSize(newMaxSize: number): void {
    if (newMaxSize <= 0) {
      throw new Error('Max size must be greater than 0');
    }

    const oldMaxSize = this.maxSize;
    this.maxSize = newMaxSize;

    // If current stack exceeds new max size, remove oldest screens
    while (this.stack.length > this.maxSize) {
      const removedScreen = this.stack.shift();
      this.emit('overflow', {
        removedScreen,
        reason: 'maxSizeReduced',
        oldMaxSize,
        newMaxSize,
        stackSize: this.stack.length,
      });
    }

    this.emit('maxSizeChanged', {
      oldMaxSize,
      newMaxSize,
      stackSize: this.stack.length,
    });
  }

  public getMaxSize(): number {
    return this.maxSize;
  }

  public getUtilization(): number {
    return this.stack.length / this.maxSize;
  }

  public popToScreen(screen: Screen): Screen[] {
    const targetIndex = this.stack.indexOf(screen);
    if (targetIndex === -1) {
      throw new Error('Screen not found in stack');
    }

    const poppedScreens: Screen[] = [];
    while (this.stack.length > targetIndex + 1) {
      const popped = this.pop();
      if (popped) {
        poppedScreens.unshift(popped);
      }
    }

    return poppedScreens;
  }

  public popToId(id: string): Screen[] {
    const screen = this.findById(id);
    if (!screen) {
      throw new Error(`Screen with id '${id}' not found in stack`);
    }
    return this.popToScreen(screen);
  }

  public popToIndex(index: number): Screen[] {
    if (index < 0 || index >= this.stack.length) {
      throw new Error('Index out of bounds');
    }

    const poppedScreens: Screen[] = [];
    while (this.stack.length > index + 1) {
      const popped = this.pop();
      if (popped) {
        poppedScreens.unshift(popped);
      }
    }

    return poppedScreens;
  }

  public getMetrics() {
    return {
      size: this.stack.length,
      maxSize: this.maxSize,
      utilization: this.getUtilization(),
      isEmpty: this.isEmpty(),
      isFull: this.isFull(),
      screenIds: this.getScreenIds(),
      screenNames: this.getScreenNames(),
    };
  }

  public validate(): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for duplicate IDs
    const ids = this.getScreenIds();
    const uniqueIds = new Set(ids);
    if (ids.length !== uniqueIds.size) {
      errors.push('Duplicate screen IDs found in stack');
    }

    // Check for high utilization
    if (this.getUtilization() > 0.9) {
      warnings.push('Stack utilization is above 90%');
    }

    // Check for empty names
    const emptyNames = this.stack.filter((screen) => !screen.name.trim());
    if (emptyNames.length > 0) {
      warnings.push(`${emptyNames.length} screen(s) have empty names`);
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
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
            `Error in screen stack event handler for '${event}':`,
            error
          );
        }
      });
    }
  }
}

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

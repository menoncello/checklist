export class DebugKeyboardHandler {
  private handlers: Map<string, () => void> = new Map();

  register(key: string, handler: () => void): void {
    this.handlers.set(key, handler);
  }

  handle(key: string): boolean {
    const handler = this.handlers.get(key);
    if (handler) {
      handler();
      return true;
    }
    return false;
  }

  unregister(key: string): void {
    this.handlers.delete(key);
  }

  clear(): void {
    this.handlers.clear();
  }
}

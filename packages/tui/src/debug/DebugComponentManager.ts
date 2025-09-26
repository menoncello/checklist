export class DebugComponentManager {
  private components: Map<string, unknown> = new Map();

  register(id: string, component: unknown): void {
    this.components.set(id, component);
  }

  unregister(id: string): void {
    this.components.delete(id);
  }

  getComponent(id: string): unknown | undefined {
    return this.components.get(id);
  }

  getAllComponents(): Map<string, unknown> {
    return new Map(this.components);
  }

  clear(): void {
    this.components.clear();
  }
}

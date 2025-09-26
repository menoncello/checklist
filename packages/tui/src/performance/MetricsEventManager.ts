export class MetricsEventManager {
  constructor() {}

  emit(_event: string, _data?: unknown): void {}

  on(_event: string, _handler: (...args: unknown[]) => void): void {}

  off(_event: string, _handler: (...args: unknown[]) => void): void {}

  removeAllListeners(): void {}
}

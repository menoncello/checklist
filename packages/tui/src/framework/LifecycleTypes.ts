export type LifecyclePhase =
  | 'initializing'
  | 'running'
  | 'shutting-down'
  | 'stopped';

export interface LifecycleHooks {
  onInitialize?: () => Promise<void | boolean> | void | boolean;
  onStart?: () => Promise<void | boolean> | void | boolean;
  onStop?: () => Promise<void | boolean> | void | boolean;
  onShutdown?: () => Promise<void | boolean> | void | boolean;
  onError?: (error: Error) => Promise<void> | void;
}

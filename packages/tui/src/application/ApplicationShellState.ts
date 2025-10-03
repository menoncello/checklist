import { LifecycleManager } from '../framework/Lifecycle';
import { LifecycleState } from '../framework/UIFramework';
import { ApplicationState } from './ApplicationShellConfig';

export class ApplicationShellState {
  constructor(
    private state: ApplicationState,
    private lifecycleManager: LifecycleManager
  ) {}

  public getState(): ApplicationState {
    return { ...this.state };
  }

  public getLifecycleState(): LifecycleState {
    return this.lifecycleManager.getState();
  }
}

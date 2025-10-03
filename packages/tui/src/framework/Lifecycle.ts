import { LifecycleManager as LifecycleManagerCore } from './LifecycleCore';
import { LifecycleState } from './UIFramework';

export { type LifecycleHooks, type LifecyclePhase } from './LifecycleTypes';

export class LifecycleManager extends LifecycleManagerCore {
  constructor(initialState?: LifecycleState) {
    super(initialState);
  }
}

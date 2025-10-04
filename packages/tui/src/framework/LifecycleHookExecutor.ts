import { type LifecycleHooks } from './LifecycleTypes';

export class LifecycleHookExecutor {
  public static async executeHooks(
    hooks: LifecycleHooks[],
    methodName: keyof LifecycleHooks
  ): Promise<void> {
    for (const hook of hooks) {
      const method = hook[methodName];
      if (method) {
        if (methodName === 'onError') {
          // onError methods expect an Error parameter
          // Skip execution in this context as we don't have an error to pass
          continue;
        }
        const result = await (
          method as () => Promise<void | boolean> | void | boolean
        ).call(hook);
        // If method returns false, stop execution
        if (result === false) {
          break;
        }
      }
    }
  }

  public static async executeHooksWithErrorHandling(
    hooks: LifecycleHooks[],
    methodName: keyof LifecycleHooks,
    errorHandler: (error: Error) => Promise<void>
  ): Promise<boolean> {
    try {
      await LifecycleHookExecutor.executeHooks(hooks, methodName);
      return false;
    } catch (error) {
      await errorHandler(error as Error);
      return true;
    }
  }

  public static async executeShutdownHandlers(
    shutdownHandlers: (() => Promise<void>)[],
    _success: boolean
  ): Promise<void> {
    for (const handler of shutdownHandlers) {
      try {
        await handler();
      } catch (error) {
        // Log but don't fail shutdown for individual handler failures
        console.error('Shutdown handler failed:', error);
      }
    }
  }
}

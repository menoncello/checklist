import { type LifecyclePhase } from './LifecycleTypes';
import { LifecycleState } from './UIFramework';

export class LifecycleUtils {
  public static notifyStateChange(
    state: LifecycleState,
    listeners: ((state: LifecycleState) => void)[]
  ): void {
    for (const listener of listeners) {
      try {
        listener(state);
      } catch (error) {
        console.error('Error in state change listener:', error);
      }
    }
  }

  public static logPhaseTransition(
    oldPhase: LifecyclePhase,
    newPhase: LifecyclePhase
  ): void {
    console.log(`Lifecycle phase transition: ${oldPhase} -> ${newPhase}`);
  }

  public static async handleSignal(
    signal: string,
    shutdownCallback: () => Promise<void>
  ): Promise<void> {
    console.log(`Received ${signal}, initiating graceful shutdown...`);
    try {
      await shutdownCallback();
      process.exit(0);
    } catch (error) {
      console.error('Error during shutdown:', error);
      process.exit(1);
    }
  }

  public static setupSignalHandlers(signalHandler: {
    setupSignalHandlers: () => void;
  }): void {
    signalHandler.setupSignalHandlers();
  }

  public static cleanupSignalHandlers(signalHandler: {
    cleanupSignalHandlers: () => void;
  }): void {
    signalHandler.cleanupSignalHandlers();
  }
}

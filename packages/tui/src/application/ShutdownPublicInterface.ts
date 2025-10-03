import { createLogger } from '@checklist/core/utils/logger';
import { EventBus } from '../events/EventBus';
import { ShutdownManagerConfig } from './ShutdownConfigManager';
import { ShutdownContext } from './ShutdownManager';
import { ShutdownStep } from './ShutdownSteps';

const _logger = createLogger('checklist:tui:shutdown-public');

export interface ShutdownPublicInterfaceDependencies {
  handlerManager: {
    addHandler: (id: string, executor: () => Promise<void>) => void;
    removeHandler: (id: string) => boolean;
    getHandlerCount: () => number;
  };
  stepManager: {
    addStep: (step: ShutdownStep) => void;
    removeStep: (stepId: string) => boolean;
    getStepCount: () => number;
  };
  configManager: {
    getConfig: () => ShutdownManagerConfig;
    updateConfig: (newConfig: Partial<ShutdownManagerConfig>) => void;
  };
  eventBus: EventBus;
  getShutdownContext: () => ShutdownContext | null;
  executeGracefulShutdown: (reason: string) => Promise<void>;
}

export class ShutdownPublicInterface {
  constructor(private deps: ShutdownPublicInterfaceDependencies) {}

  public addShutdownHandler(id: string, executor: () => Promise<void>): void {
    this.deps.handlerManager.addHandler(id, executor);
  }

  public removeShutdownHandler(id: string): boolean {
    return this.deps.handlerManager.removeHandler(id);
  }

  public addCleanupStep(step: ShutdownStep): void {
    this.deps.stepManager.addStep(step);
  }

  public removeCleanupStep(stepId: string): boolean {
    return this.deps.stepManager.removeStep(stepId);
  }

  public isShutdownInProgress(): boolean {
    return this.deps.getShutdownContext() !== null;
  }

  public getShutdownContext(): ShutdownContext | null {
    return this.deps.getShutdownContext();
  }

  public getConfig(): ShutdownManagerConfig {
    return this.deps.configManager.getConfig();
  }

  public updateConfig(newConfig: Partial<ShutdownManagerConfig>): void {
    this.deps.configManager.updateConfig(newConfig);
  }

  public getEventBus(): EventBus {
    return this.deps.eventBus;
  }

  public getStats(): {
    handlerCount: number;
    stepCount: number;
    isShutdownInProgress: boolean;
  } {
    return {
      handlerCount: this.deps.handlerManager.getHandlerCount(),
      stepCount: this.deps.stepManager.getStepCount(),
      isShutdownInProgress: this.isShutdownInProgress(),
    };
  }
}

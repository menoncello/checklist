import { BunFileSystemService } from '../../services/BunFileSystemService';
import { ConfigService } from '../../services/ConfigService';
import { LoggerServiceAdapter } from '../../services/LoggerServiceAdapter';
import { StateManagerService } from '../../services/StateManagerService';
import { WorkflowEngineService } from '../../services/WorkflowEngineService';
import type { Constructor } from '../Container';
import type { ServiceBinding } from '../ServiceConfiguration';

/**
 * Development environment service bindings
 */
export const developmentBindings: ServiceBinding[] = [
  {
    service: 'ILogger',
    implementation: LoggerServiceAdapter as unknown as Constructor<unknown>,
    options: {
      singleton: true,
      lifecycle: {
        afterInit: async (_service: unknown) => {
          // Logger service initialized - development environment
        },
      },
    },
    environments: ['development'],
  },
  {
    service: 'IConfigService',
    implementation: ConfigService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IFileSystemService'],
    },
    environments: ['development'],
  },
  {
    service: 'IFileSystemService',
    implementation: BunFileSystemService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger'],
    },
    environments: ['development'],
  },
  {
    service: 'IStateManager',
    implementation: StateManagerService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IFileSystemService'],
    },
    environments: ['development'],
  },
  {
    service: 'IWorkflowEngine',
    implementation: WorkflowEngineService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IStateManager'],
    },
    environments: ['development'],
  },
];
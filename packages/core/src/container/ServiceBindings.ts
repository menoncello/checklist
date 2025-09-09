import { MockConfigService } from '../../mocks/ConfigService.mock';
import { MockFileSystemService } from '../../mocks/FileSystemService.mock';
import { MockLoggerService } from '../../mocks/LoggerService.mock';
import { MockStateManagerService } from '../../mocks/StateManagerService.mock';
import { MockWorkflowEngineService } from '../../mocks/WorkflowEngineService.mock';
import { BunFileSystemService } from '../services/BunFileSystemService';
import { ConfigService } from '../services/ConfigService';
import { LoggerServiceAdapter } from '../services/LoggerServiceAdapter';
import { StateManagerService } from '../services/StateManagerService';
import { WorkflowEngineService } from '../services/WorkflowEngineService';
import type { Constructor } from './Container';
import type { ServiceBinding, EnvironmentConfig } from './ServiceConfiguration';

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
      lifecycle: {
        afterInit: async (service: unknown) => {
          const stateManager = service as StateManagerService;
          await stateManager.initialize();
        },
        beforeDestroy: async (service: unknown) => {
          const stateManager = service as StateManagerService;
          await stateManager.unlock();
        },
      },
    },
    environments: ['development'],
  },
  {
    service: 'IWorkflowEngine',
    implementation: WorkflowEngineService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IStateManager'],
      lifecycle: {
        afterInit: async (service: unknown) => {
          await (
            service as unknown as { initialize: () => Promise<void> }
          ).initialize();
        },
        beforeDestroy: async (service: unknown) => {
          await (
            service as unknown as { shutdown: () => Promise<void> }
          ).shutdown();
        },
      },
    },
    environments: ['development'],
  },
];

/**
 * Test environment service bindings (using mocks)
 */
export const testBindings: ServiceBinding[] = [
  {
    service: 'ILogger',
    implementation: MockLoggerService as Constructor<unknown>,
    options: {
      singleton: false, // New instance for each test
    },
    environments: ['test'],
  },
  {
    service: 'IConfigService',
    implementation: MockConfigService as Constructor<unknown>,
    options: {
      singleton: false,
    },
    environments: ['test'],
  },
  {
    service: 'IFileSystemService',
    implementation: MockFileSystemService as Constructor<unknown>,
    options: {
      singleton: false,
    },
    environments: ['test'],
  },
  {
    service: 'IStateManager',
    implementation: MockStateManagerService as Constructor<unknown>,
    options: {
      singleton: false,
    },
    environments: ['test'],
  },
  {
    service: 'IWorkflowEngine',
    implementation: MockWorkflowEngineService as Constructor<unknown>,
    options: {
      singleton: false,
    },
    environments: ['test'],
  },
];

/**
 * Production environment service bindings
 */
export const productionBindings: ServiceBinding[] = [
  {
    service: 'ILogger',
    implementation: LoggerServiceAdapter as unknown as Constructor<unknown>,
    options: {
      singleton: true,
      lifecycle: {
        healthCheck: async (service: unknown) => {
          // Check if logger is functioning
          try {
            (
              service as unknown as { info: (msg: { msg: string }) => void }
            ).info({ msg: 'Health check' });
            return true;
          } catch {
            return false;
          }
        },
      },
    },
    environments: ['production'],
  },
  {
    service: 'IConfigService',
    implementation: ConfigService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IFileSystemService'],
      lifecycle: {
        healthCheck: async (service: unknown) => {
          const svc = service as unknown as {
            validate: (data: unknown) => boolean;
            load: () => Promise<unknown>;
          };
          return svc.validate(await svc.load());
        },
      },
    },
    environments: ['production'],
  },
  {
    service: 'IFileSystemService',
    implementation: BunFileSystemService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger'],
      lifecycle: {
        healthCheck: async (service: unknown) => {
          // Check if filesystem is accessible
          try {
            await (
              service as unknown as {
                exists: (path: string) => Promise<boolean>;
              }
            ).exists('/tmp');
            return true;
          } catch {
            return false;
          }
        },
      },
    },
    environments: ['production'],
  },
  {
    service: 'IStateManager',
    implementation: StateManagerService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IFileSystemService'],
      lifecycle: {
        afterInit: async (service: unknown) => {
          await (
            service as unknown as { initialize: () => Promise<void> }
          ).initialize();
        },
        beforeDestroy: async (service: unknown) => {
          await (
            service as unknown as { unlock: () => Promise<void> }
          ).unlock();
        },
        healthCheck: async (service: unknown) => {
          return await (
            service as unknown as { exists: () => Promise<boolean> }
          ).exists();
        },
        onError: async (error, service: unknown) => {
          // Log StateManager error in production - error handler should use injected logger
          // Attempt recovery by restoring from backup
          try {
            const svc = service as unknown as {
              backup: () => Promise<string>;
              restore: (path: string) => Promise<void>;
            };
            const backupPath = await svc.backup();
            await svc.restore(backupPath);
          } catch (_recoveryError) {
            // Recovery failed - error handler should use injected logger
          }
        },
      },
    },
    environments: ['production'],
  },
  {
    service: 'IWorkflowEngine',
    implementation: WorkflowEngineService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IStateManager'],
      lifecycle: {
        afterInit: async (service: unknown) => {
          await (
            service as unknown as { initialize: () => Promise<void> }
          ).initialize();
        },
        beforeDestroy: async (service: unknown) => {
          await (
            service as unknown as { shutdown: () => Promise<void> }
          ).shutdown();
        },
        healthCheck: async (service: unknown) => {
          const status = (
            service as unknown as { getStatus: () => string }
          ).getStatus();
          return status !== 'failed';
        },
        onError: async (error, service: unknown) => {
          // Log WorkflowEngine error in production - error handler should use injected logger
          // Pause workflow on error in production
          const svc = service as unknown as {
            getStatus: () => string;
            pause: () => Promise<void>;
          };
          if (svc.getStatus() === 'running') {
            await svc.pause();
          }
        },
      },
    },
    environments: ['production'],
  },
];

/**
 * Get environment configuration
 */
export function getEnvironmentConfig(
  environment: 'development' | 'test' | 'production'
): EnvironmentConfig {
  let bindings: ServiceBinding[];
  let featureFlags: Record<string, unknown> = {};

  switch (environment) {
    case 'development':
      bindings = developmentBindings;
      featureFlags = {
        DI_ENABLED: 'full',
        DI_LOGGER_ENABLED: true,
        DI_DEBUG: true,
        DI_PERFORMANCE_MONITORING: true,
      };
      break;

    case 'test':
      bindings = testBindings;
      featureFlags = {
        DI_ENABLED: 'full',
        DI_LOGGER_ENABLED: true,
        DI_DEBUG: false,
        DI_PERFORMANCE_MONITORING: false,
      };
      break;

    case 'production':
      bindings = productionBindings;
      featureFlags = {
        DI_ENABLED: 'full',
        DI_LOGGER_ENABLED: true,
        DI_DEBUG: false,
        DI_PERFORMANCE_MONITORING: true,
        DI_AUTO_ROLLBACK: true,
      };
      break;

    default:
      bindings = developmentBindings;
  }

  return {
    environment,
    services: bindings.map((binding) => ({
      name: binding.service as string,
      bindings: [binding],
      autoStart: true,
      priority: binding.service === 'ILogger' ? 1 : 2, // Logger has highest priority
    })),
    featureFlags,
    globalOptions: {
      singleton: environment === 'production',
    },
  };
}

/**
 * Create default service bindings configuration file content
 */
export function createDefaultConfigFile(
  environment: 'development' | 'test' | 'production' = 'development'
): string {
  const config = getEnvironmentConfig(environment);

  return `# Service Bindings Configuration
# Environment: ${environment}

environment: ${environment}

featureFlags:
  DI_ENABLED: ${config.featureFlags?.DI_ENABLED ?? 'false'}
  DI_LOGGER_ENABLED: ${config.featureFlags?.DI_LOGGER_ENABLED ?? false}
  DI_DEBUG: ${config.featureFlags?.DI_DEBUG ?? false}
  DI_PERFORMANCE_MONITORING: ${config.featureFlags?.DI_PERFORMANCE_MONITORING ?? false}
  DI_AUTO_ROLLBACK: ${config.featureFlags?.DI_AUTO_ROLLBACK ?? false}

services:
${config.services
  .map(
    (service) => `  - name: ${service.name}
    autoStart: ${service.autoStart}
    priority: ${service.priority}
    bindings:
${service.bindings
  .map(
    (binding) => `      - service: ${binding.service}
        environments: [${binding.environments?.join(', ') ?? environment}]
        singleton: ${binding.options?.singleton ?? true}`
  )
  .join('\n')}`
  )
  .join('\n')}

globalOptions:
  singleton: ${config.globalOptions?.singleton ?? true}
`;
}

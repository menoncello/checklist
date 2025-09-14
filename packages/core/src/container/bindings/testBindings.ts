import { MockConfigService } from '../../../tests/mocks/ConfigService.mock';
import { MockFileSystemService } from '../../../tests/mocks/FileSystemService.mock';
import { MockLoggerService } from '../../../tests/mocks/LoggerService.mock';
import { MockStateManagerService } from '../../../tests/mocks/StateManagerService.mock';
import { MockWorkflowEngineService } from '../../../tests/mocks/WorkflowEngineService.mock';
import type { Constructor } from '../Container';
import type { ServiceBinding } from '../ServiceConfiguration';

/**
 * Test environment service bindings
 */
export const testBindings: ServiceBinding[] = [
  {
    service: 'ILogger',
    implementation: MockLoggerService as unknown as Constructor<unknown>,
    options: {
      singleton: true,
      lifecycle: {
        afterInit: async (_service: unknown) => {
          // Mock logger initialized - test environment
        },
      },
    },
    environments: ['test'],
  },
  {
    service: 'IConfigService',
    implementation: MockConfigService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IFileSystemService'],
    },
    environments: ['test'],
  },
  {
    service: 'IFileSystemService',
    implementation: MockFileSystemService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger'],
    },
    environments: ['test'],
  },
  {
    service: 'IStateManager',
    implementation: MockStateManagerService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IFileSystemService'],
    },
    environments: ['test'],
  },
  {
    service: 'IWorkflowEngine',
    implementation: MockWorkflowEngineService as Constructor<unknown>,
    options: {
      singleton: true,
      dependencies: ['ILogger', 'IStateManager'],
    },
    environments: ['test'],
  },
];
import type { ServiceBinding, EnvironmentConfig } from '../ServiceConfiguration';
import { developmentBindings } from './developmentBindings';
import { productionBindings } from './productionBindings';
import { testBindings } from './testBindings';

/**
 * Get feature flags for environment
 */
function getFeatureFlags(environment: string): Record<string, unknown> {
  switch (environment) {
    case 'development':
      return {
        DI_ENABLED: 'full',
        DI_LOGGER_ENABLED: true,
        DI_DEBUG: true,
        DI_PERFORMANCE_MONITORING: true,
      };
    case 'test':
      return {
        DI_ENABLED: 'full',
        DI_LOGGER_ENABLED: true,
        DI_DEBUG: false,
        DI_PERFORMANCE_MONITORING: false,
      };
    case 'production':
      return {
        DI_ENABLED: 'full',
        DI_LOGGER_ENABLED: true,
        DI_DEBUG: false,
        DI_PERFORMANCE_MONITORING: true,
        DI_AUTO_ROLLBACK: true,
      };
    default:
      return {};
  }
}

/**
 * Get bindings for environment
 */
function getBindings(environment: string): ServiceBinding[] {
  switch (environment) {
    case 'development':
      return developmentBindings;
    case 'test':
      return testBindings;
    case 'production':
      return productionBindings;
    default:
      return developmentBindings;
  }
}

/**
 * Get environment configuration
 */
export function getEnvironmentConfig(
  environment: 'development' | 'test' | 'production'
): EnvironmentConfig {
  const bindings = getBindings(environment);
  const featureFlags = getFeatureFlags(environment);

  return {
    environment,
    services: bindings.map((binding) => ({
      name: binding.service as string,
      bindings: [binding],
      autoStart: true,
      priority: binding.service === 'ILogger' ? 1 : 2,
    })),
    featureFlags,
    globalOptions: {
      singleton: environment === 'production',
    },
  };
}
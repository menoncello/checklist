import type { ServiceBinding, ServiceConfiguration } from '../ServiceConfiguration';
import { getEnvironmentConfig } from './environmentConfig';

/**
 * Generate YAML config for a service binding
 */
function generateBindingYaml(binding: ServiceBinding, environment: string): string {
  return `      - service: ${binding.service}
        environments: [${binding.environments?.join(', ') ?? environment}]
        singleton: ${binding.options?.singleton ?? true}`;
}

/**
 * Generate YAML config for a service
 */
function generateServiceYaml(service: ServiceConfiguration): string {
  return `  - name: ${service.name}
    autoStart: ${service.autoStart ?? true}
    priority: ${service.priority ?? 2}
    bindings:
${service.bindings
  .map((binding) => generateBindingYaml(binding, 'development'))
  .join('\n')}`;
}

/**
 * Generate feature flags section
 */
function generateFeatureFlagsYaml(flags: Record<string, unknown> | undefined): string {
  const getFlagValue = (key: string, defaultValue: unknown): unknown => {
    return flags?.[key] ?? defaultValue;
  };

  return `
featureFlags:
  DI_ENABLED: ${getFlagValue('DI_ENABLED', 'false')}
  DI_LOGGER_ENABLED: ${getFlagValue('DI_LOGGER_ENABLED', false)}
  DI_DEBUG: ${getFlagValue('DI_DEBUG', false)}
  DI_PERFORMANCE_MONITORING: ${getFlagValue('DI_PERFORMANCE_MONITORING', false)}
  DI_AUTO_ROLLBACK: ${getFlagValue('DI_AUTO_ROLLBACK', false)}`;
}

/**
 * Create default service bindings configuration file content
 */
export function createDefaultConfigFile(
  environment: 'development' | 'test' | 'production' = 'development'
): string {
  const config = getEnvironmentConfig(environment);

  const header = `# Service Bindings Configuration
# Environment: ${environment}

environment: ${environment}`;

  const featureFlags = generateFeatureFlagsYaml(config.featureFlags);

  const services = `
services:
${config.services.map(generateServiceYaml).join('\n')}`;

  const globalOptions = `
globalOptions:
  singleton: ${config.globalOptions?.singleton ?? false}`;

  return `${header}${featureFlags}${services}${globalOptions}`;
}
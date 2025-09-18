import type { AppConfig } from '../interfaces/IConfigService';
import type { Logger } from '../utils/logger';

/**
 * Configuration validator
 */
export class ConfigValidator {
  constructor(private logger: Logger) {}

  /**
   * Validate complete configuration
   */
  validate(config: AppConfig): boolean {
    return (
      this.validateRequiredFields(config) && this.validateOptionalFields(config)
    );
  }

  /**
   * Validate required fields
   */
  validateRequiredFields(config: AppConfig): boolean {
    return (
      this.validateVersion(config.version) &&
      this.validateAppName(config.appName) &&
      this.validateEnvironment(config.environment) &&
      this.validateDebug(config.debug)
    );
  }

  private validateVersion(version: unknown): boolean {
    if (
      version === undefined ||
      version === null ||
      typeof version !== 'string'
    ) {
      this.logger.error({ msg: 'Invalid config: missing or invalid version' });
      return false;
    }
    return true;
  }

  private validateAppName(appName: unknown): boolean {
    if (
      appName === undefined ||
      appName === null ||
      typeof appName !== 'string'
    ) {
      this.logger.error({ msg: 'Invalid config: missing or invalid appName' });
      return false;
    }
    return true;
  }

  private validateEnvironment(environment: unknown): boolean {
    if (
      environment === undefined ||
      environment === null ||
      !['development', 'test', 'production'].includes(environment as string)
    ) {
      this.logger.error({
        msg: 'Invalid config: missing or invalid environment',
      });
      return false;
    }
    return true;
  }

  private validateDebug(debug: unknown): boolean {
    if (typeof debug !== 'boolean') {
      this.logger.error({ msg: 'Invalid config: debug must be boolean' });
      return false;
    }
    return true;
  }

  /**
   * Validate optional fields
   */
  validateOptionalFields(config: AppConfig): boolean {
    if (
      !this.validateOptionalField(config.workingDirectory, 'workingDirectory')
    )
      return false;
    if (!this.validateOptionalField(config.featureFlags, 'featureFlags'))
      return false;
    if (!this.validateOptionalField(config.services, 'services')) return false;
    if (!this.validateOptionalField(config.metadata, 'metadata')) return false;

    return this.validateAllConfigs(config);
  }

  /**
   * Validate optional field type
   */
  private validateOptionalField(field: unknown, name: string): boolean {
    if (name === 'workingDirectory') {
      if (field !== undefined && typeof field !== 'string') {
        this.logger.warn({ msg: `Invalid config: ${name} must be a string` });
        return false;
      }
    } else if (field !== undefined && typeof field !== 'object') {
      this.logger.warn({ msg: `Invalid config: ${name} must be an object` });
      return false;
    }
    return true;
  }

  /**
   * Validate all configuration sections
   */
  private validateAllConfigs(config: AppConfig): boolean {
    return (
      this.validateFeatureFlagsConfig(config.featureFlags) &&
      this.validateServicesConfig(config.services) &&
      this.validateMetadataConfig(config.metadata)
    );
  }

  /**
   * Validate feature flags configuration
   */
  private validateFeatureFlagsConfig(
    featureFlags?: AppConfig['featureFlags']
  ): boolean {
    if (featureFlags === undefined) return true;

    for (const [flag, value] of Object.entries(featureFlags)) {
      if (typeof value !== 'boolean' && typeof value !== 'string') {
        this.logger.warn({
          msg: `Feature flag ${flag} must be boolean or string`,
        });
        return false;
      }
    }

    return true;
  }

  /**
   * Validate services configuration
   */
  private validateServicesConfig(services?: AppConfig['services']): boolean {
    if (services === undefined) return true;

    for (const [serviceName, serviceConfig] of Object.entries(services)) {
      if (!this.validateServiceConfig(serviceConfig, serviceName)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate individual service configuration
   */
  private validateServiceConfig(
    serviceConfig: unknown,
    serviceName: string
  ): boolean {
    if (!this.validateServiceObject(serviceConfig, serviceName)) return false;

    const config = serviceConfig as Record<string, unknown>;
    return (
      this.validateServiceEnabled(config, serviceName) &&
      this.validateServiceOptionalFields(config, serviceName)
    );
  }

  private validateServiceObject(
    serviceConfig: unknown,
    serviceName: string
  ): boolean {
    if (typeof serviceConfig !== 'object' || serviceConfig === null) {
      this.logger.error({
        msg: `Service ${serviceName} config must be an object`,
      });
      return false;
    }
    return true;
  }

  private validateServiceEnabled(
    config: Record<string, unknown>,
    serviceName: string
  ): boolean {
    if (typeof config.enabled !== 'boolean') {
      this.logger.error({
        msg: `Service ${serviceName} must have enabled boolean property`,
      });
      return false;
    }
    return true;
  }

  private validateServiceOptionalFields(
    config: Record<string, unknown>,
    serviceName: string
  ): boolean {
    if (
      config.config !== undefined &&
      (typeof config.config !== 'object' || config.config === null)
    ) {
      this.logger.warn({
        msg: `Service ${serviceName} config property must be an object`,
      });
      return false;
    }

    if (
      config.dependencies !== undefined &&
      !Array.isArray(config.dependencies)
    ) {
      this.logger.warn({
        msg: `Service ${serviceName} dependencies must be an array`,
      });
      return false;
    }

    if (config.priority !== undefined && typeof config.priority !== 'number') {
      this.logger.warn({
        msg: `Service ${serviceName} priority must be a number`,
      });
      return false;
    }

    return true;
  }

  /**
   * Validate metadata configuration
   */
  private validateMetadataConfig(metadata?: AppConfig['metadata']): boolean {
    if (metadata === undefined) return true;

    if (typeof metadata !== 'object' || metadata === null) {
      this.logger.warn({ msg: 'Metadata must be an object' });
      return false;
    }

    return true;
  }
}

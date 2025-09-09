export {
  Container,
  CircularDependencyError,
  ServiceNotFoundError,
  LifecycleState,
  type Constructor,
  type Factory,
  type ServiceResolver,
  type ServiceDefinition,
  type ServiceLifecycle,
  type ServiceMetadata,
  type ServiceOptions,
  type DependencyGraph,
  type DependencyNode,
} from './Container';

export { ServiceProvider, type ServiceProviderConfig } from './ServiceProvider';

export {
  ContainerDebugger,
  type ServiceInspection,
  type PerformanceMetrics,
  type CircularDependencyInfo,
} from './ContainerDebugger';

export { CompatibilityLayer } from './CompatibilityLayer';

export {
  FeatureFlagManager,
  DIFeatureFlag,
  globalFeatureFlags,
  type DIEnabledValue,
  type FeatureFlagConfig,
} from './FeatureFlags';

export {
  ServiceConfigurationLoader,
  ServiceLifecycleManager,
  ServiceRecoveryManager,
  RecoveryStrategy,
  type ServiceBinding,
  type ServiceConfiguration,
  type EnvironmentConfig,
  type ServiceRecoveryConfig,
} from './ServiceConfiguration';

export {
  developmentBindings,
  testBindings,
  productionBindings,
  getEnvironmentConfig,
  createDefaultConfigFile,
} from './ServiceBindings';

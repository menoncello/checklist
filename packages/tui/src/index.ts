export const version = '0.0.1';

// Framework core
export * from './framework';

// Screen management
export * from './screens';

// Component system - export specific items to avoid conflicts
export {
  BaseComponent,
  ComponentInstanceImpl,
  ComponentLifecycle,
  ComponentRegistry,
  VirtualList,
  ScrollableContainer,
  LargeListOptimizer,
} from './components';

export type {
  ComponentState,
  ComponentProps,
  ComponentEventHandler,
  ComponentMetadata,
  ComponentInstanceState,
  ComponentInstanceConfig,
  ComponentInstanceMetrics,
  LifecycleHook,
  LifecyclePhaseTransition,
  LifecycleEvent,
  ComponentFactory,
  ComponentRegistration,
  RegistryConfig,
  ComponentQuery,
  RegistryMetrics,
  VirtualListItem,
  VirtualListConfig,
  VirtualListState,
  VirtualListRenderer,
  VirtualListMetrics,
  ScrollableContainerConfig,
  ScrollableContainerState,
  ScrollEvent,
  ListOptimizationConfig,
  ListDataSource,
  CacheEntry,
  LoadingChunk,
  OptimizationMetrics,
  Component,
  RenderContext,
  IComponentInstance,
} from './components';

// Event handling
export * from './events';

// Terminal capabilities
export * from './terminal';

// Error handling
export * from './errors';

// Performance monitoring
export * from './performance';

// Debug mode
export * from './debug';

// Main TUI Framework class
export { TUIFramework } from './TUIFramework';

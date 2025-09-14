// Base components
export { BaseComponent } from './BaseComponent';
export { ComponentInstanceImpl } from './ComponentInstance';
export { ComponentLifecycle } from './ComponentLifecycle';
export { ComponentRegistry } from './ComponentRegistry';

// Large list support components
export { VirtualList } from './virtuallist/VirtualList';
export { ScrollableContainer } from './ScrollableContainer';
export { LargeListOptimizer } from './LargeListOptimizer';

// Component types
export type {
  ComponentState,
  ComponentProps,
  ComponentEventHandler,
  LifecyclePhase,
  ComponentMetadata,
} from './BaseComponent';

export type {
  ComponentInstanceState,
  ComponentInstanceConfig,
  ComponentInstanceMetrics,
} from './ComponentInstance';

export type {
  LifecycleState,
  LifecycleHook,
  LifecyclePhaseTransition,
  LifecycleEvent,
} from './ComponentLifecycle';

export type {
  ComponentFactory,
  ComponentRegistration,
  RegistryConfig,
  ComponentQuery,
  RegistryMetrics,
} from './ComponentRegistry';

// Virtual list types
export type {
  VirtualListItem,
  VirtualListConfig,
  VirtualListState,
  VirtualListRenderer,
} from './virtuallist/types';

// Virtual list metrics - temporary interface until available
export interface VirtualListMetrics {
  totalItems: number;
  visibleItems: number;
  renderedItems: number;
}

// Scrollable container types
export type {
  ScrollableContainerConfig,
  ScrollableContainerState,
  ScrollEvent,
} from './ScrollableContainer';

// Large list optimizer types
export type {
  ListOptimizationConfig,
  ListDataSource,
  OptimizationMetrics,
} from './LargeListOptimizer';

// Re-export cache types from their actual locations
export type { CacheEntry } from './ListCacheManager';
export type { LoadingChunk } from './ListChunkLoader';

// Re-export framework types for convenience
export type {
  Component,
  RenderContext,
  ComponentInstance as IComponentInstance,
} from '../framework/UIFramework';

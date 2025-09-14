export type Constructor<T = unknown> = new (...args: unknown[]) => T;
export type Factory<T = unknown> = (...args: unknown[]) => T | Promise<T>;
export type ServiceResolver<T = unknown> = Constructor<T> | Factory<T>;

export interface ServiceDefinition<T = unknown> {
  resolver: ServiceResolver<T>;
  singleton?: boolean;
  dependencies?: Array<string | Constructor<unknown>>;
  lifecycle?: ServiceLifecycle<T>;
  metadata?: ServiceMetadata;
}

export interface ServiceLifecycle<T = unknown> {
  beforeInit?: (service: T) => void | Promise<void>;
  afterInit?: (service: T) => void | Promise<void>;
  beforeDestroy?: (service: T) => void | Promise<void>;
  afterDestroy?: (service: T) => void | Promise<void>;
  onError?: (error: Error, service: T) => void | Promise<void>;
  healthCheck?: (service: T) => boolean | Promise<boolean>;
}

export interface ServiceMetadata {
  name?: string;
  version?: string;
  description?: string;
  tags?: string[];
  createdAt?: Date;
  [key: string]: unknown;
}

export interface ServiceOptions<T = unknown> {
  singleton?: boolean;
  dependencies?: Array<string | Constructor<unknown>>;
  lifecycle?: ServiceLifecycle<T>;
  metadata?: ServiceMetadata;
}

export enum LifecycleState {
  REGISTERED = 'registered',
  INITIALIZING = 'initializing',
  INITIALIZED = 'initialized',
  DESTROYING = 'destroying',
  DESTROYED = 'destroyed',
  ERROR = 'error',
}

export interface DependencyGraph {
  nodes: Map<string, DependencyNode>;
  edges: Map<string, Set<string>>;
}

export interface DependencyNode {
  id: string;
  definition: ServiceDefinition;
  dependencies: string[];
  dependents: string[];
  state: LifecycleState;
}

export class CircularDependencyError extends Error {
  constructor(cycle: string[]) {
    super(`Circular dependency detected: ${cycle.join(' -> ')}`);
    this.name = 'CircularDependencyError';
  }
}

export class ServiceNotFoundError extends Error {
  constructor(id: string) {
    super(`Service not found: ${id}`);
    this.name = 'ServiceNotFoundError';
  }
}

export class ServiceInitializationError extends Error {
  constructor(id: string, cause: Error) {
    super(`Failed to initialize service: ${id} - ${cause.message}`);
    this.name = 'ServiceInitializationError';
    this.cause = cause;
  }
}
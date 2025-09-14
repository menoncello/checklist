export class ContainerError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'ContainerError';
  }
}

export class ServiceNotFoundError extends ContainerError {
  constructor(public serviceName: string) {
    super(`Service not found: ${serviceName}`, 'SERVICE_NOT_FOUND');
    this.name = 'ServiceNotFoundError';
  }
}

export class CircularDependencyError extends ContainerError {
  constructor(public cycle: string[]) {
    super(
      `Circular dependency detected: ${cycle.join(' -> ')}`,
      'CIRCULAR_DEPENDENCY'
    );
    this.name = 'CircularDependencyError';
  }
}

export class ServiceAlreadyRegisteredError extends ContainerError {
  constructor(public serviceName: string) {
    super(
      `Service already registered: ${serviceName}`,
      'SERVICE_ALREADY_REGISTERED'
    );
    this.name = 'ServiceAlreadyRegisteredError';
  }
}

export class InvalidServiceDefinitionError extends ContainerError {
  constructor(message: string) {
    super(message, 'INVALID_SERVICE_DEFINITION');
    this.name = 'InvalidServiceDefinitionError';
  }
}
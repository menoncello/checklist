# Dependency Injection Migration Guide

## Overview

This guide provides a phased approach to migrating the codebase from singleton patterns to dependency injection (DI) using our IoC container. The migration is designed to be gradual, with rollback points at each phase.

## Migration Phases

### Phase 1: Non-Critical Services (Low Risk)
**Status**: In Progress  
**Feature Flag**: `DI_ENABLED=partial`

#### Services to Migrate:
1. ConfigService - New implementation
2. FileSystemService - New implementation

#### Steps:
1. Enable feature flag in config: `DI_ENABLED=partial`
2. Register services in ServiceProvider
3. Update consumers to use injected services
4. Verify functionality
5. Monitor for issues

#### Rollback:
```bash
# 1. Disable feature flag
export DI_ENABLED=false

# 2. Remove service registrations
git checkout HEAD~1 -- packages/core/src/services/ConfigService.ts
git checkout HEAD~1 -- packages/core/src/services/BunFileSystemService.ts

# 3. Restart application
bun run dev
```

### Phase 2: Logger Migration (Medium Risk)
**Status**: Pending  
**Feature Flag**: `DI_LOGGER_ENABLED=true`

#### Services to Migrate:
1. LoggerService - Adapter pattern for backward compatibility

#### Steps:
1. Enable feature flag: `DI_LOGGER_ENABLED=true`
2. Use LoggerServiceAdapter to wrap existing singleton
3. Gradually replace direct LoggerService usage
4. Update all logger consumers
5. Remove singleton after full migration

#### Rollback:
```bash
# 1. Disable feature flag
export DI_LOGGER_ENABLED=false

# 2. Revert to singleton pattern
git checkout HEAD~1 -- packages/core/src/services/LoggerServiceAdapter.ts

# 3. Restart application
bun run dev
```

### Phase 3: Core Services (High Risk)
**Status**: Pending  
**Feature Flag**: `DI_ENABLED=full`

#### Services to Migrate:
1. StateManager
2. WorkflowEngine

#### Steps:
1. Enable feature flag: `DI_ENABLED=full`
2. Register all core services
3. Update all consumers
4. Full integration testing
5. Performance validation

#### Rollback:
```bash
# 1. Disable feature flag
export DI_ENABLED=false

# 2. Restore previous implementations
git checkout HEAD~1 -- packages/core/src/services/

# 3. Clear container cache
rm -rf .checklist/.container-cache/

# 4. Restart application
bun run dev
```

## Code Examples

### Before Migration (Singleton Pattern)
```typescript
import { LoggerService } from '../utils/logger';

class MyService {
  private logger = LoggerService.getInstance();
  
  doSomething() {
    this.logger.info({ msg: 'Doing something' });
  }
}
```

### After Migration (Dependency Injection)
```typescript
import type { ILogger } from '../interfaces/ILogger';

class MyService {
  constructor(private logger: ILogger) {}
  
  doSomething() {
    this.logger.info({ msg: 'Doing something' });
  }
}

// Registration
serviceProvider.register('MyService', MyService, {
  dependencies: ['ILogger']
});
```

## Service Registration

### Basic Registration
```typescript
import { ServiceProvider } from '../container/ServiceProvider';
import { ConfigService } from '../services/ConfigService';
import { BunFileSystemService } from '../services/BunFileSystemService';

const provider = new ServiceProvider();

// Register services
provider.registerConfigService(ConfigService);
provider.registerFileSystemService(BunFileSystemService);

// Resolve services
const config = await provider.getConfigService();
const fs = await provider.getFileSystemService();
```

### With Dependencies
```typescript
import { StateManagerService } from '../services/StateManagerService';

provider.register('IStateManager', StateManagerService, {
  dependencies: ['ILogger', 'IFileSystemService'],
  singleton: true,
  lifecycle: {
    afterInit: async (service) => {
      await service.initialize();
    },
    beforeDestroy: async (service) => {
      await service.unlock();
    }
  }
});
```

## Feature Flag Configuration

### Environment Variables
```bash
# .env or shell
export DI_ENABLED=partial          # Enable Phase 1
export DI_LOGGER_ENABLED=false     # Keep logger as singleton
export DI_DEBUG=true               # Enable debug logging
```

### Runtime Configuration
```typescript
const provider = new ServiceProvider({
  environment: 'development',
  featureFlags: {
    DI_ENABLED: 'partial',
    DI_LOGGER_ENABLED: false
  }
});

// Check feature flags
if (provider.isFeatureEnabled('DI_ENABLED')) {
  // Use DI pattern
} else {
  // Use singleton pattern
}
```

## Compatibility Layer

### Backward Compatibility Wrapper
```typescript
// Maintains existing API while using DI internally
export class LoggerServiceCompat {
  private static instance: ILogger | null = null;
  
  static getInstance(): ILogger {
    if (!this.instance) {
      // Try to get from DI container first
      if (globalProvider && globalProvider.isFeatureEnabled('DI_LOGGER_ENABLED')) {
        this.instance = await globalProvider.getLogger();
      } else {
        // Fall back to singleton
        this.instance = LoggerServiceAdapter.fromSingleton();
      }
    }
    return this.instance;
  }
}
```

## Testing During Migration

### Unit Tests with Mocks
```typescript
import { describe, test, expect } from 'bun:test';
import { MockLoggerService } from '../tests/mocks';
import { MyService } from './MyService';

describe('MyService with DI', () => {
  test('should log messages', () => {
    const mockLogger = new MockLoggerService();
    const service = new MyService(mockLogger);
    
    service.doSomething();
    
    expect(mockLogger.hasLoggedMessage('Doing something')).toBe(true);
  });
});
```

### Integration Tests
```typescript
import { ServiceProvider } from '../container/ServiceProvider';

describe('Service Integration', () => {
  let provider: ServiceProvider;
  
  beforeEach(() => {
    provider = ServiceProvider.createForTest();
    // Register test services
  });
  
  afterEach(async () => {
    await provider.destroy();
  });
  
  test('services work together', async () => {
    const stateManager = await provider.getStateManager();
    const workflowEngine = await provider.getWorkflowEngine();
    
    // Test integrated functionality
  });
});
```

## Performance Monitoring

### Measuring Injection Overhead
```typescript
import { ContainerDebugger } from '../container/ContainerDebugger';

const debugger = new ContainerDebugger(container);

// Measure resolution performance
const { result, metrics } = await debugger.measureResolutionPerformance('ILogger');

console.log(`Resolution time: ${metrics.resolutionTime}ms`);
console.log(`Memory usage: ${metrics.memoryUsage} bytes`);

// Target: <1ms per injection
```

### Health Checks
```typescript
const healthStatus = debugger.getServiceHealthStatus();

for (const [service, healthy] of healthStatus) {
  if (!healthy) {
    console.error(`Service unhealthy: ${service}`);
    // Trigger rollback
  }
}
```

## Troubleshooting

### Common Issues

#### Circular Dependencies
```typescript
// Error: Circular dependency detected: ServiceA -> ServiceB -> ServiceA

// Solution: Use lazy injection or refactor
provider.register('ServiceA', ServiceA, {
  dependencies: [() => 'ServiceB'] // Lazy resolution
});
```

#### Missing Dependencies
```typescript
// Error: Service not found: ILogger

// Solution: Ensure service is registered
provider.registerLogger(LoggerServiceAdapter);
```

#### Performance Degradation
```typescript
// If injection takes >1ms, check:
1. Service resolution caching is enabled
2. No circular dependencies
3. Lifecycle hooks are optimized
4. Container debugger for profiling
```

## Migration Checklist

### Phase 1 Checklist
- [ ] Feature flag enabled (`DI_ENABLED=partial`)
- [ ] ConfigService registered and tested
- [ ] FileSystemService registered and tested
- [ ] No singleton usage for these services
- [ ] Performance metrics collected
- [ ] Rollback procedure documented

### Phase 2 Checklist
- [ ] Feature flag enabled (`DI_LOGGER_ENABLED=true`)
- [ ] LoggerServiceAdapter implemented
- [ ] All logger consumers updated
- [ ] Backward compatibility maintained
- [ ] No performance regression
- [ ] Tests passing with mocks

### Phase 3 Checklist
- [ ] Feature flag enabled (`DI_ENABLED=full`)
- [ ] All services migrated
- [ ] No singleton patterns remaining
- [ ] Full test coverage with mocks
- [ ] Performance targets met (<1ms)
- [ ] Documentation updated

## Best Practices

1. **Always use interfaces** - Depend on abstractions, not implementations
2. **Register early** - Register all services at application startup
3. **Use lifecycle hooks** - Properly initialize and cleanup services
4. **Monitor performance** - Track injection overhead continuously
5. **Test with mocks** - Use mock implementations for unit tests
6. **Feature flag everything** - Enable gradual rollout and easy rollback
7. **Document dependencies** - Keep service dependency graph updated

## Support

For issues or questions during migration:
1. Check container debug report: `debugger.generateDebugReport()`
2. Review dependency graph: `debugger.visualizeDependencyGraph()`
3. Enable verbose logging: `debugger.enableVerboseLogging()`
4. Consult team lead for rollback decision
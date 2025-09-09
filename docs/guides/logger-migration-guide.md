# Pino Logger Migration Guide

## Overview

This guide helps you migrate from the `debug` library to our new Pino-based logging infrastructure.

## Quick Start

### Basic Usage

```typescript
// OLD (debug library)
import createDebug from 'debug';
const debug = createDebug('checklist:module');
debug('Processing %s with %d items', name, count);

// NEW (Pino logger)
import { createLogger } from '@checklist/core/utils/logger';
const logger = createLogger('checklist:module');
logger.debug({ msg: 'Processing items', name, count });
```

## Migration Steps

### 1. Update Imports

Replace all debug imports with logger imports:

```typescript
// Before
import createDebug from 'debug';

// After  
import { createLogger } from '@checklist/core/utils/logger';
```

### 2. Replace Debug Instances

```typescript
// Before
const debug = createDebug('checklist:mymodule');

// After
const logger = createLogger('checklist:mymodule');
```

### 3. Update Log Calls

Debug uses printf-style formatting, while Pino uses structured logging:

```typescript
// Before
debug('User %s logged in at %s', userId, timestamp);
debug('Error: %O', error);

// After
logger.debug({ msg: 'User logged in', userId, timestamp });
logger.error({ msg: 'Error occurred', error });
```

### 4. Log Levels

Map your debug calls to appropriate log levels:

```typescript
// Debug library (single level)
debug('Something happened');

// Pino logger (multiple levels)
logger.debug({ msg: 'Debug information' });
logger.info({ msg: 'Normal operation' });
logger.warn({ msg: 'Warning condition' });
logger.error({ msg: 'Error occurred', error });
logger.fatal({ msg: 'Fatal error', error });
```

## Structured Logging Best Practices

### Always Include Context

```typescript
// ❌ Bad
logger.info({ msg: 'Operation completed' });

// ✅ Good
logger.info({ 
  msg: 'Operation completed',
  operationId: op.id,
  duration: endTime - startTime,
  itemsProcessed: items.length
});
```

### Use Child Loggers for Request Context

```typescript
class WorkflowEngine {
  private logger = createLogger('checklist:workflow:engine');
  
  async execute(workflowId: string) {
    const requestLogger = this.logger.child({ 
      requestId: crypto.randomUUID(),
      workflowId 
    });
    
    requestLogger.info({ msg: 'Starting workflow execution' });
    // All logs from requestLogger will include requestId and workflowId
  }
}
```

### Performance Tracking

```typescript
const startTime = performance.now();
// ... do work ...
const duration = performance.now() - startTime;

logger.info({ 
  msg: 'Operation completed',
  duration,
  performanceOk: duration < 100
});
```

## Configuration

### Environment Variables

Configure logging via environment variables:

```bash
# Log level (debug, info, warn, error, fatal)
LOG_LEVEL=info

# Enable file logging
ENABLE_FILE_LOGGING=true

# Log directory
LOG_DIRECTORY=.logs

# Enable log rotation
ENABLE_LOG_ROTATION=true

# Maximum log file size
LOG_MAX_FILE_SIZE=10M

# Maximum number of log files to keep
LOG_MAX_FILES=7

# Maximum age of log files
LOG_MAX_AGE=7d
```

### Programmatic Configuration

```typescript
import { initializeLogger } from '@checklist/core/utils/logger';

initializeLogger({
  level: 'info',
  prettyPrint: true, // Pretty output in development
  enableFileLogging: true,
  enableRotation: true,
  logDirectory: '.logs',
  maxFileSize: '10M',
  maxFiles: 7,
  maxAge: '7d'
});
```

## Testing with Mock Logger

### Unit Tests

```typescript
import { TestDataFactory } from '@checklist/core/test-utils/TestDataFactory';
import { LogAssertions } from '@checklist/core/test-utils/LogAssertions';

describe('MyService', () => {
  it('should log operations', () => {
    const mockLogger = TestDataFactory.createMockLogger();
    const service = new MyService(mockLogger);
    
    service.doWork();
    
    // Assert specific message was logged
    LogAssertions.assertLogged(mockLogger, 'info', 'Work completed');
    
    // Assert no errors
    LogAssertions.assertNoErrors(mockLogger);
    
    // Check log count
    expect(mockLogger.infoCalls).toHaveLength(1);
  });
});
```

### Integration Tests

```typescript
import { TestDataFactory } from '@checklist/core/test-utils/TestDataFactory';

describe('Integration', () => {
  it('should work with in-memory logger', () => {
    const logger = TestDataFactory.createInMemoryLogger();
    const service = new MyService(logger);
    
    service.process();
    
    const logs = logger.getLogs();
    expect(logs).toContainEqual(
      expect.objectContaining({
        level: 'info',
        context: expect.objectContaining({
          msg: 'Processing complete'
        })
      })
    );
  });
});
```

## Adding External Transports

Configure external services (DataDog, CloudWatch, etc.):

```typescript
initializeLogger({
  level: 'info',
  externalTransports: [
    {
      target: 'pino-datadog',
      options: {
        apiKey: process.env.DATADOG_API_KEY,
        service: 'checklist-app'
      },
      level: 'warn' // Only send warnings and above
    },
    {
      target: 'pino-cloudwatch',
      options: {
        region: 'us-east-1',
        logGroupName: '/aws/lambda/checklist'
      }
    }
  ]
});
```

## Common Migration Patterns

### Pattern 1: Simple Debug Statement

```typescript
// Before
debug('Starting process');

// After
logger.debug({ msg: 'Starting process' });
```

### Pattern 2: Variable Interpolation

```typescript
// Before
debug('Found %d items for user %s', items.length, userId);

// After
logger.debug({ 
  msg: 'Found items for user',
  itemCount: items.length,
  userId 
});
```

### Pattern 3: Object Logging

```typescript
// Before
debug('Config: %O', config);

// After
logger.debug({ msg: 'Configuration loaded', config });
```

### Pattern 4: Error Logging

```typescript
// Before
debug('Error: %O', error);

// After
logger.error({ msg: 'Operation failed', error });
```

### Pattern 5: Conditional Logging

```typescript
// Before
if (debug.enabled) {
  debug('Expensive operation: %O', expensiveComputation());
}

// After
if (logger.level === 'debug') {
  logger.debug({ 
    msg: 'Expensive operation',
    result: expensiveComputation()
  });
}
```

## Troubleshooting

### Logs Not Appearing

1. Check log level: `LOG_LEVEL` environment variable
2. Verify file permissions for log directory
3. Ensure logger is properly initialized

### Performance Issues

1. Use child loggers instead of creating new instances
2. Avoid logging large objects in hot paths
3. Consider using sampling for high-frequency logs

### File Rotation Not Working

1. Verify `ENABLE_LOG_ROTATION=true`
2. Check disk space availability
3. Ensure pino-roll plugin is installed

## Benefits of Migration

1. **Structured Logging**: Better searchability and analysis
2. **Performance**: Pino is one of the fastest Node.js loggers
3. **Rotation**: Built-in log rotation support
4. **Multiple Levels**: Fine-grained control over log verbosity
5. **Child Loggers**: Automatic context propagation
6. **Testing**: Comprehensive mock and assertion utilities
7. **External Services**: Easy integration with monitoring services
8. **Type Safety**: Full TypeScript support

## Need Help?

- Check the [Logger API Documentation](./logger-api.md)
- Review [example implementations](../../examples/logging/)
- Ask in the development channel
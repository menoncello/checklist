# Logger API Documentation

## Core API

### `createLogger(namespace: string): Logger`

Creates a new logger instance with the specified namespace.

```typescript
import { createLogger } from '@checklist/core/utils/logger';

const logger = createLogger('checklist:mymodule');
```

**Parameters:**
- `namespace`: A colon-separated namespace string (e.g., 'checklist:workflow:engine')

**Returns:** A `Logger` instance with all logging methods

### `initializeLogger(config?: LoggerConfig): void`

Initializes the global logger service with custom configuration.

```typescript
import { initializeLogger } from '@checklist/core/utils/logger';

initializeLogger({
  level: 'info',
  enableFileLogging: true,
  logDirectory: '.logs'
});
```

## Logger Interface

### Methods

#### `debug(context: LogContext): void`

Logs a debug-level message. Only visible when log level is set to 'debug'.

```typescript
logger.debug({ 
  msg: 'Debug information',
  variable: value,
  metadata: { ... }
});
```

#### `info(context: LogContext): void`

Logs an info-level message. Standard operational messages.

```typescript
logger.info({ 
  msg: 'Operation completed',
  duration: 125,
  itemsProcessed: 42
});
```

#### `warn(context: LogContext): void`

Logs a warning-level message. Potential issues that don't prevent operation.

```typescript
logger.warn({ 
  msg: 'Rate limit approaching',
  current: 95,
  limit: 100
});
```

#### `error(context: LogContext): void`

Logs an error-level message. Errors that are handled and recoverable.

```typescript
logger.error({ 
  msg: 'Operation failed',
  error: new Error('Connection timeout'),
  retryCount: 3
});
```

#### `fatal(context: LogContext): void`

Logs a fatal-level message. Unrecoverable errors that will cause shutdown.

```typescript
logger.fatal({ 
  msg: 'Critical system failure',
  error: new Error('Database connection lost'),
  shutdownInitiated: true
});
```

#### `child(bindings: Record<string, any>, options?: ChildLoggerOptions): Logger`

Creates a child logger with additional context that will be included in all logs.

```typescript
const requestLogger = logger.child({
  requestId: crypto.randomUUID(),
  userId: user.id,
  sessionId: session.id
});

// All logs from requestLogger will include requestId, userId, and sessionId
requestLogger.info({ msg: 'Processing request' });
```

## Types

### `LogContext`

The context object passed to all logging methods.

```typescript
interface LogContext {
  msg: string;           // Required message
  [key: string]: any;    // Additional properties
}
```

### `LoggerConfig`

Configuration options for the logger service.

```typescript
interface LoggerConfig {
  level?: string;                    // 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  prettyPrint?: boolean;             // Pretty formatting for development
  enableFileLogging?: boolean;       // Write logs to files
  enableRotation?: boolean;          // Enable log rotation
  logDirectory?: string;             // Directory for log files
  maxFileSize?: string;              // Max size before rotation (e.g., '10M')
  maxFiles?: number;                 // Number of rotated files to keep
  maxAge?: string;                   // Max age of log files (e.g., '7d')
  externalTransports?: Array<{      // External service transports
    target: string;                  // Transport package name
    options?: Record<string, any>;  // Transport-specific options
    level?: string;                  // Minimum level for this transport
  }>;
}
```

## Service Architecture

### BaseService

Abstract base class for services with logger injection.

```typescript
import { BaseService } from '@checklist/core/services/BaseService';
import type { ServiceConfig, Logger } from '@checklist/core';

export class MyService extends BaseService {
  constructor(config: ServiceConfig, logger: Logger) {
    super(config, logger);
  }

  protected async onInitialize(): Promise<void> {
    this.logger.info({ msg: 'MyService initializing' });
    // Initialization logic
  }

  protected async onShutdown(): Promise<void> {
    this.logger.info({ msg: 'MyService shutting down' });
    // Cleanup logic
  }

  doWork(): void {
    const childLogger = this.getChildLogger('work');
    childLogger.debug({ msg: 'Starting work' });
    // Work logic
  }
}
```

### DIContainer

Dependency injection container with logger support.

```typescript
import { DIContainer } from '@checklist/core/services/DIContainer';

const container = new DIContainer();

// Register a service with logger injection
container.register({
  name: 'myService',
  factory: (container) => {
    const config = container.get('config');
    const logger = container.createLogger('myservice');
    return new MyService(config, logger);
  },
  singleton: true
});

// Retrieve service
const service = container.get<MyService>('myService');
```

## Test Utilities

### MockLogger

Test double for unit testing.

```typescript
import { MockLogger } from '@checklist/core/utils/MockLogger';

const mockLogger = new MockLogger();

// Use in tests
service.doWork(mockLogger);

// Assert calls
expect(mockLogger.infoCalls).toHaveLength(1);
expect(mockLogger.infoCalls[0].msg).toBe('Work completed');
expect(mockLogger.hasLoggedMessage('Work completed')).toBe(true);
expect(mockLogger.hasLoggedError(expectedError)).toBe(true);

// Clear for next test
mockLogger.clear();
```

### TestDataFactory

Factory for creating test loggers.

```typescript
import { TestDataFactory } from '@checklist/core/test-utils/TestDataFactory';

// Create different types of test loggers
const mockLogger = TestDataFactory.createMockLogger();
const inMemoryLogger = TestDataFactory.createInMemoryLogger();
const silentLogger = TestDataFactory.createSilentLogger();

// Create custom logger
const customLogger = TestDataFactory.createCustomLogger({
  info: (context) => console.log('Custom:', context.msg)
});
```

### LogAssertions

Assertion utilities for testing logs.

```typescript
import { LogAssertions } from '@checklist/core/test-utils/LogAssertions';

// Assert specific message logged
LogAssertions.assertLogged(mockLogger, 'info', 'Expected message');

// Assert with context
LogAssertions.assertLogged(mockLogger, 'info', 'Expected message', {
  userId: '123',
  action: 'login'
});

// Assert no errors
LogAssertions.assertNoErrors(mockLogger);

// Assert error logged
LogAssertions.assertErrorLogged(mockLogger, expectedError);

// Assert log count
LogAssertions.assertLogCount(mockLogger, 'info', 3);

// Assert child logger created
LogAssertions.assertChildLoggerCreated(mockLogger, {
  requestId: '123'
});

// Assert performance
await LogAssertions.assertLoggerPerformance(
  () => createLogger('test'),
  5 // max milliseconds
);
```

## Health Monitoring

### HealthMonitor

Monitor logger health and performance.

```typescript
import { HealthMonitor } from '@checklist/core/monitoring/HealthMonitor';

const monitor = new HealthMonitor();

// Track log operations
const startTime = performance.now();
logger.info({ msg: 'Operation' });
monitor.trackLogOperation(performance.now() - startTime);

// Get logger metrics
const metrics = await monitor.getLoggerMetrics();
console.log({
  performanceOk: metrics.performanceOk,
  averageLogTime: metrics.averageLogTime,
  rotationStatus: metrics.rotationStatus,
  errorRate: metrics.errorRate
});

// Run health checks
const health = await monitor.checkHealth();
console.log({
  status: health.status,
  checks: health.checks
});

// Register custom check
monitor.registerCheck('custom-check', async () => ({
  name: 'custom-check',
  status: 'healthy',
  message: 'All good'
}));
```

## Environment Variables

Configure logging via environment:

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `LOG_LEVEL` | Minimum log level | `info` | `debug`, `info`, `warn`, `error`, `fatal` |
| `NODE_ENV` | Environment mode | - | `development`, `production` |
| `ENABLE_FILE_LOGGING` | Write logs to files | `false` | `true`, `false` |
| `ENABLE_LOG_ROTATION` | Enable log file rotation | `false` | `true`, `false` |
| `LOG_DIRECTORY` | Directory for log files | `.logs` | `./logs`, `/var/log/app` |
| `LOG_MAX_FILE_SIZE` | Max file size before rotation | `10M` | `1M`, `100M`, `1G` |
| `LOG_MAX_FILES` | Number of rotated files | `7` | `3`, `30` |
| `LOG_MAX_AGE` | Maximum age of log files | `7d` | `1d`, `30d` |

## Log File Structure

When file logging is enabled, logs are organized as:

```
.logs/
├── info/
│   ├── app.log        # Current info+ logs
│   ├── app.log.1      # Rotated logs
│   └── app.log.2
├── error/
│   ├── error.log      # Current error+ logs
│   └── error.log.1
└── debug/             # Development only
    ├── debug.log      # Current debug+ logs
    └── debug.log.1
```

## Performance Guidelines

1. **Use child loggers** instead of creating new instances
2. **Cache logger instances** in long-lived objects
3. **Avoid logging in tight loops** without sampling
4. **Use appropriate log levels** to reduce overhead
5. **Structure data efficiently** - avoid deep nesting

## Best Practices

1. **Always include `msg` field** - Required for all log calls
2. **Use structured data** - Better than string concatenation
3. **Include trace IDs** - For distributed tracing
4. **Log at appropriate levels** - Debug for development, Info for operations
5. **Add contextual metadata** - User IDs, request IDs, etc.
6. **Handle sensitive data** - Never log passwords, tokens, etc.
7. **Use child loggers** - For request-scoped context
8. **Monitor performance** - Track logging overhead
9. **Test with mocks** - Ensure proper logging in tests
10. **Configure for environment** - Different settings for dev/prod
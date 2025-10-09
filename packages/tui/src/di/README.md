# Dependency Injection Container

## Overview

Lightweight IoC (Inversion of Control) container for managing dependencies in the TUI package. Solves testability issues by decoupling components and enabling easy mocking.

## Why Use DI?

### Before (Tight Coupling)

```typescript
class NavigationCommandHandler {
  constructor() {
    // Hard-coded dependencies - impossible to mock
    this.eventBus = new EventBus();
    this.queue = new CommandQueue();
    this.monitor = new PerformanceMonitor();
  }
}

// Tests are difficult
test('should handle commands', () => {
  const handler = new NavigationCommandHandler(); // Creates real EventBus!
  // Can't mock, can't control behavior
});
```

### After (Loose Coupling)

```typescript
class NavigationCommandHandler {
  constructor(
    private eventBus: IEventBus,
    private queue: ICommandQueue,
    private monitor: IPerformanceMonitor
  ) {
    // Dependencies injected - easy to test
  }
}

// Tests are easy
test('should handle commands', () => {
  const mockBus = createMockEventBus();
  const mockQueue = createMockCommandQueue();
  const mockMonitor = createMockMonitor();

  const handler = new NavigationCommandHandler(mockBus, mockQueue, mockMonitor);
  // Full control over behavior!
});
```

## Quick Start

### 1. Define Interfaces (Recommended)

```typescript
// src/interfaces/IEventBus.ts
export interface IEventBus {
  publish<T>(type: string, data: T): void;
  subscribe<T>(type: string, handler: (msg: T) => void): string;
  unsubscribe(id: string): boolean;
  destroy(): void;
}
```

### 2. Register Dependencies

```typescript
import { Container, Lifecycle } from './di/Container';
import { EVENT_BUS, COMMAND_QUEUE } from './di/tokens';

const container = new Container();

// Singleton (default) - one instance for entire app
container.register(EVENT_BUS, () => new EventBus(), Lifecycle.Singleton);

// Transient - new instance each time
container.register(
  COMMAND_QUEUE,
  (c) => {
    const eventBus = c.resolve<IEventBus>(EVENT_BUS);
    return new CommandQueue(eventBus);
  },
  Lifecycle.Transient
);
```

### 3. Resolve Dependencies

```typescript
// In production code
const eventBus = container.resolve<IEventBus>(EVENT_BUS);
const queue = container.resolve<ICommandQueue>(COMMAND_QUEUE);

const handler = new NavigationCommandHandler(eventBus, queue);
```

### 4. Test with Mocks

```typescript
import { Container } from '../../../src/di/Container';
import { EVENT_BUS } from '../../../src/di/tokens';

describe('NavigationCommandHandler', () => {
  let container: Container;
  let mockEventBus: MockEventBus;

  beforeEach(() => {
    container = new Container();

    // Register mock
    mockEventBus = createMockEventBus();
    container.registerInstance(EVENT_BUS, mockEventBus);

    // Handler now uses mock
    const handler = new NavigationCommandHandler(container.resolve(EVENT_BUS));
  });

  afterEach(async () => {
    await container.dispose(); // Cleans up all instances
  });

  it('should publish events', () => {
    // mockEventBus is fully controlled
    expect(mockEventBus.publish).toHaveBeenCalled();
  });
});
```

## Advanced Usage

### Scoped Dependencies

```typescript
// Create a scope for request-level dependencies
const requestScope = container.createScope();

requestScope.register(REQUEST_CONTEXT, () => new RequestContext(), Lifecycle.Scoped);

// Dispose scope when request completes
await requestScope.dispose();
```

### Auto Disposal

```typescript
class MyService {
  async dispose() {
    // Cleanup logic
  }
}

container.register(MY_SERVICE, () => new MyService());

// Later...
await container.dispose(); // Automatically calls MyService.dispose()
```

### Conditional Registration

```typescript
if (process.env.NODE_ENV === 'test') {
  container.register(EVENT_BUS, () => new MockEventBus());
} else {
  container.register(EVENT_BUS, () => new EventBus());
}
```

## Migration Guide

### Step 1: Extract Interfaces

```typescript
// Before
class NavigationCommandHandler {
  private eventBus: EventBus;
}

// After
interface IEventBus {
  publish(...): void;
  subscribe(...): string;
}

class NavigationCommandHandler {
  constructor(private eventBus: IEventBus) {}
}
```

### Step 2: Update Constructors

```typescript
// Before
constructor() {
  this.eventBus = new EventBus();
  this.queue = new CommandQueue();
}

// After
constructor(
  private eventBus: IEventBus,
  private queue: ICommandQueue
) {}
```

### Step 3: Update Tests

```typescript
// Before
beforeEach(() => {
  handler = new NavigationCommandHandler(); // Creates real dependencies
});

// After
beforeEach(() => {
  container = new Container();
  container.registerInstance(EVENT_BUS, mockEventBus);
  container.registerInstance(COMMAND_QUEUE, mockQueue);

  handler = new NavigationCommandHandler(
    container.resolve(EVENT_BUS),
    container.resolve(COMMAND_QUEUE)
  );
});

afterEach(async () => {
  await container.dispose(); // Auto cleanup!
});
```

## Best Practices

### 1. Use Interfaces

```typescript
// ✅ Good - testable
constructor(private eventBus: IEventBus) {}

// ❌ Bad - tied to implementation
constructor(private eventBus: EventBus) {}
```

### 2. Register Early, Resolve Late

```typescript
// ✅ Good - at app startup
container.register(EVENT_BUS, () => new EventBus());

// Later when needed
const eventBus = container.resolve(EVENT_BUS);

// ❌ Bad - resolve during registration
container.register(HANDLER, () => {
  return new Handler(container.resolve(EVENT_BUS)); // Resolved too early
});
```

### 3. One Container Per Test

```typescript
// ✅ Good
beforeEach(() => {
  container = new Container(); // Fresh for each test
});

// ❌ Bad
const container = new Container(); // Shared state!

beforeEach(() => {
  container.reset(); // Not enough, doesn't dispose
});
```

### 4. Always Dispose

```typescript
afterEach(async () => {
  await container.dispose(); // Prevents leaks
});
```

## Common Patterns

### Factory Pattern

```typescript
container.register(COMMAND_QUEUE_FACTORY, (c) => {
  return (options: QueueOptions) => {
    const eventBus = c.resolve(EVENT_BUS);
    return new CommandQueue(eventBus, options);
  };
});

// Usage
const factory = container.resolve(COMMAND_QUEUE_FACTORY);
const queue = factory({ maxSize: 10 });
```

### Configuration Objects

```typescript
const CONFIG = Symbol('Config');

container.registerInstance(CONFIG, {
  maxRetries: 3,
  timeout: 5000,
});

container.register(MY_SERVICE, (c) => {
  const config = c.resolve(CONFIG);
  return new MyService(config);
});
```

### Optional Dependencies

```typescript
constructor(
  private eventBus: IEventBus,
  private logger?: ILogger
) {
  this.logger = logger ?? new NullLogger();
}

// Or use tryResolve
const logger = container.tryResolve(LOGGER) ?? new NullLogger();
```

## Performance Considerations

- **Singleton**: Zero overhead after first resolve (cached)
- **Transient**: Small overhead per resolve (factory call)
- **Scoped**: Zero overhead within scope (cached per scope)

## Comparison with Libraries

| Feature        | Our Container | TSyringe         | InversifyJS      |
| -------------- | ------------- | ---------------- | ---------------- |
| Size           | ~200 LOC      | ~15KB            | ~50KB            |
| Dependencies   | Zero          | reflect-metadata | reflect-metadata |
| Decorators     | No            | Yes              | Yes              |
| Async Disposal | Yes           | No               | Partial          |
| Learning Curve | Low           | Medium           | High             |

## FAQ

**Q: Why not use TSyringe or InversifyJS?**
A: They require `reflect-metadata` (runtime overhead) and decorators (experimental). Our lightweight solution fits the project's zero-dependency philosophy.

**Q: Do I need to migrate everything at once?**
A: No! Migrate incrementally. Start with problematic classes (hard to test), then expand.

**Q: What about performance?**
A: Negligible. Singletons are cached after first resolution. The clarity and testability gains far outweigh any minimal overhead.

**Q: Can I use it with existing code?**
A: Yes! You can wrap existing classes without modifying them:

```typescript
container.register(LEGACY_SERVICE, () => {
  const instance = LegacyService.getInstance();
  return instance;
});
```

## Next Steps

1. Read `Container.ts` for implementation details
2. Check `tokens.ts` for available tokens
3. See test examples in `tests/di/` (to be created)
4. Start migrating classes with testing issues

# Backend Architecture (Complete with All Services)

## Service Architecture

```typescript
// Base Service Template with Dependency Injection
export abstract class BaseService {
  protected logger: Logger;
  protected config: ServiceConfig;
  protected dependencies: Map<string, BaseService> = new Map();
  
  constructor(config: ServiceConfig, logger: Logger) {
    this.config = config;
    this.logger = logger;
  }
  
  async initialize(): Promise<void> {
    this.logger.debug(`Initializing ${this.constructor.name}`);
    await this.onInitialize();
  }
  
  async shutdown(): Promise<void> {
    this.logger.debug(`Shutting down ${this.constructor.name}`);
    await this.onShutdown();
  }
  
  inject(name: string, service: BaseService): void {
    this.dependencies.set(name, service);
  }
  
  protected abstract onInitialize(): Promise<void>;
  protected abstract onShutdown(): Promise<void>;
}
```

## Concurrency Manager Implementation

```typescript
export class ConcurrencyManager {
  private locks: Map<string, Lock> = new Map();
  private readonly lockDir = '.checklist/.locks';
  
  async acquireLock(
    resource: string, 
    options: LockOptions = {}
  ): Promise<LockToken> {
    const lockFile = join(this.lockDir, `${resource}.lock`);
    const timeout = options.timeout ?? 5000;
    const retryInterval = options.retryInterval ?? 100;
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const lock: Lock = {
          id: crypto.randomUUID(),
          pid: process.pid,
          hostname: hostname(),
          acquiredAt: new Date(),
          expiresAt: new Date(Date.now() + (options.ttl ?? 60000)),
          resource
        };
        
        await Bun.write(lockFile, JSON.stringify(lock), {
          createPath: false,
          flags: 'wx'
        });
        
        this.locks.set(resource, lock);
        this.startHeartbeat(resource, lock);
        
        return { id: lock.id, resource };
      } catch (error) {
        if (await this.isLockExpired(lockFile)) {
          await this.forceRelease(lockFile);
          continue;
        }
        await Bun.sleep(retryInterval);
      }
    }
    
    throw new LockTimeoutError(`Failed to acquire lock for ${resource}`);
  }
}
```

## Transaction Coordinator

```typescript
export class TransactionCoordinator {
  private activeTransactions: Map<string, Transaction> = new Map();
  
  async beginTransaction(): Promise<Transaction> {
    const txn: Transaction = {
      id: crypto.randomUUID(),
      startedAt: new Date(),
      operations: [],
      snapshot: await this.createSnapshot(),
      status: 'active'
    };
    
    this.activeTransactions.set(txn.id, txn);
    return txn;
  }
  
  async commit(txn: Transaction): Promise<void> {
    if (txn.status !== 'active') {
      throw new TransactionError(`Cannot commit ${txn.status} transaction`);
    }
    
    try {
      await this.validateTransaction(txn);
      await this.applyChanges(txn);
      txn.status = 'committed';
    } catch (error) {
      await this.rollback(txn);
      throw error;
    } finally {
      this.activeTransactions.delete(txn.id);
    }
  }
}
```

## Event Store Implementation

```typescript
export class EventStore {
  private events: DomainEvent[] = [];
  private projections: Map<string, Projection> = new Map();
  
  async append(event: DomainEvent): Promise<void> {
    event.id = crypto.randomUUID();
    event.timestamp = new Date();
    event.version = this.events.length + 1;
    
    await this.validateEvent(event);
    await this.persistEvent(event);
    
    this.events.push(event);
    await this.updateProjections(event);
    
    this.emit('event', event);
  }
  
  async replay(
    from?: Date,
    to?: Date,
    filter?: (event: DomainEvent) => boolean
  ): Promise<DomainEvent[]> {
    let events = this.events;
    
    if (from) events = events.filter(e => e.timestamp >= from);
    if (to) events = events.filter(e => e.timestamp <= to);
    if (filter) events = events.filter(filter);
    
    return events;
  }
}
```

## Dependency Injection Container

```typescript
export class Container {
  private services: Map<string, ServiceDefinition> = new Map();
  private instances: Map<string, any> = new Map();
  
  register<T>(
    name: string,
    factory: () => T,
    options: ServiceOptions = {}
  ): void {
    this.services.set(name, {
      factory,
      singleton: options.singleton ?? true,
      dependencies: options.dependencies ?? [],
      lifecycle: options.lifecycle
    });
  }
  
  async resolve<T>(name: string): Promise<T> {
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }
    
    const definition = this.services.get(name);
    if (!definition) {
      throw new ServiceNotFoundError(name);
    }
    
    const deps = await Promise.all(
      definition.dependencies.map(dep => this.resolve(dep))
    );
    
    const instance = await definition.factory(...deps);
    
    if (definition.lifecycle?.onInit) {
      await definition.lifecycle.onInit(instance);
    }
    
    if (definition.singleton) {
      this.instances.set(name, instance);
    }
    
    return instance;
  }
}
```

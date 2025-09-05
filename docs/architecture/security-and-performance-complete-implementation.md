# Security and Performance (Complete Implementation)

## Template Sandbox Implementation

```typescript
export class TemplateSandbox {
  private readonly allowedModules = new Set(['path', 'url']);
  private readonly blockedGlobals = new Set(['process', 'require', 'eval']);

  async executeTemplate(
    template: string,
    context: Record<string, any>
  ): Promise<string> {
    const sandbox = this.createSandbox(context);
    const ast = this.parseTemplate(template);
    const violations = this.validateAST(ast);
    
    if (violations.length > 0) {
      throw new SandboxViolationError(violations);
    }
    
    return await this.runInSandbox(ast, sandbox);
  }
  
  private createSandbox(context: Record<string, any>): any {
    const sandbox = {
      console: {
        log: (...args: any[]) => this.log('info', args),
        error: (...args: any[]) => this.log('error', args),
      },
      Math,
      Date: { now: Date.now, parse: Date.parse },
      JSON: { parse: JSON.parse, stringify: JSON.stringify },
      ...context
    };

    return Object.freeze(sandbox);
  }
}
```

## Resource Limiter

```typescript
export class ResourceLimiter {
  private readonly limits = {
    executionTime: 5000,
    memoryDelta: 10485760,
    cpuUsage: 80,
    fileHandles: 10,
    processCount: 0
  };

  async executeWithLimits<T>(
    operation: () => Promise<T>,
    customLimits?: Partial<typeof this.limits>
  ): Promise<T> {
    const limits = { ...this.limits, ...customLimits };
    const monitor = this.startMonitoring(limits);
    const timeout = setTimeout(() => {
      throw new TimeoutError(`Operation exceeded ${limits.executionTime}ms`);
    }, limits.executionTime);
    
    try {
      const result = await operation();
      const usage = monitor.getUsage();
      
      if (usage.memoryDelta > limits.memoryDelta) {
        throw new MemoryLimitError(`Memory usage exceeded: ${usage.memoryDelta}`);
      }
      
      return result;
    } finally {
      clearTimeout(timeout);
      monitor.stop();
    }
  }
}
```

## Cryptographic Security

```typescript
export class CryptoManager {
  private readonly algorithm = 'aes-256-gcm';
  private key: Buffer;
  
  constructor() {
    this.key = this.deriveKey();
  }
  
  createIntegrityHash(data: string): string {
    const hmac = createHmac('sha256', this.key);
    hmac.update(data);
    return hmac.digest('hex');
  }
  
  verifyIntegrity(data: string, hash: string): boolean {
    const computed = this.createIntegrityHash(data);
    return this.timingSafeEqual(computed, hash);
  }
  
  encrypt(text: string): EncryptedData {
    const iv = randomBytes(16);
    const cipher = createCipheriv(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: cipher.getAuthTag().toString('hex')
    };
  }
}
```

## Audit Logger

```typescript
export class AuditLogger {
  private readonly logFile = '.checklist/audit.log';
  
  async logSecurityEvent(event: SecurityEvent): Promise<void> {
    const entry: AuditEntry = {
      timestamp: new Date().toISOString(),
      type: event.type,
      severity: event.severity,
      user: process.env.USER || 'unknown',
      pid: process.pid,
      details: event.details,
      stackTrace: event.includeStack ? new Error().stack : undefined
    };
    
    const integrity = this.crypto.createIntegrityHash(JSON.stringify(entry));
    entry.integrity = integrity;
    
    await this.appendToLog(entry);
    
    if (event.severity === 'critical') {
      await this.alertCriticalEvent(entry);
    }
  }
  
  async queryAuditLog(filter: AuditFilter): Promise<AuditEntry[]> {
    const content = await Bun.file(this.logFile).text();
    const lines = content.split('\n').filter(l => l.length > 0);
    const entries: AuditEntry[] = [];
    
    for (const line of lines) {
      const entry = JSON.parse(line);
      const integrity = entry.integrity;
      delete entry.integrity;
      
      if (!this.crypto.verifyIntegrity(JSON.stringify(entry), integrity)) {
        console.warn('⚠️ Audit log entry tampering detected');
        continue;
      }
      
      if (this.matchesFilter(entry, filter)) {
        entries.push(entry);
      }
    }
    
    return entries;
  }
}
```

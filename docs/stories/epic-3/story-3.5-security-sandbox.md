# Story 3.5: Security Sandbox

## Overview

Implement a secure sandbox environment for template execution that prevents malicious operations, restricts resource access, and ensures safe template operation.

## Story Details

- **Epic**: 3 - Template System & Security
- **Type**: Feature
- **Priority**: Critical
- **Estimated Effort**: 2 days
- **Dependencies**: [3.1, 3.3]

## Description

Create a comprehensive security sandbox that isolates template execution, prevents file system access outside designated areas, blocks network calls, prevents command execution, and enforces resource limits.

## Security Threat Model

### Threat Categories

| Threat                     | Risk Level | Impact                    | Mitigation                             |
| -------------------------- | ---------- | ------------------------- | -------------------------------------- |
| **Code Injection**         | Critical   | Remote code execution     | Sandbox execution, no eval()           |
| **Path Traversal**         | High       | Access sensitive files    | Path validation, chroot to .checklist/ |
| **Command Injection**      | Critical   | System compromise         | Block shell commands, whitelist only   |
| **Resource Exhaustion**    | Medium     | DoS, system hang          | CPU/Memory limits, timeouts            |
| **Data Exfiltration**      | High       | Sensitive data leak       | Block network access                   |
| **Privilege Escalation**   | Critical   | Admin access              | Run with minimal privileges            |
| **Template Poisoning**     | High       | Malicious template spread | Template validation, signing           |
| **Supply Chain**           | Medium     | Compromised dependencies  | Dependency scanning, vendoring         |
| **Information Disclosure** | Medium     | Leak system info          | Sanitize error messages                |
| **TOCTOU**                 | Low        | Race conditions           | Atomic operations                      |

### Attack Vectors

1. **Malicious Template Import**
   - User imports template with embedded malicious code
   - Mitigation: Template validation, sandboxed execution

2. **Expression Injection**
   - Attacker crafts expression to escape sandbox
   - Mitigation: AST validation, no eval()

3. **Resource Bombing**
   - Template consumes excessive resources
   - Mitigation: Hard limits, kill switches

4. **File System Attack**
   - Template attempts to read/write sensitive files
   - Mitigation: Strict path validation, permissions

5. **Network Exfiltration**
   - Template attempts to send data externally
   - Mitigation: Network isolation

### Security Controls

| Control           | Implementation             | Priority |
| ----------------- | -------------------------- | -------- |
| Input Validation  | Strict schema validation   | P0       |
| Sandboxing        | VM2 or similar isolation   | P0       |
| Resource Limits   | Memory/CPU/Time caps       | P0       |
| Audit Logging     | All security events logged | P0       |
| Least Privilege   | Minimal permissions        | P0       |
| Defense in Depth  | Multiple security layers   | P1       |
| Security Headers  | CSP, HSTS where applicable | P1       |
| Regular Updates   | Dependency updates         | P1       |
| Security Testing  | Penetration testing        | P2       |
| Incident Response | Security playbooks         | P2       |

## Acceptance Criteria

- [ ] Restrict file system access to .checklist/ directory only
- [ ] Block all network calls from templates
- [ ] Prevent shell command execution
- [ ] Enforce memory limits (max 50MB per template)
- [ ] Enforce CPU time limits (max 5s per operation)
- [ ] Prevent access to process and system APIs
- [ ] Safe expression evaluation without eval()
- [ ] Audit log of security violations
- [ ] Graceful handling of sandbox violations
- [ ] Configurable security policies

## Technical Requirements

### Sandbox Architecture

```typescript
interface SecuritySandbox {
  // Sandbox Execution
  execute<T>(fn: () => T, policy?: SecurityPolicy): T;
  executeTemplate(template: Template, context: Context): ExecutionResult;

  // Security Policies
  setPolicy(policy: SecurityPolicy): void;
  getPolicy(): SecurityPolicy;
  validatePolicy(policy: SecurityPolicy): boolean;

  // Monitoring
  getViolations(): SecurityViolation[];
  clearViolations(): void;
  onViolation(handler: ViolationHandler): void;

  // Resource Management
  checkResourceLimits(): ResourceStatus;
  resetResources(): void;
}

interface SecurityPolicy {
  filesystem: {
    enabled: boolean;
    allowedPaths: string[];
    maxFileSize: number;
    allowedOperations: ('read' | 'write' | 'delete')[];
  };

  network: {
    enabled: boolean;
    allowedHosts: string[];
    allowedProtocols: string[];
  };

  execution: {
    allowCommands: boolean;
    allowedCommands: string[];
    timeout: number;
    maxMemory: number;
    maxCPU: number;
  };

  apis: {
    allowedGlobals: string[];
    blockedModules: string[];
    allowedBuiltins: string[];
  };
}

interface SecurityViolation {
  type: ViolationType;
  message: string;
  timestamp: Date;
  context: {
    template?: string;
    item?: string;
    expression?: string;
    stackTrace?: string;
  };
  severity: 'low' | 'medium' | 'high' | 'critical';
}
```

### Sandbox Implementation

#### File System Sandboxing

```typescript
class FileSystemSandbox {
  private readonly baseDir = '.checklist';

  read(path: string): string {
    const resolved = this.resolvePath(path);

    // Check if path is within allowed directory
    if (!this.isAllowed(resolved)) {
      throw new SecurityViolation({
        type: 'filesystem',
        message: `Access denied: ${path} is outside sandbox`,
        severity: 'high',
      });
    }

    // Check file size
    const stats = fs.statSync(resolved);
    if (stats.size > this.policy.maxFileSize) {
      throw new SecurityViolation({
        type: 'filesystem',
        message: `File too large: ${stats.size} bytes`,
        severity: 'medium',
      });
    }

    return fs.readFileSync(resolved, 'utf-8');
  }

  private resolvePath(path: string): string {
    // Resolve and normalize path
    const resolved = path.resolve(this.baseDir, path);

    // Prevent path traversal
    if (resolved.includes('..')) {
      throw new SecurityViolation({
        type: 'path_traversal',
        message: 'Path traversal attempt detected',
        severity: 'critical',
      });
    }

    return resolved;
  }

  private isAllowed(path: string): boolean {
    const normalized = path.normalize(path);
    return normalized.startsWith(this.baseDir);
  }
}
```

#### Expression Sandbox

```typescript
class ExpressionSandbox {
  evaluate(expression: string, context: Context): any {
    // Create sandboxed context
    const sandbox = this.createSandbox(context);

    try {
      // Use safe expression evaluator (no eval!)
      const ast = this.parser.parse(expression);
      return this.evaluateAST(ast, sandbox);
    } catch (error) {
      this.handleViolation(error, expression);
      throw error;
    }
  }

  private createSandbox(context: Context): SandboxContext {
    // Create proxy to intercept dangerous operations
    return new Proxy(context, {
      get: (target, prop) => {
        // Block access to dangerous properties
        if (this.isDangerous(prop)) {
          throw new SecurityViolation({
            type: 'api_access',
            message: `Access to '${String(prop)}' is blocked`,
            severity: 'high',
          });
        }

        return target[prop];
      },

      set: (target, prop, value) => {
        // Prevent modification of critical properties
        if (this.isProtected(prop)) {
          throw new SecurityViolation({
            type: 'modification',
            message: `Cannot modify '${String(prop)}'`,
            severity: 'medium',
          });
        }

        target[prop] = value;
        return true;
      },
    });
  }

  private isDangerous(prop: string | symbol): boolean {
    const dangerous = [
      'process',
      'require',
      'eval',
      'Function',
      '__proto__',
      'constructor',
      'prototype',
    ];
    return dangerous.includes(String(prop));
  }
}
```

#### Resource Limiting

```typescript
class ResourceLimiter {
  private startTime: number;
  private memoryBaseline: number;

  startOperation() {
    this.startTime = Date.now();
    this.memoryBaseline = process.memoryUsage().heapUsed;

    // Set timeout
    this.timeout = setTimeout(() => {
      throw new SecurityViolation({
        type: 'timeout',
        message: 'Operation exceeded time limit',
        severity: 'high',
      });
    }, this.policy.execution.timeout);
  }

  checkLimits() {
    // Check time limit
    const elapsed = Date.now() - this.startTime;
    if (elapsed > this.policy.execution.timeout) {
      throw new SecurityViolation({
        type: 'timeout',
        message: `Operation took ${elapsed}ms (limit: ${this.policy.execution.timeout}ms)`,
        severity: 'high',
      });
    }

    // Check memory limit
    const memoryUsed = process.memoryUsage().heapUsed - this.memoryBaseline;
    if (memoryUsed > this.policy.execution.maxMemory) {
      throw new SecurityViolation({
        type: 'memory',
        message: `Memory usage ${memoryUsed} exceeds limit`,
        severity: 'high',
      });
    }
  }

  endOperation() {
    clearTimeout(this.timeout);
  }
}
```

### Security Audit Log

```
Security Audit Log
══════════════════

[2024-01-04 10:30:45] HIGH: Path traversal attempt
  Template: user-template.yaml
  Item: cleanup-task
  Path: ../../etc/passwd
  Action: Blocked

[2024-01-04 10:31:02] MEDIUM: Resource limit exceeded
  Template: complex-workflow.yaml
  Memory: 52MB (limit: 50MB)
  Action: Terminated

[2024-01-04 10:31:15] CRITICAL: Command execution attempt
  Template: malicious.yaml
  Command: rm -rf /
  Action: Blocked and reported

Summary: 3 violations in last hour
Status: Sandbox integrity maintained
```

## Testing Requirements

- [ ] Path traversal prevention tests
- [ ] Resource limit enforcement tests
- [ ] API access blocking tests
- [ ] Expression sandbox tests
- [ ] Network blocking tests
- [ ] Command execution prevention tests
- [ ] Violation logging tests
- [ ] Policy configuration tests
- [ ] Performance impact tests

## Security Considerations

- Regular security audits of sandbox
- Keep sandbox implementation updated
- Monitor for bypass attempts
- Log all violations for analysis
- Fail closed (deny by default)

## Definition of Done

- [ ] File system sandbox implemented
- [ ] Expression sandbox complete
- [ ] Resource limiting functional
- [ ] Network calls blocked
- [ ] Command execution prevented
- [ ] Violation logging working
- [ ] Policy system configurable
- [ ] Tests passing with >95% coverage
- [ ] Security review completed
- [ ] Performance impact <5%

/**
 * Template-specific error classes for the template loading and execution system
 * Provides clear, actionable error messages with structured context
 */

export interface ErrorContext {
  templatePath?: string;
  templateId?: string;
  errorCode?: string;
  details?: Record<string, unknown>;
  recovery?: string;
}

/**
 * Base class for all template-related errors
 */
export abstract class TemplateError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly recoverable: boolean = false,
    public readonly context?: ErrorContext
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      recoverable: this.recoverable,
      context: this.context,
      stack: this.stack,
    };
  }
}

/**
 * Error thrown when template loading fails
 */
export class TemplateLoadError extends TemplateError {
  constructor(templatePath: string, reason: string, originalError?: Error) {
    const message = `Failed to load template from "${templatePath}": ${reason}`;
    const recovery = TemplateLoadError.getRecoveryStrategy(reason);

    super(message, 'TEMPLATE_LOAD_ERROR', true, {
      templatePath,
      details: { reason, originalError: originalError?.message },
      recovery,
    });
  }

  private static getRecoveryStrategy(reason: string): string {
    if (reason.includes('not found') || reason.includes('ENOENT')) {
      return 'Ensure the template file exists in the /templates directory';
    }
    if (reason.includes('permission') || reason.includes('EACCES')) {
      return 'Check file permissions for the template file';
    }
    if (reason.includes('parse') || reason.includes('YAML')) {
      return 'Verify the template file has valid YAML syntax';
    }
    return 'Review the template file and error details';
  }
}

/**
 * Error thrown when template schema validation fails
 */
export class TemplateValidationError extends TemplateError {
  constructor(
    templateId: string,
    violations: string[],
    context?: Record<string, unknown>
  ) {
    const message = `Template validation failed for "${templateId}":\n${violations.map((v) => `  - ${v}`).join('\n')}`;
    const recovery = 'Review and fix the validation errors in the template';

    super(message, 'TEMPLATE_VALIDATION_ERROR', true, {
      templateId,
      details: { violations, ...context },
      recovery,
    });
  }
}

/**
 * Error thrown when sandbox security violations are detected
 */
export class SandboxViolationError extends TemplateError {
  constructor(
    templateId: string,
    violation: string,
    details?: Record<string, unknown>
  ) {
    const message = `Sandbox security violation in template "${templateId}": ${violation}`;
    const recovery = 'Remove the dangerous operation from the template';

    super(message, 'SANDBOX_VIOLATION_ERROR', false, {
      templateId,
      details: { violation, ...details },
      recovery,
    });
  }
}

/**
 * Error thrown when network access is attempted in sandbox
 */
export class NetworkAccessError extends TemplateError {
  constructor(
    templateId: string,
    resource: string,
    details?: Record<string, unknown>
  ) {
    const message = `Network access blocked in template "${templateId}": ${resource}`;
    const recovery = 'Templates should not access network resources';

    super(message, 'NETWORK_ACCESS_ERROR', false, {
      templateId,
      details: { resource, ...details },
      recovery,
    });
  }
}

/**
 * Error thrown when template execution exceeds time limit
 */
export class TimeoutError extends TemplateError {
  constructor(templateId: string, timeoutMs: number, operation?: string) {
    const opInfo = operation !== undefined ? ` during ${operation}` : '';
    const message = `Template "${templateId}" execution timeout${opInfo} (limit: ${timeoutMs}ms)`;
    const recovery =
      'Simplify the template logic or increase the timeout limit';

    super(message, 'TIMEOUT_ERROR', false, {
      templateId,
      details: { timeoutMs, operation },
      recovery,
    });
  }
}

/**
 * Error thrown when template execution exceeds memory limit
 */
export class MemoryLimitError extends TemplateError {
  constructor(templateId: string, memoryUsed: number, memoryLimit: number) {
    const message = `Template "${templateId}" exceeded memory limit: ${(memoryUsed / 1024 / 1024).toFixed(2)}MB (limit: ${(memoryLimit / 1024 / 1024).toFixed(2)}MB)`;
    const recovery =
      'Reduce memory usage in the template or increase the limit';

    super(message, 'MEMORY_LIMIT_ERROR', false, {
      templateId,
      details: { memoryUsed, memoryLimit },
      recovery,
    });
  }
}

/**
 * Error thrown when template inheritance chain has issues
 */
export class TemplateInheritanceError extends TemplateError {
  constructor(
    templateId: string,
    issue: string,
    context?: Record<string, unknown>
  ) {
    let message = `Template inheritance error in "${templateId}": ${issue}`;

    // If chain is provided in context, format it in the message
    if (context?.chain !== undefined && Array.isArray(context.chain)) {
      const chain = context.chain as string[];
      message += `\nInheritance chain: ${chain.join(' → ')}`;
    }

    const recovery =
      'Check the template inheritance configuration and resolve circular dependencies';

    super(message, 'TEMPLATE_INHERITANCE_ERROR', true, {
      templateId,
      details: { issue, ...context },
      recovery,
    });
  }
}

/**
 * Error thrown when template cache operations fail
 */
export class TemplateCacheError extends TemplateError {
  constructor(
    operation: string,
    reason: string,
    context?: Record<string, unknown>
  ) {
    const message = `Template cache ${operation} failed: ${reason}`;
    const recovery = 'Clear the template cache and reload';

    super(message, 'TEMPLATE_CACHE_ERROR', true, {
      details: { operation, reason, ...context },
      recovery,
    });
  }
}

/**
 * Error thrown when resource limits are exceeded
 */
export class ResourceLimitError extends TemplateError {
  constructor(
    resourceType: string,
    used: number,
    limit: number,
    templateId?: string
  ) {
    const templateInfo =
      templateId !== undefined ? ` in template "${templateId}"` : '';
    const message = `Resource limit exceeded${templateInfo}: ${resourceType} used ${used}, limit ${limit}`;
    const recovery = `Reduce ${resourceType} usage or increase the limit`;

    super(message, 'RESOURCE_LIMIT_ERROR', false, {
      templateId,
      details: { resourceType, used, limit },
      recovery,
    });
  }
}

/**
 * Utility function to create error with structured logging context
 */
export function createTemplateError(
  ErrorClass: new (...args: unknown[]) => TemplateError,
  ...args: unknown[]
): TemplateError {
  const error = new ErrorClass(...args);

  // Add timestamp for logging
  if (error.context) {
    error.context.details = {
      ...error.context.details,
      timestamp: new Date().toISOString(),
    };
  }

  return error;
}

/**
 * Type guard to check if error is a TemplateError
 */
export function isTemplateError(error: unknown): error is TemplateError {
  return error instanceof TemplateError;
}

/**
 * Extract recovery suggestion from error
 */
export function getRecoverySuggestion(error: unknown): string | undefined {
  if (isTemplateError(error)) {
    return error.context?.recovery;
  }
  return undefined;
}

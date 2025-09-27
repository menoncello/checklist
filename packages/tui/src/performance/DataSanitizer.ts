export interface DataSanitizerConfig {
  enabled: boolean;
  sanitizeStackTraces: boolean;
  sanitizeMetadata: boolean;
  redactPatterns: (string | RegExp)[];
  customRedactors?: RedactorFunction[];
}

export type RedactorFunction = (data: string) => string;

export class DataSanitizer {
  private static readonly SANITIZATION_PATTERNS = [
    {
      regex: /password\s*[:=]\s*["']([^"']+)["']/gi,
      replacement: 'password: "[REDACTED]"',
    },
    {
      regex: /api[_-]?key\s*[:=]\s*["']([a-zA-Z0-9]+)["']/gi,
      replacement: 'api_key: "[REDACTED]"',
    },
    {
      regex: /(Bearer|bearer)\s+([a-zA-Z0-9\-._~+\/]+=*)/gi,
      replacement: '$1 [REDACTED]',
    },
    {
      regex: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
      replacement: '[REDACTED]',
    },
    {
      regex: /(mongodb|postgres|mysql):\/\/[^:]+:[^@]+@/gi,
      replacement: '$1://[REDACTED]@',
    },
    {
      regex: /\b(eyJ[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*\.[a-zA-Z0-9_-]*)\b/g,
      replacement: '[REDACTED]',
    },
    {
      regex: /(secret|private[_-]?key)\s*[:=]\s*["']([^"']+)["']/gi,
      replacement: '$1: "[REDACTED]"',
    },
    {
      regex: /\b(password|passwd|pwd)\s*[:=]\s*([^\s;]+)/gi,
      replacement: '$1: [REDACTED]',
    },
    {
      regex: /\b(password\d+|passwd\d+|pwd\d+)\b/gi,
      replacement: '[REDACTED]',
    },
  ];
  private config: DataSanitizerConfig;
  private defaultPatterns: RegExp[] = DataSanitizer.SANITIZATION_PATTERNS.map(
    (p) => p.regex
  );

  constructor(config?: Partial<DataSanitizerConfig>) {
    this.config = {
      enabled: true,
      sanitizeStackTraces: true,
      sanitizeMetadata: true,
      redactPatterns: [],
      ...config,
    };

    // Combine default patterns with custom ones
    this.config.redactPatterns = [
      ...this.defaultPatterns,
      ...(config?.redactPatterns ?? []),
    ];
  }

  public sanitizeStackTrace(stackTrace: string): string {
    if (!this.config.enabled || !this.config.sanitizeStackTraces) {
      return stackTrace;
    }

    let sanitized = stackTrace;

    // Apply all redaction patterns
    for (const pattern of this.config.redactPatterns) {
      sanitized = sanitized.replace(pattern, '[REDACTED]');
    }

    // Remove file paths that might contain user information
    sanitized = sanitized.replace(
      /\/(Users|home)\/[^\/]+\/.+\/([^\/]+)\.ts:(\d+):(\d+)/g,
      '/[PATH]/[FILE].ts:$3:$4'
    );
    sanitized = sanitized.replace(
      /\\Users\\[^\\]+\\.+\\([^\\]+)\.ts:(\d+):(\d+)/g,
      '\\[PATH]\\[FILE].ts:$2:$3'
    );

    // Apply custom redactors
    if (this.config.customRedactors) {
      for (const redactor of this.config.customRedactors) {
        sanitized = redactor(sanitized);
      }
    }

    return sanitized;
  }

  public sanitizeMetadata(
    metadata: Record<string, unknown>
  ): Record<string, unknown> {
    if (!this.shouldSanitizeMetadata() || metadata == null) {
      return metadata;
    }

    const sanitized: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      sanitized[key] = this.sanitizeMetadataValue(key, value);
    }

    return sanitized;
  }

  private shouldSanitizeMetadata(): boolean {
    return this.config.enabled && this.config.sanitizeMetadata === true;
  }

  private sanitizeMetadataValue(key: string, value: unknown): unknown {
    if (this.isSensitiveKey(key)) {
      return '[REDACTED]';
    }

    if (this.isObject(value)) {
      return this.sanitizeMetadata(value as Record<string, unknown>);
    }

    if (typeof value === 'string') {
      return this.sanitizeString(value);
    }

    if (Array.isArray(value)) {
      return value.map((item) =>
        typeof item === 'string' ? this.sanitizeString(item) : item
      );
    }

    return value;
  }

  private isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  public sanitizeString(input: string): string {
    if (!this.config.enabled) return input;

    let sanitized = input;
    sanitized = this.applyRegexPatterns(sanitized);
    sanitized = this.applyCustomPatterns(sanitized);
    sanitized = this.applyTokenPattern(sanitized);

    return sanitized;
  }

  private applyRegexPatterns(input: string): string {
    return DataSanitizer.SANITIZATION_PATTERNS.reduce(
      (result, pattern) => result.replace(pattern.regex, pattern.replacement),
      input
    );
  }

  private applyCustomPatterns(input: string): string {
    let result = input;
    for (const pattern of this.config.redactPatterns) {
      result = result.replace(pattern, '[REDACTED]');
    }
    if (this.config.customRedactors) {
      for (const redactor of this.config.customRedactors) {
        result = redactor(result);
      }
    }
    return result;
  }

  public sanitizeMetricData(data: {
    name?: string;
    tags?: Record<string, string>;
    metadata?: Record<string, unknown>;
  }): void {
    if (!this.config.enabled) {
      return;
    }

    if (data.tags) {
      data.tags = this.sanitizeTags(data.tags);
    }

    if (data.metadata) {
      data.metadata = this.sanitizeMetadata(data.metadata);
    }
  }

  private sanitizeTags(tags: Record<string, string>): Record<string, string> {
    const sanitized: Record<string, string> = {};

    for (const [key, value] of Object.entries(tags)) {
      if (this.isSensitiveKey(key)) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = this.sanitizeString(value);
      }
    }

    return sanitized;
  }

  private isSensitiveKey(key: string): boolean {
    const sensitivePatterns = [
      /password/i,
      /secret/i,
      /token/i,
      /key/i,
      /auth/i,
      /credential/i,
      /api[_-]?key/i,
      /private[_-]?key/i,
      /access[_-]?key/i,
      /session/i,
      /cookie/i,
      /authorization/i,
      /bearer/i,
      /jwt/i,
      /user/i,
      /email/i,
      /phone/i,
      /credit/i,
      /card/i,
      /account/i,
      /database/i,
      /connection/i,
      /url/i,
      /endpoint/i,
    ];

    return sensitivePatterns.some((pattern) => pattern.test(key));
  }

  private applyTokenPattern(input: string): string {
    return input
      .replace(/token_\d+/gi, '[REDACTED_TOKEN]')
      .replace(/_secret\b/gi, '_[REDACTED]');
  }

  public addCustomRedactor(redactor: RedactorFunction): void {
    this.config.customRedactors ??= [];
    this.config.customRedactors.push(redactor);
  }

  public addCustomPattern(pattern: string | RegExp): void {
    if (typeof pattern === 'string') {
      try {
        pattern = new RegExp(pattern, 'gi');
      } catch (_error) {
        console.warn(`[DataSanitizer] Invalid regex pattern: ${pattern}`);
        return;
      }
    }
    this.config.redactPatterns.push(pattern);
  }

  public getConfig(): DataSanitizerConfig {
    return { ...this.config };
  }

  public updateConfig(newConfig: Partial<DataSanitizerConfig>): void {
    this.config = { ...this.config, ...newConfig };

    if (newConfig.redactPatterns) {
      this.config.redactPatterns = [
        ...this.defaultPatterns,
        ...newConfig.redactPatterns,
      ];
    }
  }

  public testSanitization(text: string): {
    original: string;
    sanitized: string;
    changesDetected: boolean;
  } {
    const sanitized = this.sanitizeString(text);
    return { original: text, sanitized, changesDetected: sanitized !== text };
  }

  public getSensitivePatterns(): (string | RegExp)[] {
    return [...this.defaultPatterns];
  }

  public isDataSensitive(text: string): boolean {
    return this.testSanitization(text).changesDetected;
  }

  public sanitizeMetric(
    metric: Record<string, unknown>
  ): Record<string, unknown> {
    const copy = JSON.parse(JSON.stringify(metric));
    this.sanitizeMetricData(copy);
    return copy;
  }

  public sanitizeReport(
    report: Record<string, unknown>
  ): Record<string, unknown> {
    const sanitizeObject = (obj: unknown): unknown => {
      if (typeof obj !== 'object' || obj === null) return obj;
      if (Array.isArray(obj)) return obj.map(sanitizeObject);

      const result: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(
        obj as Record<string, unknown>
      )) {
        if (typeof value === 'string') result[key] = this.sanitizeString(value);
        else if (typeof value === 'object' && value !== null)
          result[key] = sanitizeObject(value);
        else result[key] = value;
      }
      return result;
    };

    return sanitizeObject(report) as Record<string, unknown>;
  }
}

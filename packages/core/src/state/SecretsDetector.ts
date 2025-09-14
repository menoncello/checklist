/**
 * Secrets detection for state files
 * Prevents accidental credential leakage in state persistence
 */

export class SecretsDetector {
  private static readonly patterns: Array<{ name: string; regex: RegExp }> = [
    // API Keys and Tokens
    {
      name: 'API Key',
      regex:
        /(?:api[_-]?key|apikey|api[_-]?secret)[\s:=]*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    },
    {
      name: 'Auth Token',
      regex:
        /(?:auth[_-]?token|access[_-]?token|bearer[_-]?token)[\s:=]*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    },
    // AWS Credentials
    {
      name: 'AWS Access Key',
      regex: /(?:AKIA|A3T|AGPA|AIDA|AROA|AIPA|ANPA|ANVA|ASIA)[A-Z0-9]{16}/g,
    },
    {
      name: 'AWS Secret Key',
      regex:
        /aws[_-]?secret[_-]?access[_-]?key[\s:=]*['"]?([a-zA-Z0-9/+=]{40})['"]?/gi,
    },
    // Database URLs
    {
      name: 'Database URL',
      regex: /(?:postgres|mysql|mongodb|redis|sqlite):\/\/[^:]+:[^@]+@[^\s]+/gi,
    },
    // SSH Keys
    {
      name: 'SSH Private Key',
      regex: /-----BEGIN (?:RSA |DSA |EC |OPENSSH )?PRIVATE KEY-----/gi,
    },
    // GitHub/GitLab Tokens
    {
      name: 'GitHub Token',
      regex: /(?:ghp|gho|ghu|ghs|ghr)_[a-zA-Z0-9]{36}/g,
    },
    {
      name: 'GitLab Token',
      regex: /glpat-[a-zA-Z0-9\-_]{20}/g,
    },
    // Generic Secrets
    {
      name: 'Generic Secret',
      regex:
        /(?:secret|password|passwd|pwd|pass)[\s:=]*['"]?([^\s'"]{8,})['"]?/gi,
    },
    {
      name: 'Private Key',
      regex:
        /(?:private[_-]?key|priv[_-]?key)[\s:=]*['"]?([a-zA-Z0-9/+=]{20,})['"]?/gi,
    },
    // OAuth
    {
      name: 'OAuth Client Secret',
      regex:
        /(?:client[_-]?secret|client[_-]?id)[\s:=]*['"]?([a-zA-Z0-9_-]{20,})['"]?/gi,
    },
    // Slack
    {
      name: 'Slack Token',
      regex: /xox[baprs]-[0-9]{10,12}-[0-9]{10,12}-[a-zA-Z0-9]{24}/g,
    },
    // Stripe
    {
      name: 'Stripe Key',
      regex: /(?:sk|pk)_(?:test|live)_[a-zA-Z0-9]{24,}/g,
    },
    // JWT
    {
      name: 'JWT Token',
      regex: /eyJ[a-zA-Z0-9_-]+\.eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+/g,
    },
  ];

  /**
   * Scan content for potential secrets
   * @param content - The content to scan
   * @returns Array of detected secrets with their types and positions
   */
  public static scan(content: string): Array<{
    type: string;
    match: string;
    line: number;
    column: number;
  }> {
    const detectedSecrets: Array<{
      type: string;
      match: string;
      line: number;
      column: number;
    }> = [];

    for (const pattern of this.patterns) {
      this.scanPattern(content, pattern, detectedSecrets);
    }

    return detectedSecrets;
  }

  private static scanPattern(
    content: string,
    pattern: { name: string; regex: RegExp },
    detectedSecrets: Array<{
      type: string;
      match: string;
      line: number;
      column: number;
    }>
  ): void {
    pattern.regex.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = pattern.regex.exec(content)) !== null) {
      const secretMatch = this.extractSecretMatch(match);

      if (this.isValidSecret(secretMatch)) {
        const position = this.getLineColumn(content, match.index);
        this.addDetectedSecret(detectedSecrets, pattern.name, secretMatch, position);
      }
    }
  }

  private static extractSecretMatch(match: RegExpExecArray): string {
    return match[1] || match[0];
  }

  private static isValidSecret(secretMatch: string): boolean {
    return !this.isFalsePositive(secretMatch);
  }

  private static addDetectedSecret(
    detectedSecrets: Array<{
      type: string;
      match: string;
      line: number;
      column: number;
    }>,
    type: string,
    secretMatch: string,
    position: { line: number; column: number }
  ): void {
    detectedSecrets.push({
      type,
      match: this.redact(secretMatch),
      line: position.line,
      column: position.column,
    });
  }

  /**
   * Check if content contains any secrets
   * @param content - The content to check
   * @returns true if secrets are detected
   */
  public static hasSecrets(content: string): boolean {
    return this.scan(content).length > 0;
  }

  /**
   * Get line and column position from index
   */
  private static getLineColumn(
    content: string,
    index: number
  ): { line: number; column: number } {
    const lines = content.substring(0, index).split('\n');
    return {
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    };
  }

  /**
   * Redact sensitive parts of the secret for logging
   */
  private static redact(secret: string): string {
    if (secret.length <= 8) {
      return '***REDACTED***';
    }
    const visibleLength = Math.min(4, Math.floor(secret.length / 4));
    return (
      secret.substring(0, visibleLength) +
      '*'.repeat(secret.length - visibleLength * 2) +
      secret.substring(secret.length - visibleLength)
    );
  }

  /**
   * Check if a match is likely a false positive
   */
  private static isFalsePositive(match: string): boolean {
    const falsePositives = [
      'password123',
      'secret123',
      'changeme',
      'your_password',
      'your_secret',
      'example',
      'sample',
      'placeholder',
      'dummy',
      'test123',
      'default',
      '<password>',
      '<secret>',
      '${',
      '{{',
      'undefined',
      'null',
      'true',
      'false',
    ];

    const lowerMatch = match.toLowerCase();
    return falsePositives.some((fp) => lowerMatch.includes(fp));
  }

  /**
   * Create a detailed error message for detected secrets
   */
  public static createErrorMessage(
    detectedSecrets: Array<{
      type: string;
      match: string;
      line: number;
      column: number;
    }>
  ): string {
    const secretsByType = new Map<string, number>();

    for (const secret of detectedSecrets) {
      secretsByType.set(secret.type, (secretsByType.get(secret.type) ?? 0) + 1);
    }

    const summary = Array.from(secretsByType.entries())
      .map(([type, count]) => `${count} ${type}${count > 1 ? 's' : ''}`)
      .join(', ');

    const locations = detectedSecrets
      .slice(0, 5) // Show first 5 locations
      .map(
        (s) => `  - ${s.type} at line ${s.line}, column ${s.column}: ${s.match}`
      )
      .join('\n');

    return (
      `Detected potential secrets in state content:\n` +
      `Summary: ${summary}\n` +
      `Locations:\n${locations}` +
      (detectedSecrets.length > 5
        ? `\n  ... and ${detectedSecrets.length - 5} more`
        : '')
    );
  }
}

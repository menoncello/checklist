/**
 * Repository URL validation for security
 * Prevents malicious URL attacks and validates repository URLs
 */

import { createLogger } from '../../utils/logger';

const logger = createLogger('checklist:templates:url-validator');

/**
 * Security error for repository URL validation failures
 */
export class RepositorySecurityError extends Error {
  constructor(
    message: string,
    public readonly url: string
  ) {
    super(message);
    this.name = 'RepositorySecurityError';
  }
}

/**
 * Checks if protocol is dangerous
 */
function isDangerousProtocol(protocol: string): boolean {
  const dangerous = ['file:', 'javascript:', 'data:', 'ftp:'];
  return dangerous.includes(protocol);
}

/**
 * Checks if protocol is allowed
 */
function isAllowedProtocol(protocol: string): boolean {
  const allowed = ['https:', 'http:', 'git:'];
  return allowed.includes(protocol);
}

/**
 * Validates SSH URL format
 */
function validateSshUrl(url: string): void {
  const sshPattern = /^git@[\w.-]+:[\w/-]+\.git$/;
  if (!sshPattern.test(url)) {
    throw new RepositorySecurityError(
      'Invalid SSH URL format. Expected: git@host:user/repo.git',
      url
    );
  }

  logger.info({
    msg: 'SSH repository URL validated',
    url: url.replace(/git@([\w.-]+):.*/, 'git@$1:***'),
  });
}

/**
 * Validates HTTP/HTTPS/Git URL
 */
function validateHttpUrl(url: string): void {
  const parsed = new URL(url);

  if (isDangerousProtocol(parsed.protocol)) {
    throw new RepositorySecurityError(
      `Protocol ${parsed.protocol} is not allowed for security reasons. Use https:// or git@ instead.`,
      url
    );
  }

  if (!isAllowedProtocol(parsed.protocol)) {
    throw new RepositorySecurityError(
      `Protocol ${parsed.protocol} is not supported. Use https://, http://, or git:// only.`,
      url
    );
  }

  logger.info({
    msg: 'Repository URL validated',
    protocol: parsed.protocol,
    host: parsed.host,
  });
}

/**
 * Validates repository URL to prevent security vulnerabilities
 * Rejects dangerous protocols and validates URL format
 *
 * @param url - Repository URL to validate
 * @throws RepositorySecurityError if URL is invalid or dangerous
 */
export function validateRepositoryUrl(url: string): void {
  if (url.startsWith('git@')) {
    validateSshUrl(url);
    return;
  }

  try {
    validateHttpUrl(url);
  } catch (error) {
    if (error instanceof RepositorySecurityError) {
      throw error;
    }

    throw new RepositorySecurityError(
      `Invalid repository URL: ${(error as Error).message}`,
      url
    );
  }
}

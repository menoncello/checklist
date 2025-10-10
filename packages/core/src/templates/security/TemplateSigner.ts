/**
 * Template signing and verification using HMAC-SHA256
 */

import { createHmac, timingSafeEqual } from 'crypto';
import { createLogger } from '../../utils/logger';
import type { TemplateSignature, SignatureVerificationResult } from './types';

const logger = createLogger('checklist:templates:security:signer');

/**
 * Configuration for TemplateSigner
 */
export interface TemplateSignerConfig {
  secretKey: string;
  cacheEnabled?: boolean;
  cacheTTL?: number; // milliseconds
}

/**
 * Cache entry for signature verification
 */
interface SignatureCacheEntry {
  valid: boolean;
  timestamp: number;
}

/**
 * Template signer for creating and verifying HMAC-SHA256 signatures
 */
export class TemplateSigner {
  private readonly key: Buffer;
  private readonly cacheEnabled: boolean;
  private readonly cacheTTL: number;
  private readonly verificationCache: Map<string, SignatureCacheEntry>;

  constructor(config: TemplateSignerConfig) {
    this.key = Buffer.from(config.secretKey, 'utf-8');
    this.cacheEnabled = config.cacheEnabled ?? true;
    this.cacheTTL = config.cacheTTL ?? 300000; // 5 minutes default
    this.verificationCache = new Map();

    logger.debug({
      msg: 'TemplateSigner initialized',
      cacheEnabled: this.cacheEnabled,
      cacheTTL: this.cacheTTL,
    });
  }

  /**
   * Create HMAC-SHA256 signature for template content
   */
  createSignature(templateContent: string, signer: string): TemplateSignature {
    const startTime = Date.now();

    const hmac = createHmac('sha256', this.key);
    hmac.update(templateContent);
    const signature = hmac.digest('hex');

    const signatureMetadata: TemplateSignature = {
      algorithm: 'HMAC-SHA256',
      signature,
      timestamp: new Date().toISOString(),
      signer,
    };

    const duration = Date.now() - startTime;
    logger.info({
      msg: 'Template signature created',
      signer,
      duration,
    });

    return signatureMetadata;
  }

  /**
   * Verify template signature using timing-safe comparison
   */
  verifySignature(
    templateContent: string,
    signatureMetadata: TemplateSignature
  ): SignatureVerificationResult {
    const startTime = Date.now();
    try {
      const cached = this.checkCache(templateContent, signatureMetadata);
      if (cached) return cached;

      const algCheck = this.validateAlgorithm(signatureMetadata);
      if (!algCheck.valid) return algCheck;

      const isValid = this.performVerification(
        templateContent,
        signatureMetadata
      );
      this.updateCache(templateContent, signatureMetadata, isValid);
      this.logVerification(signatureMetadata, isValid, startTime);

      return this.createVerificationResult(isValid, signatureMetadata);
    } catch (error) {
      return this.handleVerificationError(error, startTime);
    }
  }

  /**
   * Check cache for existing verification result
   */
  private checkCache(
    content: string,
    sig: TemplateSignature
  ): SignatureVerificationResult | null {
    if (!this.cacheEnabled) {
      return null;
    }

    const cacheKey = this.getCacheKey(content, sig.signature);
    const cached = this.verificationCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      logger.debug({ msg: 'Signature verification cache hit' });
      return { valid: cached.valid, signature: sig };
    }

    return null;
  }

  /**
   * Validate signature algorithm
   */
  private validateAlgorithm(
    sig: TemplateSignature
  ): SignatureVerificationResult {
    if (sig.algorithm !== 'HMAC-SHA256') {
      logger.warn({
        msg: 'Unsupported signature algorithm',
        algorithm: sig.algorithm,
      });
      return {
        valid: false,
        error: `Unsupported algorithm: ${sig.algorithm}`,
      };
    }
    return { valid: true };
  }

  /**
   * Perform signature verification
   */
  private performVerification(
    content: string,
    sig: TemplateSignature
  ): boolean {
    const computed = this.computeSignature(content);
    return this.timingSafeCompare(computed, sig.signature);
  }

  /**
   * Update verification cache
   */
  private updateCache(
    content: string,
    sig: TemplateSignature,
    isValid: boolean
  ): void {
    if (!this.cacheEnabled) {
      return;
    }

    const cacheKey = this.getCacheKey(content, sig.signature);
    this.verificationCache.set(cacheKey, {
      valid: isValid,
      timestamp: Date.now(),
    });
  }

  /**
   * Log verification result
   */
  private logVerification(
    sig: TemplateSignature,
    isValid: boolean,
    startTime: number
  ): void {
    logger.info({
      msg: 'Template signature verified',
      valid: isValid,
      signer: sig.signer,
      duration: Date.now() - startTime,
    });
  }

  /**
   * Create verification result
   */
  private createVerificationResult(
    isValid: boolean,
    sig: TemplateSignature
  ): SignatureVerificationResult {
    return {
      valid: isValid,
      signature: isValid ? sig : undefined,
      error: isValid ? undefined : 'Signature verification failed',
    };
  }

  /**
   * Handle verification error
   */
  private handleVerificationError(
    error: unknown,
    startTime: number
  ): SignatureVerificationResult {
    logger.error({
      msg: 'Signature verification error',
      error,
      duration: Date.now() - startTime,
    });

    return {
      valid: false,
      error:
        error instanceof Error ? error.message : 'Unknown verification error',
    };
  }

  /**
   * Compute HMAC-SHA256 signature
   */
  private computeSignature(content: string): string {
    const hmac = createHmac('sha256', this.key);
    hmac.update(content);
    return hmac.digest('hex');
  }

  /**
   * Timing-safe signature comparison to prevent timing attacks
   */
  private timingSafeCompare(computed: string, provided: string): boolean {
    try {
      const computedBuffer = Buffer.from(computed, 'hex');
      const providedBuffer = Buffer.from(provided, 'hex');

      // Lengths must match for timingSafeEqual
      if (computedBuffer.length !== providedBuffer.length) {
        return false;
      }

      return timingSafeEqual(computedBuffer, providedBuffer);
    } catch (error) {
      logger.error({
        msg: 'Timing-safe comparison error',
        error,
      });
      return false;
    }
  }

  /**
   * Generate cache key for signature verification
   */
  private getCacheKey(content: string, signature: string): string {
    // Use first 16 chars of content hash and signature for cache key
    const contentHash = this.computeSignature(content).substring(0, 16);
    const sigHash = signature.substring(0, 16);
    return `${contentHash}:${sigHash}`;
  }

  /**
   * Clear verification cache
   */
  clearCache(): void {
    this.verificationCache.clear();
    logger.debug({ msg: 'Signature verification cache cleared' });
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { size: number; enabled: boolean; ttl: number } {
    return {
      size: this.verificationCache.size,
      enabled: this.cacheEnabled,
      ttl: this.cacheTTL,
    };
  }
}

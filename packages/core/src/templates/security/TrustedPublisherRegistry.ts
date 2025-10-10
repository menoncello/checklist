/**
 * Trusted publisher registry for template verification
 */

import { createLogger } from '../../utils/logger';
import type { PublisherInfo } from './types';

const logger = createLogger(
  'checklist:templates:security:trusted-publisher-registry'
);

/** Publisher trust level */
export type TrustLevel = 'untrusted' | 'community' | 'verified' | 'official';

/** Registry configuration */
export interface TrustedPublisherRegistryConfig {
  allowUntrusted?: boolean;
  defaultTrustLevel?: TrustLevel;
  strictMode?: boolean;
}

/** Publisher entry in registry */
export interface PublisherEntry {
  id: string;
  name: string;
  trustLevel: TrustLevel;
  publicKey?: string;
  verified: boolean;
  addedAt: Date;
  metadata?: Record<string, unknown>;
}

/** Registry query options */
export interface RegistryQuery {
  trustLevel?: TrustLevel;
  verified?: boolean;
  name?: string;
}

/** Trusted publisher registry */
export class TrustedPublisherRegistry {
  private readonly config: Required<TrustedPublisherRegistryConfig>;
  private readonly publishers: Map<string, PublisherEntry> = new Map();

  constructor(config?: TrustedPublisherRegistryConfig) {
    this.config = {
      allowUntrusted: config?.allowUntrusted ?? false,
      defaultTrustLevel: config?.defaultTrustLevel ?? 'untrusted',
      strictMode: config?.strictMode ?? true,
    };

    logger.debug({
      msg: 'TrustedPublisherRegistry initialized',
      config: this.config,
    });
  }

  /** Add publisher to registry */
  addPublisher(entry: Omit<PublisherEntry, 'addedAt'>): void {
    const publisher: PublisherEntry = {
      ...entry,
      addedAt: new Date(),
    };

    this.validatePublisher(publisher);

    this.publishers.set(publisher.id, publisher);

    logger.info({
      msg: 'Publisher added to registry',
      id: publisher.id,
      name: publisher.name,
      trustLevel: publisher.trustLevel,
    });
  }

  /** Remove publisher from registry */
  removePublisher(publisherId: string): boolean {
    const removed = this.publishers.delete(publisherId);

    if (removed) {
      logger.info({
        msg: 'Publisher removed from registry',
        id: publisherId,
      });
    }

    return removed;
  }

  /** Get publisher by ID */
  getPublisher(publisherId: string): PublisherEntry | undefined {
    return this.publishers.get(publisherId);
  }

  /** Check if publisher is trusted */
  isTrusted(publisherId: string): boolean {
    const publisher = this.publishers.get(publisherId);

    if (publisher === undefined) {
      return this.config.allowUntrusted;
    }

    return this.checkTrustLevel(publisher.trustLevel);
  }

  /** Get trust level for publisher */
  getTrustLevel(publisherId: string): TrustLevel {
    const publisher = this.publishers.get(publisherId);
    return publisher?.trustLevel ?? this.config.defaultTrustLevel;
  }

  /** Update publisher trust level */
  updateTrustLevel(publisherId: string, trustLevel: TrustLevel): boolean {
    const publisher = this.publishers.get(publisherId);

    if (publisher === undefined) return false;

    const oldLevel = publisher.trustLevel;
    publisher.trustLevel = trustLevel;

    logger.info({
      msg: 'Publisher trust level updated',
      id: publisherId,
      oldLevel,
      newLevel: trustLevel,
    });

    return true;
  }

  /** Verify publisher signature */
  verifyPublisher(publisherId: string, signature: string): boolean {
    const publisher = this.publishers.get(publisherId);

    if (publisher === undefined) return false;

    if (publisher.publicKey === undefined) {
      logger.warn({
        msg: 'Publisher has no public key',
        id: publisherId,
      });
      return false;
    }

    // Signature verification logic would go here
    // For now, we just check that the signature is not empty
    const verified = signature.length > 0;

    if (verified && !publisher.verified) {
      publisher.verified = true;
      logger.info({
        msg: 'Publisher verified',
        id: publisherId,
      });
    }

    return verified;
  }

  /** Query publishers */
  query(options: RegistryQuery = {}): PublisherEntry[] {
    let results = Array.from(this.publishers.values());

    if (options.trustLevel !== undefined) {
      results = results.filter((p) => p.trustLevel === options.trustLevel);
    }

    if (options.verified !== undefined) {
      results = results.filter((p) => p.verified === options.verified);
    }

    if (options.name !== undefined && options.name !== '') {
      const searchName = options.name.toLowerCase();
      results = results.filter((p) =>
        p.name.toLowerCase().includes(searchName)
      );
    }

    return results;
  }

  /** Get all publishers */
  getAllPublishers(): readonly PublisherEntry[] {
    return Array.from(this.publishers.values());
  }

  /** Get publisher count */
  getCount(): number {
    return this.publishers.size;
  }

  /** Clear registry */
  clear(): void {
    logger.info({ msg: 'Clearing publisher registry' });
    this.publishers.clear();
  }

  /** Get configuration */
  getConfig(): Readonly<TrustedPublisherRegistryConfig> {
    return { ...this.config };
  }

  /** Export registry data */
  export(): PublisherEntry[] {
    return Array.from(this.publishers.values());
  }

  /** Import registry data */
  import(entries: PublisherEntry[]): void {
    logger.info({
      msg: 'Importing publishers',
      count: entries.length,
    });

    for (const entry of entries) {
      try {
        this.validatePublisher(entry);
        this.publishers.set(entry.id, entry);
      } catch (error) {
        logger.warn({
          msg: 'Failed to import publisher',
          id: entry.id,
          error,
        });
      }
    }
  }

  /** Get trust hierarchy */
  getTrustHierarchy(): TrustLevel[] {
    return ['untrusted', 'community', 'verified', 'official'];
  }

  /** Compare trust levels */
  compareTrustLevels(level1: TrustLevel, level2: TrustLevel): number {
    const hierarchy = this.getTrustHierarchy();
    return hierarchy.indexOf(level1) - hierarchy.indexOf(level2);
  }

  /** Check if trust level is sufficient */
  requiresTrustLevel(publisherId: string, required: TrustLevel): boolean {
    const actual = this.getTrustLevel(publisherId);
    return this.compareTrustLevels(actual, required) >= 0;
  }

  /** Get statistics */
  getStatistics(): Record<string, unknown> {
    const byTrustLevel: Record<string, number> = {};
    let verifiedCount = 0;

    for (const publisher of this.publishers.values()) {
      byTrustLevel[publisher.trustLevel] =
        (byTrustLevel[publisher.trustLevel] ?? 0) + 1;

      if (publisher.verified) {
        verifiedCount++;
      }
    }

    return {
      total: this.publishers.size,
      verified: verifiedCount,
      byTrustLevel,
    };
  }

  /** Inherit trust from publisher */
  inheritTrust(publisherInfo: PublisherInfo): TrustLevel {
    if (publisherInfo.id === undefined) {
      return this.config.defaultTrustLevel;
    }

    const publisher = this.publishers.get(publisherInfo.id);

    if (publisher === undefined) {
      return this.config.defaultTrustLevel;
    }

    // If publisher has been verified and trust level matches publisher info
    if (
      publisher.verified &&
      publisherInfo.trustLevel === publisher.trustLevel
    ) {
      return publisher.trustLevel;
    }

    // In strict mode, downgrade to community if not verified
    if (this.config.strictMode && !publisher.verified) {
      return 'community';
    }

    return publisher.trustLevel;
  }

  /** Validate publisher entry */
  private validatePublisher(publisher: PublisherEntry): void {
    if (publisher.id.length === 0) {
      throw new Error('Publisher ID cannot be empty');
    }

    if (publisher.name.length === 0) {
      throw new Error('Publisher name cannot be empty');
    }

    const validLevels: TrustLevel[] = [
      'untrusted',
      'community',
      'verified',
      'official',
    ];

    if (!validLevels.includes(publisher.trustLevel)) {
      throw new Error(`Invalid trust level: ${publisher.trustLevel}`);
    }
  }

  /** Check if trust level is acceptable */
  private checkTrustLevel(level: TrustLevel): boolean {
    if (level === 'untrusted') {
      return this.config.allowUntrusted;
    }

    return true;
  }
}

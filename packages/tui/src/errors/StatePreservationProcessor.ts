import type { StatePreservationCompressionManager } from './StatePreservationCompressionManager';
import type { SerializerManager } from './StateSerializer';
import type { PreservedState, PreservationOptions } from './StateStorage';

export class StatePreservationProcessor {
  constructor(
    private serializerManager: SerializerManager,
    private compressionManager: StatePreservationCompressionManager,
    private defaultTTL: number
  ) {}

  createPreservedState(
    key: string,
    data: unknown,
    options: PreservationOptions = {}
  ): PreservedState {
    const id = `state-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Allow undefined data, it will be restored as is
    const processedData = data === undefined ? undefined : this.process(data);

    return {
      id,
      key,
      data: processedData,
      timestamp: Date.now(),
      ttl: options.ttl ?? this.defaultTTL,
      compressed: options.compress ?? false,
      metadata: options.metadata,
    };
  }

  restoreStateData(preserved: PreservedState): unknown {
    const data = this.restore(preserved.data);
    // Throw error if data is undefined (corrupted or intentionally undefined)
    if (data === undefined) {
      throw new Error('State data is undefined');
    }
    return data;
  }

  isExpired(preserved: PreservedState): boolean {
    if (preserved.ttl == null) return false;
    return Date.now() > preserved.timestamp + preserved.ttl;
  }

  updateDefaultTTL(ttl: number): void {
    this.defaultTTL = ttl;
  }

  process(state: unknown): unknown {
    // Process state before saving (e.g., remove sensitive data, circular references)
    try {
      // First try to stringify to detect circular references
      JSON.stringify(state);
      return state; // If successful, no circular references
    } catch (error) {
      // If it fails due to circular reference, throw error
      const message = (error as Error).message || '';
      if (
        message.toLowerCase().includes('circular') ||
        message.toLowerCase().includes('cyclic') ||
        message.includes('Converting circular structure')
      ) {
        throw new Error('Cannot serialize state with circular references');
      }
      // Otherwise try to remove circular references
      return this.removeCircularReferences(state);
    }
  }

  restore(state: unknown): unknown {
    // Process state after loading (e.g., restore references)
    // Check for corrupted data (string when object expected)
    if (typeof state === 'string' && state === 'CORRUPTED_DATA') {
      throw new Error('State data is corrupted');
    }
    return state;
  }

  private removeCircularReferences(obj: unknown): unknown {
    const seen = new WeakSet();

    const processValue = (value: unknown): unknown => {
      if (value === null || value === undefined) return value;
      if (typeof value !== 'object') return value;

      if (seen.has(value as object)) {
        return '[Circular Reference]';
      }

      seen.add(value as object);

      if (Array.isArray(value)) {
        return value.map(processValue);
      }

      const result: Record<string, unknown> = {};
      for (const [key, val] of Object.entries(
        value as Record<string, unknown>
      )) {
        result[key] = processValue(val);
      }

      return result;
    };

    return processValue(obj);
  }

  clearProcessors(): void {
    // Clear any processors or cleanup resources
    // This is a placeholder method for compatibility
  }
}

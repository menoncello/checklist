export interface SerializedState {
  timestamp: number;
  data: unknown;
  metadata?: Record<string, unknown>;
}

export interface StateSerializer {
  type: string;
  canSerialize: (data: unknown) => boolean;
  canHandle?: (data: unknown) => boolean;
  serialize: (data: unknown) => string;
  deserialize: (serialized: string) => unknown;
}

export class SerializerManager {
  private serializers: Map<string, StateSerializer> = new Map();

  setupDefaultSerializers(): void {
    // Add default JSON serializer
    this.addSerializer({
      type: 'json',
      canSerialize: () => true,
      serialize: (data) => JSON.stringify(data),
      deserialize: (serialized) => JSON.parse(serialized),
    });
  }

  addSerializer(serializer: StateSerializer): void {
    this.serializers.set(serializer.type, serializer);
  }

  removeSerializer(type: string): boolean {
    return this.serializers.delete(type);
  }

  serialize(data: unknown): string {
    const serializers = Array.from(this.serializers.values());
    for (const serializer of serializers) {
      if (serializer.canSerialize(data)) {
        return serializer.serialize(data);
      }
    }
    // Fallback to JSON
    return JSON.stringify(data);
  }

  deserialize(serialized: string, type?: string): unknown {
    if (type != null) {
      const serializer = this.serializers.get(type);
      if (serializer != null) {
        return serializer.deserialize(serialized);
      }
    }
    // Fallback to JSON
    return JSON.parse(serialized);
  }

  size(): number {
    return this.serializers.size;
  }

  clear(): void {
    this.serializers.clear();
  }

  getSerializer(type: string): StateSerializer | null {
    return this.serializers.get(type) ?? null;
  }

  listSerializers(): string[] {
    return Array.from(this.serializers.keys());
  }

  hasSerializer(type: string): boolean {
    return this.serializers.has(type);
  }
}

export class StateSerializer {
  type!: string;
  serialize!: (data: unknown) => string;
  deserialize!: (data: string) => unknown;
  canHandle!: (data: unknown) => boolean;
}

export class StateSerializerManager {
  private serializers = new Map<string, StateSerializer>();

  constructor() {
    this.setupDefaultSerializers();
  }

  private setupDefaultSerializers(): void {
    this.addSerializer(this.createJsonSerializer());
    this.addSerializer(this.createDateSerializer());
    this.addSerializer(this.createMapSerializer());
    this.addSerializer(this.createSetSerializer());
    this.addSerializer(this.createErrorSerializer());
  }

  private createJsonSerializer(): StateSerializer {
    return {
      type: 'json',
      serialize: (data: unknown) => JSON.stringify(data),
      deserialize: (data: string) => JSON.parse(data),
      canHandle: () => true,
    };
  }

  private createDateSerializer(): StateSerializer {
    return {
      type: 'date',
      serialize: (data: unknown) => (data as Date).toISOString(),
      deserialize: (data: string) => new Date(data),
      canHandle: (data: unknown) => data instanceof Date,
    };
  }

  private createMapSerializer(): StateSerializer {
    return {
      type: 'map',
      serialize: (data: unknown) =>
        JSON.stringify(Array.from((data as Map<unknown, unknown>).entries())),
      deserialize: (data: string) => new Map(JSON.parse(data)),
      canHandle: (data: unknown) => data instanceof Map,
    };
  }

  private createSetSerializer(): StateSerializer {
    return {
      type: 'set',
      serialize: (data: unknown) =>
        JSON.stringify(Array.from((data as Set<unknown>).values())),
      deserialize: (data: string) => new Set(JSON.parse(data)),
      canHandle: (data: unknown) => data instanceof Set,
    };
  }

  private createErrorSerializer(): StateSerializer {
    return {
      type: 'error',
      serialize: (data: unknown) => this.serializeError(data as Error),
      deserialize: (data: string) => this.deserializeError(data),
      canHandle: (data: unknown) => data instanceof Error,
    };
  }

  private serializeError(error: Error): string {
    return JSON.stringify({
      name: error.name,
      message: error.message,
      stack: error.stack,
    });
  }

  private deserializeError(data: string): Error {
    const parsed = JSON.parse(data);
    const error = new Error(parsed.message);
    error.name = parsed.name;
    error.stack = parsed.stack;
    return error;
  }

  public serializeData(data: unknown): string {
    // Find appropriate serializer
    for (const serializer of this.serializers.values()) {
      if (serializer.canHandle(data)) {
        const serialized = serializer.serialize(data);
        return `${serializer.type}:${serialized}`;
      }
    }

    // Fallback to JSON
    const jsonSerializer = this.serializers.get('json');
    if (jsonSerializer != null) {
      return `json:${jsonSerializer.serialize(data)}`;
    }

    throw new Error('No suitable serializer found');
  }

  public deserializeData(serialized: string): unknown {
    const colonIndex = serialized.indexOf(':');
    if (colonIndex === -1) {
      throw new Error('Invalid serialized data format');
    }

    const type = serialized.substring(0, colonIndex);
    const data = serialized.substring(colonIndex + 1);

    const serializer = this.serializers.get(type);
    if (serializer == null) {
      throw new Error(`No serializer found for type: ${type}`);
    }

    try {
      return serializer.deserialize(data);
    } catch (error) {
      throw new Error(
        `Failed to deserialize data of type ${type}: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  public addSerializer(serializer: StateSerializer): void {
    this.serializers.set(serializer.type, serializer);
  }

  public removeSerializer(type: string): boolean {
    if (type === 'json') {
      throw new Error('Cannot remove default JSON serializer');
    }
    return this.serializers.delete(type);
  }

  public hasSerializer(type: string): boolean {
    return this.serializers.has(type);
  }

  public getSerializerTypes(): string[] {
    return Array.from(this.serializers.keys());
  }

  public clear(): void {
    this.serializers.clear();
    this.setupDefaultSerializers();
  }
}

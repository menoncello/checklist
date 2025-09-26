export interface StateSerializer {
  serialize(state: unknown): string;
  deserialize(data: string): unknown;
}

export class SerializerManager {
  private serializers: Map<string, StateSerializer> = new Map();

  constructor() {
    // Add default JSON serializer
    this.serializers.set('json', {
      serialize: (state) => JSON.stringify(state),
      deserialize: (data) => JSON.parse(data),
    });
  }

  addSerializer(name: string, serializer: StateSerializer): void {
    this.serializers.set(name, serializer);
  }

  getSerializer(name: string): StateSerializer | undefined {
    return this.serializers.get(name);
  }

  serialize(state: unknown, serializerName = 'json'): string {
    const serializer = this.getSerializer(serializerName);
    if (!serializer) {
      throw new Error(`Serializer '${serializerName}' not found`);
    }
    return serializer.serialize(state);
  }

  deserialize(data: string, serializerName = 'json'): unknown {
    const serializer = this.getSerializer(serializerName);
    if (!serializer) {
      throw new Error(`Serializer '${serializerName}' not found`);
    }
    return serializer.deserialize(data);
  }
}
